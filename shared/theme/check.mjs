// Check a theme file against the non-negotiables in rules.md.
//
//   node shared/theme/check.mjs design/theme.tokens.json [--json]
//
// Prints one line per problem, tagged with its rule (NN-n) and level: an error breaks a
// non-negotiable, a warning is worth a look. Exits 1 if there are errors. It checks the
// file only; scan.mjs checks how code and designs use it.

import {
  loadTheme, resolve, valueIn, aliasOf, parseColor, contrast, parseDimension, toHex, TIERS,
} from './tokens.mjs';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const asJson = args.includes('--json');
if (!file) {
  console.error('usage: node check.mjs <theme.tokens.json> [--json]');
  process.exit(2);
}

let index;
try {
  index = loadTheme(file);
} catch (e) {
  console.error(e.message);
  process.exit(2);
}
const { tokens, meta } = index;
const out = [];
const err = (rule, path, msg) => out.push({ level: 'error', rule, path, msg });
const warn = (rule, path, msg) => out.push({ level: 'warn', rule, path, msg });

const byTier = (tier) => [...tokens.values()].filter((t) => t.tier === tier);
const tryResolve = (t, v = t.value) => {
  try {
    return resolve(index, v);
  } catch (e) {
    err('NN-1', t.path, e.message);
    return undefined;
  }
};

// NN-1 Tiers. Every token sits in a tier; semantic aliases primitive; component aliases
// semantic (or another component token).
for (const t of tokens.values()) {
  if (!TIERS.includes(t.tier)) {
    err('NN-1', t.path, `outside the three tiers (${TIERS.join(', ')})`);
    continue;
  }
  if (t.tier === 'primitive') {
    if (aliasOf(t.value)) warn('NN-1', t.path, 'a primitive should hold a raw value, not an alias');
    continue;
  }
  for (const [label, v] of [['value', t.value], ['dark value', t.dark]]) {
    if (v === undefined) continue;
    if (v && typeof v === 'object' && !Array.isArray(v) && t.type === 'typography') {
      // A composite: its scale fields alias, its ratios (line height, tracking) may be raw.
      for (const k of ['fontFamily', 'fontSize', 'fontWeight'])
        if (k in v && !aliasOf(v[k])) err('NN-1', t.path, `${k} is a raw value; alias the type scale`);
      continue;
    }
    if (!aliasOf(v)) {
      err('NN-1', t.path, `${label} is a raw value; a ${t.tier} token must alias a ${t.tier === 'semantic' ? 'primitive' : 'semantic'} token`);
      continue;
    }
    tryResolve(t, v);
    const first = tokens.get(aliasOf(v));
    if (t.tier === 'semantic' && first && first.tier !== 'primitive' && first.tier !== 'semantic')
      err('NN-1', t.path, `${label} aliases a ${first.tier} token; semantic tokens alias primitives`);
    if (t.tier === 'component' && first && first.tier === 'primitive')
      err('NN-1', t.path, `${label} skips the semantic tier (aliases {${first.path}})`);
  }
}

// NN-12 Deprecation: says what replaces it, and nothing still points at it.
for (const t of tokens.values()) {
  if (t.deprecated !== undefined && t.deprecated !== false && !(typeof t.deprecated === 'string' && /\{[^}]+\}/.test(t.deprecated)))
    warn('NN-12', t.path, 'deprecated without naming its replacement, e.g. "$deprecated": "Use {semantic.color.primary}"');
  for (const v of [t.value, t.dark]) {
    const target = tokens.get(aliasOf(v) ?? '');
    if (target?.deprecated && !t.deprecated) warn('NN-12', t.path, `aliases deprecated {${target.path}}`);
  }
}

