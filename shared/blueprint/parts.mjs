#!/usr/bin/env node
// Build a parts sheet: every component a design will use, on the ultrahand canvas, before
// the full design is drawn. Each part is either reused from the theme's component inventory
// (design/THEME.md) or proposed new, and is shown in each of its states with a one-line note
// on why the design needs it. Zero dependencies; Node 18+.
//
//   node parts.mjs parts.json [--inventory design/THEME.md] [--head theme.html]
//                  [--presets presets.md] [--title "Trail log parts"] [--out index.html]
//                  [--work dir] [--no-build] [--check]
//
// It checks parts.json, writes parts.screen.html and parts.config.json (into --work, default
// the folder of --out), then runs ../canvas/build.mjs with them. --no-build stops after
// writing them; --check only checks. The format is in README.md ("Parts sheet").

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, join, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/* The states a part can show, in the order the sheet shows them. `force` names the
   pseudo-classes the sheet turns on for that state (see forceSelector). */
export const STATES = [
  { id: 'default', label: 'Default' },
  { id: 'hover', label: 'Hover', force: 'hover' },
  { id: 'pressed', label: 'Pressed', force: 'hover active' },
  { id: 'focus', label: 'Focus', force: 'focus' },
  { id: 'disabled', label: 'Disabled', attrs: 'disabled' },
  { id: 'error', label: 'Error', attrs: 'aria-invalid="true"' },
  { id: 'long', label: 'Longest text' },
];
const CANON = Object.fromEntries(STATES.map((s) => [s.id, s]));
const INTERACTIVE = ['default', 'hover', 'pressed', 'focus', 'disabled'];

/* Neutral stand-ins for the theme roles, used when no theme is given. They keep the
   non-negotiables in shared/theme/rules.md: the required roles (NN-5) in both schemes
   (NN-3) with measured contrast (NN-4), spacing on the 8-point grid (NN-2), a short radius
   scale (NN-7), rem type on a scale (NN-6) and a 2px focus ring (NN-10). Greys on purpose:
   colour is the theme's decision, not the parts sheet's. */
export const FALLBACK = {
  '--color-surface': 'light-dark(#fafafa, #141414)',
  '--color-surface-raised': 'light-dark(#ffffff, #222222)',
  '--color-on-surface': 'light-dark(#1a1a1a, #ebebeb)',
  '--color-on-surface-variant': 'light-dark(#4a4a4a, #c4c4c4)',
  '--color-outline': 'light-dark(#767676, #8f8f8f)',
  '--color-primary': 'light-dark(#2e2e2e, #e0e0e0)',
  '--color-on-primary': 'light-dark(#ffffff, #1a1a1a)',
  '--color-primary-container': 'light-dark(#e6e6e6, #3a3a3a)',
  '--color-on-primary-container': 'light-dark(#1a1a1a, #f0f0f0)',
  '--color-error': 'light-dark(#b3261e, #f2b8b5)',
  '--color-on-error': 'light-dark(#ffffff, #601410)',
  '--color-focus-ring': 'light-dark(#1a1a1a, #f5f5f5)',
  '--space-inset-tight': '8px',
  '--space-inset': '16px',
  '--space-inset-loose': '24px',
  '--space-gap-related': '8px',
  '--space-gap-group': '16px',
  '--space-gap-section': '32px',
  '--radius-control': '4px',
  '--radius-container': '8px',
  '--radius-pill': '9999px',
  '--focus-width': '2px',
  '--focus-offset': '2px',
  '--motion-duration-feedback': '120ms',
  '--motion-duration-move': '240ms',
  '--motion-easing': 'cubic-bezier(0.2, 0, 0, 1)',
  ...typeRole('headline', '1.75rem', 600, 1.25),
  ...typeRole('title', '1.25rem', 600, 1.4),
  ...typeRole('body', '1rem', 400, 1.5),
  ...typeRole('label', '0.875rem', 500, 1.43),
};
function typeRole(role, size, weight, lineHeight) {
  return {
    [`--type-${role}-font-family`]: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    [`--type-${role}-font-size`]: size,
    [`--type-${role}-font-weight`]: String(weight),
    [`--type-${role}-letter-spacing`]: '0px',
    [`--type-${role}-line-height`]: String(lineHeight),
  };
}

/* ---------- Forcing hover, pressed and focus ---------- */

/* Rewrites one selector so a state can be shown without the pointer or keyboard: each
   :hover, :active, :focus, :focus-visible and :focus-within also matches the element the
   sheet marks with data-pt-hover, data-pt-active or data-pt-focus, and (for :hover,
   :active and :focus-within) any element that contains it. Real interaction still works.
   A pseudo-class inside :not() is left alone. This runs in the page, on the parsed sheet,
   so it is written to be serialised: no closures, ES5 only. */
