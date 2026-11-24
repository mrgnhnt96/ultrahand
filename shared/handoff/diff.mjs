#!/usr/bin/env node
// Check a running web build against design/<flow>/spec.json, anchor by anchor: tier 1 of the
// handoff (see README.md). It drives the build with ../input/drive.mjs at one preset per size
// class, in light and dark and in each state, then lists what is missing, out of order, worded
// differently, off its token or laid out wrong for the size class. Zero dependencies; Node 22+.
//
//   node diff.mjs --spec design/<flow>/spec.json --url 'http://localhost:5173/{screen}?state={state}'
//     [--routes routes.json]      per screen and state: { "lists": "/", "lists.empty": "/?empty=1" }
//     [--screen lists,list.header] only these screens, sections or members (an anchor or its start)
//     [--preset small,large-landscape] [--scheme light|dark] [--attr data-uh|data-testid]
//     [--accepted design/<flow>/accepted.json] [--tokens <file>] [--root <project>] [--wait 250]
//     [--color-tol 1] [--px-tol 2] [--keep <dir>] [--json] [--port 9333] [--chrome <path>]
//   node diff.mjs --spec … --url … --steps          prints the drive.mjs steps it would run
//   node diff.mjs --spec … --measured <dir>         diffs a pass kept with --keep, without a browser
//
// Exit: 0 when the build matches the spec, 1 on any miss, 2 when it couldn't check.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildIndex } from '../theme/tokens.mjs';
import { DEFAULT_SIZE_CLASSES, parseInspectName, tokenTable } from './spec.mjs';

const DRIVE = fileURLToPath(new URL('../input/drive.mjs', import.meta.url));
export const TOL = { color: 1, px: 2, font: 0.5, columns: 4 };
const KINDS = ['missing', 'order', 'copy', 'token', 'layout'];

const str = (v) => typeof v === 'string' && v.trim() !== '';
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const classOf = (list, px) => list.reduce((at, c) => (px >= c.min ? c.name : at), list[0].name);
const shownIn = (x, state) => !x.states || x.states.includes(state);
const q = (s) => JSON.stringify(String(s));

/* ---------- The plan: which screen, state, preset and scheme to measure, and where ---------- */

/* An anchor filter from --screen: the anchor itself or anything under it. */
export const inScope = (only, anchor) => !only.length || only.some((o) => anchor === o || anchor.startsWith(`${o}.`));
const touches = (only, anchor) => !only.length || only.some((o) => inScope([o], anchor) || o.startsWith(`${anchor}.`));

/* The states a screen needs measuring in: default, and each state a section or member of it
   is limited to or changes in. */
export function statesOf(screen, only = []) {
  const out = new Set(['default']);
  for (const sec of screen.sections) {
    if (!touches(only, sec.anchor)) continue;
    for (const st of sec.states || []) out.add(st);
    for (const m of sec.members) {
      if (!inScope(only, m.anchor) && !inScope(only, sec.anchor)) continue;
      for (const st of m.states || []) out.add(st);
      for (const st of Object.keys(m.when || {})) out.add(st);
    }
  }
  return [...out];
}

/* One preset per width class, the first the spec lists in each. */
export function pickPresets(spec, ids) {
  if (ids && ids.length) {
    return ids.map((id) => {
      const p = spec.presets.find((x) => x.id === id);
      if (!p) throw new Error(`--preset ${id}: the spec's presets are ${spec.presets.map((x) => x.id).join(', ')}`);
      return p;
    });
  }
  const classes = (spec.sizeClasses || DEFAULT_SIZE_CLASSES).width;
  const out = [];
  for (const c of classes) {
    const p = spec.presets.find((x) => classOf(classes, x.width) === c.name);
    if (p) out.push(p);
  }
  return out;
}

