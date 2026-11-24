#!/usr/bin/env node
// Generate design/<flow>/spec.json for a handoff (see README.md) from the approved design's
// blueprint.json, its parts.json and an inspect pass over the built design. Zero
// dependencies; Node 18+.
//
//   node spec.mjs --blueprint blueprint/blueprint.json --presets <skill>/references/presets.md \
//     [--parts blueprint/parts.json] [--inventory design/THEME.md] [--tokens design/theme.tokens.json] \
//     [--inspect <dir>] [--previous design/<flow>/spec.json] [--platform mobile] [--locale en] \
//     [--artifact <url>] [--round <n>] [--approved <date>] [--title "…"] [--out design/<flow>/spec.json]
//     [--root <project>]   the folder the spec's theme path is relative to (default: the current one)
//   node spec.mjs --steps --blueprint … --presets …     prints the drive.mjs steps for the inspect pass
//
// Warnings go to stderr. Problems in the blueprint stop it.

import { readFileSync, readdirSync, writeFileSync, mkdirSync, realpathSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { check as checkBlueprint } from '../blueprint/greybox.mjs';
import { readInventory } from '../blueprint/parts.mjs';
import { buildIndex, resolve as resolveAlias, valueIn, parseColor, toHex, parseDimension } from '../theme/tokens.mjs';

export const SPEC_VERSION = 1;

/* Material 3's window size classes, as on the canvas (shared/canvas/README.md). */
export const DEFAULT_SIZE_CLASSES = {
  width: [
    { name: 'compact', min: 0 }, { name: 'medium', min: 600 }, { name: 'expanded', min: 840 },
    { name: 'large', min: 1200 }, { name: 'extra-large', min: 1600 },
  ],
  height: [{ name: 'compact', min: 0 }, { name: 'medium', min: 480 }, { name: 'expanded', min: 900 }],
};

const str = (v) => typeof v === 'string' && v.trim() !== '';
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
/* One anchor segment: lowercase letters, digits and single dashes. */
export const slug = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const SEGMENT = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/* A member named by its words takes the first five, so a paragraph doesn't become its anchor. */
const WORDS = 5;
const LABEL_FIRST = ['field', 'toggle', 'stat'];
const classOf = (list, px) => list.reduce((at, c) => (px >= c.min ? c.name : at), list[0].name);

/* ---------- Anchors ---------- */

/* A member's own segment: its id, else a slug of its words (label first for a field, toggle or
   stat, whose text is a value), else its kind. */
export function memberSlug(m) {
  if (str(m.id)) return slug(m.id) || m.kind;
  const words = LABEL_FIRST.includes(m.kind) ? [m.label, m.text] : [m.text, m.label];
  for (const w of words) if (str(w) && slug(w)) return slug(w).split('-').slice(0, WORDS).join('-');
  return m.kind;
}

/* The words that identify a member across rounds, for keeping its anchor through a copy edit. */
const copyKey = (m) => [m.kind, m.text, m.label, m.placeholder,
  ...(Array.isArray(m.items) ? m.items.map((it) => (typeof it === 'string' ? it : it?.text)) : [])]
  .map(norm).join('|');

/* Gives each member of a section its segment, keeping the previous spec's ids where a member
   matches one there: first by its words, then by its place among members of its kind. */
function memberIds(members, prev) {
  const ids = new Array(members.length);
  const from = new Array(members.length);
  const taken = new Set();
  const prevMembers = prev ? prev.members || [] : [];
  members.forEach((m, i) => {
    const p = prevMembers.find((q, j) => !taken.has(j) && q.kind === m.kind && copyKey(q) === copyKey(m));
    if (p) { const j = prevMembers.indexOf(p); taken.add(j); from[i] = p; }
  });
  members.forEach((m, i) => {
    if (from[i]) return;
    const nth = members.slice(0, i).filter((q) => q.kind === m.kind).length;
    const same = prevMembers.map((q, j) => [q, j]).filter(([q]) => q.kind === m.kind);
    const hit = same[nth];
    if (hit && !taken.has(hit[1])) { taken.add(hit[1]); from[i] = hit[0]; }
  });
  members.forEach((m, i) => {
    const base = str(m.id) ? memberSlug(m) : from[i] && SEGMENT.test(from[i].id || '') ? from[i].id : memberSlug(m);
    let id = base, n = 1;
    while (ids.includes(id)) id = `${base}-${++n}`;
    ids[i] = id;
  });
  return { ids, from };
}

/* ---------- Parts ---------- */

const KIND_WORDS = {
  button: ['button'], field: ['field', 'input', 'textarea'], toggle: ['toggle', 'switch', 'checkbox'],
  list: ['list', 'row'], nav: ['tab', 'nav', 'rail', 'navigation'], image: ['image', 'photo', 'picture', 'media'],
  stat: ['stat', 'metric'], title: ['title', 'heading'], text: ['text', 'paragraph'],
};
const UNPARTED = ['title', 'text', 'stat'];

/* The parts of parts.json as { id, name, component, variant, part, usedIn, kind }. */
export function partsList(doc) {
  return (doc && Array.isArray(doc.parts) ? doc.parts : []).map((p) => ({
    id: str(p.id) ? p.id : slug(p.name),
    name: p.name,
    component: p.status === 'reused' ? p.component || p.name : p.name,
    variant: p.variant ?? null,
    part: p.status === 'new' ? 'new' : 'reused',
    usedIn: Array.isArray(p.usedIn) ? p.usedIn.map((u) => norm(u).toLowerCase()) : [],
    kind: p.kind,
  }));
}

/* The part that draws a member: the one its `part` names, else the one part of its kind used on
   the screen, preferring a primary variant for the emphasis and another for the rest. */
export function matchPart(m, screen, parts) {
  if (!parts.length) return { part: null };
  if (str(m.part)) {
    const want = m.part.toLowerCase();
    const hit = parts.find((p) => p.id === want || p.id === slug(want) || norm(p.name).toLowerCase() === want);
    return hit ? { part: hit } : { part: null, warning: `names part "${m.part}", which parts.json doesn't have` };
  }
  const words = KIND_WORDS[m.kind] || [m.kind];
  const where = [screen.id, screen.title].map((s) => norm(s).toLowerCase());
  let pool = parts.filter((p) => (p.kind ? p.kind === m.kind
    : words.some((w) => `${p.name} ${p.component}`.toLowerCase().includes(w))));
  pool = pool.filter((p) => !p.usedIn.length || p.usedIn.some((u) => where.includes(u)));
  if (pool.length > 1) {
    const primary = (p) => /primary|filled/.test(`${p.variant || ''} ${p.name}`.toLowerCase());
    const narrowed = pool.filter((p) => primary(p) === !!m.emphasis);
    if (narrowed.length) pool = narrowed;
  }
  if (pool.length === 1) return { part: pool[0] };
  if (!pool.length) return { part: null, warning: UNPARTED.includes(m.kind) ? null : 'matched no part in parts.json; give it "part" in the blueprint' };
  return { part: pool[0], warning: `could be ${pool.map((p) => `"${p.name}${p.variant ? ` (${p.variant})` : ''}"`).join(' or ')}; took the first. Give it "part" in the blueprint` };
}

/* ---------- Tokens ---------- */

const WEIGHTS = { thin: 100, hairline: 100, 'extra-light': 200, 'ultra-light': 200, light: 300, normal: 400, regular: 400, book: 400,
  medium: 500, 'semi-bold': 600, 'demi-bold': 600, bold: 700, 'extra-bold': 800, 'ultra-bold': 800, black: 900, heavy: 900 };
const weightOf = (v) => (typeof v === 'number' ? v : Number(v) || WEIGHTS[slug(v)] || null);
const hex6 = (c) => (c && (c.a ?? 1) >= 1 ? toHex({ ...c, a: 1 }) : null);

/* The semantic and component tokens a measured style can map to: colours with their light and
   dark hex, type styles with their size, weight, line height and family. */
export function tokenTable(index) {
  const colors = [], types = [];
  for (const t of index.tokens.values()) {
    if (t.tier !== 'semantic' && t.tier !== 'component') continue;
    try {
      if (t.type === 'color') {
        const light = hex6(parseColor(valueIn(index, t, 'light')));
        const dark = hex6(parseColor(valueIn(index, t, 'dark')));
        if (light) colors.push({ path: t.path, tier: t.tier, light, dark: dark || light });
      } else if (t.type === 'typography') {
        const v = valueIn(index, t, 'light');
        if (!v || typeof v !== 'object') continue;
        const get = (k) => (v[k] === undefined ? undefined : resolveAlias(index, v[k]));
        const size = parseDimension(get('fontSize'));
        const lh = get('lineHeight');
        const family = get('fontFamily');
        types.push({
          path: t.path, tier: t.tier, size, weight: weightOf(get('fontWeight')),
          lineHeight: typeof lh === 'number' ? lh * size : parseDimension(lh),
          family: Array.isArray(family) ? family[0] : family,
        });
      }
    } catch { /* a broken alias is check.mjs's to report */ }
  }
  return { colors, types };
}

/* Prefer the member's own component tokens, then names that fit the role, then semantic ones. */
function rank(cands, key, component) {
  const own = component ? `component.${slug(component).split('-')[0]}` : null;
  const hint = key === 'background' ? /(^|[.-])(bg|background|fill|surface|container)([.-]|$)/
    : key === 'border' ? /(border|outline)/ : /(^|[.-])(on|fg|text|color|foreground)([.-]|$)/;
  const bad = key === 'background' ? /(^|\.)on-/ : null;
  const score = (t) => [own && t.path.startsWith(own) ? 0 : 1, bad && bad.test(t.path) ? 1 : 0,
    hint.test(t.path) ? 0 : 1, t.tier === 'semantic' ? 0 : 1];
  return [...cands].sort((a, b) => {
    const x = score(a), y = score(b);
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
    return a.path.localeCompare(b.path);
  });
}

/* The colour token for a measured value in light and dark, or null with the reason. */
export function matchColor(table, light, dark, key, component) {
  const L = light && light.toLowerCase(), D = dark && dark.toLowerCase();
  const both = table.colors.filter((t) => (!L || t.light === L) && (!D || t.dark === D));
  if (both.length) return { token: rank(both, key, component)[0].path };
  const lightOnly = L && D ? table.colors.filter((t) => t.light === L) : [];
  if (lightOnly.length) return { token: null, why: `${L} in light matches ${rank(lightOnly, key, component)[0].path}, but no token with that light value is ${D} in dark` };
  return { token: null, why: `${[L && `${L} (light)`, D && `${D} (dark)`].filter(Boolean).join(', ')} matches no token` };
}

/* The type token for a measured style: size and weight, and line height and family when the
   inspect pass gives them. */
export function matchType(table, font, component) {
  const cands = table.types.filter((t) => t.size != null && Math.abs(t.size - font.size) <= 0.5
    && (t.weight == null || t.weight === font.weight)
    && (font.lineHeight == null || t.lineHeight == null || Math.abs(t.lineHeight - font.lineHeight) <= 0.5)
    && (font.family == null || t.family == null || norm(t.family).toLowerCase() === norm(font.family).toLowerCase()));
  if (cands.length) return { token: rank(cands, 'type', component)[0].path };
  return { token: null, why: `${font.size}px/${font.weight}${font.family ? ` ${font.family}` : ''} matches no type token` };
}

/* ---------- Inputs ---------- */

/* Presets from a skill's presets.md (its first ```json block) or a .json file, with a rotated
   entry for each when the skill designs in landscape. */
export function readPresets(text) {
  const block = text.trimStart().startsWith('{') ? text : (text.match(/```json\s*\n([\s\S]*?)```/) || [])[1];
  if (!block) throw new Error('presets: no ```json block');
  const cfg = JSON.parse(block);
  const list = (cfg.presets || []).map((p) => ({ id: p.id, width: p.width, height: p.height }));
  const out = [...list];
  if ((cfg.orientations || []).includes('landscape')) {
    for (const p of list) if (p.height > p.width) out.push({ id: `${p.id}-landscape`, width: p.height, height: p.width });
  }
  return { platform: cfg.device || null, presets: out, sizeClasses: cfg.sizeClasses || null };
}

/* inspect-<screen>.<preset>[.<state>][.dark|.light].json → { screen, preset, state, scheme }. */
export function parseInspectName(file) {
  const m = String(file).match(/(?:^|[\\/])inspect-([^\\/]+)\.json$/);
  if (!m) return null;
  const parts = m[1].split('.');
  if (parts.length < 2) return null;
  const [screen, preset, ...rest] = parts;
  let scheme = 'light', state = 'default';
  for (const r of rest) {
    if (r === 'dark' || r === 'light') scheme = r;
    else state = r;
  }
  return { screen, preset, state, scheme };
}

export function readInspectDir(dir) {
  return readdirSync(dir).map((f) => {
    const at = parseInspectName(f);
    if (!at) return null;
    const data = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    return { ...at, elements: Array.isArray(data.elements) ? data.elements : [], scale: data.scale || 1, file: f };
  }).filter(Boolean);
}

/* ---------- Measuring ---------- */

const fontOf = (el) => {
  const [size, weight] = String(el.font || '').split('/').map(Number);
  if (!size) return null;
  return { size, weight: weight || 400, lineHeight: el.lineHeight ?? null, family: el.family ?? null };
};
const boxOf = (els) => {
  const bs = els.filter((e) => Array.isArray(e.box)).map((e) => e.box);
  if (!bs.length) return null;
  const l = Math.min(...bs.map((b) => b[0])), t = Math.min(...bs.map((b) => b[1]));
  const r = Math.max(...bs.map((b) => b[0] + b[2])), btm = Math.max(...bs.map((b) => b[1] + b[3]));
  return { left: l, top: t, right: r, bottom: btm };
};

/* The strings a member shows, its main one first. */
function memberStrings(m) {
  const items = Array.isArray(m.items) ? m.items.map((it) => (typeof it === 'string' ? { text: it } : it || {})) : [];
  const first = m.kind === 'field' || m.kind === 'toggle' ? [m.label, m.text] : [m.text, m.label];
  return [...first, m.placeholder, ...items.flatMap((it) => [it.text, it.meta])].filter(str).map(norm);
}

/* Which inspect elements belong to which member and section of a screen in one run. With
   `uh` on the elements (the nearest data-uh anchor), by anchor; without, by the words. */
export function assign(screen, run) {
  const byMember = new Map(), bySection = new Map(), extra = new Set();
  const anchored = run.elements.some((e) => str(e.uh));
  const shown = (x) => !x.states || x.states.includes(run.state);
  if (anchored) {
    const members = new Map(), sections = new Map();
    for (const sec of screen.sections) {
      sections.set(sec.anchor, sec);
      for (const m of sec.members) members.set(m.anchor, m);
    }
    for (const e of run.elements) {
      if (!str(e.uh)) continue;
      let a = e.uh, hit = null;
      while (a && !hit) {
        if (members.has(a)) hit = ['m', a];
        else if (sections.has(a)) hit = ['s', a];
        else a = a.includes('.') ? a.slice(0, a.lastIndexOf('.')) : '';
      }
      if (!hit) { if (e.uh !== screen.anchor) extra.add(e.uh); continue; }
      const map = hit[0] === 'm' ? byMember : bySection;
      if (!map.has(hit[1])) map.set(hit[1], []);
      map.get(hit[1]).push(e);
    }
  } else {
    const claimed = new Set();
    for (const sec of screen.sections) {
      if (!shown(sec)) continue;
      for (const m of sec.members) {
        if (m.rare || !shown(m)) continue;
        const got = [];
        for (const s of memberStrings(m.source)) {
          const want = s.slice(0, 50);
          const i = run.elements.findIndex((e, k) => !claimed.has(k) && norm(e.text) === want);
          if (i >= 0) { claimed.add(i); got.push(run.elements[i]); }
        }
        if (got.length) byMember.set(m.anchor, got);
      }
    }
  }
  for (const sec of screen.sections) {
    const els = [...(bySection.get(sec.anchor) || []), ...sec.members.flatMap((m) => byMember.get(m.anchor) || [])];
    if (els.length) bySection.set(sec.anchor, els);
  }
  return { anchored, byMember, bySection, extra };
}

const mode = (values) => {
  const n = new Map();
  for (const v of values) if (v) n.set(v, (n.get(v) || 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
};

/* Distinct left edges among a list's rows, or null with fewer than two rows. */
function columnsOf(els, tol) {
  const lefts = els.filter((e) => Array.isArray(e.box)).map((e) => e.box[0]).sort((a, b) => a - b);
  if (lefts.length < 2) return null;
  let n = 1;
  for (let i = 1; i < lefts.length; i++) if (lefts[i] - lefts[i - 1] > tol) n++;
  return n;
}

/* Where chrome sits against the content in one run: top, bottom or side. */
function placeOf(box, content) {
  if (!box || !content) return null;
  const vOverlap = Math.min(box.bottom, content.bottom) - Math.max(box.top, content.top) > 2;
  if ((box.right <= content.left + 2 || box.left >= content.right - 2) && vOverlap) return 'side';
  if (box.bottom <= content.top + 2) return 'top';
  return (box.top + box.bottom) / 2 > (content.top + content.bottom) / 2 ? 'bottom' : 'top';
}

/* ---------- Layout ---------- */

/* The layout the blueprint implies, per width class: the greybox's rules (blueprint README). */
function blueprintLayout(sec, screenSrc, classes) {
  const first = classes.width[0].name;
  const at = (min) => classes.width.find((c) => c.min >= min)?.name;
  const L = {};
  const put = (cls, k, v) => { if (cls) (L[cls] ||= {})[k] = v; };
  if (sec.role === 'chrome') {
    const place = sec.place === 'side' ? sec.compactPlace || 'bottom' : sec.place;
    if (place !== 'side') put(first, 'sticky', true);
    if (sec.place === 'side') put(at(600), 'place', 'side');
  } else {
    const hasSecondary = screenSrc.sections.some((s) => s.role === 'content' && s.pane === 'secondary');
    if ((sec.pane || 'primary') === 'secondary') { put(first, 'beside', false); put(at(840), 'beside', true); }
    else if (!hasSecondary) put(at(840), 'maxWidth', '60rem');
  }
  if (sec.role === 'chrome' && sec.place !== 'side') L['height-compact'] = { sticky: false };
  return L;
}

/* The value of a key at a class, cascading up from the nearest smaller class that sets it. */
const cascade = (L, classes, cls, key, base) => {
  let v = base;
  for (const c of classes.width) {
    if (L[c.name] && key in L[c.name]) v = L[c.name][key];
    if (c.name === cls) break;
  }
  return v;
};

/* Writes a key's value per class compactly: only where it changes going up. */
function setPerClass(L, classes, key, values, base) {
  for (const c of classes.width) if (L[c.name]) delete L[c.name][key];
  let prev = base;
  for (const c of classes.width) {
    const v = values[c.name];
    if (v === undefined || v === prev) continue;
    (L[c.name] ||= {})[key] = v;
    prev = v;
  }
  for (const k of Object.keys(L)) if (!Object.keys(L[k]).length) delete L[k];
}

/* ---------- The generator ---------- */

/**
 * Build a spec. Inputs are parsed already: blueprint and parts as JSON, inventory from
 * readInventory, theme as a buildIndex index, presets from readPresets, inspect from
 * readInspectDir, previous as the last published spec.
 * Returns { spec, warnings, errors }.
 */
export function generate({
  blueprint, parts = null, inventory = null, theme = null, tokensPath = null, presets,
  platform = null, inspect = [], previous = null, design = {}, locale = 'en', title = null,
}) {
  const errors = [], warnings = [];
  const bp = checkBlueprint(blueprint);
  if (bp.errors.length) return { spec: null, errors: bp.errors, warnings: bp.warnings };
  warnings.push(...bp.warnings.map((w) => `blueprint: ${w}`));
  if (!presets || !presets.presets.length) return { spec: null, errors: ['presets: none given'], warnings };

  const classes = presets.sizeClasses || DEFAULT_SIZE_CLASSES;
  const plist = presets.presets;
  const byWidth = [...plist].sort((a, b) => a.width - b.width);
  const table = theme ? tokenTable(theme) : null;
  if (!theme) warnings.push('no theme (--tokens): token fields are null and the token check is skipped');
  const partList = partsList(parts);
  if (!parts) warnings.push('no parts.json (--parts): members carry no component');
  const prevScreens = new Map((previous?.screens || []).map((s) => [s.id, s]));
  const renamed = {};
  /* Measured values that match no token, grouped by value: { "<key> <why>": [anchors] }. */
  const raw = new Map();
  const rawValue = (anchor, what) => { if (!raw.has(what)) raw.set(what, []); raw.get(what).push(anchor); };
  const states = (Array.isArray(blueprint.states) && blueprint.states.length ? blueprint.states : ['default'])
    .map((s) => (typeof s === 'string' ? { id: s } : s));

  /* Screens, sections and members with their anchors. `source` keeps the blueprint member. */
  const screens = blueprint.screens.map((s) => {
    const sid = slug(s.id);
    const prevScreen = prevScreens.get(sid);
    const usedNames = new Set(s.sections.map((x) => slug(x.name)));
    const sections = s.sections.map((sec, xi) => {
      const id = slug(sec.name);
      let prevSec = prevScreen?.sections.find((p) => p.id === id);
      if (!prevSec && prevScreen) {
        const cand = prevScreen.sections[xi];
        if (cand && cand.role === sec.role && !usedNames.has(cand.id)) {
          prevSec = cand;
          renamed[cand.anchor] = `${sid}.${id}`;
        }
      }
      const { ids, from } = memberIds(sec.members, prevSec);
      const members = sec.members.map((m, mi) => {
        const anchor = `${sid}.${id}.${ids[mi]}`;
        if (from[mi] && from[mi].anchor && from[mi].anchor !== anchor) renamed[from[mi].anchor] = anchor;
        return { id: ids[mi], anchor, source: m, rare: !!m.rare, states: m.states };
      });
      return { id, anchor: `${sid}.${id}`, source: sec, members, states: sec.states };
    });
    return { id: sid, anchor: sid, source: s, sections };
  });

  const anchors = new Set();
  for (const s of screens) for (const a of [s.anchor, ...s.sections.flatMap((x) => [x.anchor, ...x.members.map((m) => m.anchor)])]) {
    if (!a.split('.').every((seg) => SEGMENT.test(seg))) errors.push(`anchor "${a}" isn't lowercase letters, digits and dashes`);
    if (anchors.has(a)) errors.push(`anchor "${a}" is used twice`);
    anchors.add(a);
  }
  if (errors.length) return { spec: null, errors, warnings };

  /* The token for a measured colour, or null with a warning; undefined when nothing was measured. */
  const colorToken = (anchor, key, l, d, component) => {
    if (!l && !d) return undefined;
    const r = matchColor(table, l, d, key, component);
    if (!r.token) rawValue(anchor, `${key} ${r.why}`);
    return r.token;
  };

  /* Runs of the inspect pass, by screen. */
  const presetIds = new Set(plist.map((p) => p.id));
  for (const r of inspect) {
    if (!presetIds.has(r.preset)) warnings.push(`inspect ${r.file || r.preset}: preset "${r.preset}" isn't in the presets; skipped`);
    if (!screens.some((s) => s.id === r.screen)) warnings.push(`inspect ${r.file || r.screen}: no screen "${r.screen}" in the blueprint; skipped`);
  }
  const runsOf = (sid) => inspect.filter((r) => r.screen === sid && presetIds.has(r.preset));
  const presetOf = (id) => plist.find((p) => p.id === id);
  const order = (a, b) => plist.indexOf(presetOf(a.preset)) - plist.indexOf(presetOf(b.preset));

  const out = screens.map((s) => {
    const runs = runsOf(s.id).map((r) => ({ ...r, ...assign(s, r) }));
    if (inspect.length && !runs.length) warnings.push(`${s.anchor}: no inspect pass for this screen; tokens and measured layout are left out`);
    for (const r of runs) for (const a of r.extra) warnings.push(`${s.anchor}: the design has anchor "${a}", which the blueprint doesn't; add it to the blueprint or remove it`);
    /* The token runs: the first preset with default-state data, in light and in dark. */
    const pick = (scheme, state = 'default') => runs.filter((r) => r.scheme === scheme && r.state === state).sort(order)[0];
    const tokenRun = (state) => ({ light: pick('light', state), dark: pick('dark', state) });
    const stateFor = (x) => (x.states && !x.states.includes('default') ? x.states[0] : 'default');
    const els = (run, anchor, map = 'byMember') => (run ? run[map].get(anchor) || [] : []);

    const sections = s.sections.map((sec) => {
      const src = sec.source;
      const tr = tokenRun(stateFor(sec));
      const secEls = { light: els(tr.light, sec.anchor, 'bySection'), dark: els(tr.dark, sec.anchor, 'bySection') };
      const secBg = { light: mode(secEls.light.map((e) => e.bg)), dark: mode(secEls.dark.map((e) => e.bg)) };
      const o = { id: sec.id, anchor: sec.anchor, name: src.name, job: src.job, role: src.role };
      if (src.role === 'chrome') o.place = src.place === 'side' ? src.compactPlace || 'bottom' : src.place;
      else o.pane = src.pane || 'primary';
      if (src.states) o.states = src.states;
      if (theme && (secBg.light || secBg.dark)) {
        const t = colorToken(sec.anchor, 'background', secBg.light, secBg.dark);
        if (t !== undefined) o.tokens = { background: t };
      }

      /* Layout: the blueprint's, then what the design measures at one preset per class. */
      const L = blueprintLayout(src, s.source, classes);
      const measured = {};
      for (const c of classes.width) {
        const run = runs.filter((r) => r.state === stateFor(sec) && classOf(classes.width, presetOf(r.preset).width) === c.name)
          .sort((a, b) => (a.scheme === 'light' ? 0 : 1) - (b.scheme === 'light' ? 0 : 1) || order(a, b))[0];
        if (!run) continue;
        const box = boxOf(els(run, sec.anchor, 'bySection'));
        if (!box) continue;
        const m = (measured[c.name] = {});
        const others = s.sections.filter((x) => x !== sec && (!x.states || x.states.includes(run.state)));
        if (src.role === 'chrome') {
          const content = boxOf(others.filter((x) => x.source.role === 'content').flatMap((x) => els(run, x.anchor, 'bySection')));
          const p = placeOf(box, content);
          if (p) m.place = p;
        } else if ((src.pane || 'primary') === 'secondary') {
          const primary = boxOf(others.filter((x) => x.source.role === 'content' && (x.source.pane || 'primary') === 'primary')
            .flatMap((x) => els(run, x.anchor, 'bySection')));
          if (primary) {
            const v = Math.min(box.bottom, primary.bottom) - Math.max(box.top, primary.top) > 2;
            const h = Math.min(box.right, primary.right) - Math.max(box.left, primary.left) > 2;
            m.beside = v && !h;
          }
        }
        if (src.role === 'content') {
          const list = sec.members.find((x) => x.source.kind === 'list' && (x.source.items || []).length > 1);
          if (list) {
            const rowText = new Set((list.source.items || []).map((it) => norm(typeof it === 'string' ? it : it.text).slice(0, 50)));
            const cols = columnsOf(els(run, list.anchor).filter((e) => rowText.has(norm(e.text))), 4 * (run.scale || 1));
            if (cols) m.columns = cols;
          }
        }
      }
      const base = { place: o.place, beside: undefined, columns: 1 };
      for (const key of ['place', 'beside', 'columns']) {
        const got = Object.entries(measured).filter(([, m]) => key in m);
        if (!got.length) continue;
        /* The design's value where it was measured. A class that wasn't measured keeps the class
           below it, unless the blueprint changes the value there. */
        const values = {};
        let cur = base[key];
        for (const c of classes.width) {
          const bpv = cascade(L, classes, c.name, key, base[key]);
          const m = measured[c.name];
          if (m && key in m) {
            if (key !== 'columns' && bpv !== undefined && bpv !== m[key]) {
              warnings.push(`${sec.anchor}: the design has ${key} ${JSON.stringify(m[key])} at ${c.name}, the blueprint ${JSON.stringify(bpv)}; the spec follows the design`);
            }
            cur = m[key];
          } else if (L[c.name] && key in L[c.name]) cur = L[c.name][key];
          values[c.name] = cur;
        }
        if (key === 'place') {
          o.place = values[classes.width[0].name] ?? o.place;
          setPerClass(L, classes, key, values, o.place);
        } else setPerClass(L, classes, key, values, base[key]);
      }
      if (Object.keys(L).length) o.layout = L;

      o.members = sec.members.map((mm) => memberSpec(mm, sec, s, { tr: tokenRun(stateFor(mm.states ? mm : sec)), runs, secBg }));
      return o;
    });
    return { id: s.id, anchor: s.anchor, title: s.source.title, sections };
  });

  function memberSpec(mm, sec, s, { tr, runs, secBg }) {
    const m = mm.source;
    const o = { id: mm.id, anchor: mm.anchor, kind: m.kind };
    for (const k of ['text', 'label', 'placeholder', 'meta']) if (str(m[k])) o[k] = m[k];
    if (Array.isArray(m.items)) {
      o.items = m.items.map((it) => {
        const x = typeof it === 'string' ? { text: it } : { ...it };
        x.anchor = m.kind === 'nav' && str(x.nav) ? `${mm.anchor}.${slug(x.nav)}` : `${mm.anchor}.row`;
        return x;
      });
    }
    if (str(m.name)) o.name = m.name;
    o.copy = m.copy || (m.kind === 'list' || m.kind === 'stat' ? 'sample' : 'fixed');
    if (str(m.pattern)) o.pattern = m.pattern;
    if (m.emphasis) o.emphasis = true;
    if (m.rare) o.rare = true;
    if (m.nav !== undefined) o.nav = m.nav;
    if (m.back) o.back = true;

    const pm = matchPart(m, s.source, partList);
    if (pm.warning) warnings.push(`${mm.anchor}: ${pm.warning}`);
    o.component = pm.part ? pm.part.component : null;
    o.variant = pm.part ? pm.part.variant : null;
    o.part = pm.part ? pm.part.part : null;
    if (pm.part && pm.part.part === 'reused' && inventory && !inventory.components.some((c) => c.component.toLowerCase() === String(pm.part.component).toLowerCase())) {
      warnings.push(`${mm.anchor}: component "${pm.part.component}" isn't in the theme inventory`);
    }

    /* The design's words win over the blueprint's when an anchor ties them together. */
    const main = (run) => {
      const list = run ? run.byMember.get(mm.anchor) || [] : [];
      const want = memberStrings(m)[0];
      return list.find((e) => want && norm(e.text) === want.slice(0, 50)) || list[0] || null;
    };
    const L = main(tr.light), D = main(tr.dark);
    if (tr.light?.anchored && L && ['title', 'text', 'button'].includes(m.kind) && str(m.text)) {
      const got = norm(L.text);
      if (got && got !== norm(m.text) && got.length < 50) {
        warnings.push(`${mm.anchor}: the design says "${got}", the blueprint "${norm(m.text)}"; the spec uses the design's words`);
        o.text = got;
      }
    }
    if (!theme) o.tokens = null;
    else if (L || D) {
      const t = {};
      const comp = o.component;
      const c = colorToken(mm.anchor, 'color', L?.fg, D?.fg, comp);
      if (c !== undefined) t.color = c;
      const ownFill = ['button', 'field'].includes(m.kind)
        || (L?.bg && secBg.light && L.bg !== secBg.light) || (D?.bg && secBg.dark && D.bg !== secBg.dark);
      if (ownFill && (L?.bg || D?.bg)) {
        const b = colorToken(mm.anchor, 'background', L?.bg, D?.bg, comp);
        if (b !== undefined) t.background = b;
      }
      const f = fontOf(L || D);
      if (f) {
        const r = matchType(table, f, comp);
        if (!r.token) rawValue(mm.anchor, `type ${r.why}`);
        t.type = r.token;
      }
      o.tokens = t;
    } else if (tr.light || tr.dark) {
      if (!m.rare) warnings.push(`${mm.anchor}: found nothing for it in the inspect pass; its tokens are left out`);
    }
    if (mm.states) o.states = mm.states;
    if (m.when) o.when = m.when;

    /* show: rare members sit behind More; an anchored member missing at a class is hidden. */
    const layout = {};
    if (m.rare) layout[classes.width[0].name] = { show: 'more' };
    else {
      const values = {};
      for (const c of classes.width) {
        const run = runs.filter((r) => r.anchored && classOf(classes.width, presetOf(r.preset).width) === c.name
          && (!sec.states || sec.states.includes(r.state)) && (!mm.states || mm.states.includes(r.state)))[0];
        if (run) values[c.name] = run.byMember.has(mm.anchor) ? 'visible' : 'hidden';
      }
      setPerClass(layout, classes, 'show', values, 'visible');
    }
    if (m.layout) Object.assign(layout, m.layout);
    if (Object.keys(layout).length) o.layout = layout;
    return o;
  }

  const shots = [byWidth[0].id, byWidth[byWidth.length - 1].id].filter((v, i, a) => a.indexOf(v) === i);
  const spec = {
    spec: SPEC_VERSION,
    title: title || blueprint.title || null,
    platform: platform || presets.platform || null,
    design: { artifact: design.artifact ?? null, round: design.round ?? null, approved: design.approved ?? null },
    theme: theme ? { tokens: tokensPath, version: inventory?.version || theme.meta?.version || null } : null,
    locale,
    sizeClasses: classes,
    presets: plist,
    shots,
    states,
    screens: out,
  };
  if (Object.keys(renamed).length) spec.renamed = renamed;
  for (const [what, list] of raw) {
    const shown = list.slice(0, 3).join(', ') + (list.length > 3 ? ` and ${list.length - 3} more` : '');
    warnings.push(`${what}, so the design used a raw value: ${shown}`);
  }
  return { spec, errors, warnings: [...new Set(warnings)] };
}

/* ---------- The inspect pass ---------- */

/**
 * The drive.mjs steps that measure the built design for generate(): each screen at one preset
 * per width class, in light and dark, in the default state and in each state that a section of
 * the screen is limited to. Each inspect is named <screen>.<preset>[.<state>][.dark].
 */
export function inspectSteps({ blueprint, presets }) {
  const classes = presets.sizeClasses || DEFAULT_SIZE_CLASSES;
  const portrait = new Set(presets.presets.filter((p) => !p.id.endsWith('-landscape')).map((p) => p.id));
  const perClass = [];
  for (const c of classes.width) {
    const p = presets.presets.find((x) => classOf(classes.width, x.width) === c.name);
    if (p) perClass.push(p);
  }
  const steps = [];
  for (const s of blueprint.screens) {
    const states = new Set(['default']);
    for (const sec of s.sections) for (const st of sec.states || []) states.add(st);
    for (const st of states) {
      for (const p of perClass) {
        for (const scheme of ['light', 'dark']) {
          const size = portrait.has(p.id) ? `ultrahandCanvas.usePreset(${JSON.stringify(p.id)})` : `ultrahandCanvas.setSize(${p.width}, ${p.height})`;
          steps.push({ eval: `ultrahandCanvas.navigate(${JSON.stringify(s.id)}, { replace: true }); ultrahandCanvas.setState(${JSON.stringify(st)}); ${size}; ultrahandCanvas.setScheme(${JSON.stringify(scheme)})` });
          steps.push({ wait: 150 });
          steps.push({ inspect: '.uh-viewport', name: [slug(s.id), p.id, st === 'default' ? null : st, scheme === 'dark' ? 'dark' : null].filter(Boolean).join('.') });
        }
      }
    }
  }
  return steps;
}

/* ---------- CLI ---------- */

function args(argv) {
  const o = { flags: new Set() };
  const valued = ['blueprint', 'parts', 'inventory', 'tokens', 'presets', 'inspect', 'previous', 'platform',
    'locale', 'artifact', 'round', 'approved', 'title', 'out', 'root'];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const k = a.replace(/^--/, '');
    if (a === '-h' || a === '--help') o.flags.add('help');
    else if (a === '--steps') o.flags.add('steps');
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
/* The comment at the top of this file, up to the first line that isn't one. */
const usage = () => {
  const lines = readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1);
  return lines.slice(0, lines.findIndex((l) => !l.startsWith('//'))).map((l) => l.replace(/^\/\/ ?/, '')).join('\n');
};

export function main(argv = process.argv.slice(2)) {
  const o = args(argv);
  if (o.flags.has('help') || !o.blueprint || !o.presets) {
    console.log(usage());
    return o.flags.has('help') ? 0 : 2;
  }
  const blueprint = readJson(o.blueprint, 'blueprint');
  const presets = readPresets(readFileSync(o.presets, 'utf8'));
  if (o.flags.has('steps')) {
    const b = checkBlueprint(blueprint);
    if (b.errors.length) throw new Error(`blueprint problems:\n  - ${b.errors.join('\n  - ')}`);
    process.stdout.write(JSON.stringify(inspectSteps({ blueprint, presets }), null, 1) + '\n');
    return 0;
  }
  const parts = o.parts ? readJson(o.parts, 'parts') : null;
  const invPath = o.inventory || (parts?.inventory && o.parts ? join(dirname(o.parts), parts.inventory) : null);
  const inventory = invPath ? readInventory(readFileSync(invPath, 'utf8')) : null;
  const theme = o.tokens ? buildIndex(readJson(o.tokens, 'token file')) : null;
  const tokensPath = o.tokens ? relative(realpathSync(o.root || process.cwd()), realpathSync(o.tokens)).split(sep).join('/') : null;
  const inspect = o.inspect ? readInspectDir(o.inspect) : [];
  if (o.inspect && !inspect.length) console.warn(`spec: warning: no inspect-<screen>.<preset>….json files in ${o.inspect}`);
  const previous = o.previous ? readJson(o.previous, 'previous spec') : null;
  const r = generate({
    blueprint, parts, inventory, theme, tokensPath, presets, platform: o.platform, inspect, previous,
    design: { artifact: o.artifact, round: o.round === undefined ? undefined : Number(o.round), approved: o.approved },
    locale: o.locale || 'en', title: o.title,
  });
  for (const w of r.warnings) console.warn(`spec: warning: ${w}`);
  if (r.errors.length) {
    console.error(`spec: ${r.errors.length} problem${r.errors.length === 1 ? '' : 's'}:\n${r.errors.map((e) => `  - ${e}`).join('\n')}`);
    return 1;
  }
  const json = JSON.stringify(r.spec, null, 2) + '\n';
  if (o.out) {
    mkdirSync(dirname(resolve(o.out)), { recursive: true });
    writeFileSync(resolve(o.out), json);
    const n = r.spec.screens.reduce((a, s) => a + s.sections.reduce((b, x) => b + x.members.length, 0), 0);
    console.error(`spec: wrote ${o.out} (${r.spec.screens.length} screens, ${n} members, ${r.warnings.length} warning${r.warnings.length === 1 ? '' : 's'})`);
  } else process.stdout.write(json);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = main(); } catch (e) { console.error(`spec: ${e.message}`); process.exitCode = 1; }
}
