#!/usr/bin/env node
// Assemble an ultrahand canvas page: canvas.html with a skill's config, presets and screen
// injected into its marked regions. Zero dependencies; Node 18+.
//
//   node build.mjs --screen screen.html [--config config.json] [--presets presets.md]
//                  [--head head.html] [--title "Checkout"] [--out index.html]
//
// --presets takes a .json file, or a .md file whose first ```json block holds the presets.
// Its fields are merged under --config, so the config wins on any key both set.
// See README.md for the config and screen contract.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const FRAMES = ['phone', 'tablet', 'window', 'none'];
const WINDOWS = ['mac', 'windows', 'plain'];

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') out.help = true;
    else if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = argv[i + 1];
      if (val === undefined || val.startsWith('--')) fail(`--${key} needs a value`);
      out[key] = val;
      i++;
    } else fail(`Unexpected argument: ${a}`);
  }
  return out;
}

function fail(msg) {
  console.error(`build: ${msg}`);
  process.exit(1);
}

function read(path, what) {
  try {
    return readFileSync(resolve(path), 'utf8');
  } catch (err) {
    fail(`Cannot read ${what} ${path}: ${err.message}`);
  }
}

function readJson(path, what) {
  let text = read(path, what);
  if (/\.md$/i.test(path)) {
    const m = text.match(/```json\s*\n([\s\S]*?)\n```/);
    if (!m) fail(`${path} has no \`\`\`json block`);
    text = m[1];
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    fail(`${what} ${path} is not valid JSON: ${err.message}`);
  }
}

function replaceRegion(html, name, body) {
  const begin = `<!-- ULTRAHAND:${name}:BEGIN -->`;
  const end = `<!-- ULTRAHAND:${name}:END -->`;
  const a = html.indexOf(begin);
  const b = html.indexOf(end);
  if (a < 0 || b < a) fail(`canvas.html is missing the ${name} region markers`);
  return html.slice(0, a + begin.length) + '\n' + body.trim() + '\n' + html.slice(b);
}

const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// JSON inside <script> must never contain "</script" or "<!--".
const scriptSafeJson = (v) => JSON.stringify(v, null, 2).replace(/</g, '\\u003c');

function validate(cfg) {
  const errors = [];
  const pos = (n) => typeof n === 'number' && n > 0;
  if (cfg.frame !== undefined && !FRAMES.includes(cfg.frame)) errors.push(`frame must be one of ${FRAMES.join(', ')}`);
  const all = [...(cfg.presets || []), ...(cfg.extraChecks || [])];
  if (!Array.isArray(cfg.presets) || cfg.presets.length === 0) errors.push('presets must be a non-empty array');
  const ids = new Set();
  all.forEach((p, i) => {
    const at = `preset ${p && p.id ? `"${p.id}"` : i + 1}`;
    if (!p || typeof p !== 'object') return errors.push(`${at} is not an object`);
    if (!p.id) errors.push(`${at} needs an id`);
    else if (ids.has(p.id)) errors.push(`${at}: duplicate id`);
    ids.add(p.id);
    if (!pos(p.width) || !pos(p.height)) errors.push(`${at} needs a positive width and height`);
    if (p.frame !== undefined && !FRAMES.includes(p.frame)) errors.push(`${at}: frame must be one of ${FRAMES.join(', ')}`);
    if (p.window !== undefined && !WINDOWS.includes(p.window)) errors.push(`${at}: window must be one of ${WINDOWS.join(', ')}`);
    if (p.split) {
      if (!pos(p.split.width) || p.split.width <= p.width) errors.push(`${at}: split.width must be larger than width`);
      (p.split.snaps || []).forEach((s) => {
        if (!pos(s) || s >= p.split.width) errors.push(`${at}: split snap ${s} must be between 0 and split.width`);
      });
    }
  });
  if (cfg.initialPreset && !ids.has(cfg.initialPreset)) errors.push(`initialPreset "${cfg.initialPreset}" is not a preset id`);
  const l = cfg.limits || {};
  if (l.minWidth > l.maxWidth) errors.push('limits.minWidth is larger than limits.maxWidth');
  if (l.minHeight > l.maxHeight) errors.push('limits.minHeight is larger than limits.maxHeight');
  for (const axis of ['width', 'height']) {
    const list = cfg.sizeClasses && cfg.sizeClasses[axis];
    if (list && (!Array.isArray(list) || list.some((c) => !c.name || typeof c.min !== 'number'))) {
      errors.push(`sizeClasses.${axis} must be an array of { name, min }`);
    }
  }
  if (cfg.states !== undefined && !Array.isArray(cfg.states)) errors.push('states must be an array');
  return errors;
}

function lint(screen) {
  const warn = [];
  const count = (re) => (screen.match(re) || []).length;
  const n = (re, msg) => { const c = count(re); if (c) warn.push(`${msg} (${c}×)`); };
  n(/\b\d*\.?\d+(d|s|l)?v(w|h|min|max|i|b)\b/g, 'Viewport units (vw/vh) size to the artifact window, not the screen: use cqw/cqh or %');
  n(/@media[^{]*\b(width|height|orientation|aspect-ratio)\b/g, '@media size queries see the artifact window: use @container screen (width >= …)');
  n(/prefers-color-scheme/g, 'prefers-color-scheme follows the viewer\'s OS, not the Light/Dark toggle: use light-dark() or [data-scheme]');
  n(/\b(alert|confirm|prompt)\s*\(/g, 'alert/confirm/prompt are blocked in artifacts: use canvas.toast or an in-screen dialog');
  n(/\bsrc\s*=\s*["']https?:/g, 'Remote images are blocked: inline them as data: URIs or draw them in CSS/SVG');
  n(/<iframe\b/g, 'iframes of other sites are blocked');
  n(/\bfetch\s*\(/g, 'fetch to other hosts is blocked: keep sample data inline');
  n(/font(-size)?\s*:[^;{}]*\b\d+(\.\d+)?px/g, 'Text sized in px ignores the 200% text toggle: use rem');
  return warn;
}

const opt = args(process.argv.slice(2));
if (opt.help || !opt.screen) {
  console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 10).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(opt.help ? 0 : 1);
}

const base = opt.presets ? readJson(opt.presets, 'presets') : {};
const cfg = Object.assign({}, base, opt.config ? readJson(opt.config, 'config') : {});
if (opt.title) cfg.title = opt.title;
const errors = validate(cfg);
if (errors.length) fail(`config problems:\n  - ${errors.join('\n  - ')}`);

const screen = read(opt.screen, 'screen');
if (!/<template\b[^>]*\bid\s*=\s*["']uh-screen["']/.test(screen)) fail(`${opt.screen} needs a <template id="uh-screen">`);
const head = opt.head ? read(opt.head, 'head') : '';

let html = read(resolve(here, 'canvas.html'), 'template');
html = replaceRegion(html, 'HEAD', head);
html = replaceRegion(html, 'CONFIG', `<script type="application/json" id="uh-config">\n${scriptSafeJson(cfg)}\n</script>`);
html = replaceRegion(html, 'SCREEN', screen);
html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(cfg.title || 'Canvas')}</title>`);

const out = resolve(opt.out || 'index.html');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);

for (const w of lint(screen)) console.warn(`warning: ${w}`);
const kb = (Buffer.byteLength(html) / 1024).toFixed(1);
console.log(`Wrote ${out} (${kb} KiB, ${cfg.presets.length} presets${cfg.extraChecks ? ` + ${cfg.extraChecks.length} checks` : ''})`);