/* A URL, or a file path (with an optional ?query or #hash) made a file: URL. */
export function toHref(u, base) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return u;
  if (base && /^https?:/i.test(base)) return new URL(u, base).href;
  const cut = u.search(/[?#]/);
  const [path, rest] = cut < 0 ? [u, ''] : [u.slice(0, cut), u.slice(cut)];
  return pathToFileURL(resolve(path)).href + rest;
}

/* Where a screen in a state is: its --routes entry ("<screen>.<state>", or "<screen>" for the
   default state), else the --url template with {screen} and {state} filled in. A route can be
   { url, steps } when the state needs input to reach (a click that opens a sheet). A state with
   no way in is unreachable. */
export function locate({ url, routes = {}, screen, state, single }) {
  const own = routes[`${screen}.${state}`] ?? (state === 'default' ? routes[screen] : undefined);
  const entry = typeof own === 'string' ? { url: own } : own || null;
  const fill = (t) => t.replaceAll('{screen}', encodeURIComponent(screen)).replaceAll('{state}', encodeURIComponent(state));
  const template = url && (url.includes('{screen}') || single) && (state === 'default' || url.includes('{state}')) ? fill(url) : null;
  const screenRoute = typeof routes[screen] === 'string' ? routes[screen] : routes[screen]?.url;
  const target = entry?.url ?? template ?? (entry && screenRoute) ?? null;
  if (!target) return null;
  return { url: toHref(fill(target), url && fill(url)), steps: entry?.steps || [] };
}

export const runName = (r) => [r.screen, r.preset, r.state === 'default' ? null : r.state, r.scheme === 'dark' ? 'dark' : null]
  .filter(Boolean).join('.');

/**
 * The runs to measure: each screen in scope, in each of its states, at one preset per width
 * class, in each scheme. Returns { runs, unreachable }.
 */
export function plan({ spec, url = null, routes = {}, only = [], presets = null, schemes = ['light', 'dark'] }) {
  const ps = pickPresets(spec, presets);
  const screens = spec.screens.filter((s) => touches(only, s.anchor));
  if (!screens.length) throw new Error(`--screen ${only.join(',')}: the spec's screens are ${spec.screens.map((s) => s.id).join(', ')}`);
  const single = screens.length === 1;
  const runs = [], unreachable = [];
  for (const s of screens) {
    for (const state of statesOf(s, only)) {
      const at = locate({ url, routes, screen: s.id, state, single });
      if (!at) { unreachable.push({ screen: s.id, state }); continue; }
      for (const p of ps) {
        for (const scheme of schemes) {
          const r = { screen: s.id, state, preset: p.id, width: p.width, height: p.height, scheme, url: at.url, steps: at.steps };
          runs.push({ ...r, name: runName(r) });
        }
      }
    }
  }
  return { runs, unreachable };
}

/* ---------- Measuring ---------- */

/* Read in the page: every element with the anchor attribute, through open shadow roots, in
   document order, with its box, whether it is rendered, whether it or an ancestor inside the
   screen is sticky or fixed, and its words. */
export const anchorsScript = (attr) => `(() => {
  const A = ${JSON.stringify(attr)};
  const found = [];
  const walk = (root) => { for (const el of root.querySelectorAll('*')) { if (el.hasAttribute(A)) found.push(el); if (el.shadowRoot) walk(el.shadowRoot); } };
  walk(document);
  const up = (el) => el.parentElement || (el.getRootNode() instanceof ShadowRoot ? el.getRootNode().host : null);
  const clean = (s) => String(s || '').replace(/\\s+/g, ' ').trim().slice(0, 400);
  const boxOf = (el) => {
    let rs = [...el.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
    if (!rs.length && getComputedStyle(el).display === 'contents') rs = [...el.children].flatMap((c) => [...c.getClientRects()]);
    if (!rs.length) return null;
    const l = Math.min(...rs.map((r) => r.left)), t = Math.min(...rs.map((r) => r.top));
    const r = Math.max(...rs.map((x) => x.right)), b = Math.max(...rs.map((x) => x.bottom));
    return [l, t, r - l, b - t].map(Math.round);
  };
  const sticky = (el) => {
    for (let p = el; p && p.nodeType === 1; p = up(p)) {
      if (p !== el && p.hasAttribute(A) && !p.getAttribute(A).includes('.')) break;
      if (/sticky|fixed/.test(getComputedStyle(p).position)) return true;
    }
    return false;
  };
  const anchors = found.map((el, i) => {
    const box = boxOf(el);
    const cs = getComputedStyle(el);
    const seen = !!box && (cs.display === 'contents' || !el.checkVisibility || el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }));
    const field = el.matches('input, textarea') ? el : el.querySelector('input, textarea');
    const text = clean(el.innerText), raw = clean(el.textContent);
    return { a: el.getAttribute(A), i, rendered: seen, box, sticky: seen && sticky(el), text,
      ...(raw !== text ? { raw } : {}), ...(el.getAttribute('aria-label') || el.title ? { label: clean(el.getAttribute('aria-label') || el.title) } : {}),
      ...(field && field.placeholder ? { placeholder: clean(field.placeholder) } : {}) };
  });
  return { viewport: [innerWidth, innerHeight], rem: parseFloat(getComputedStyle(document.documentElement).fontSize) || 16, anchors };
})()`;

/* The drive.mjs steps for the runs, and which step's eval holds each run's anchors. */
export function driveSteps(runs, { attr = 'data-uh', wait = 250 } = {}) {
  const steps = [], evals = {};
  for (const r of runs) {
    steps.push({ size: [r.width, r.height] }, { scheme: r.scheme }, { goto: r.url },
      { wait: `[${attr}="${r.screen}"], [${attr}^="${r.screen}."]`, optional: true }, { wait });
    steps.push(...r.steps);
    steps.push({ inspect: true, name: r.name, quiet: true });
    evals[steps.length] = r.name;
    steps.push({ eval: anchorsScript(attr) });
  }
  return { steps, evals };
}

/* Runs drive.mjs over the runs and saves, beside its inspect-<name>.json files,
   anchors-<name>.json for each. Returns the problems that kept a run from being measured. */
export function measure(runs, { dir, attr, wait, port, chrome, drive = DRIVE }) {
  const { steps, evals } = driveSteps(runs, { attr, wait });
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'steps.json');
  writeFileSync(file, JSON.stringify(steps));
  const args = [drive, 'run', runs[0].url, file, '--out', dir, '--size', `${runs[0].width}x${runs[0].height}`];
  if (port) args.push('--port', String(port));
  if (chrome) args.push('--chrome', chrome);
  const p = spawnSync(process.execPath, args, { encoding: 'utf8', maxBuffer: 256 << 20, timeout: Math.max(120000, runs.length * 30000) });
  if (p.error) return [`drive.mjs: ${p.error.message}`];
  const problems = [];
  let saved = 0;
  for (const line of p.stdout.split('\n')) {
    let l;
    try { l = JSON.parse(line); } catch { continue; }
    if (l.ok && evals[l.i]) { writeFileSync(join(dir, `anchors-${evals[l.i]}.json`), JSON.stringify(l.value)); saved++; }
    /* An optional wait for the screen that times out isn't a failure: the diff reports the
       screen as missing. */
    if (!l.ok && l.step?.optional !== true) problems.push(`${l.step ? `${JSON.stringify(l.step).slice(0, 100)}: ` : ''}${l.error}`);
  }
  if (!problems.length && saved < runs.length) problems.push(norm(p.stderr).slice(0, 300) || `drive.mjs exited ${p.status} after ${saved} of ${runs.length} runs`);
  return problems;
}