// NN-2 Spacing on the 4/8 grid.
const isSpace = (t) => /(^|\.)(space|spacing|gap|inset)(\.|$)/.test(t.path);
for (const t of tokens.values()) {
  if (!isSpace(t)) continue;
  const px = parseDimension(tryResolve(t));
  if (px === null || px === undefined) continue;
  if (px % 4 !== 0) err('NN-2', t.path, `${px}px is off the 4px grid`);
  else if (px > 16 && px % 8 !== 0) err('NN-2', t.path, `${px}px: above 16, spacing steps are multiples of 8`);
}

// NN-7 Radius on the grid, few steps. NN-8 Few elevation levels.
const radii = byTier('primitive').filter((t) => /(^|\.)(radius|radii|shape|corner)(\.|$)/.test(t.path));
for (const t of radii) {
  const px = parseDimension(t.value);
  if (px === null) continue;
  if (px !== 0 && px !== 2 && px < 999 && px % 4 !== 0) warn('NN-7', t.path, `${px}px radius is off the 4px grid`);
}
if (radii.length > 7) warn('NN-7', 'primitive.radius', `${radii.length} radius steps; keep to about 6 plus full`);
const elevations = byTier('primitive').filter((t) => /(^|\.)(elevation|shadow)(\.|$)/.test(t.path));
if (elevations.length > 6) warn('NN-8', 'primitive.elevation', `${elevations.length} elevation levels; keep to about 5`);

// NN-3 Both schemes, NN-11 role names.
const semColors = byTier('semantic').filter((t) => t.type === 'color');
for (const t of semColors) {
  const first = index.tokens.get(aliasOf(t.value) ?? '');
  const inherits = first && first.tier !== 'primitive';
  if (t.dark === undefined && !inherits) err('NN-3', t.path, 'no dark value ($extensions.ultrahand.dark)');
}
const VALUE_WORDS = /(^|[-.])(red|orange|yellow|green|teal|cyan|blue|indigo|purple|violet|pink|magenta|grey|gray|black|white|\d{2,3})([-.]|$)|#/;
for (const t of [...byTier('semantic'), ...byTier('component')]) {
  const name = t.path.split('.').slice(1).join('.');
  if (VALUE_WORDS.test(name)) warn('NN-11', t.path, 'name describes a value, not a role');
}

// NN-5 Required roles.
const REQUIRED = ['surface', 'on-surface', 'on-surface-variant', 'primary', 'on-primary', 'outline', 'error', 'on-error', 'focus-ring'];
for (const r of REQUIRED) {
  if (!tokens.has(`semantic.color.${r}`)) err('NN-5', `semantic.color.${r}`, 'required colour role is missing');
}

// NN-4 Contrast in both schemes. Pairs: every on-X against X, the declared pairs in
// $extensions.ultrahand.contrast, and the fixed ones below.
const pairs = [];
for (const t of semColors) {
  const m = t.path.match(/^semantic\.color\.on-(.+)$/);
  if (!m) continue;
  const bg = `semantic.color.${m[1]}`;
  if (tokens.has(bg)) pairs.push({ fg: t.path, bg, min: 4.5 });
  else if (m[1] === 'surface-variant' && tokens.has('semantic.color.surface')) pairs.push({ fg: t.path, bg: 'semantic.color.surface', min: 4.5 });
}
for (const fixed of [
  { fg: 'semantic.color.outline', bg: 'semantic.color.surface', min: 3 },
  { fg: 'semantic.color.focus-ring', bg: 'semantic.color.surface', min: 3 },
  { fg: 'semantic.color.primary', bg: 'semantic.color.surface', min: 3 },
]) if (!pairs.some((p) => p.fg === fixed.fg && p.bg === fixed.bg)) pairs.push(fixed);
for (const p of meta.contrast ?? []) {
  const strip = (s) => aliasOf(s) ?? s;
  const pair = { fg: strip(p.fg), bg: strip(p.bg), min: p.min ?? 4.5 };
  const same = pairs.find((q) => q.fg === pair.fg && q.bg === pair.bg);
  if (same) same.min = Math.max(same.min, pair.min);
  else pairs.push(pair);
}
const colorIn = (path, scheme) => {
  const t = tokens.get(path);
  if (!t) return null;
  try {
    return parseColor(valueIn(index, t, scheme));
  } catch {
    return null;
  }
};
const contrastRows = [];
for (const p of pairs) {
  if (!tokens.has(p.fg) || !tokens.has(p.bg)) continue;
  for (const scheme of ['light', 'dark']) {
    const fg = colorIn(p.fg, scheme);
    const bg = colorIn(p.bg, scheme);
    if (!fg || !bg) continue;
    const ratio = contrast(fg, bg);
    contrastRows.push({ ...p, scheme, ratio: Math.round(ratio * 100) / 100, fgHex: toHex(fg), bgHex: toHex(bg) });
    if (ratio < p.min)
      err('NN-4', p.fg, `${ratio.toFixed(2)}:1 on ${p.bg} in ${scheme} (${toHex(fg)} on ${toHex(bg)}); needs ${p.min}:1`);
  }
}

