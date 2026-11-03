// Scan a project's source for the visual values it uses: colours, spacing, radii and
// font sizes. The theme skill uses it to pull an existing theme out of code; the
// theme-review skill uses it with --theme to find values that bypass the theme.
//
//   node shared/theme/scan.mjs <dir> [--theme design/theme.tokens.json] [--json] [--top 15]
//
// Without --theme: each kind of value with its count and where it appears, near-duplicate
// colours grouped (OKLab distance under 0.02), and spacing off the 4/8 grid flagged.
// With --theme: also each raw value that matches a token (use the token instead), each
// value with no token (off the theme), and theme tokens no file mentions (maybe unused).
//
// It reads CSS, SCSS, Less, HTML, JS/TS (JSX, Tailwind arbitrary values), Vue, Svelte,
// Dart (Flutter), Swift (SwiftUI) and Kotlin (Compose). It works by pattern, not by
// parsing, so read its output as leads to check, not as proof.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, extname, resolve as resolvePath } from 'node:path';
import { loadTheme, valueIn, parseColor, toHex, deltaE, parseDimension, cssVar } from './tokens.mjs';

const args = process.argv.slice(2);
const flag = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};
const dir = args.find((a, i) => !a.startsWith('--') && !['--theme', '--top'].includes(args[i - 1]));
const themeFile = flag('--theme');
const top = Number(flag('--top') ?? 15);
const asJson = args.includes('--json');
if (!dir) {
  console.error('usage: node scan.mjs <dir> [--theme theme.tokens.json] [--json] [--top 15]');
  process.exit(2);
}

const SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'out', '.next', '.dart_tool', 'Pods', 'DerivedData', '.gradle', 'coverage', 'vendor', '.venv', 'graphify-out']);
const EXTS = new Set(['.css', '.scss', '.sass', '.less', '.html', '.htm', '.js', '.jsx', '.ts', '.tsx', '.mjs', '.vue', '.svelte', '.dart', '.swift', '.kt', '.kts', '.xml']);
const files = [];
const walk = (d) => {
  for (const name of readdirSync(d)) {
    if (SKIP.has(name) || name.startsWith('.')) continue;
    const p = join(d, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p);
    else if (EXTS.has(extname(name)) && s.size < 2_000_000 && !/\.min\.|\.g\.dart$|\.freezed\.dart$/.test(name)) files.push(p);
  }
};
const root = resolvePath(dir);
walk(root);

// kind -> value -> [locations]
const found = { color: new Map(), space: new Map(), radius: new Map(), fontSize: new Map() };
const add = (kind, value, loc) => {
  const m = found[kind];
  if (!m.has(value)) m.set(value, []);
  m.get(value).push(loc);
};