/* The runs kept in a folder: inspect-<name>.json with its anchors-<name>.json. */
export function readMeasured(dir) {
  return readdirSync(dir).map((f) => {
    const at = parseInspectName(f);
    if (!at) return null;
    const name = f.replace(/^inspect-/, '').replace(/\.json$/, '');
    const anchorsFile = join(dir, `anchors-${name}.json`);
    const inspect = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    const a = existsSync(anchorsFile) ? JSON.parse(readFileSync(anchorsFile, 'utf8')) : null;
    return { ...at, name, elements: inspect.elements || [], viewport: a?.viewport || inspect.viewport, rem: a?.rem || 16, anchors: a?.anchors || null };
  }).filter(Boolean);
}

/* ---------- Comparing ---------- */

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const isHex = (h) => typeof h === 'string' && /^#[0-9a-f]{6}$/i.test(h);
export const nearColor = (a, b, tol = TOL.color) => isHex(a) && isHex(b) && rgb(a).every((v, i) => Math.abs(v - rgb(b)[i]) <= tol);

/* A section's or member's layout at a width class, cascading up from the smallest, with
   height-compact on top when the height is compact. */
export function layoutAt(layout, classes, cls, heightCompact) {
  const o = {};
  if (!layout) return o;
  for (const c of classes) {
    Object.assign(o, layout[c.name] || {});
    if (c.name === cls) break;
  }
  if (heightCompact) Object.assign(o, layout['height-compact'] || {});
  return o;
}

const edges = ([l, t, w, h]) => ({ left: l, top: t, right: l + w, bottom: t + h });
const unionOf = (boxes) => {
  const bs = boxes.filter(Boolean).map(edges);
  if (!bs.length) return null;
  return { left: Math.min(...bs.map((b) => b.left)), top: Math.min(...bs.map((b) => b.top)),
    right: Math.max(...bs.map((b) => b.right)), bottom: Math.max(...bs.map((b) => b.bottom)) };
};
const overlap = (a, b, lo, hi) => Math.min(a[hi], b[hi]) - Math.max(a[lo], b[lo]);

/* The screen edge chrome sits at: side for a tall box against the left or right edge, top or
   bottom for a wide one against those edges, else where it sits against the content. */
export function placeOf(box, [vw, vh], content, tol = TOL.px) {
  const b = edges(box);
  const tall = box[3] > box[2];
  if (tall && (b.left <= tol || b.right >= vw - tol)) return 'side';
  if (!tall && b.top <= tol) return 'top';
  if (!tall && b.bottom >= vh - tol) return 'bottom';
  if (!content) return null;
  if ((b.right <= content.left + tol || b.left >= content.right - tol) && overlap(b, content, 'top', 'bottom') > tol) return 'side';
  if (b.bottom <= content.top + tol) return 'top';
  return (b.top + b.bottom) / 2 > (content.top + content.bottom) / 2 ? 'bottom' : 'top';
}