// NN-6 Type: body size and line height, and a bounded scale.
const body = tokens.get('semantic.type.body');
if (!body) err('NN-6', 'semantic.type.body', 'no body text style');
else {
  const v = (() => {
    try {
      return resolve(index, body.value);
    } catch {
      return null;
    }
  })();
  const field = (k) => {
    const x = v?.[k];
    try {
      return aliasOf(x) ? resolve(index, x) : x;
    } catch {
      return null;
    }
  };
  const size = parseDimension(field('fontSize'));
  const lh = field('lineHeight');
  if (size !== null && size < 13) err('NN-6', body.path, `body is ${size}px; body text is never below 13`);
  else if (size !== null && size < 16)
    warn('NN-6', body.path, `body is ${size}px: fine for a dense desktop tool (macOS 13 pt, Material body medium 14), but text people read at length needs 16`);
  if (typeof lh === 'number' && lh < 1.3) warn('NN-6', body.path, `body line height ${lh}; keep body text at 1.3 or more (1.5 for long reading)`);
}
const sizes = new Set(
  byTier('primitive')
    .filter((t) => /(^|\.)(font-?size|size)(\.|$)/i.test(t.path) && /(^|\.)(type|font|text)/.test(t.path))
    .map((t) => parseDimension(t.value))
    .filter((x) => x !== null),
);
if (sizes.size > 10) warn('NN-6', 'primitive.font-size', `${sizes.size} font sizes; a type scale has about 6–10`);

// NN-10 Focus ring width.
const fw = tokens.get('semantic.focus.width');
if (!fw) warn('NN-10', 'semantic.focus.width', 'no focus ring width token');
else {
  const px = parseDimension(tryResolve(fw));
  if (px !== null && px < 2) err('NN-10', fw.path, `focus ring is ${px}px; make it at least 2px`);
}

// Report.
const errors = out.filter((o) => o.level === 'error').length;
if (asJson) {
  console.log(JSON.stringify({ file, tokens: tokens.size, errors, warnings: out.length - errors, problems: out, contrast: contrastRows }, null, 2));
} else {
  const count = (tier) => byTier(tier).length;
  console.log(`${file}: ${tokens.size} tokens (${count('primitive')} primitive, ${count('semantic')} semantic, ${count('component')} component)`);
  for (const o of out) console.log(`${o.level === 'error' ? 'ERROR' : 'warn '} ${o.rule.padEnd(5)} ${o.path}: ${o.msg}`);
  console.log('contrast:');
  for (const r of contrastRows)
    console.log(`  ${r.ratio >= r.min ? 'ok  ' : 'FAIL'} ${r.ratio.toFixed(2).padStart(5)}:1 ${r.scheme.padEnd(5)} ${r.fg} on ${r.bg} (min ${r.min})`);
  console.log(`${errors} error(s), ${out.length - errors} warning(s)`);
}
process.exit(errors ? 1 : 0);