const SPACE_PROPS = 'margin|padding|gap|row-gap|column-gap|inset|top|right|bottom|left|margin-[a-z-]+|padding-[a-z-]+';
const PATTERNS = [
  // CSS-like declarations
  { kind: 'space', re: new RegExp(`(?:^|[;{\\s])(?:${SPACE_PROPS})\\s*:\\s*([^;}\\n,'"]+)`, 'g'), multi: 'css' },
  { kind: 'radius', re: /border(?:-[a-z]+)?-radius\s*:\s*([^;}\n,'"]+)/g, multi: 'css' },
  { kind: 'fontSize', re: /font-size\s*:\s*([\d.]+(?:px|rem))/g },
  // JS style objects: padding: 12, fontSize: '14px'
  { kind: 'space', re: /\b(?:margin|padding|gap)(?:Top|Right|Bottom|Left|Horizontal|Vertical|Inline|Block)?\s*:\s*['"]?(\d+(?:\.\d+)?)(?:px)?['"]?\s*[,}]/g },
  { kind: 'radius', re: /\bborderRadius\s*:\s*['"]?(\d+(?:\.\d+)?)(?:px)?['"]?/g },
  { kind: 'fontSize', re: /\bfontSize\s*:\s*['"]?(\d+(?:\.\d+)?)(?:px)?['"]?/g },
  // Tailwind arbitrary values: p-[13px], rounded-[6px], text-[15px]
  { kind: 'space', re: /\b(?:p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|gap-x|gap-y|space-x|space-y)-\[(\d+(?:\.\d+)?)px\]/g },
  { kind: 'radius', re: /\brounded(?:-[a-z]+)?-\[(\d+(?:\.\d+)?)px\]/g },
  { kind: 'fontSize', re: /\btext-\[(\d+(?:\.\d+)?)px\]/g },
  // Flutter
  { kind: 'space', re: /EdgeInsets\.(?:all|symmetric|only|fromLTRB)\(([^)]*)\)/g, multi: 'bare' },
  { kind: 'space', re: /SizedBox\(\s*(?:width|height)\s*:\s*(\d+(?:\.\d+)?)/g },
  { kind: 'radius', re: /(?:BorderRadius\.circular|Radius\.circular)\((\d+(?:\.\d+)?)\)/g },
  // SwiftUI
  { kind: 'space', re: /\.padding\((?:\.[a-z]+,\s*)?(\d+(?:\.\d+)?)\)/g },
  { kind: 'space', re: /spacing:\s*(\d+(?:\.\d+)?)/g },
  { kind: 'radius', re: /(?:\.cornerRadius\(|cornerRadius:\s*)(\d+(?:\.\d+)?)/g },
  { kind: 'fontSize', re: /\.system\(size:\s*(\d+(?:\.\d+)?)/g },
  // Compose / Android
  { kind: 'space', re: /\b(?:padding|spacedBy|Spacer\(Modifier\.(?:height|width))\(\s*(?:[a-z]+\s*=\s*)?(\d+(?:\.\d+)?)\.dp/g },
  { kind: 'radius', re: /RoundedCornerShape\((\d+(?:\.\d+)?)\.dp\)/g },
  { kind: 'fontSize', re: /fontSize\s*=\s*(\d+(?:\.\d+)?)\.sp/g },
  { kind: 'fontSize', re: /textSize="(\d+(?:\.\d+)?)sp"/g },
];
const COLOR_RES = [
  /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g,
  /rgba?\(\s*\d{1,3}[\s,]+\d{1,3}[\s,]+\d{1,3}(?:[\s,/]+[\d.]+%?)?\s*\)/g,
  /Color\(0x([0-9a-fA-F]{8})\)/g, // Flutter, Compose
];

// CSS lengths need a unit (px or rem); Flutter's EdgeInsets takes bare numbers.
const numbersIn = (s, mode) => {
  const re = mode === 'css' ? /(?<![\w#.-])(-?\d+(?:\.\d+)?)(px|rem)(?!\w)/g : /(?<![\w#.])(\d+(?:\.\d+)?)(?![\w.])/g;
  return [...s.matchAll(re)].map((m) => (m[2] === 'rem' ? Number(m[1]) * 16 : Number(m[1])));
};

for (const f of files) {
  const rel = relative(root, f);
  const text = readFileSync(f, 'utf8');
  const lineOf = (i) => text.slice(0, i).split('\n').length;
  for (const re of COLOR_RES) {
    for (const m of text.matchAll(re)) {
      let raw = m[0];
      if (raw.startsWith('Color(0x')) raw = `#${m[1].slice(2)}${m[1].slice(0, 2)}`; // AARRGGBB -> #RRGGBBAA
      // Skip things that look like ids or anchors: #fff in a URL fragment is rare, but
      // three-digit hex inside words (e.g. "#123" issue refs) in prose is common.
      if (raw.startsWith('#') && /\.(js|ts|jsx|tsx|mjs|swift|kt|dart)$/.test(f)) {
        const before = text[m.index - 1];
        if (before !== "'" && before !== '"' && before !== '`' && before !== ' ' && before !== ':') continue;
      }
      const c = parseColor(raw);
      if (!c) continue;
      add('color', toHex(c), `${rel}:${lineOf(m.index)}`);
    }
  }
  for (const p of PATTERNS) {
    for (const m of text.matchAll(p.re)) {
      const loc = `${rel}:${lineOf(m.index)}`;
      const vals = p.multi ? numbersIn(m[1], p.multi) : [parseDimension(/rem$/.test(m[1]) ? m[1] : Number(m[1]))];
      for (const v of vals) if (v !== null && !Number.isNaN(v) && v !== 0) add(p.kind, Math.abs(v), loc);
    }
  }
}

// Summaries.
const sorted = (m) => [...m.entries()].sort((a, b) => b[1].length - a[1].length);
const summary = {};
for (const kind of Object.keys(found)) {
  summary[kind] = sorted(found[kind]).map(([value, locs]) => ({ value, count: locs.length, at: locs.slice(0, 3) }));
}

// Near-duplicate colours: greedy clusters around the most used colour.
const clusters = [];
{
  const left = summary.color.slice();
  while (left.length) {
    const head = left.shift();
    const hc = parseColor(head.value);
    const members = [head];
    for (let i = left.length - 1; i >= 0; i--) {
      if (deltaE(hc, parseColor(left[i].value)) < 0.02 && (parseColor(left[i].value).a ?? 1) === (hc.a ?? 1)) members.push(...left.splice(i, 1));
    }
    if (members.length > 1) clusters.push(members.map((x) => `${x.value} ×${x.count}`));
  }
}
const offGrid = summary.space.filter((s) => s.value % 4 !== 0 || (s.value > 16 && s.value % 8 !== 0));

// Against a theme.
let themeReport = null;
if (themeFile) {
  const index = loadTheme(themeFile);
  const byValue = { color: new Map(), space: new Map(), radius: new Map(), fontSize: new Map() };
  const kindOf = (t) => {
    if (t.type === 'color') return 'color';
    if (/(^|\.)(space|spacing|gap|inset)(\.|$)/.test(t.path)) return 'space';
    if (/(^|\.)(radius|radii|shape|corner)(\.|$)/.test(t.path)) return 'radius';
    if (/(^|\.)(font-?size)(\.|$)/i.test(t.path) || (/(^|\.)(type|font|text)/.test(t.path) && t.type === 'dimension')) return 'fontSize';
    return null;
  };
  const note = (kind, key, t) => {
    if (!byValue[kind].has(key)) byValue[kind].set(key, []);
    byValue[kind].get(key).push(t.path);
  };
  for (const t of index.tokens.values()) {
    const kind = kindOf(t);
    if (!kind) continue;
    for (const scheme of ['light', 'dark']) {
      let r;
      try {
        r = valueIn(index, t, scheme);
      } catch {
        continue;
      }
      if (kind === 'color') {
        const c = parseColor(r);
        if (c) note(kind, toHex(c), t);
      } else {
        const px = parseDimension(r);
        if (px !== null) note(kind, px, t);
      }
    }
  }
  const matchesToken = [];
  const notInTheme = [];
  for (const kind of Object.keys(found)) {
    for (const s of summary[kind]) {
      const hit = byValue[kind].get(s.value);
      if (hit) {
        const preferred = hit.find((p) => !p.startsWith('primitive.')) ?? hit[0];
        matchesToken.push({ kind, value: s.value, count: s.count, token: preferred, at: s.at });
        continue;
      }
      let nearest = null;
      if (kind === 'color') {
        const c = parseColor(s.value);
        for (const [hex, paths] of byValue.color) {
          const d = deltaE(c, parseColor(hex));
          if (!nearest || d < nearest.d) nearest = { d, token: paths.find((p) => !p.startsWith('primitive.')) ?? paths[0], value: hex };
        }
      } else {
        for (const [px, paths] of byValue[kind]) {
          const d = Math.abs(px - s.value);
          if (!nearest || d < nearest.d) nearest = { d, token: paths.find((p) => !p.startsWith('primitive.')) ?? paths[0], value: px };
        }
      }
      notInTheme.push({ kind, value: s.value, count: s.count, nearest: nearest && { token: nearest.token, value: nearest.value }, at: s.at });
    }
  }
  // Tokens no file mentions, by CSS variable name or dotted / camel / snake path.
  const corpus = files.map((f) => readFileSync(f, 'utf8')).join('\n');
  const unused = [];
  for (const t of index.tokens.values()) {
    if (t.tier === 'primitive') continue;
    const tail = t.path.split('.').slice(1);
    const camel = tail.map((s, i) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase())).map((s, i) => (i ? s[0].toUpperCase() + s.slice(1) : s)).join('');
    const last = tail[tail.length - 1].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const names = [cssVar(t.path), tail.join('.'), tail.join('_'), camel, `.${last}`];
    if (!names.some((n) => corpus.includes(n))) unused.push(t.path);
  }
  themeReport = { theme: themeFile, matchesToken, notInTheme, unused };
}

if (asJson) {
  console.log(JSON.stringify({ dir, files: files.length, summary, colorClusters: clusters, offGrid, themeReport }, null, 2));
} else {
  console.log(`${dir}: scanned ${files.length} files`);
  for (const kind of Object.keys(summary)) {
    const rows = summary[kind];
    console.log(`\n${kind}: ${rows.length} distinct value(s)`);
    for (const r of rows.slice(0, top)) console.log(`  ${String(r.value).padEnd(10)} ×${String(r.count).padEnd(4)} ${r.at.join(', ')}`);
    if (rows.length > top) console.log(`  … ${rows.length - top} more (--top N or --json)`);
  }
  if (clusters.length) {
    console.log('\nnear-duplicate colours (probably one colour each):');
    for (const c of clusters) console.log(`  ${c.join('  ')}`);
  }
  if (offGrid.length) {
    console.log('\nspacing off the 4/8 grid:');
    for (const s of offGrid.slice(0, top)) console.log(`  ${String(s.value).padEnd(6)} ×${s.count}  ${s.at.join(', ')}`);
  }
  if (themeReport) {
    console.log(`\nagainst ${themeFile}:`);
    console.log(`  raw values that match a token (use the token): ${themeReport.matchesToken.length}`);
    for (const r of themeReport.matchesToken.slice(0, top)) console.log(`    ${String(r.value).padEnd(10)} ×${String(r.count).padEnd(4)} -> {${r.token}}  ${r.at[0]}`);
    console.log(`  values with no token (off the theme): ${themeReport.notInTheme.length}`);
    for (const r of themeReport.notInTheme.slice(0, top))
      console.log(`    ${r.kind.padEnd(8)} ${String(r.value).padEnd(10)} ×${String(r.count).padEnd(4)} nearest {${r.nearest?.token ?? '—'}} (${r.nearest?.value ?? '—'})  ${r.at[0]}`);
    console.log(`  semantic/component tokens no file mentions: ${themeReport.unused.length}`);
    if (themeReport.unused.length) console.log(`    ${themeReport.unused.slice(0, top * 2).join(', ')}`);
  }
}