/* Distinct left edges among boxes, or null with fewer than two. */
export function columnsOf(boxes, tol = TOL.columns) {
  const lefts = boxes.filter(Boolean).map((b) => b[0]).sort((a, b) => a - b);
  if (lefts.length < 2) return null;
  let n = 1;
  for (let i = 1; i < lefts.length; i++) if (lefts[i] - lefts[i - 1] > tol) n++;
  return n;
}

const toPx = (v, rem) => {
  const m = String(v).match(/^\s*([\d.]+)\s*(px|rem|em)?\s*$/);
  return m ? Number(m[1]) * (m[2] === 'rem' || m[2] === 'em' ? rem : 1) : null;
};

/* A pattern such as "{n} items · {left} left" as a regex for the words around its slots. */
export const patternRe = (p) => new RegExp(norm(p).split(/\{[^}]*\}/).map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.+?'));

const words = (r) => [r.text, r.raw].filter(str).map(norm);
const says = (r, want) => words(r).some((t) => t === norm(want));
const holds = (r, want) => words(r).some((t) => t.includes(norm(want))) || norm(r.label) === norm(want);
const shownText = (r) => norm(r.text || r.raw) || '(no text)';

/**
 * Compare measured runs with the spec. `theme` is a buildIndex index or null (no token check).
 * Returns { misses, accepted, warnings, runs } where each miss is
 * { kind, anchor, section, what, spec, build, at: [{ state, preset, scheme }] }, grouped across runs.
 */
