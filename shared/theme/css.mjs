// Turn a theme file into CSS custom properties, for a canvas screen or a web project.
//
//   node shared/theme/css.mjs design/theme.tokens.json [--style] [--selector sel] [--out theme.css]
//
// Emits the semantic and component tiers (primitives stay private, so screens can't reach
// for them). Colours become light-dark(light, dark), so the canvas Light / Dark toggle
// works. Typography composites become one property per field:
//   semantic.type.body -> --type-body-font-family, --type-body-font-size, ...
// --style wraps the output in <style>, ready for build.mjs --head; the screen's shadow root
// inherits the properties. --selector scopes them (default :root). To compare theme
// directions on the canvas, emit each without --style under '[data-state="a"]' (b, c…),
// put them in the screen template's own <style> (the canvas sets data-state inside the
// shadow root, out of reach of the page head), and declare a, b, c as the config's states.

import { writeFileSync } from 'node:fs';
import { loadTheme, resolve, valueIn, parseColor, toHex, dimensionCss, cssVar } from './tokens.mjs';

const args = process.argv.slice(2);
const valueOf = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : null);
const file = args.find((a, i) => !a.startsWith('--') && !['--out', '--selector'].includes(args[i - 1]));
const outFile = valueOf('--out');
const selector = valueOf('--selector') ?? ':root';
if (!file) {
  console.error('usage: node css.mjs <theme.tokens.json> [--style] [--selector sel] [--out file]');
  process.exit(2);
}

const index = loadTheme(file);
const lines = [];
const kebab = (s) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

const fmt = (type, v) => {
  if (type === 'color') {
    const c = parseColor(v);
    return c ? toHex(c) : String(v);
  }
  if (type === 'dimension') return dimensionCss(v);
  if (type === 'duration') return typeof v === 'object' ? `${v.value}${v.unit}` : String(v);
  if (type === 'cubicBezier' && Array.isArray(v)) return `cubic-bezier(${v.join(', ')})`;
  if (type === 'fontFamily') return Array.isArray(v) ? v.map((f) => (/\s/.test(f) ? `"${f}"` : f)).join(', ') : String(v);
  if (type === 'shadow') {
    const one = (s) => {
      const r = (x) => resolveField(x);
      const color = parseColor(r(s.color));
      return `${s.inset ? 'inset ' : ''}${dimensionCss(r(s.offsetX))} ${dimensionCss(r(s.offsetY))} ${dimensionCss(r(s.blur))} ${dimensionCss(r(s.spread ?? 0))} ${color ? toHex(color) : r(s.color)}`;
    };
    return (Array.isArray(v) ? v : [v]).map(one).join(', ');
  }
  if (v && typeof v === 'object' && 'value' in v) return dimensionCss(v);
  return String(v);
};
const resolveField = (x) => (typeof x === 'string' && x.startsWith('{') ? resolve(index, x) : x);

for (const t of index.tokens.values()) {
  if (t.tier !== 'semantic' && t.tier !== 'component') continue;
  const name = cssVar(t.path);
  const v = resolve(index, t.value);
  if (t.type === 'typography' && v && typeof v === 'object') {
    const types = { fontFamily: 'fontFamily', fontSize: 'dimension', letterSpacing: 'dimension' };
    for (const [k, raw] of Object.entries(v)) lines.push(`  ${name}-${kebab(k)}: ${fmt(types[k], resolveField(raw))};`);
    continue;
  }
  if (t.type === 'color') {
    const light = fmt('color', valueIn(index, t, 'light'));
    const dark = fmt('color', valueIn(index, t, 'dark'));
    lines.push(`  ${name}: ${light === dark ? light : `light-dark(${light}, ${dark})`};`);
    continue;
  }
  lines.push(`  ${name}: ${fmt(t.type, v)};`);
}

let css = `/* generated from ${file.split('/').pop()} by ultrahand shared/theme/css.mjs */\n${selector} {\n${lines.join('\n')}\n}\n`;
if (args.includes('--style')) css = `<style>\n${css}</style>\n`;
if (outFile) writeFileSync(outFile, css);
else process.stdout.write(css);
