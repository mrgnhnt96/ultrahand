// Shared helpers for ultrahand theme files (design tokens in the DTCG format).
// Used by check.mjs, css.mjs and scan.mjs. Node 18+, no dependencies.
//
// A theme file is a DTCG token file with three top-level tiers (see README.md):
//   primitive   raw values (the palette, the spacing scale, font sizes)
//   semantic    roles that alias primitives ({primitive.color.blue.60})
//   component   per-component decisions that alias semantic tokens
// A semantic colour's dark value lives in $extensions.ultrahand.dark.

import { readFileSync } from 'node:fs';

export const TIERS = ['primitive', 'semantic', 'component'];
export const EXT = 'ultrahand';

export function loadTheme(path) {
  let doc;
  try {
    doc = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    throw new Error(`can't read theme file ${path}: ${e.message}`);
  }
  return buildIndex(doc);
}

// Walk the tree. A token is any object with $value; $type inherits from enclosing groups.
export function buildIndex(doc) {
  const tokens = new Map();
  const walk = (node, path, inheritedType) => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return;
    const type = node.$type ?? inheritedType;
    if ('$value' in node) {
      tokens.set(path.join('.'), {
        path: path.join('.'),
        tier: path[0],
        type,
        value: node.$value,
        dark: node.$extensions?.[EXT]?.dark,
        deprecated: node.$deprecated,
        description: node.$description,
      });
      return;
    }
    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith('$')) continue;
      walk(v, [...path, k], type);
    }
  };
  walk(doc, [], undefined);
  return { doc, tokens, meta: doc.$extensions?.[EXT] ?? {} };
}

const ALIAS = /^\{([^{}]+)\}$/;
export const aliasOf = (v) => (typeof v === 'string' && ALIAS.test(v) ? v.match(ALIAS)[1] : null);

// Resolve a value (or alias) to its final raw value. Throws on a missing target or a cycle.
// In the dark scheme, each token along the chain gives its dark value when it has one, so
// a component token aliasing {semantic.color.primary} follows primary into dark mode.
export function resolve(index, value, scheme = 'light', seen = []) {
  const target = aliasOf(value);
  if (!target) return value;
  if (seen.includes(target)) throw new Error(`alias cycle: ${[...seen, target].join(' -> ')}`);
  const t = index.tokens.get(target);
  if (!t) throw new Error(`alias to a missing token: {${target}}`);
  const next = scheme === 'dark' && t.dark !== undefined ? t.dark : t.value;
  return resolve(index, next, scheme, [...seen, target]);
}

// A token's value in a scheme: its own dark value if it has one, then resolved.
export const valueIn = (index, t, scheme = 'light') =>
  resolve(index, scheme === 'dark' && t.dark !== undefined ? t.dark : t.value, scheme);

// Colours: DTCG object {colorSpace, components, alpha, hex}, or a hex / rgb() string.
export function parseColor(v) {
  if (v && typeof v === 'object') {
    if (typeof v.hex === 'string') {
      const c = parseColor(v.hex);
      return c && v.alpha !== undefined ? { ...c, a: v.alpha } : c;
    }
    if ((v.colorSpace ?? 'srgb') === 'srgb' && Array.isArray(v.components)) {
      const [r, g, b] = v.components.map((c) => (c === 'none' ? 0 : Number(c)));
      return { r, g, b, a: v.alpha ?? 1 };
    }
    return null;
  }
  if (typeof v !== 'string') return null;
  const s = v.trim().toLowerCase();
  let m = s.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    const n = (i) => parseInt(h.slice(i, i + 2), 16) / 255;
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) : 1 };
  }
  m = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/);
  if (m) {
    const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : Number(m[4]);
    return { r: m[1] / 255, g: m[2] / 255, b: m[3] / 255, a };
  }
  return null;
}

export function toHex({ r, g, b, a = 1 }) {
  const h = (x) => Math.round(Math.min(1, Math.max(0, x)) * 255).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}${a < 1 ? h(a) : ''}`;
}

// WCAG 2.x relative luminance and contrast ratio.
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export const luminance = ({ r, g, b }) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
export function contrast(fg, bg) {
  // Composite a translucent foreground over the background first.
  const a = fg.a ?? 1;
  const f = { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a) };
  const [l1, l2] = [luminance(f), luminance(bg)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

// OKLab, for spotting near-duplicate colours.
export function oklab({ r, g, b }) {
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
export const deltaE = (c1, c2) => {
  const [a, b] = [oklab(c1), oklab(c2)];
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
};

// Dimensions: DTCG object {value, unit}, or a "16px" / "1rem" string, or a bare number.
// Returns CSS px (1rem = 16px), or null.
export function parseDimension(v) {
  if (typeof v === 'number') return v;
  if (v && typeof v === 'object' && 'value' in v) return v.unit === 'rem' ? v.value * 16 : Number(v.value);
  if (typeof v !== 'string') return null;
  const m = v.trim().match(/^(-?[\d.]+)(px|rem|pt|dp)?$/);
  if (!m) return null;
  return m[2] === 'rem' ? Number(m[1]) * 16 : Number(m[1]);
}

export function dimensionCss(v) {
  if (typeof v === 'number') return `${v}px`;
  if (v && typeof v === 'object' && 'value' in v) return `${v.value}${v.unit ?? 'px'}`;
  return String(v);
}

// CSS custom property name: drop the tier, join with dashes.
//   semantic.color.on-primary -> --color-on-primary
//   component.button.radius   -> --button-radius
export const cssVar = (path) => `--${path.split('.').slice(1).join('-')}`;