export function diff({ spec, runs, theme = null, accepted = [], only = [], attr = 'data-uh', tol = TOL }) {
  const classes = (spec.sizeClasses || DEFAULT_SIZE_CLASSES).width;
  const hMin = (spec.sizeClasses?.height || DEFAULT_SIZE_CLASSES.height)[1]?.min ?? 480;
  const table = theme ? tokenTable(theme) : null;
  const colors = new Map((table?.colors || []).map((t) => [t.path, t]));
  const types = new Map((table?.types || []).map((t) => [t.path, t]));
  const known = new Set();
  for (const s of spec.screens) {
    known.add(s.anchor);
    for (const sec of s.sections) {
      known.add(sec.anchor);
      for (const m of sec.members) {
        known.add(m.anchor);
        for (const it of m.items || []) if (it.anchor) known.add(it.anchor);
      }
    }
  }
  const memberAnchors = new Set(spec.screens.flatMap((s) => s.sections.flatMap((x) => x.members.map((m) => m.anchor))));
  const groups = new Map(), warnings = new Map();
  const warn = (text, at) => {
    if (!warnings.has(text)) warnings.set(text, []);
    if (at) warnings.get(text).push(at);
  };
  const elKey = attr === 'data-testid' ? 'testid' : 'uh';

  for (const run of runs) {
    const screen = spec.screens.find((s) => s.id === run.screen);
    const preset = spec.presets.find((p) => p.id === run.preset);
    if (!screen || !preset) continue;
    const at = { state: run.state, preset: run.preset, scheme: run.scheme };
    if (!run.anchors) { warn(`${run.name}: no anchors measured; run it again without --measured`, null); continue; }
    const add = (kind, anchor, section, what, specV, buildV) => {
      const key = [kind, anchor, what, specV, buildV].join('\u0000');
      if (!groups.has(key)) groups.set(key, { kind, anchor, section, what, spec: specV, build: buildV, at: [] });
      groups.get(key).at.push(at);
    };
    const cls = classOf(classes, preset.width);
    const hc = preset.height < hMin;
    const vp = run.viewport || [preset.width, preset.height];
    const recs = new Map();
    for (const r of run.anchors) {
      if (!recs.has(r.a)) recs.set(r.a, []);
      recs.get(r.a).push(r);
    }
    const pick = (a) => { const l = recs.get(a) || []; return l.find((r) => r.rendered) || l[0] || null; };
    const seen = (a) => { const r = pick(a); return r && r.rendered ? r : null; };
    const els = (a) => run.elements.filter((e) => e.font && str(e[elKey]) && (e[elKey] === a || e[elKey].startsWith(`${a}.`)));

    /* Screen: its anchor, and its sections in order (chrome and content apart, since where
       chrome sits is the place check's). */
    if (inScope(only, screen.anchor)) {
      if (!seen(screen.anchor)) add('missing', screen.anchor, screen.anchor, null, 'the screen', pick(screen.anchor) ? 'not rendered' : 'absent');
      for (const role of ['chrome', 'content']) {
        const want = screen.sections.filter((x) => x.role === role && shownIn(x, run.state) && seen(x.anchor));
        const got = [...want].sort((a, b) => seen(a.anchor).i - seen(b.anchor).i);
        if (want.some((x, i) => x !== got[i])) add('order', screen.anchor, screen.anchor, `${role} sections`, want.map((x) => x.id).join(', '), got.map((x) => x.id).join(', '));
      }
    }

    for (const sec of screen.sections) {
      if (!touches(only, sec.anchor)) continue;
      const secIn = inScope(only, sec.anchor);
      if (!shownIn(sec, run.state)) {
        if (secIn && seen(sec.anchor)) add('layout', sec.anchor, sec.anchor, 'states', `only in ${sec.states.join(', ')}`, `shown in ${run.state}`);
        continue;
      }
      const secRec = seen(sec.anchor);
      const live = sec.members.filter((m) => shownIn(m, run.state));
      const showOf = (m) => layoutAt(m.layout, classes, cls, hc).show || (m.rare ? 'more' : 'visible');
      if (!secRec && !live.some((m) => pick(m.anchor))) {
        if (secIn) add('missing', sec.anchor, sec.anchor, null, 'the section', pick(sec.anchor) ? 'not rendered' : 'absent');
        continue;
      }
      if (secIn && !secRec) add('missing', sec.anchor, sec.anchor, null, 'the section', pick(sec.anchor) ? 'not rendered' : 'absent');

      /* Members: there, shown as the size class says, in order, with their words and tokens. */
      for (const m of sec.members) {
        if (!inScope(only, m.anchor) && !secIn) continue;
        const r = pick(m.anchor);
        if (!shownIn(m, run.state)) {
          if (r?.rendered) add('layout', m.anchor, sec.anchor, 'states', `only in ${m.states.join(', ')}`, `shown in ${run.state}`);
          continue;
        }
        const show = showOf(m);
        if (show === 'visible' && !r) { add('missing', m.anchor, sec.anchor, null, `a ${m.kind}`, 'absent'); continue; }
        if (show === 'visible' && !r.rendered) { add('layout', m.anchor, sec.anchor, 'show', 'visible', 'hidden'); continue; }
        if (show !== 'visible' && r?.rendered) { add('layout', m.anchor, sec.anchor, 'show', show, 'visible'); continue; }
        if (!r?.rendered) continue;
        for (const [what, s, b] of copyOf(m, run.state, r, recs, seen)) add(what === 'missing' ? 'missing' : 'copy', s.anchor || m.anchor, sec.anchor, s.anchor ? null : what, s.want, b);
        if (table && m.tokens) tokensOf(m, run, els(m.anchor), colors, types, tol, warn, (what, s, b) => add('token', m.anchor, sec.anchor, what, s, b));
      }
      if (secIn) {
        const want = live.filter((m) => showOf(m) === 'visible' && seen(m.anchor));
        const got = [...want].sort((a, b) => seen(a.anchor).i - seen(b.anchor).i);
        if (want.some((x, i) => x !== got[i])) add('order', sec.anchor, sec.anchor, 'members', want.map((x) => x.id).join(', '), got.map((x) => x.id).join(', '));
      }
      if (!secIn || !secRec) continue;

      /* The section's own background token. */
      const bgTok = sec.tokens?.background;
      if (table && bgTok) {
        const t = colors.get(bgTok);
        const bgs = els(sec.anchor).map((e) => e.bg).filter(isHex);
        const counts = new Map();
        for (const b of bgs) counts.set(b, (counts.get(b) || 0) + 1);
        const got = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
        if (!t) warn(`token ${bgTok} isn't an opaque colour in the token file; not checked`);
        else if (got && !nearColor(got, t[run.scheme], tol.color)) add('token', sec.anchor, sec.anchor, 'background', `${bgTok} ${t[run.scheme]}`, got);
      }

      /* Layout at this size class. */
      const L = layoutAt(sec.layout, classes, cls, hc);
      if (sec.role === 'chrome') {
        const wantPlace = L.place || sec.place;
        const content = unionOf(screen.sections.filter((x) => x.role === 'content' && shownIn(x, run.state)).map((x) => seen(x.anchor)?.box));
        const got = placeOf(secRec.box, vp, content, tol.px);
        if (wantPlace && got && got !== wantPlace) add('layout', sec.anchor, sec.anchor, 'place', wantPlace, got);
        if (typeof L.sticky === 'boolean' && L.sticky !== !!secRec.sticky) add('layout', sec.anchor, sec.anchor, 'sticky', String(L.sticky), String(!!secRec.sticky));
      } else {
        if (typeof L.beside === 'boolean') {
          const primary = unionOf(screen.sections.filter((x) => x.role === 'content' && (x.pane || 'primary') === 'primary' && shownIn(x, run.state)).map((x) => seen(x.anchor)?.box));
          if (primary) {
            const b = edges(secRec.box);
            const got = overlap(b, primary, 'top', 'bottom') > tol.px && overlap(b, primary, 'left', 'right') <= tol.px;
            if (got !== L.beside) add('layout', sec.anchor, sec.anchor, 'beside', String(L.beside), String(got));
          }
        }
        const rows = sec.members.filter((m) => m.kind === 'list').flatMap((m) => (recs.get(`${m.anchor}.row`) || []).filter((r) => r.rendered).map((r) => r.box));
        const cols = columnsOf(rows, tol.columns);
        const wantCols = L.columns ?? 1;
        if (cols != null && cols !== wantCols) add('layout', sec.anchor, sec.anchor, 'columns', String(wantCols), String(cols));
        const max = L.maxWidth != null ? toPx(L.maxWidth, run.rem || 16) : null;
        if (max != null && secRec.box[2] > max + tol.px) add('layout', sec.anchor, sec.anchor, 'maxWidth', `${L.maxWidth} (${Math.round(max)}px)`, `${secRec.box[2]}px`);
      }
    }

    /* Anchors the build shows that the spec doesn't have: a warning, not a miss. Parts of a
       known member (rows, nav items) and other screens' anchors are left alone. */
    for (const [a] of recs) {
      if (known.has(a) || !seen(a)) continue;
      const parent = [...memberAnchors].some((m) => a.startsWith(`${m}.`));
      const elsewhere = spec.screens.some((s) => s.id !== screen.id && (a === s.anchor || a.startsWith(`${s.anchor}.`)));
      if (!parent && !elsewhere && inScope(only, a.split('.').slice(0, 2).join('.'))) warn(`extra ${a}: in the build, not in the spec`, at);
    }
  }

  /* Accepted departures come off the list of misses. */
  const misses = [], ok = [];
  for (const g of groups.values()) {
    const dep = accepted.find((d) => d.anchor === g.anchor && d.check === g.kind);
    if (dep) ok.push({ ...g, why: dep.why, approved: dep.approved });
    else misses.push(g);
  }
  const sectionOrder = spec.screens.flatMap((s) => [s.anchor, ...s.sections.map((x) => x.anchor)]);
  const byPlace = (a, b) => sectionOrder.indexOf(a.section) - sectionOrder.indexOf(b.section) || KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind);
  misses.sort(byPlace);
  return {
    misses, accepted: ok,
    warnings: [...warnings.entries()].map(([text, at]) => ({ text, at })),
    runs: runs.length,
  };
}