export function forceSelector(sel) {
  var MAP = {
    hover: ['hover', true], active: ['active', true],
    focus: ['focus', false], 'focus-visible': ['focus', false], 'focus-within': ['focus', true],
  };
  var out = '', i = 0, stack = [];
  while (i < sel.length) {
    var ch = sel[i];
    if (ch === '"' || ch === "'") {
      var q = sel.indexOf(ch, i + 1);
      var qe = q < 0 ? sel.length : q + 1;
      out += sel.slice(i, qe); i = qe; continue;
    }
    if (ch === '\\') { out += sel.slice(i, i + 2); i += 2; continue; }
    if (ch === '[') {
      var b = sel.indexOf(']', i);
      var be = b < 0 ? sel.length : b + 1;
      out += sel.slice(i, be); i = be; continue;
    }
    if (ch === ':') {
      var m = /^(::?)([a-zA-Z-]+)(\()?/.exec(sel.slice(i));
      if (!m) { out += ch; i++; continue; }
      var name = m[2].toLowerCase();
      if (m[3]) { stack.push(name); out += m[0]; i += m[0].length; continue; }
      if (m[1] === ':' && MAP[name] && stack.indexOf('not') < 0) {
        var attr = '[data-pt-' + MAP[name][0] + ']';
        var within = MAP[name][1] && stack.indexOf('has') < 0 ? ', :has(' + attr + ')' : '';
        out += ':is(:' + name + ', ' + attr + within + ')';
      } else out += m[0];
      i += m[0].length; continue;
    }
    if (ch === '(') stack.push('(');
    else if (ch === ')') stack.pop();
    out += ch; i++;
  }
  return out;
}

/* The page script: mark the element each forced state applies to, then rewrite the parts'
   style sheet with forceSelector. */
function setupScript() {
  return `<script>
window.ultrahandSetup = function (canvas) {
  var forceSelector = ${forceSelector.toString()};
  var FOCUSABLE = 'button, a[href], input, select, textarea, summary, [tabindex], [contenteditable], [role=button], [role=link], [role=checkbox], [role=radio], [role=switch], [role=tab], [role=slider], [role=menuitem], [role=option]';
  canvas.$$('[data-pt-force]').forEach(function (cell) {
    var force = cell.getAttribute('data-pt-force').split(/\\s+/).filter(Boolean);
    var t = cell.querySelector('[data-pt-target]') || cell.querySelector(FOCUSABLE) || cell.firstElementChild;
    if (t) force.forEach(function (f) { t.setAttribute('data-pt-' + f, ''); });
  });
  function rewrite(rules) {
    for (var i = 0; i < rules.length; i++) {
      var r = rules[i];
      if (typeof r.selectorText === 'string') {
        var s = forceSelector(r.selectorText);
        if (s !== r.selectorText) r.selectorText = s;
      }
      if (r.cssRules) rewrite(r.cssRules);
    }
  }
  var style = canvas.root.querySelector('style[data-pt-parts]');
  if (style && style.sheet) rewrite(style.sheet.cssRules);
  /* The overview's previews are pictures of the parts; their targets are judged on each
     part's own screen. */
  canvas.$$('.pt-preview').forEach(function (p) {
    p.querySelectorAll(FOCUSABLE).forEach(function (e) { e.setAttribute('data-uh-ignore-target', ''); });
  });
  /* A click on See all, Next or Back hides the button that had focus. Move focus to the new
     screen's heading, and back on the overview to the card the part was opened from. A
     change from the toolbar's Go to picker keeps focus in the toolbar. */
  canvas.onNavigate(function (nav) {
    var active = canvas.root.activeElement;
    if (active && !active.closest('[data-screen][hidden]') && document.activeElement !== document.body) return;
    var screen = canvas.$('[data-screen="' + nav.screen + '"]');
    if (!screen) return;
    var to = nav.screen === 'parts' && nav.from
      ? screen.querySelector('[data-nav="' + nav.from + '"]')
      : screen.querySelector('.pt-h1[tabindex]');
    if (to) to.focus();
  });
  canvas.refresh();
};
</script>`;
}

/* ---------- Reading the inputs ---------- */

/* The Components table of THEME.md: [{ component, variants, tokens, definedIn }]. */
export function readInventory(md) {
  const lines = md.split(/\r?\n/);
  const start = lines.findIndex((l) => /^##\s+Components\s*$/i.test(l));
  const head = lines.find((l) => /^#\s+/.test(l));
  const version = (md.match(/^Version\s+(\d+\.\d+\.\d+)/m) || [])[1] || null;
  const theme = { title: head ? head.replace(/^#\s+/, '').trim() : null, version, components: [] };
  if (start < 0) return theme;
  const rows = [];
  for (const l of lines.slice(start + 1)) {
    if (/^#/.test(l)) break;
    if (/^\s*\|/.test(l)) rows.push(l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
    else if (rows.length && l.trim()) break;
  }
  if (rows.length < 2) return theme;
  const cols = rows[0].map((c) => c.toLowerCase());
  const col = (name) => cols.findIndex((c) => c.startsWith(name));
  const at = { component: col('component'), variants: col('variant'), tokens: col('token'), definedIn: col('defined') };
  for (const r of rows.slice(1)) {
    if (r.every((c) => /^:?-+:?$/.test(c))) continue;
    const get = (k) => (at[k] >= 0 ? (r[at[k]] || '').replace(/`/g, '') : '');
    if (get('component')) theme.components.push({ component: get('component'), variants: get('variants'), tokens: get('tokens'), definedIn: get('definedIn') });
  }
  return theme;
}

/* Custom property names a CSS text declares. */
export const declaredVars = (text) => new Set([...String(text).matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));

export const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'part';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/* The states a part shows, as [{ id, label, force, attrs, html, text, message, note }]. */
export function partStates(part, defaults) {
  let list = part.states;
  if (!list) {
    list = [...(defaults || INTERACTIVE)];
    if (part.error !== undefined && !list.includes('error')) list.push('error');
    if (part.long !== undefined && !list.includes('long')) list.push('long');
  }
  const entries = Array.isArray(list) ? list.map((id) => [id, {}]) : Object.entries(list).map(([id, o]) => [id, o === true ? {} : o || {}]);
  return entries.map(([id, o]) => {
    const c = CANON[id] || {};
    return {
      id,
      label: o.label || c.label || id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' '),
      force: o.force !== undefined ? [].concat(o.force).join(' ') : c.force || '',
      attrs: o.attrs !== undefined ? o.attrs : c.attrs || '',
      html: o.html,
      text: o.text,
      message: o.message,
      note: o.note,
    };
  });
}

/* Fill a snippet: {{text}}, {{message}} and {{uid}} (escaped), {{attrs}} (raw), and sections
   {{#key}}…{{/key}} kept only when key is non-empty. */
export function fill(html, vals) {
  let out = String(html).replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (all, k, body) => (!(k in vals) ? all : vals[k] ? body : ''));
  out = out.replace(/\{\{(\w+)\}\}/g, (all, k) => (k in vals ? (k === 'attrs' ? vals[k] : esc(vals[k])) : all));
  return out;
}

/* uid is unique to each drawn copy, so a snippet can link a field to its message with
   id="{{uid}}-msg" and aria-describedby="{{uid}}-msg". */
function stateHtml(part, s, uid = `${part.id || 'part'}--${s.id}`) {
  const text = s.text ?? (s.id === 'long' ? part.long : part.text) ?? '';
  const message = s.message ?? (s.id === 'error' ? part.error ?? '' : '');
  return fill(s.html ?? part.html, { text, attrs: s.attrs, message, uid });
}

/* ---------- Checks ---------- */

const COLOR_FN = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i;
const HEX = /(^|[^\w&-])#[0-9a-f]{3,8}\b/i;
const NAMED = /\b(white|black|red|green|blue|gr[ae]y|yellow|orange|purple|pink|brown|navy|teal|silver|gold)\b/i;
const COLORISH = /(color|background|border|outline|fill|stroke|shadow|caret|accent|decoration)/i;
const SPACING = /^(margin|padding|gap|row-gap|column-gap|inset)(-|$)/i;
const NN2 = new Set([0, 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96]);

/* Every declaration inside a block, nested blocks included: innermost blocks are read and
   cut out until none are left, so selectors never pass for declarations. */
function declarations(cssText) {
  let text = String(cssText).replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  const take = (body) => {
    for (const d of body.split(';')) {
      const m = /^\s*(-{0,2}[a-zA-Z][\w-]*)\s*:\s*([\s\S]+?)\s*$/.exec(d);
      if (m) out.push({ prop: m[1].toLowerCase(), value: m[2] });
    }
  };
  for (let guard = 0; /\{[^{}]*\}/.test(text) && guard < 50; guard++) {
    text = text.replace(/\{([^{}]*)\}/g, (_, body) => (take(body), ';'));
  }
  return out;
}

/* Raw values where a theme role belongs (NN-1), spacing off the grid (NN-2), px type (NN-6). */
function rawValues(where, cssText, errors, warnings) {
  for (const { prop, value } of declarations(cssText)) {
    const v = value.replace(/var\([^()]*(\([^()]*\))?[^()]*\)/g, '');
    if (COLOR_FN.test(v) || HEX.test(v) || (COLORISH.test(prop) && NAMED.test(v))) {
      errors.push(`${where}: raw colour in "${prop}: ${value}". Use a theme role such as var(--color-on-surface) (NN-1).`);
    }
    if (SPACING.test(prop)) {
      for (const m of v.matchAll(/(-?\d*\.?\d+)(px|rem|em)\b/g)) {
        const px = m[2] === 'px' ? Math.abs(+m[1]) : Math.abs(+m[1]) * 16;
        if (px === 0) continue;
        warnings.push(`${where}: raw spacing "${prop}: ${value}". Use a --space-* role (NN-1)${NN2.has(px) ? '' : `; ${m[0]} is also off the 8-point grid (NN-2)`}.`);
        break;
      }
    }
    if (prop === 'font-size' && /\d(px|pt)\b/.test(v)) warnings.push(`${where}: "${prop}: ${value}" in px. Use a --type-* role, or rem, so text scales (NN-6).`);
  }
}

function htmlStyles(html) {
  const out = [];
  for (const m of String(html).matchAll(/\sstyle\s*=\s*("([^"]*)"|'([^']*)')/gi)) out.push(`{${m[2] ?? m[3]}}`);
  for (const m of String(html).matchAll(/\s(fill|stroke|color|bgcolor)\s*=\s*("([^"]*)"|'([^']*)')/gi)) {
    const v = (m[3] ?? m[4]).trim();
    if (!/^(none|currentcolor|transparent|inherit)$/i.test(v) && !/^var\(/.test(v)) out.push(`{${m[1]}: ${v}}`);
  }
  for (const m of String(html).matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) out.push(m[1]);
  return out.join('\n');
}

const usedVars = (text) => [...String(text).matchAll(/var\(\s*(--[\w-]+)\s*(,)?/g)].map((m) => ({ name: m[1], fallback: !!m[2] }));

/* Check parts.json. Returns { errors, warnings, parts } with each part normalised. */
export function check(doc, { inventory, defined, themed }) {
  const errors = [], warnings = [];
  if (!doc || typeof doc !== 'object') return { errors: ['parts.json must be an object'], warnings, parts: [] };
  if (!Array.isArray(doc.parts) || !doc.parts.length) errors.push('parts must be a non-empty array');
  if (doc.states !== undefined && !Array.isArray(doc.states)) errors.push('states (top level) must be an array of state ids');
  const parts = [];
  const ids = new Set();
  const local = declaredVars(doc.css || '');
  for (const p of doc.parts || []) {
    for (const v of declaredVars(`${(p && p.css) || ''}\n${htmlStyles((p && p.html) || '')}`)) local.add(v);
  }
  const inv = inventory ? inventory.components : null;
  const findInv = (name) => inv && inv.find((c) => c.component.toLowerCase() === String(name).toLowerCase());

  (doc.parts || []).forEach((p, i) => {
    const at = `parts[${i}]${p && p.name ? ` "${p.name}"` : ''}`;
    if (!p || typeof p !== 'object') return errors.push(`${at} must be an object`);
    if (!p.name) errors.push(`${at}: name is required`);
    const id = p.id ? String(p.id) : slug(p.name || `part-${i + 1}`);
    if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) errors.push(`${at}: id "${id}" must be lowercase letters, digits and dashes`);
    if (ids.has(id)) errors.push(`${at}: id "${id}" is used twice`);
    ids.add(id);
    if (p.status !== 'reused' && p.status !== 'new') errors.push(`${at}: status must be "reused" or "new"`);
    if (!p.why || !String(p.why).trim()) errors.push(`${at}: why is required: one line on why the design needs it`);
    else if (String(p.why).length > 140) warnings.push(`${at}: why is ${String(p.why).length} characters; keep it to one line`);
    if (!p.html) errors.push(`${at}: html is required: a snippet that draws the part with theme custom properties`);
    if (p.size !== undefined && !['fit', 'full'].includes(p.size)) errors.push(`${at}: size must be "fit" or "full"`);
    if (p.usedIn !== undefined && !Array.isArray(p.usedIn)) errors.push(`${at}: usedIn must be an array of strings`);
    if (p.states !== undefined && (typeof p.states !== 'object' || p.states === null)) errors.push(`${at}: states must be an array of state ids or an object`);

    let entry = null;
    if (p.status === 'reused') {
      const name = p.component || p.name;
      if (inv) {
        entry = findInv(name);
        if (!entry) errors.push(`${at}: marked reused, but the inventory has no component "${name}" (it lists ${inv.map((c) => c.component).join(', ') || 'none'}). Name it with "component", or mark the part new.`);
        else if (p.variant && entry.variants && !entry.variants.toLowerCase().includes(String(p.variant).toLowerCase())) {
          warnings.push(`${at}: variant "${p.variant}" isn't among ${entry.component}'s variants (${entry.variants}). A new variant is a theme change: say so in why.`);
        }
      }
    } else if (p.status === 'new' && inv) {
      const twin = findInv(p.component || p.name);
      if (twin) warnings.push(`${at}: marked new, but the inventory already has "${twin.component}" (${twin.definedIn || 'no file'}). Reuse it unless it can't do this job (EV-2).`);
    }

    const states = p.html && (p.states === undefined || (typeof p.states === 'object' && p.states)) ? partStates(p, doc.states) : [];
    if (p.html && !states.length) errors.push(`${at}: no states to show`);
    for (const s of states) {
      if (s.id === 'long' && s.text === undefined && s.html === undefined && p.long === undefined) {
        errors.push(`${at}: the long state needs "long", the longest plausible text`);
      }
      const html = stateHtml({ ...p, id }, s);
      const left = html.match(/\{\{[#/]?\w+\}\}/g);
      if (left) errors.push(`${at}: state ${s.id} leaves ${[...new Set(left)].join(', ')} unfilled (only text, message, attrs and uid exist)`);
    }
    if (p.html && /\{\{text\}\}/.test(p.html) && p.long === undefined && !states.some((s) => s.id === 'long')) {
      warnings.push(`${at}: no longest text. Add "long" so the sheet shows how it wraps.`);
    }

    const source = [p.html || '', ...states.map((s) => s.html || '')].join('\n');
    rawValues(at, `${p.css || ''}\n${htmlStyles(source)}`, errors, warnings);
    const vars = usedVars(`${p.css || ''}\n${source}`);
    const seen = new Set();
    for (const v of vars) {
      if (defined.has(v.name) || local.has(v.name) || v.name.startsWith('--uh-') || seen.has(v.name)) continue;
      seen.add(v.name);
      /* Without a theme a component token can't exist yet, so var(--button-bg, var(--color-primary))
         is the expected form; with a theme, a name it lacks is most likely a typo. */
      if (v.fallback && !themed) continue;
      const msg = `${at}: var(${v.name}) isn't a ${themed ? 'theme' : 'fallback'} custom property${themed ? '' : ' (no theme given: use a role from README.md, or give the var a fallback role)'}`;
      if (v.fallback) warnings.push(`${msg}; its fallback value will show`);
      else errors.push(msg);
    }
    parts.push({ ...p, id, states, entry, tokens: [...new Set(vars.map((v) => v.name).filter((n) => !n.startsWith('--uh-')))].sort() });
  });
  if (doc.css) rawValues('css', doc.css, errors, warnings);
  for (const v of usedVars(doc.css || '')) {
    if (!defined.has(v.name) && !local.has(v.name) && !v.name.startsWith('--uh-') && !v.fallback) errors.push(`css: var(${v.name}) isn't a ${themed ? 'theme' : 'fallback'} custom property`);
  }
  if (!inv && parts.some((p) => p.status === 'reused')) warnings.push('No inventory (design/THEME.md) given, so reused parts are taken on trust. Pass --inventory or set "inventory".');
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)], parts };
}

/* ---------- The sheet ---------- */

const SHEET_CSS = `
:host { color-scheme: light dark; }
[data-screen] {
  box-sizing: border-box;
  background: var(--color-surface);
  color: var(--color-on-surface);
  font-family: var(--type-body-font-family);
  font-size: var(--type-body-font-size);
  line-height: var(--type-body-line-height);
  padding: calc(var(--uh-safe-top) + var(--space-inset)) calc(var(--uh-safe-right) + var(--space-inset))
    calc(var(--uh-safe-bottom) + var(--space-gap-section)) calc(var(--uh-safe-left) + var(--space-inset));
}
.pt-top { padding-inline-start: var(--uh-window-controls-width, 0px); min-height: var(--uh-window-controls-height, 0px); }
.pt-h1, .pt-h2, .pt-h3, .pt-p { margin: 0; }
.pt-h1 {
  font-family: var(--type-headline-font-family, var(--type-title-font-family));
  font-size: var(--type-headline-font-size, var(--type-title-font-size));
  font-weight: var(--type-headline-font-weight, var(--type-title-font-weight));
  line-height: var(--type-headline-line-height, var(--type-title-line-height));
  text-wrap: balance;
}
.pt-h2, .pt-h3 {
  font-family: var(--type-title-font-family);
  font-size: var(--type-title-font-size);
  font-weight: var(--type-title-font-weight);
  line-height: var(--type-title-line-height);
}
.pt-h3 { font-size: var(--type-body-font-size); }
.pt-label, .pt-badge, .pt-btn, figcaption {
  font-family: var(--type-label-font-family);
  font-size: var(--type-label-font-size);
  font-weight: var(--type-label-font-weight);
  line-height: var(--type-label-line-height);
}
.pt-muted { color: var(--color-on-surface-variant); }
.pt-head { display: grid; gap: var(--space-gap-related); margin-block-end: var(--space-gap-section); max-width: 48rem; }
.pt-group { margin-block-end: var(--space-gap-section); }
.pt-group > .pt-h2 { margin-block-end: var(--space-gap-group); }
.pt-list {
  list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-gap-group);
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 20rem), 1fr));
}
.pt-card {
  display: grid; gap: var(--space-gap-related); grid-template-rows: auto auto 1fr auto; min-width: 0;
  padding: var(--space-inset); border: 1px solid var(--color-outline); border-radius: var(--radius-container);
}
/* Only the card and its button take a pin, so a note on the overview names its part. */
.pt-card > :not(.pt-btn) { pointer-events: none; }
.pt-title { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-gap-related); }
/* Outlined and square-cornered, so the sheet's own label never looks like a part. */
.pt-badge {
  display: inline-block; padding: 0 var(--space-inset-tight); border-radius: var(--radius-control);
  border: 1px solid var(--color-outline); color: var(--color-on-surface-variant);
}
.pt-badge[data-status="new"] { border-color: var(--color-on-surface); color: var(--color-on-surface); }
.pt-preview { min-width: 0; }
.pt-none { margin: 0; padding-block: var(--space-inset-tight); }
.pt-btn {
  min-height: 48px; min-width: 48px; padding: 0 var(--space-inset); justify-self: start;
  border: 1px solid var(--color-outline); border-radius: var(--radius-control);
  background: transparent; color: var(--color-on-surface); cursor: pointer; text-align: start;
}
.pt-btn:focus-visible { outline: var(--focus-width) solid var(--color-focus-ring); outline-offset: var(--focus-offset); }
.pt-card > .pt-btn { align-self: end; }
.pt-back { border-color: transparent; padding-inline-start: var(--space-inset-tight); margin-inline-start: calc(-1 * var(--space-inset-tight)); }
.pt-about { margin-block-start: var(--space-gap-section); display: grid; gap: var(--space-gap-group); max-width: 48rem; }
.pt-about summary { cursor: pointer; min-height: 24px; }
.pt-h1:focus { outline: none; }
.pt-h1:focus-visible { outline: var(--focus-width) solid var(--color-focus-ring); outline-offset: var(--focus-offset); }
.pt-facts { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: var(--space-gap-related) var(--space-gap-group); margin: 0; }
.pt-facts dt { color: var(--color-on-surface-variant); }
.pt-facts dd { margin: 0; overflow-wrap: anywhere; }
.pt-role { display: block; }
.pt-about details > summary + .pt-role { margin-block-start: var(--space-gap-related); }
.pt-states {
  display: grid; gap: var(--space-gap-group);
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr));
}
.pt-part[data-size="full"] .pt-states { grid-template-columns: minmax(0, 1fr); }
.pt-state { margin: 0; display: grid; gap: var(--space-gap-related); align-content: start; min-width: 0; }
.pt-state figcaption { color: var(--color-on-surface-variant); }
.pt-cell { min-width: 0; padding: var(--space-inset); border: 1px dashed var(--color-outline); border-radius: var(--radius-container); }
.pt-part[data-size="full"] .pt-cell { padding-inline: 0; border-inline: 0; border-radius: 0; }
.pt-pager { display: flex; flex-wrap: wrap; justify-content: space-between; gap: var(--space-gap-related); margin-block-start: var(--space-gap-section); }
/* A focus ring for parts that don't draw their own, forced too in the focus state. */
.pt-cell :focus-visible, .pt-cell [data-pt-focus] { outline: var(--focus-width) solid var(--color-focus-ring); outline-offset: var(--focus-offset); }
`;

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function overviewCard(p, allStates) {
  const have = new Map(p.states.map((s) => [s.id, s]));
  const cells = allStates.map((s) => {
    const own = have.get(s.id);
    return own
      ? `<div class="pt-cell" id="ov-${p.id}--${s.id}" data-pt-force="${esc(own.force)}" data-show-state="${s.id}">${stateHtml(p, own, `ov-${p.id}--${s.id}`)}</div>`
      : `<p class="pt-none pt-muted" data-show-state="${s.id}">No ${esc(s.label.toLowerCase())} state</p>`;
  }).join('\n          ');
  const n = p.states.length;
  return `
      <li class="pt-card" aria-label="${esc(p.name)}, ${p.status} part">
        <div class="pt-title"><h3 class="pt-h3">${esc(p.name)}</h3><span class="pt-badge" data-status="${p.status}">${p.status === 'new' ? 'New' : 'Reused'}</span></div>
        <p class="pt-p pt-muted">${esc(p.why)}</p>
        <div class="pt-preview" inert>
          ${cells}
        </div>
        <button class="pt-btn" type="button" data-nav="part-${p.id}" aria-label="See ${n === 1 ? 'its state' : `all ${n} states`}: ${esc(p.name)}">See ${n === 1 ? 'its state' : `all ${n} states`}</button>
      </li>`;
}

/* --color-on-surface, --color-outline, --space-inset → "color: on-surface, outline" and
   "space: inset", one family a line, so the list reads as roles rather than a wall of names. */
function roleList(tokens) {
  const families = new Map();
  for (const t of tokens) {
    const [family, ...rest] = t.replace(/^--/, '').split('-');
    if (!families.has(family)) families.set(family, []);
    families.get(family).push(rest.join('-') || family);
  }
  return [...families].map(([f, names]) => `<span class="pt-role">${esc(f)}: ${esc(names.join(', '))}</span>`).join('');
}

function partScreen(p, prev, next) {
  const facts = [];
  if (p.status === 'reused') {
    facts.push(['From', 'The theme’s component inventory']);
    if (p.entry) {
      if (p.entry.variants) facts.push(['Variants', p.entry.variants]);
      if (p.entry.tokens) facts.push(['Tokens', p.entry.tokens]);
      if (p.entry.definedIn) facts.push(['Defined in', p.entry.definedIn]);
    }
    if (p.variant) facts.push(['Variant used', p.variant]);
  } else {
    facts.push(['Status', 'Proposed for this design. Once approved, it joins the theme’s component inventory.']);
    if (p.tokens.length) facts.push(['Theme roles', `<details><summary>${plural(p.tokens.length, 'role', 'roles')}</summary>${roleList(p.tokens)}</details>`, true]);
  }
  if (p.usedIn && p.usedIn.length) facts.push(['Used in', p.usedIn.join(', ')]);
  const states = p.states.map((s) => `
      <figure class="pt-state" data-note-state="${esc(s.id)}" data-note-state-label="${esc(s.label)}">
        <figcaption>${esc(s.label)}</figcaption>
        <div class="pt-cell" id="${p.id}--${s.id}" data-pt-force="${esc(s.force)}">${stateHtml(p, s)}</div>${s.note ? `\n        <p class="pt-p pt-muted">${esc(s.note)}</p>` : ''}
      </figure>`).join('');
  const pager = [
    prev ? `<button class="pt-btn" type="button" data-nav="part-${prev.id}" data-nav-replace>Previous: ${esc(prev.name)}</button>` : '<span></span>',
    next ? `<button class="pt-btn" type="button" data-nav="part-${next.id}" data-nav-replace>Next: ${esc(next.name)}</button>` : '',
  ].join('\n      ');
  return `
  <section data-screen="part-${p.id}" data-title="${esc(p.name)} · ${p.status}" class="pt-part" data-size="${p.size || 'fit'}">
    <div class="pt-top"><button class="pt-btn pt-back" type="button" data-nav-back>‹ All parts</button></div>
    <header class="pt-head">
      <div class="pt-title"><h1 class="pt-h1" tabindex="-1">${esc(p.name)}</h1><span class="pt-badge" data-status="${p.status}">${p.status === 'new' ? 'New' : 'Reused'}</span></div>
      <p class="pt-p">${esc(p.why)}</p>
    </header>
    <div class="pt-states">${states}
    </div>
    <section class="pt-about" aria-label="About ${esc(p.name)}">
      <h2 class="pt-h2">About this part</h2>
      <dl class="pt-facts pt-label">
        ${facts.map(([k, v, html]) => `<dt>${esc(k)}</dt><dd>${html ? v : esc(v)}</dd>`).join('\n        ')}
      </dl>
    </section>
    <nav class="pt-pager" aria-label="Other parts">
      ${pager}
    </nav>
  </section>`;
}

/* The canvas screen and config for a checked set of parts. */
export function render({ title, parts, css, themed, inventory }) {
  const order = [...parts.filter((p) => p.status === 'new'), ...parts.filter((p) => p.status === 'reused')];
  /* The State picker offers the standard states only. A state of a part's own, such as a
     level or variant, shows on that part's screen. */
  const ids = new Set(parts.flatMap((p) => p.states.map((s) => s.id)));
  const allStates = STATES.filter((s) => ids.has(s.id)).map((s) => ({ id: s.id, label: s.label }));
  const fresh = order.filter((p) => p.status === 'new');
  const reused = order.filter((p) => p.status === 'reused');
  const theme = themed
    ? `Theme: ${inventory && inventory.title ? esc(inventory.title) + (inventory.version ? ` ${esc(inventory.version)}` : '') : 'the theme in the page head'}.`
    : 'No theme yet: drawn with neutral stand-ins that keep the non-negotiables in shared/theme/rules.md. The greys are placeholders, not a colour choice.';
  const group = (name, list) => (list.length ? `
    <section class="pt-group" aria-label="${name}">
      <h2 class="pt-h2">${name} (${list.length})</h2>
      <ul class="pt-list">${list.map((p) => overviewCard(p, allStates)).join('')}
      </ul>
    </section>` : '');
  const fallback = themed ? '' : `\n:host {\n${Object.entries(FALLBACK).map(([k, v]) => `  ${k}: ${v};`).join('\n')}\n}`;
  const screen = `<template id="uh-screen">
<style>${fallback}${SHEET_CSS}</style>
<style data-pt-parts>
${[css || '', ...parts.map((p) => (p.css ? `/* ${p.name} */\n${p.css}` : ''))].filter(Boolean).join('\n\n')}
</style>

  <section data-screen="parts" data-title="All parts">
    <header class="pt-head pt-top">
      <h1 class="pt-h1">${esc(title)}</h1>
      <p class="pt-p">${plural(parts.length, 'part', 'parts')}: ${fresh.length} new, ${reused.length} reused from the theme.</p>
      <p class="pt-p pt-muted">${theme}</p>
      <p class="pt-p pt-muted">${allStates.length > 1 ? 'The State picker shows every part in one state. ' : ''}Open a part to see all its states side by side and try them.</p>
    </header>${group('New parts', fresh)}${group('Reused from the theme', reused)}
  </section>
${order.map((p, i) => partScreen(p, order[i - 1], order[i + 1])).join('\n')}
</template>

${setupScript()}
`;
  const config = { title, initialScreen: 'parts', states: allStates.length ? allStates : [{ id: 'default', label: 'Default' }] };
  return { screen, config };
}

/* ---------- Command line ---------- */

function cli(argv) {
  const opts = { flags: new Set() };
  const valued = ['inventory', 'head', 'presets', 'title', 'out', 'work'];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') opts.flags.add('help');
    else if (a === '--no-build' || a === '--check') opts.flags.add(a.slice(2));
    else if (a.startsWith('--')) {
      const key = a.slice(2);
      if (!valued.includes(key)) die(`Unknown option ${a}`);
      if (argv[i + 1] === undefined || argv[i + 1].startsWith('--')) die(`${a} needs a value`);
      opts[key] = argv[++i];
    } else if (!opts.file) opts.file = a;
    else die(`Unexpected argument: ${a}`);
  }
  return opts;
}

function die(msg) {
  console.error(`parts: ${msg}`);
  process.exit(1);
}

function readText(path, what) {
  try {
    return readFileSync(resolve(path), 'utf8');
  } catch (err) {
    die(`Cannot read ${what} ${path}: ${err.message}`);
  }
}

function main() {
  const o = cli(process.argv.slice(2));
  if (o.flags.has('help') || !o.file) {
    console.log('usage: node parts.mjs parts.json [--inventory THEME.md] [--head theme.html] [--presets presets.md]\n                    [--title "…"] [--out index.html] [--work dir] [--no-build] [--check]');
    process.exit(o.file ? 0 : 2);
  }
  let doc;
  try {
    doc = JSON.parse(readText(o.file, 'parts file'));
  } catch (err) {
    die(`${o.file} is not valid JSON: ${err.message}`);
  }
  const base = dirname(resolve(o.file));
  const invPath = o.inventory || (doc.inventory ? join(base, doc.inventory) : null);
  const inventory = invPath ? readInventory(readText(invPath, 'inventory')) : null;
  if (inventory && !inventory.components.length) console.warn(`parts: warning: ${invPath} has no "## Components" table rows`);
  const head = o.head ? readText(o.head, 'head file') : '';
  const fromHead = declaredVars(head);
  const themed = fromHead.has('--color-surface');
  const defined = themed ? fromHead : new Set([...Object.keys(FALLBACK), ...fromHead]);

  const { errors, warnings, parts } = check(doc, { inventory, defined, themed });
  for (const w of warnings) console.warn(`parts: warning: ${w}`);
  if (errors.length) {
    console.error(`parts: ${plural(errors.length, 'problem', 'problems')} in ${o.file}:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
    process.exit(1);
  }
  if (o.flags.has('check')) {
    console.log(`parts: ${o.file} is fine (${plural(parts.length, 'part', 'parts')}, ${themed ? 'themed' : 'no theme: neutral fallback'})`);
    return;
  }
  const title = o.title || doc.title || 'Parts';
  const { screen, config } = render({ title, parts, css: doc.css, themed, inventory });
  const out = resolve(o.out || 'index.html');
  const work = resolve(o.work || dirname(out));
  mkdirSync(work, { recursive: true });
  const screenFile = join(work, 'parts.screen.html');
  const configFile = join(work, 'parts.config.json');
  writeFileSync(screenFile, screen);
  writeFileSync(configFile, JSON.stringify(config, null, 2) + '\n');
  if (o.flags.has('no-build')) {
    console.log(`parts: wrote ${screenFile} and ${configFile}`);
    return;
  }
  const build = join(here, '..', 'canvas', 'build.mjs');
  const args = [build, '--screen', screenFile, '--config', configFile, '--title', title, '--out', out];
  if (o.presets) args.push('--presets', o.presets);
  if (o.head) args.push('--head', o.head);
  const r = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
  console.log(`parts: ${plural(parts.length, 'part', 'parts')} (${parts.filter((p) => p.status === 'new').length} new) → ${basename(out)}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