/* What a member says against what the spec says: [what, { want, anchor? }, build]. A nav
   item that isn't there comes back as 'missing' with its own anchor. */
function copyOf(m, state, r, recs, seen) {
  const w = { ...m, ...(m.when?.[state] || {}) };
  const out = [];
  const fixed = (w.copy || 'fixed') === 'fixed';
  if (['field', 'toggle', 'stat'].includes(m.kind) && str(w.label) && !holds(r, w.label)) out.push(['label', { want: q(w.label) }, shownText(r)]);
  if (str(w.placeholder) && norm(r.placeholder) !== norm(w.placeholder)) out.push(['placeholder', { want: q(w.placeholder) }, r.placeholder ? q(r.placeholder) : '(none)']);
  if (['title', 'text', 'button', 'image'].includes(m.kind) && str(w.name) && !str(w.text) && norm(r.label) !== norm(w.name)) {
    out.push(['name', { want: q(w.name) }, r.label ? q(r.label) : '(none)']);
  }
  if (['title', 'text', 'button'].includes(m.kind) && str(w.text) && fixed && !says(r, w.text)) out.push(['text', { want: q(w.text) }, q(shownText(r))]);
  if (!fixed && m.kind !== 'list') {
    const rest = norm(words(r)[0] || '').replace(norm(w.label || ''), '').trim();
    if (!rest) out.push(['text', { want: 'sample words' }, '(empty)']);
    else if (str(w.pattern) && !words(r).some((t) => patternRe(w.pattern).test(t))) out.push(['text', { want: `the pattern ${q(w.pattern)}` }, q(shownText(r))]);
  }
  if (m.kind === 'list') {
    const rows = (recs.get(`${m.anchor}.row`) || []).filter((x) => x.rendered);
    if (!rows.length && !words(r).length) out.push(['rows', { want: 'rows with words' }, '(empty)']);
    if (str(w.pattern)) {
      const bad = rows.filter((x) => !words(x).some((t) => patternRe(w.pattern).test(t)));
      if (bad.length) out.push(['rows', { want: `the pattern ${q(w.pattern)}` }, `${bad.length} of ${rows.length} rows don't fit, such as ${q(shownText(bad[0]))}`]);
    }
  }
  if (m.kind === 'nav') {
    for (const it of m.items || []) {
      if (!it.anchor) continue;
      const x = seen(it.anchor);
      if (!x) out.push(['missing', { want: `a nav item${str(it.text) ? ` ${q(it.text)}` : ''}`, anchor: it.anchor }, 'absent']);
      else if (fixed && str(it.text) && !says(x, it.text) && norm(x.label) !== norm(it.text)) out.push(['text', { want: q(it.text), anchor: it.anchor }, q(shownText(x))]);
    }
  }
  return out;
}

/* A member's measured colours and type against its tokens, in the run's scheme. */
function tokensOf(m, run, list, colors, types, tol, warn, add) {
  if (!list.length) return;
  const w = { ...m, ...(m.when?.[run.state] || {}) };
  const tokens = { ...m.tokens, ...(w.tokens || {}) };
  const want = [w.text, w.label, w.placeholder].find(str);
  const main = list.find((e) => want && norm(e.text) === norm(want).slice(0, 50)) || list[0];
  for (const key of ['color', 'background']) {
    const path = tokens[key];
    if (!path) continue;
    const t = colors.get(path);
    if (!t) { warn(`token ${path} isn't an opaque colour in the token file; not checked`); continue; }
    const got = key === 'color' ? main.fg : main.bg;
    if (isHex(got) && !nearColor(got, t[run.scheme], tol.color)) add(key, `${path} ${t[run.scheme]}`, got);
  }
  if (tokens.type) {
    const t = types.get(tokens.type);
    const [size, weight] = String(main.font || '').split('/').map(Number);
    if (!t) warn(`token ${tokens.type} isn't a type style in the token file; not checked`);
    else if (size && ((t.size != null && Math.abs(t.size - size) > tol.font) || (t.weight != null && weight && t.weight !== weight))) {
      add('type', `${tokens.type} ${t.size}px/${t.weight}`, `${size}px/${weight}`);
    }
  }
}

/* ---------- Report ---------- */

const uniq = (xs) => [...new Set(xs)];
export function where(at) {
  return [uniq(at.map((a) => a.state)), uniq(at.map((a) => a.preset)), uniq(at.map((a) => a.scheme))].map((x) => x.join(', ')).join(' · ');
}

export function report(r, { unreachable = [], checked = '' } = {}) {
  const lines = [];
  let section = null;
  for (const m of r.misses) {
    if (m.section !== section) { section = m.section; lines.push(section); }
    lines.push(`  ${m.kind.padEnd(8)} ${m.anchor}${m.what ? ` ${m.what}` : ''}: spec ${m.spec}, build ${m.build}  [${where(m.at)}]`);
  }
  if (r.accepted.length) {
    lines.push('accepted');
    for (const m of r.accepted) lines.push(`  ${m.kind.padEnd(8)} ${m.anchor}${m.what ? ` ${m.what}` : ''}: ${m.why || 'accepted'}${m.approved ? ` (${m.approved})` : ''}`);
  }
  const warns = [...unreachable.map((u) => `unreachable ${u.screen} · ${u.state}: no route; give --routes "${u.state === 'default' ? u.screen : `${u.screen}.${u.state}`}" or {state} in --url`),
    ...r.warnings.map((w) => w.text + (w.at.length ? `  [${where(w.at)}]` : ''))];
  if (warns.length) {
    lines.push('warnings');
    for (const w of warns) lines.push(`  ${w}`);
  }
  const n = r.misses.length;
  const secs = new Set(r.misses.map((m) => m.section)).size;
  lines.push(`${n ? `${n} miss${n === 1 ? '' : 'es'} in ${secs} section${secs === 1 ? '' : 's'}` : 'matches the spec'}`
    + `${r.accepted.length ? `, ${r.accepted.length} accepted` : ''}${warns.length ? `, ${warns.length} warning${warns.length === 1 ? '' : 's'}` : ''}`
    + ` (${r.runs} run${r.runs === 1 ? '' : 's'}${checked ? `: ${checked}` : ''})`);
  return lines.join('\n');
}

/* ---------- CLI ---------- */

function args(argv) {
  const o = { flags: new Set() };
  const valued = ['spec', 'url', 'routes', 'screen', 'preset', 'scheme', 'attr', 'accepted', 'tokens', 'root', 'wait',
    'color-tol', 'px-tol', 'keep', 'measured', 'port', 'chrome'];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const k = a.replace(/^--/, '');
    if (a === '-h' || a === '--help') o.flags.add('help');
    else if (a === '--steps' || a === '--json') o.flags.add(k);
    else if (a.startsWith('--') && valued.includes(k)) {
      if (argv[i + 1] === undefined) throw new Error(`${a} needs a value`);
      o[k] = argv[++i];
    } else throw new Error(`unknown argument ${a}`);
  }
  return o;
}

const readJson = (path, what) => {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch (e) { throw new Error(`can't read ${what} ${path}: ${e.message}`); }
};
const list = (v) => (v ? String(v).split(',').map((s) => s.trim()).filter(Boolean) : []);
const usage = () => {
  const lines = readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1);
  return lines.slice(0, lines.findIndex((l) => !l.startsWith('//'))).map((l) => l.replace(/^\/\/ ?/, '')).join('\n');
};

export function main(argv = process.argv.slice(2)) {
  const o = args(argv);
  if (o.flags.has('help') || !o.spec || (!o.url && !o.routes && !o.measured)) {
    console.log(usage());
    return o.flags.has('help') ? 0 : 2;
  }
  const spec = readJson(o.spec, 'spec');
  if (spec.spec !== 1) throw new Error(`${o.spec}: spec version ${spec.spec}; this check reads version 1`);
  const attr = o.attr || 'data-uh';
  if (!['data-uh', 'data-testid'].includes(attr)) throw new Error('--attr is data-uh or data-testid');
  const only = list(o.screen);
  const schemes = o.scheme ? [o.scheme] : ['light', 'dark'];
  if (!schemes.every((s) => s === 'light' || s === 'dark')) throw new Error('--scheme is light or dark');
  const routes = o.routes ? readJson(o.routes, 'routes') : {};
  const { runs, unreachable: noRoute } = plan({ spec, url: o.url || null, routes, only, presets: list(o.preset), schemes });
  /* A kept pass says itself what was measured. */
  const unreachable = o.measured ? [] : noRoute;
  if (o.flags.has('steps')) {
    process.stdout.write(JSON.stringify(driveSteps(runs, { attr, wait: Number(o.wait ?? 250) }).steps, null, 1) + '\n');
    for (const u of unreachable) console.warn(`diff: warning: ${u.screen} in ${u.state} has no route; not checked`);
    return 0;
  }

  const root = o.root || process.cwd();
  const tokensFile = o.tokens || (spec.theme?.tokens ? join(root, spec.theme.tokens) : null);
  let theme = null;
  if (tokensFile && existsSync(tokensFile)) theme = buildIndex(readJson(tokensFile, 'token file'));
  else if (tokensFile) console.warn(`diff: warning: no token file at ${tokensFile} (--tokens, --root); the token check is skipped`);
  const acceptedFile = o.accepted || join(dirname(o.spec), 'accepted.json');
  const accepted = existsSync(acceptedFile) ? readJson(acceptedFile, 'accepted departures') : [];

  let measured;
  if (o.measured) measured = readMeasured(o.measured).filter((r) => runs.some((x) => x.name === r.name) || (!o.url && !o.routes && touches(only, r.screen)));
  else {
    if (!runs.length) throw new Error('no screen has a route: give --url with {screen}, or --routes');
    const dir = o.keep ? resolve(o.keep) : mkdtempSync(join(tmpdir(), 'uh-diff-'));
    try {
      const problems = measure(runs, { dir, attr, wait: Number(o.wait ?? 250), port: o.port, chrome: o.chrome });
      if (problems.length) {
        console.error(`diff: couldn't measure the build:\n${uniq(problems).map((p) => `  - ${p}`).join('\n')}`);
        return 2;
      }
      measured = readMeasured(dir);
    } finally {
      if (!o.keep) rmSync(dir, { recursive: true, force: true });
    }
  }
  if (!measured.length) throw new Error(o.measured ? `no inspect-<screen>.<preset>….json in ${o.measured}` : 'nothing was measured');
  const tol = { ...TOL, ...(o['color-tol'] ? { color: Number(o['color-tol']) } : {}), ...(o['px-tol'] ? { px: Number(o['px-tol']) } : {}) };
  const r = diff({ spec, runs: measured, theme, accepted, only, attr, tol });
  const screens = uniq(measured.map((x) => x.screen)).length;
  const checked = `${screens} screen${screens === 1 ? '' : 's'} × ${uniq(measured.map((x) => `${x.preset}`)).length} presets × ${uniq(measured.map((x) => x.scheme)).length} schemes${!theme ? ', no token check' : ''}`;
  if (o.flags.has('json')) process.stdout.write(JSON.stringify({ ...r, unreachable }, null, 1) + '\n');
  else console.log(report(r, { unreachable, checked }));
  return r.misses.length ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = main(); } catch (e) { console.error(`diff: ${e.message}`); process.exitCode = 2; }
}
