#!/usr/bin/env node
// Drive a page in Chrome with real input over the Chrome DevTools Protocol: trusted mouse,
// wheel, keyboard and touch events that go through hit testing, focus, default actions and
// scroll chaining, unlike synthetic dispatchEvent calls. Zero dependencies; Node 22+.
//
//   node drive.mjs open <url> [--size 1280x800] [--zoom 200%] [--scheme dark] [--port 9333]
//                           [--headed] [--chrome <path>]
//   node drive.mjs do <steps.json | steps.mjs | '<json>' | -> [--port 9333] [--out <dir>]
//                          [--sections <selectors>]
//   node drive.mjs close [--port 9333]
//   node drive.mjs run <url> <steps.json | steps.mjs | '<json>'> [--size 1280x800] [--out <dir>]
//
// See README.md for the step list and what each result reports.

import { spawn } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DEFAULT_PORT = 9333;
// A locked review child's shell runs only this script, so it can't set or clear this
// variable: the review CLI names the one folder the child may write in, and the only steps
// script it may run is the composition audit (a script runs as Node, with no lock at all).
const LOCK_FOLDER = 'ULTRAHAND_DRIVE_FOLDER';
const AUDIT = fileURLToPath(new URL('../composition/audit.mjs', import.meta.url));
const VERSION = 6;
const MAC = process.platform === 'darwin';
// Mod is the platform's command key: Cmd on macOS, Ctrl elsewhere.
const MODS = { Alt: 1, Option: 1, Ctrl: 2, Control: 2, Meta: 4, Cmd: 4, Shift: 8, Mod: MAC ? 4 : 2 };
// On macOS, Chrome turns editing shortcuts into editor commands in the browser process, so
// a raw CDP key event with Cmd held does nothing to a text field. Send the command with the
// key, as the real keyboard does. Keyed by modifier bits (Alt 1, Ctrl 2, Cmd 4, Shift 8).
const MAC_COMMANDS = {
  '4+a': 'selectAll', '4+c': 'copy', '4+x': 'cut', '4+v': 'paste', '4+z': 'undo',
  '12+z': 'redo', '4+ArrowLeft': 'moveToBeginningOfLine', '4+ArrowRight': 'moveToEndOfLine',
  '12+ArrowLeft': 'moveToBeginningOfLineAndModifySelection',
  '12+ArrowRight': 'moveToEndOfLineAndModifySelection',
  '4+ArrowUp': 'moveToBeginningOfDocument', '4+ArrowDown': 'moveToEndOfDocument',
  '12+ArrowUp': 'moveToBeginningOfDocumentAndModifySelection',
  '12+ArrowDown': 'moveToEndOfDocumentAndModifySelection',
  '1+ArrowLeft': 'moveWordLeft', '1+ArrowRight': 'moveWordRight',
  '9+ArrowLeft': 'moveWordLeftAndModifySelection', '9+ArrowRight': 'moveWordRightAndModifySelection',
  '4+Backspace': 'deleteToBeginningOfLine', '1+Backspace': 'deleteWordBackward',
  '1+Delete': 'deleteWordForward',
};
const BUTTONS = { none: 0, left: 1, right: 2, middle: 4 };
const NAMED_KEYS = {
  Tab: [9, 'Tab'], Enter: [13, 'Enter', '\r'], Escape: [27, 'Escape'], Esc: [27, 'Escape'],
  Space: [32, 'Space', ' '], Backspace: [8, 'Backspace'], Delete: [46, 'Delete'],
  ArrowLeft: [37, 'ArrowLeft'], ArrowUp: [38, 'ArrowUp'], ArrowRight: [39, 'ArrowRight'],
  ArrowDown: [40, 'ArrowDown'], Home: [36, 'Home'], End: [35, 'End'], PageUp: [33, 'PageUp'],
  PageDown: [34, 'PageDown'], ContextMenu: [93, 'ContextMenu'], Shift: [16, 'ShiftLeft'],
  Control: [17, 'ControlLeft'], Ctrl: [17, 'ControlLeft'], Alt: [18, 'AltLeft'],
  Option: [18, 'AltLeft'], Meta: [91, 'MetaLeft'], Cmd: [91, 'MetaLeft'],
  Mod: MAC ? [91, 'MetaLeft'] : [17, 'ControlLeft'],
};
for (let n = 1; n <= 12; n++) NAMED_KEYS[`F${n}`] = [111 + n, `F${n}`];
// US layout: each unshifted key's windows code and code name, and the character Shift gives.
const PUNCT = {
  '=': [187, 'Equal'], '-': [189, 'Minus'], ',': [188, 'Comma'], '.': [190, 'Period'],
  '/': [191, 'Slash'], ';': [186, 'Semicolon'], "'": [222, 'Quote'], '[': [219, 'BracketLeft'],
  ']': [221, 'BracketRight'], '\\': [220, 'Backslash'], '`': [192, 'Backquote'],
};
const SHIFTED = {
  '`': '~', 1: '!', 2: '@', 3: '#', 4: '$', 5: '%', 6: '^', 7: '&', 8: '*', 9: '(', 0: ')',
  '-': '_', '=': '+', '[': '{', ']': '}', '\\': '|', ';': ':', "'": '"', ',': '<', '.': '>', '/': '?',
};
// A shifted character names the key that types it: "?" is Shift+/.
const UNSHIFTED = Object.fromEntries(Object.entries(SHIFTED).map(([k, v]) => [v, k]));

function fail(msg) {
  console.error(`drive: ${msg}`);
  process.exit(1);
}

// The real path a file would get: a missing tail is joined to its nearest existing folder,
// and a link anywhere on the way is followed (a dangling one throws).
function realTarget(path) {
  let head = resolve(path);
  const tail = [];
  for (;;) {
    try {
      lstatSync(head);
      break;
    } catch (err) {
      if (err.code !== 'ENOENT' || dirname(head) === head) throw err;
      tail.unshift(basename(head));
      head = dirname(head);
    }
  }
  return join(realpathSync(head), ...tail);
}

function lockedFolder() {
  const folder = process.env[LOCK_FOLDER];
  if (!folder) return null;
  try {
    return realpathSync(folder);
  } catch {
    fail(`${LOCK_FOLDER} names ${folder}, which isn't there`);
  }
}

function checkOut(out) {
  const folder = lockedFolder();
  if (!folder || out === undefined) return;
  let target;
  try {
    target = realTarget(out);
  } catch (err) {
    fail(`--out ${out}: ${err.message}`);
  }
  if (target !== folder && !target.startsWith(folder + sep)) fail(`--out must be inside ${folder} in a review run`);
}

function checkScript(file) {
  if (!lockedFolder()) return;
  let target;
  try {
    target = realpathSync(file);
  } catch (err) {
    fail(`${file}: ${err.message}`);
  }
  if (target !== realpathSync(AUDIT)) fail(`a review run takes steps as JSON; the only steps script it runs is ${AUDIT}`);
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--headed') out.headed = true;
    else if (a === '-h' || a === '--help') out.help = true;
    else if (a.startsWith('--')) {
      if (argv[i + 1] === undefined) fail(`${a} needs a value`);
      out[a.slice(2)] = argv[++i];
    } else out._.push(a);
  }
  return out;
}

function parseZoom(z) {
  const n = typeof z === 'string' && z.endsWith('%') ? Number(z.slice(0, -1)) / 100 : Number(z);
  if (!Number.isFinite(n)) throw new Error(`zoom wants a number or a percentage, got ${z}`);
  return n;
}

function parseSize(text) {
  const m = /^(\d+)x(\d+)$/.exec(text || '');
  if (!m) fail(`--size wants WIDTHxHEIGHT, got ${text}`);
  return [Number(m[1]), Number(m[2])];
}

function toUrl(target) {
  if (/^[a-z]+:/i.test(target)) return target;
  if (!existsSync(target)) fail(`No such file: ${target}`);
  return pathToFileURL(resolve(target)).href;
}

function findChrome(given) {
  const candidates = [
    given, process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium',
    '/usr/bin/chromium-browser', '/snap/bin/chromium',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];
  const found = candidates.find((p) => p && existsSync(p));
  if (!found) fail('Chrome not found. Pass --chrome <path> or set CHROME_PATH.');
  return found;
}

async function getJson(port, path) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`);
  return res.json();
}

async function waitForPort(port, ms = 15000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      return await getJson(port, '/json/version');
    } catch {
      await new Promise((r) => setTimeout(r, 150));
    }
  }
  fail(`Chrome did not open its debugging port ${port}`);
}

class Cdp {
  static async connect(wsUrl) {
    const cdp = new Cdp();
    cdp.ws = new WebSocket(wsUrl);
    cdp.next = 1;
    cdp.pending = new Map();
    cdp.listeners = [];
    cdp.ws.addEventListener('message', (ev) => cdp.onMessage(JSON.parse(ev.data)));
    await new Promise((ok, bad) => {
      cdp.ws.addEventListener('open', ok, { once: true });
      cdp.ws.addEventListener('error', () => bad(new Error(`Cannot connect to ${wsUrl}`)), { once: true });
    });
    return cdp;
  }

  onMessage(msg) {
    if (msg.id && this.pending.has(msg.id)) {
      const { ok, bad, method } = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      if (msg.error) bad(new Error(`${method}: ${msg.error.message}`));
      else ok(msg.result);
    } else if (msg.method) {
      for (const fn of this.listeners) fn(msg.method, msg.params);
    }
  }

  send(method, params = {}) {
    const id = this.next++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((ok, bad) => this.pending.set(id, { ok, bad, method }));
  }

  on(fn) {
    this.listeners.push(fn);
  }

  close() {
    this.ws.close();
  }
}

async function pageSocket(port) {
  let targets;
  try {
    targets = await getJson(port, '/json/list');
  } catch {
    fail(`No browser on port ${port}. Start one with: node drive.mjs open <url>`);
  }
  const page = targets.find((t) => t.type === 'page');
  if (!page) fail(`No page open on port ${port}`);
  return page.webSocketDebuggerUrl;
}

async function launch(url, opts) {
  const port = Number(opts.port || DEFAULT_PORT);
  const busy = await getJson(port, '/json/version').then(() => true, () => false);
  if (busy) fail(`Port ${port} is already in use. Close it with: node drive.mjs close --port ${port}`);
  const [w, h] = parseSize(opts.size || '1280x800');
  const profile = mkdtempSync(join(tmpdir(), 'ultrahand-drive-'));
  const args = [
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run',
    '--no-default-browser-check', '--disable-extensions', '--disable-sync',
    `--window-size=${w},${h}`, opts.headed ? null : '--headless=new', 'about:blank',
  ].filter(Boolean);
  const child = spawn(findChrome(opts.chrome), args, { detached: true, stdio: 'ignore' });
  child.unref();
  await waitForPort(port);
  rmSync(stateFile(port), { force: true });
  const cdp = await Cdp.connect(await pageSocket(port));
  const sized = await emulate(cdp, port, { size: [w, h], zoom: parseZoom(opts.zoom ?? 1),
    scheme: opts.scheme === 'none' ? undefined : opts.scheme });
  await navigate(cdp, toUrl(url));
  cdp.close();
  return { port, pid: child.pid, url: toUrl(url), ...sized };
}

// Per-port state shared by `do` calls: the window's viewport size, the page zoom and the
// colour scheme, and the token of the `hold` process keeping any emulation.
const stateFile = (port) => join(tmpdir(), `ultrahand-drive-${port}.json`);

function readState(port) {
  try {
    return JSON.parse(readFileSync(stateFile(port), 'utf8'));
  } catch {
    return {};
  }
}

// Ends a hold: the hold process sees its token gone and disconnects, which drops its overrides.
async function releaseHold(port) {
  const state = readState(port);
  rmSync(stateFile(port), { force: true });
  if (state.token) await sleep(300);
}

// Sizes the viewport, zooms the page and sets the colour scheme. A change keeps the other
// two as they were. The real window is used for the size when it can reach it, and it stays
// for later `do` calls. Anything else needs an override: below the window's minimum (about
// 500px wide headless) a device-metrics one, for zoom one with a CSS viewport 1/zoom the
// size and a device scale factor of zoom, which lays out and draws as browser page zoom
// does, and for the scheme an emulated media feature. CDP drops an override when its
// connection closes, so a small `hold` process keeps them until the next change or `close`.
async function emulate(cdp, port, change) {
  const prev = readState(port);
  const size = change.size || prev.size || await viewportSize(cdp);
  const zoom = change.zoom ?? prev.zoom ?? 1;
  const scheme = 'scheme' in change ? change.scheme : prev.scheme;
  if (!(zoom >= 0.25 && zoom <= 5)) throw new Error(`zoom wants 0.25 to 5 (or 25% to 500%), got ${zoom}`);
  if (scheme && !['light', 'dark'].includes(scheme)) throw new Error(`scheme wants light, dark or none, got ${scheme}`);
  await releaseHold(port);
  const [width, height] = size;
  const actual = await setViewport(cdp, width, height);
  const metrics = actual[0] !== width || actual[1] !== height || zoom !== 1;
  const state = { size, ...(zoom !== 1 ? { zoom } : {}), ...(scheme ? { scheme } : {}) };
  const out = { size, ...(zoom !== 1 ? { zoom, cssViewport: cssSize(size, zoom) } : {}),
    ...(scheme ? { scheme } : {}) };
  if (!metrics && !scheme) {
    writeFileSync(stateFile(port), JSON.stringify(state));
    return out;
  }
  const token = `${process.pid}-${Date.now()}`;
  writeFileSync(stateFile(port), JSON.stringify({ ...state, metrics, token }));
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), 'hold',
    '--port', String(port), '--token', token], { detached: true, stdio: 'ignore' });
  child.unref();
  if (await emulated(cdp, { ...state, metrics }, 5000)) {
    if (actual[0] !== width || actual[1] !== height) {
      out.emulated = `the window stops at ${actual.join('x')}, so this size is a device-metrics `
        + 'override. It holds across do calls until the next size step or close.';
    }
    return out;
  }
  await releaseHold(port);
  throw new Error(`Could not emulate ${JSON.stringify(state)}; the window stops at ${actual.join('x')}`);
}

// The CSS viewport of a window viewport at a page zoom, as Chrome rounds it.
const cssSize = ([w, h], zoom) => [Math.round(w / zoom), Math.round(h / zoom)];

// An expression that is true when the page shows the state's size, zoom and scheme.
function emulationCheck({ size, zoom = 1, scheme, metrics }) {
  const [w, h] = metrics ? cssSize(size, zoom) : size;
  return `innerWidth === ${w} && innerHeight === ${h}` + (metrics ? ` && devicePixelRatio === ${zoom}` : '')
    + (scheme ? ` && matchMedia('(prefers-color-scheme: ${scheme})').matches` : '');
}

// Waits up to `ms` for the page to show the state's emulation; true once it does.
async function emulated(cdp, state, ms) {
  const end = Date.now() + ms;
  do {
    const { result } = await cdp.send('Runtime.evaluate', { expression: emulationCheck(state), returnByValue: true })
      .catch(() => ({ result: {} }));
    if (result.value === true) return true;
    await sleep(100);
  } while (Date.now() < end);
  return false;
}

// Keeps the state's overrides. Another connection that sets an override of its own (a shot
// at a zoom does) clears this one's when it closes, so the hold puts them back when the page
// stops matching.
async function hold(port, token) {
  const state = readState(port);
  const { size, zoom = 1, scheme, metrics } = state;
  const cdp = await Cdp.connect(await pageSocket(port));
  const apply = async (again) => {
    if (metrics) {
      const [width, height] = cssSize(size, zoom);
      // Chrome skips an override that equals this connection's last one, so clear it first.
      if (again) await cdp.send('Emulation.clearDeviceMetricsOverride');
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: zoom, mobile: false });
    }
    if (scheme) {
      await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] });
    }
  };
  await apply();
  cdp.ws.addEventListener('close', () => process.exit(0));
  let busy = false;
  setInterval(async () => {
    if (readState(port).token !== token) {
      cdp.close();
      process.exit(0);
    }
    if (busy) return;
    busy = true;
    try {
      const { result } = await cdp.send('Runtime.evaluate', { expression: emulationCheck(state), returnByValue: true });
      if (result.value === false) await apply(true);
    } catch {
      // The page is between documents; check again on the next tick.
    } finally {
      busy = false;
    }
  }, 100);
}

async function viewportSize(cdp) {
  const { result } = await cdp.send('Runtime.evaluate', {
    expression: '[innerWidth, innerHeight]', returnByValue: true,
  });
  return result.value;
}

// Sizes the real browser window so the viewport is width x height, as near as it can.
async function setViewport(cdp, width, height) {
  const { windowId } = await cdp.send('Browser.getWindowForTarget');
  await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'normal' } });
  let outer = { width, height };
  for (let i = 0; i < 3; i++) {
    await cdp.send('Browser.setWindowBounds', { windowId, bounds: outer });
    await sleep(100);
    const [iw, ih] = await viewportSize(cdp);
    if (iw === width && ih === height) return [iw, ih];
    outer = { width: outer.width + width - iw, height: outer.height + height - ih };
  }
  return viewportSize(cdp);
}

async function navigate(cdp, url) {
  await cdp.send('Page.enable');
  const loaded = new Promise((ok) => cdp.on((m) => m === 'Page.loadEventFired' && ok()));
  await cdp.send('Page.navigate', { url });
  await Promise.race([loaded, new Promise((r) => setTimeout(r, 10000))]);
  await sleep(100);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Page-side helpers, installed once per document. Selectors search the document and every
// open shadow root; "@<n>" is a control from the last `controls` step; "text=Save" matches
// an interactive element by its accessible name or text.
const PAGE_HELPERS = `(() => {
  if (window.__uhDrive?.version === ${VERSION}) return;
  const INTERACTIVE = 'a[href], button, input:not([type=hidden]), select, textarea, summary, label[for], [contenteditable=""], [contenteditable=true], [role=button], [role=link], [role=tab], [role=switch], [role=checkbox], [role=radio], [role=menuitem], [role=option], [role=slider], [role=separator][tabindex], [role=combobox], [tabindex]:not([tabindex="-1"]), [data-nav], [data-nav-back]';
  const roots = () => {
    const out = [document];
    for (let i = 0; i < out.length; i++)
      for (const el of out[i].querySelectorAll('*')) if (el.shadowRoot) out.push(el.shadowRoot);
    return out;
  };
  const all = (sel) => roots().flatMap((r) => [...r.querySelectorAll(sel)]);
  const ownText = (el) => [...el.childNodes].map((n) => n.nodeType === 3 ? n.textContent
    : n.nodeType === 1 && !n.matches('select, input, textarea, option, datalist') ? ownText(n) : '').join(' ');
  const clean = (t) => (t || '').replace(/\\s+/g, ' ').trim();
  const name = (el) => {
    const label = clean(el.getAttribute('aria-label')) || clean(el.labels?.[0] && ownText(el.labels[0]));
    if (el.localName === 'select') return (label + ' = ' + clean(el.selectedOptions[0]?.text)).trim().slice(0, 60);
    if (/^(input|textarea)$/.test(el.localName)) return (label || clean(el.placeholder) || el.type).slice(0, 60);
    return (label || clean(ownText(el)) || clean(el.title)).slice(0, 60);
  };
  const desc = (el) => {
    if (!el) return null;
    if (el.nodeType !== 1) return String(el.nodeName);
    let s = el.localName;
    if (el.id) s += '#' + el.id;
    const cls = [...el.classList].slice(0, 2).join('.');
    if (cls) s += '.' + cls;
    const role = el.getAttribute('role');
    if (role) s += '[role=' + role + ']';
    const n = name(el);
    return n ? s + ' "' + n + '"' : s;
  };
  const deepActive = () => {
    let a = document.activeElement;
    while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement;
    return a;
  };
  const deepHit = (x, y) => {
    let el = document.elementFromPoint(x, y);
    while (el && el.shadowRoot) {
      const inner = el.shadowRoot.elementFromPoint(x, y);
      if (!inner || inner === el) break;
      el = inner;
    }
    return el;
  };
  const contains = (a, b) => {
    for (let n = b; n; n = n.parentNode || n.host) if (n === a) return true;
    return false;
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
  };
  const resolve = (target) => {
    if (typeof target === 'string' && target.startsWith('@')) {
      const el = window.__uhDrive.refs[Number(target.slice(1))];
      if (!el || !el.isConnected) throw new Error(target + ' is gone; run a controls step again');
      return el;
    }
    if (typeof target === 'string' && target.startsWith('text=')) {
      const want = target.slice(5).toLowerCase();
      const found = all(INTERACTIVE).filter(visible);
      const el = found.find((e) => name(e).toLowerCase() === want) || found.find((e) => name(e).toLowerCase().includes(want));
      if (!el) throw new Error('No visible control named ' + JSON.stringify(target.slice(5)));
      return el;
    }
    const matches = all(target);
    const el = matches.find(visible) || matches[0];
    if (!el) throw new Error('No element matches ' + target);
    return el;
  };
  const scrollers = () => all('*').filter((el) => {
    const cs = getComputedStyle(el);
    return (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1)
      || (/(auto|scroll)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1);
  }).concat(document.scrollingElement || []);
  const parentOf = (el) => el.parentElement || el.parentNode?.host || null;
  const clipRect = (el) => {
    const r = el.getBoundingClientRect();
    let box = { left: Math.max(r.left, 0), top: Math.max(r.top, 0),
      right: Math.min(r.right, innerWidth), bottom: Math.min(r.bottom, innerHeight) };
    for (let p = parentOf(el); p && p !== document.documentElement; p = parentOf(p)) {
      const cs = getComputedStyle(p);
      if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
      const q = p.getBoundingClientRect();
      box = { left: Math.max(box.left, q.left), top: Math.max(box.top, q.top),
        right: Math.min(box.right, q.right), bottom: Math.min(box.bottom, q.bottom) };
    }
    return box.right > box.left && box.bottom > box.top ? box : null;
  };
  const centreOf = (box) => [Math.round((box.left + box.right) / 2), Math.round((box.top + box.bottom) / 2)];
  /* inspect: the layout as numbers, so a review checks contrast, targets, clipping, overlap
     and focus order without screenshots. Colours go through a 1px canvas, which turns any
     computed CSS colour (rgb, color(srgb), oklch, light-dark already resolved) into sRGB. */
  const pen = Object.assign(document.createElement('canvas'), { width: 1, height: 1 })
    .getContext('2d', { willReadFrequently: true });
  const colours = new Map();
  const rgba = (c) => {
    if (!colours.has(c)) {
      pen.clearRect(0, 0, 1, 1);
      pen.fillStyle = 'transparent';
      pen.fillStyle = c;
      pen.fillRect(0, 0, 1, 1);
      const d = pen.getImageData(0, 0, 1, 1).data;
      colours.set(c, [d[0], d[1], d[2], d[3] / 255]);
    }
    return colours.get(c);
  };
  const over = (top, under) => [0, 1, 2].map((i) => top[i] * top[3] + under[i] * (1 - top[3])).concat(1);
  const hex = (c) => '#' + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  const lum = (c) => {
    const [r, g, b] = c.slice(0, 3).map((v) => (v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
  };
  const COLOUR = /(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\\([^()]*\\)|#[0-9a-f]{3,8}\\b/gi;
  /* What can sit behind el: its own background and its ancestors', down to the first opaque
     one, on the page canvas. A gradient gives one candidate per stop; an image gives none. */
  const behind = (el) => {
    const rs = getComputedStyle(document.documentElement).colorScheme;
    const dark = /dark/.test(rs) && (!/light/.test(rs) || matchMedia('(prefers-color-scheme: dark)').matches);
    const layers = [];
    let opacity = 1;
    for (let p = el, solid = false; p && !solid; p = parentOf(p)) {
      const cs = getComputedStyle(p);
      if (cs.backgroundImage !== 'none') {
        const stops = cs.backgroundImage.match(COLOUR);
        if (/url\\(|image-set\\(|element\\(/.test(cs.backgroundImage) || !stops) return { image: desc(p) };
        layers.push(stops.map(rgba));
      }
      const c = rgba(cs.backgroundColor);
      if (c[3] > 0) layers.push([c]);
      solid = c[3] >= 1;
      if (!solid) opacity *= Number(cs.opacity);
    }
    let under = [dark ? [18, 18, 18, 1] : [255, 255, 255, 1]];
    for (const layer of layers.reverse()) under = layer.flatMap((top) => under.map((u) => over(top, u))).slice(0, 12);
    return { under, opacity };
  };
  const lineBoxes = (el) => {
    const range = document.createRange();
    const rects = [];
    for (const n of el.childNodes) {
      if (n.nodeType !== 3 || !n.textContent.trim()) continue;
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) if (r.width >= 1 && r.height >= 1) rects.push(r);
    }
    return rects;
  };
  const union = (rects) => rects.reduce((b, r) => ({ left: Math.min(b.left, r.left), top: Math.min(b.top, r.top),
    right: Math.max(b.right, r.right), bottom: Math.max(b.bottom, r.bottom) }),
    { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
  const boxOf = (b) => [b.left, b.top, b.right - b.left, b.bottom - b.top].map(Math.round);
  const fieldText = (el, cs) => {
    if (el.localName === 'select') return { text: clean(el.selectedOptions[0]?.text), color: cs.color };
    if (!/^(input|textarea)$/.test(el.localName)) return null;
    if (/^(submit|reset|button)$/.test(el.type)) return { text: clean(el.value), color: cs.color };
    if (/^(checkbox|radio|range|color|file|image)$/.test(el.type)) return null;
    if (el.value) return { text: el.type === 'password' ? '***' : clean(el.value).slice(0, 40), color: cs.color };
    if (el.placeholder) return { text: clean(el.placeholder), color: getComputedStyle(el, '::placeholder').color, placeholder: true };
    return null;
  };
  /* Text another box cuts off: the element's own hidden overflow (an ellipsis or a line
     clamp), or an ancestor that hides overflow, up to the first one that scrolls. Text past
     the window's side with no scroller to reach it is off screen: a reflow failure. */
  const cutOff = (el, cs, b) => {
    if (cs.display !== 'inline') {
      const hx = /hidden|clip/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1;
      const hy = /hidden|clip/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1;
      if (hx || hy) return { by: 'itself', px: Math.max(hx ? el.scrollWidth - el.clientWidth : 0, hy ? el.scrollHeight - el.clientHeight : 0) };
    }
    let scrollsX = false;
    for (let p = parentOf(el); p && p !== document.documentElement && p !== document.body; p = parentOf(p)) {
      const ps = getComputedStyle(p);
      if (ps.overflowX === 'visible' && ps.overflowY === 'visible') continue;
      const sx = /auto|scroll/.test(ps.overflowX), sy = /auto|scroll/.test(ps.overflowY);
      const q = p.getBoundingClientRect();
      const dx = sx ? 0 : Math.max(q.left - b.left, b.right - q.right, 0);
      const dy = sy ? 0 : Math.max(q.top - b.top, b.bottom - q.bottom, 0);
      if (dx > 1 || dy > 1) return { by: desc(p), px: Math.round(Math.max(dx, dy)) };
      scrollsX ||= sx;
      if (sx && sy) break;
    }
    const past = Math.max(b.right - innerWidth, -b.left, 0);
    return !scrollsX && past > 1 ? { by: 'window', px: Math.round(past) } : null;
  };
  const coveredBy = (el, b, inScope) => {
    const v = { left: Math.max(b.left, 0), top: Math.max(b.top, 0), right: Math.min(b.right, innerWidth), bottom: Math.min(b.bottom, innerHeight) };
    if (v.right <= v.left || v.bottom <= v.top || getComputedStyle(el).pointerEvents === 'none') return null;
    const top = deepHit(...centreOf(v));
    return top && inScope(top) && !contains(el, top) && !contains(top, el) ? desc(top) : null;
  };
  const composed = () => {
    const out = [];
    const walk = (node) => {
      const slotted = node.localName === 'slot' ? node.assignedElements({ flatten: true }) : [];
      for (const c of slotted.length ? slotted : [...(node.shadowRoot || node).children]) { out.push(c); walk(c); }
    };
    walk(document);
    return out;
  };
  const inspect = (scope, min) => {
    const root = scope === true || scope == null ? null : resolve(scope);
    const inScope = (el) => !root || contains(root, el);
    const issues = [];
    const elements = [];
    const pairs = new Map();
    const unresolved = [];
    const texts = [];
    const shown = (el) => visible(el) && !el.closest('datalist, script, style, noscript, template, title')
      && (el.localName === 'select' || !el.closest('select'));
    const alpha = (el) => { let o = 1; for (let p = el; p; p = parentOf(p)) o *= Number(getComputedStyle(p).opacity); return o; };
    for (const el of all('*')) {
      if (!inScope(el) || !shown(el)) continue;
      const cs = getComputedStyle(el);
      const field = fieldText(el, cs);
      const rects = field ? (field.text ? [el.getBoundingClientRect()] : []) : lineBoxes(el);
      if (!rects.length || alpha(el) < 0.05) continue;
      const b = union(rects);
      if (b.right - b.left <= 1 || b.bottom - b.top <= 1) continue;
      const text = field ? field.text : clean(ownText(el));
      const size = parseFloat(cs.fontSize);
      const weight = Number(cs.fontWeight);
      const need = size >= 24 || (size >= 18.66 && weight >= 700) ? 3 : 4.5;
      const off = !!el.closest(':disabled') || el.closest('[aria-disabled=true]');
      const item = { el: desc(el), text: text.slice(0, 50), font: Math.round(size * 10) / 10 + '/' + weight, box: boxOf(b) };
      const bg = behind(el);
      const fg = rgba(field ? field.color : cs.color);
      if (bg.image) {
        item.bg = 'image on ' + bg.image;
        unresolved.push(item.el);
      } else {
        const tint = [fg[0], fg[1], fg[2], fg[3] * bg.opacity];
        const worst = bg.under.map((u) => ({ u, r: contrast(over(tint, u), u) })).sort((x, y) => x.r - y.r)[0];
        Object.assign(item, { fg: hex(over(tint, worst.u)), bg: hex(worst.u), ratio: worst.r, need });
        if (bg.under.length > 1) item.gradient = true;
        if (worst.r < need && !off) {
          const key = item.fg + item.bg + need;
          const g = pairs.get(key) || { kind: 'contrast', ratio: worst.r, need, fg: item.fg, bg: item.bg, n: 0, eg: [] };
          g.n++;
          if (g.eg.length < 3) g.eg.push(item.el + (field?.placeholder ? ' (placeholder)' : ''));
          pairs.set(key, g);
        }
      }
      const cut = cutOff(el, cs, b);
      if (cut) { item.cut = cut; issues.push({ kind: cut.by === 'window' ? 'offscreen' : 'cut', el: item.el, by: cut.by, px: cut.px }); }
      const cover = coveredBy(el, b, inScope);
      if (cover) { item.covered = cover; issues.push({ kind: 'covered', el: item.el, by: cover }); }
      texts.push({ el, rects, desc: item.el });
      elements.push(item);
    }
    issues.unshift(...[...pairs.values()].sort((a, b) => a.ratio - b.ratio));
    /* Text drawn over other text: line boxes of two elements, neither inside the other, that
       intersect by more than 2px each way. */
    for (let i = 0; i < texts.length && i < 600; i++) {
      for (let j = i + 1; j < texts.length && j < 600; j++) {
        const a = texts[i], c = texts[j];
        if (contains(a.el, c.el) || contains(c.el, a.el)) continue;
        const hit = a.rects.some((r) => c.rects.some((s) =>
          Math.min(r.right, s.right) - Math.max(r.left, s.left) > 2 && Math.min(r.bottom, s.bottom) - Math.max(r.top, s.top) > 2));
        if (hit) issues.push({ kind: 'overlap', el: a.desc, with: c.desc });
      }
    }
    /* Targets, in CSS px (a zoomed canvas frame scales the boxes, not the layout). WCAG 2.5.8:
       under 24px passes if a 24px circle on its centre touches no other target, and no other
       undersized target's circle; a link inside a sentence is exempt. */
    const ctrls = all(INTERACTIVE).filter((el) => visible(el) && inScope(el)
      && !(el.localName === 'label' && el.control && el.contains(el.control)));
    const live = ctrls.filter((el) => !el.disabled && el.getAttribute('aria-disabled') !== 'true').map((el) => {
      const r = el.getBoundingClientRect();
      const size = el.offsetWidth !== undefined ? [el.offsetWidth, el.offsetHeight] : [r.width, r.height].map(Math.round);
      return { el, r, size, scale: size[0] ? r.width / size[0] : 1, c: [r.left + r.width / 2, r.top + r.height / 2] };
    });
    const small = (t) => t.size[0] < 24 || t.size[1] < 24;
    const gap = (p, r) => Math.hypot(Math.max(r.left - p[0], 0, p[0] - r.right), Math.max(r.top - p[1], 0, p[1] - r.bottom));
    for (const t of live) {
      if (t.size[0] >= min && t.size[1] >= min) continue;
      const cs = getComputedStyle(t.el);
      if (cs.display === 'inline' && clean(ownText(parentOf(t.el))).length > clean(ownText(t.el)).length + 1) continue;
      const near = live.find((o) => o !== t && !contains(o.el, t.el) && !contains(t.el, o.el)
        && (gap(t.c, o.r) < 12 * t.scale || (small(t) && small(o) && Math.hypot(o.c[0] - t.c[0], o.c[1] - t.c[1]) < 24 * t.scale)));
      issues.push({ kind: 'target', el: desc(t.el), size: t.size, min,
        wcag: !small(t) ? 'pass' : near ? 'fail: ' + desc(near.el) + ' is within 12px' : 'pass by spacing' });
    }
    /* Non-text contrast (1.4.11) for fields, whose edge is how a person finds them: the
       best of fill and borders against what is around them must reach 3:1. */
    const FIELD = 'input:not([type=hidden], [type=submit], [type=reset], [type=button], [type=image]), select, textarea, [role=checkbox], [role=switch], [role=radio], [role=slider], [role=combobox], [role=textbox]';
    for (const t of live) {
      const el = t.el;
      const cs = getComputedStyle(el);
      if (!el.matches(FIELD) || (/^(checkbox|radio|range|color)$/.test(el.type) && cs.appearance !== 'none')) continue;
      const out = behind(parentOf(el));
      if (out.image) continue;
      const around = out.under[0];
      let edge = contrast(over(rgba(cs.backgroundColor), around), around);
      for (const s of ['Top', 'Right', 'Bottom', 'Left']) {
        if (parseFloat(cs['border' + s + 'Width']) >= 1 && !/none|hidden/.test(cs['border' + s + 'Style'])) {
          edge = Math.max(edge, contrast(over(rgba(cs['border' + s + 'Color']), around), around));
        }
      }
      for (const c of cs.boxShadow === 'none' ? [] : cs.boxShadow.match(COLOUR) || []) edge = Math.max(edge, contrast(over(rgba(c), around), around));
      if (edge < 3) issues.push({ kind: 'field-edge', el: desc(el), ratio: edge, need: 3, around: hex(around) });
    }
    /* Focus order: what Tab visits, in the composed tree (through shadow roots and slots),
       positive tabindex first; one stop per radio group. A step that goes up the page is
       listed: right in a new column, wrong within one. */
    const tree = composed();
    const radios = new Set();
    const stops = tree.filter((el) => el.tabIndex >= 0 && !el.disabled && !el.closest('[inert]') && visible(el) && inScope(el))
      .filter((el) => {
        if (el.localName !== 'input' || el.type !== 'radio' || !el.name) return true;
        const key = (el.form ? 'f' : 'r') + el.name;
        if (radios.has(key)) return false;
        const group = tree.filter((o) => o.localName === 'input' && o.type === 'radio' && o.name === el.name && o.form === el.form);
        const pick = group.find((o) => o.checked) || group[0];
        if (pick !== el) return false;
        radios.add(key);
        return true;
      });
    const order = [...stops.filter((el) => el.tabIndex > 0).sort((a, b) => a.tabIndex - b.tabIndex), ...stops.filter((el) => el.tabIndex === 0)];
    for (const el of order) if (el.tabIndex > 0) issues.push({ kind: 'tabindex', el: desc(el), tabindex: el.tabIndex });
    const focusOrder = order.map((el, i) => {
      const r = el.getBoundingClientRect();
      const prev = i && order[i - 1].getBoundingClientRect();
      const up = prev && r.bottom <= prev.top - 1;
      if (up) issues.push({ kind: 'focus-up', from: desc(order[i - 1]), to: desc(el) });
      return (i + 1) + ' ' + desc(el) + ' @' + Math.round(r.left) + ',' + Math.round(r.top);
    });
    for (const t of live) elements.push({ el: desc(t.el), control: true, size: t.size, box: boxOf(t.r) });
    const kinds = {};
    const capped = issues.filter((x) => (kinds[x.kind] = (kinds[x.kind] || 0) + 1) <= 20);
    for (const k in kinds) if (kinds[k] > 20) capped.push({ kind: k, more: kinds[k] - 20 });
    const scale = live[0] ? Math.round(live[0].scale * 100) / 100 : 1;
    const page = document.scrollingElement;
    return {
      viewport: [innerWidth, innerHeight], ...(scale !== 1 ? { scale } : {}),
      counts: { text: texts.length, controls: live.length, tabStops: order.length, issues: issues.length, unresolved: unresolved.length },
      ...(page && page.scrollWidth > innerWidth + 1 ? { pageOverflowX: page.scrollWidth - innerWidth } : {}),
      issues: capped,
      ...(unresolved.length ? { unresolved: unresolved.slice(0, 8) } : {}),
      focusOrder: focusOrder.length > 80 ? focusOrder.slice(0, 80).concat('+' + (focusOrder.length - 80) + ' more') : focusOrder,
      elements,
    };
  };
  window.__uhDrive = {
    version: ${VERSION},
    refs: window.__uhDrive?.refs || [],
    desc, deepActive, deepHit, resolve, inspect,
    point(target) {
      const el = resolve(target);
      let box = clipRect(el);
      let scrolled = false;
      if (!box) {
        el.scrollIntoView({ block: 'center', inline: 'center' });
        box = clipRect(el);
        scrolled = true;
      }
      if (!box) throw new Error('Not visible even after scrolling into view: ' + desc(el));
      const r = el.getBoundingClientRect();
      const [x, y] = centreOf(box);
      const top = deepHit(x, y);
      return { x, y, w: Math.round(r.width), h: Math.round(r.height), target: desc(el),
        hit: !!top && contains(el, top), topmost: desc(top), scrolledIntoView: scrolled };
    },
    at(x, y) { return desc(deepHit(x, y)); },
    selectInfo(target, by, want) {
      const el = resolve(target);
      if (el.localName !== 'select') {
        throw new Error('choose needs a native <select>, and ' + desc(el) + ' is not one: drive a custom listbox with click and key steps');
      }
      const opts = [...el.options];
      const w = clean(want).toLowerCase();
      /* By text, a person can only pick an option they can see and that is enabled, so a
         disabled or hidden "Large, resized" never wins over "Large". */
      const usable = (o) => !o.disabled && !o.closest('optgroup[disabled]') && !o.hidden && getComputedStyle(o).display !== 'none';
      const byText = (ok) => [(o) => clean(o.text).toLowerCase() === w, (o) => clean(o.text).toLowerCase().includes(w)]
        .map((f) => opts.findIndex((o) => ok(o) && f(o))).find((n) => n >= 0) ?? -1;
      let i = by === 'value' ? opts.findIndex((o) => o.value === want) : byText(usable);
      if (i < 0 && by !== 'value') i = byText(() => true);
      return { target: desc(el), index: i, text: i >= 0 ? clean(opts[i].text) : null,
        value: i >= 0 ? opts[i].value : null, current: el.selectedIndex,
        focused: deepActive() === el, multiple: el.multiple,
        disabled: el.disabled || (i >= 0 && (opts[i].disabled || !!opts[i].closest('optgroup[disabled]'))),
        hidden: i >= 0 && (opts[i].hidden || getComputedStyle(opts[i]).display === 'none'),
        options: opts.slice(0, 40).map((o) => clean(o.text)) };
    },
    focusEl(target) { resolve(target).focus(); },
    selectedIndex(target) { return resolve(target).selectedIndex; },
    forceSelect(target, i) {
      const el = resolve(target);
      el.selectedIndex = i;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    },
    focus() { return desc(deepActive()); },
    scrollSnapshot() {
      return scrollers().map((el) => ({ el, top: el.scrollTop, left: el.scrollLeft }));
    },
    controls() {
      const els = all(INTERACTIVE).filter(visible)
        .filter((el) => !(el.localName === 'label' && el.control && el.contains(el.control)));
      window.__uhDrive.refs = els;
      return els.map((el, i) => {
        const r = el.getBoundingClientRect();
        const box = clipRect(el);
        const inView = !!box;
        const [x, y] = box ? centreOf(box) : [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)];
        const top = inView ? deepHit(x, y) : null;
        return { ref: '@' + i, control: desc(el), x, y,
          w: Math.round(r.width), h: Math.round(r.height), inView,
          covered: inView && !!top && !contains(el, top) ? desc(top) : null,
          disabled: !!el.disabled || el.getAttribute('aria-disabled') === 'true' };
      });
    },
  };
})()`;

class Driver {
  constructor(cdp, outDir, port) {
    this.cdp = cdp;
    this.outDir = outDir;
    this.port = port;
    this.errors = [];
    this.mouse = { x: 0, y: 0 };
    cdp.on((method, p) => {
      if (method === 'Runtime.exceptionThrown') {
        this.errors.push(p.exceptionDetails.exception?.description || p.exceptionDetails.text);
      } else if (method === 'Runtime.consoleAPICalled' && p.type === 'error') {
        this.errors.push(p.args.map((a) => a.value ?? a.description).join(' '));
      }
    });
  }

  async init() {
    await this.cdp.send('Runtime.enable');
    await this.cdp.send('Page.enable');
  }

  async js(expr, arg) {
    await this.cdp.send('Runtime.evaluate', { expression: PAGE_HELPERS });
    return this.evaluate(`(${expr})(${arg === undefined ? '' : JSON.stringify(arg)})`);
  }

  async evaluate(expression, extra = {}) {
    const res = await this.cdp.send('Runtime.evaluate', {
      expression, returnByValue: true, awaitPromise: true, ...extra,
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.exception?.description?.split('\n')[0] || res.exceptionDetails.text);
    }
    return res.result.value;
  }

  async point(target) {
    if (Array.isArray(target)) {
      const [x, y] = target;
      return { x, y, topmost: await this.js('(p) => __uhDrive.at(p[0], p[1])', [x, y]) };
    }
    return this.js('(t) => __uhDrive.point(t)', target);
  }

  async mouseEvent(type, x, y, extra = {}) {
    await this.cdp.send('Input.dispatchMouseEvent', { type, x, y, ...extra });
    this.mouse = { x, y };
  }

  async move(x, y, steps = 1, extra = {}) {
    const { x: x0, y: y0 } = this.mouse;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      await this.mouseEvent('mouseMoved', Math.round(x0 + (x - x0) * t), Math.round(y0 + (y - y0) * t), extra);
    }
  }

  async key(combo, { repeat = 1, up = true, down = true } = {}) {
    const { key, mods } = parseCombo(combo);
    const modifiers = mods.reduce((m, k) => m | MODS[k], 0);
    const [code, keyName, codeName, text] = keyInfo(key, mods.includes('Shift'));
    const command = macCommand(modifiers, key);
    for (let i = 0; i < repeat; i++) {
      if (down) {
        for (const m of mods) await this.cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...modKey(m), modifiers });
        const sendsText = text && !(modifiers & (MODS.Ctrl | MODS.Meta | MODS.Alt));
        await this.cdp.send('Input.dispatchKeyEvent', {
          type: sendsText ? 'keyDown' : 'rawKeyDown', key: keyName, code: codeName,
          windowsVirtualKeyCode: code, modifiers, ...(sendsText ? { text, unmodifiedText: text } : {}),
          ...(command ? { commands: [command] } : {}),
        });
      }
      if (up) {
        await this.cdp.send('Input.dispatchKeyEvent', {
          type: 'keyUp', key: keyName, code: codeName, windowsVirtualKeyCode: code, modifiers,
        });
        for (const m of [...mods].reverse()) await this.cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...modKey(m), modifiers: 0 });
      }
    }
  }

  async step(step) {
    const verb = Object.keys(step).find((k) => VERBS.includes(k));
    if (!verb) throw new Error(`Unknown step ${JSON.stringify(step)}. Steps: ${VERBS.join(', ')}`);
    const before = ['wheel', 'drag', 'key', 'touchScroll', 'click', 'choose'].includes(verb)
      ? await this.js('() => { const s = __uhDrive.scrollSnapshot(); window.__uhSnap = s; return s.length; }')
      : null;
    const result = await this[`do_${verb}`](step[verb], step);
    if (before !== null) {
      const moved = await this.js(`() => (window.__uhSnap || []).map((s) => ({ el: __uhDrive.desc(s.el),
        dx: Math.round(s.el.scrollLeft - s.left), dy: Math.round(s.el.scrollTop - s.top) }))
        .filter((s) => s.dx || s.dy)`);
      if (moved.length || verb !== 'click') result.scrolled = moved;
    }
    if (!['eval', 'shot', 'controls', 'inspect', 'wait'].includes(verb)) result.focus = await this.js('() => __uhDrive.focus()');
    return result;
  }

  mods(step) {
    return (step.mods || []).reduce((m, k) => m | (MODS[k] ?? fail(`Unknown modifier ${k}`)), 0);
  }

  async do_size([width, height]) {
    const result = await emulate(this.cdp, this.port, { size: [width, height] });
    await sleep(150);
    return result;
  }

  // Browser page zoom: 2 or "200%". The window keeps its size and the CSS viewport shrinks.
  async do_zoom(zoom) {
    const result = await emulate(this.cdp, this.port, { zoom: parseZoom(zoom) });
    await sleep(150);
    return result;
  }

  // prefers-color-scheme: "light", "dark", or "none" to follow the OS again.
  async do_scheme(scheme) {
    return emulate(this.cdp, this.port, { scheme: scheme === 'none' || !scheme ? undefined : scheme });
  }

  async do_goto(url) {
    await navigate(this.cdp, toUrl(url));
    return { url };
  }

  async do_click(target, step) {
    const p = await this.point(target);
    const button = step.button || 'left';
    const modifiers = this.mods(step);
    await this.move(p.x, p.y, 1, { modifiers });
    for (let n = 1; n <= (step.count || 1); n++) {
      await this.mouseEvent('mousePressed', p.x, p.y, { button, buttons: BUTTONS[button], clickCount: n, modifiers });
      await this.mouseEvent('mouseReleased', p.x, p.y, { button, buttons: 0, clickCount: n, modifiers });
    }
    await sleep(50);
    return p;
  }

  async do_hover(target) {
    const p = await this.point(target);
    await this.move(p.x, p.y, 4);
    await sleep(50);
    return p;
  }

  async do_drag(target, step) {
    const from = await this.point(target);
    let to;
    if (step.to && typeof step.to === 'object' && !Array.isArray(step.to)) {
      to = { x: from.x + (step.to.dx || 0), y: from.y + (step.to.dy || 0) };
    } else to = await this.point(step.to);
    const button = step.button || 'left';
    const modifiers = this.mods(step);
    if (step.hold) await this.key(step.hold, { up: false });
    await this.move(from.x, from.y, 1, { modifiers });
    await this.mouseEvent('mousePressed', from.x, from.y, { button, buttons: BUTTONS[button], clickCount: 1, modifiers });
    await this.move(to.x, to.y, step.steps || 12, { button, buttons: BUTTONS[button], modifiers });
    if (step.cancel) await this.key(step.cancel);
    await this.mouseEvent('mouseReleased', to.x, to.y, { button, buttons: 0, clickCount: 1, modifiers });
    if (step.hold) await this.key(step.hold, { down: false });
    await sleep(50);
    return { from, to: { x: to.x, y: to.y, topmost: await this.js('(p) => __uhDrive.at(p[0], p[1])', [to.x, to.y]) } };
  }

  async do_wheel(target, step) {
    const p = await this.point(target);
    const total = { dx: step.dx || 0, dy: step.dy ?? 0 };
    const ticks = step.ticks || Math.max(1, Math.ceil(Math.max(Math.abs(total.dx), Math.abs(total.dy)) / 100));
    await this.move(p.x, p.y);
    for (let i = 0; i < ticks; i++) {
      await this.mouseEvent('mouseWheel', p.x, p.y, {
        deltaX: total.dx / ticks, deltaY: total.dy / ticks, modifiers: this.mods(step),
      });
      await sleep(16);
    }
    await sleep(200);
    return p;
  }

  async do_key(combo, step) {
    await this.key(combo, { repeat: step.repeat || 1 });
    await sleep(30);
    const { key, mods } = parseCombo(combo);
    const command = macCommand(mods.reduce((m, k) => m | MODS[k], 0), key);
    // The keydown's event.key, when it isn't the key as written: "Shift+/" sends "?".
    const eventKey = NAMED_KEYS[key] ? null : keyInfo(key, mods.includes('Shift'))[1];
    return { key: combo, ...(eventKey && eventKey !== (combo.endsWith('+') ? '+' : combo.split('+').pop()) ? { eventKey } : {}), ...(command ? { command } : {}) };
  }

  async do_type(text) {
    for (const ch of text) {
      if (ch === '\n') {
        await this.key('Enter');
        continue;
      }
      await this.cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch, unmodifiedText: ch, key: ch });
      await this.cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch });
    }
    return { typed: text.length };
  }

  async touch(type, points) {
    await this.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y]) => ({ x, y })) });
  }

  async enableTouch() {
    if (this.touchOn) return;
    await this.cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
    this.touchOn = true;
  }

  async do_tap(target, step) {
    await this.enableTouch();
    const p = await this.point(target);
    await this.touch('touchStart', [[p.x, p.y]]);
    if (step.hold) await sleep(step.hold);
    await this.touch('touchEnd', []);
    await sleep(80);
    return p;
  }

  async do_touchScroll(target, step) {
    await this.enableTouch();
    const p = await this.point(target);
    await this.cdp.send('Input.synthesizeScrollGesture', {
      x: p.x, y: p.y, xDistance: -(step.dx || 0), yDistance: -(step.dy || 0),
      gestureSourceType: 'touch', speed: step.speed || 800,
    });
    await sleep(200);
    return p;
  }

  async do_pinch(target, step) {
    const p = await this.point(target);
    await this.cdp.send('Input.synthesizePinchGesture', {
      x: p.x, y: p.y, scaleFactor: step.scale || 2, gestureSourceType: 'mouse',
    });
    await sleep(200);
    return p;
  }

  async do_controls() {
    const controls = await this.js('() => __uhDrive.controls()');
    return { count: controls.length, controls };
  }

  // Every text element and control as numbers: contrast, target size, clipping, overlap and
  // focus order (README: inspect). The full dump goes to <out>/inspect-<name>.json; the line
  // printed carries the issues, and every element only with "all".
  async do_inspect(scope, step) {
    const { elements, ...out } = await this.js('(a) => __uhDrive.inspect(...a)', [scope, step.min ?? 24]);
    if (this.outDir) {
      mkdirSync(this.outDir, { recursive: true });
      const name = String(step.name ?? out.viewport.join('x')).replace(/[^\w.-]+/g, '-');
      out.file = join(this.outDir, `inspect-${name}.json`);
      writeFileSync(out.file, JSON.stringify({ ...out, elements }, null, 1));
    }
    if (step.all) out.elements = elements;
    return out;
  }

  // An expression, or statements like the console: the value is the last statement's
  // (top-level await works, and so does an explicit return).
  async do_eval(code) {
    await this.cdp.send('Runtime.evaluate', { expression: PAGE_HELPERS });
    const asExpr = `(async () => (${code}))()`;
    const compiled = await this.cdp.send('Runtime.compileScript', {
      expression: asExpr, sourceURL: 'eval', persistScript: false,
    });
    if (!compiled.exceptionDetails) return { value: await this.evaluate(asExpr) };
    try {
      return { value: await this.evaluate(code, { replMode: true }) };
    } catch (err) {
      if (!/Illegal return/.test(err.message)) throw err;
      return { value: await this.evaluate(`(async () => {\n${code}\n})()`) };
    }
  }

  // Picks an option of a native <select>. It types the option's text into the focused,
  // closed select (type-ahead, real key events), which works headless on every platform,
  // unlike the arrow keys and the popup. If that doesn't select it, it sets the value and
  // fires input and change, and says so: that part is not real input.
  async do_choose(target, step) {
    const by = step.value !== undefined ? 'value' : 'text';
    const want = String(step.value ?? step.text ?? '');
    if (step.value === undefined && step.text === undefined) throw new Error('choose needs "value" or "text"');
    const info = await this.js('(a) => __uhDrive.selectInfo(...a)', [target, by, want]);
    const out = { target: info.target, chose: info.text, value: info.value };
    if (info.index < 0) throw new Error(`No option with ${by} ${JSON.stringify(want)} in ${info.target}. Options: ${info.options.join(' | ')}`);
    if (info.disabled) throw new Error(`${info.target} or its option ${JSON.stringify(info.text)} is disabled`);
    if (info.hidden) throw new Error(`The option ${JSON.stringify(info.text)} of ${info.target} is hidden`);
    if (info.index === info.current) return { ...out, input: 'none', note: 'already selected' };
    if (!info.multiple) {
      if (!info.focused) {
        await this.js('(t) => __uhDrive.focusEl(t)', target);
        out.focusedBy = 'script';
      }
      // Type-ahead joins keys less than a second apart, so pause after the last choose.
      await sleep(Math.max(0, (this.typedAheadAt ?? 0) + 1100 - Date.now()));
      for (const ch of info.text) {
        await this.cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch, unmodifiedText: ch, key: ch });
        await this.cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch });
      }
      this.typedAheadAt = Date.now();
      await sleep(50);
      if (await this.js('(t) => __uhDrive.selectedIndex(t)', target) === info.index) {
        return { ...out, input: 'keyboard' };
      }
    }
    await this.js('(a) => __uhDrive.forceSelect(...a)', [target, info.index]);
    return { ...out, input: 'script', warning: 'not real input: type-ahead did not select it, so the '
      + 'value was set by script with input and change events. Check the select by hand.' };
  }

  async do_wait(ms) {
    if (typeof ms === 'number') {
      await sleep(ms);
      return { waited: ms };
    }
    const end = Date.now() + 5000;
    while (Date.now() < end) {
      try {
        await this.js('(t) => __uhDrive.point(t)', ms);
        return { found: ms };
      } catch {
        await sleep(100);
      }
    }
    throw new Error(`Timed out waiting for ${ms}`);
  }

  async do_shot(name) {
    if (!this.outDir) throw new Error('shot needs --out <dir>');
    mkdirSync(this.outDir, { recursive: true });
    // At a page zoom the capture is the window's size in device px, as a screenshot of a
    // zoomed browser window is. It is taken under this connection's own copy of the hold's
    // override: Chrome captures at the scale factor of the connection asking, and a clip
    // with a scale would reset the page's scale factor to 1 once the capture ends.
    const { size, zoom = 1 } = readState(this.port);
    if (zoom !== 1) {
      const [width, height] = cssSize(size, zoom);
      await this.cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: zoom, mobile: false });
    }
    const { data } = await this.cdp.send('Page.captureScreenshot', { format: 'png' });
    const file = join(this.outDir, `${String(name).replace(/[^\w.-]+/g, '-')}.png`);
    writeFileSync(file, Buffer.from(data, 'base64'));
    return { file };
  }
}

const VERBS = ['size', 'zoom', 'scheme', 'goto', 'click', 'hover', 'drag', 'wheel', 'key', 'type', 'choose', 'tap',
  'touchScroll', 'pinch', 'controls', 'inspect', 'eval', 'wait', 'shot'];

// Splits "Ctrl+Shift+/" into its key and modifiers. A shifted character names the key that
// types it, with Shift held as on a US keyboard: "?" is Shift+/, "Ctrl++" is Ctrl+Shift+=.
function parseCombo(combo) {
  const parts = combo === '+' ? ['+'] : combo.endsWith('++') ? [...combo.slice(0, -2).split('+'), '+'] : combo.split('+');
  let key = parts.pop();
  for (const m of parts) if (!(m in MODS)) fail(`Unknown modifier ${m} in ${combo}`);
  if (key === '−') key = '-';
  if (UNSHIFTED[key] !== undefined) {
    key = UNSHIFTED[key];
    if (!parts.includes('Shift')) parts.push('Shift');
  }
  return { key, mods: parts };
}

function macCommand(modifiers, key) {
  return MAC ? MAC_COMMANDS[`${modifiers}+${/^[a-z]$/i.test(key) ? key.toLowerCase() : key}`] : undefined;
}

function modKey(m) {
  const [code, codeName] = NAMED_KEYS[m];
  const key = { Ctrl: 'Control', Cmd: 'Meta', Option: 'Alt', Mod: MAC ? 'Meta' : 'Control' }[m] || m;
  return { key, code: codeName, windowsVirtualKeyCode: code };
}

// [windows code, key, code name, text] for a key, with Shift applied to its character.
function keyInfo(key, shift) {
  if (NAMED_KEYS[key]) {
    const [code, codeName, text] = NAMED_KEYS[key];
    return [code, key === 'Esc' ? 'Escape' : key === 'Space' ? ' ' : key, codeName, text];
  }
  if (/^[a-z]$/i.test(key)) {
    const upper = key.toUpperCase();
    const text = shift ? upper : key.toLowerCase();
    return [upper.charCodeAt(0), text, `Key${upper}`, text];
  }
  const [code, codeName] = /^\d$/.test(key) ? [48 + Number(key), `Digit${key}`] : PUNCT[key] || [];
  if (code) {
    const ch = shift ? SHIFTED[key] : key;
    return [code, ch, codeName, ch];
  }
  if ([...key].length !== 1) fail(`Unknown key ${key}`);
  return [0, key, '', key];
}

// Steps are JSON (a file, inline, or `-` for stdin), or a .mjs/.js file whose default
// export is an array of steps or an async function given one method per verb.
async function readSteps(arg) {
  if (!arg) fail('No steps given');
  if (/\.m?js$/.test(arg)) {
    if (!existsSync(arg)) fail(`No such file: ${arg}`);
    checkScript(arg);
    const mod = await import(pathToFileURL(resolve(arg)).href);
    const steps = mod.default ?? mod.steps;
    if (typeof steps === 'function' || Array.isArray(steps)) return steps;
    fail(`${arg} must export default an array of steps or an async function`);
  }
  let text = arg;
  if (arg === '-') text = readFileSync(0, 'utf8');
  else if (!/^\s*[[{]/.test(arg)) text = readFileSync(resolve(arg), 'utf8');
  let steps;
  try {
    steps = JSON.parse(text);
  } catch (err) {
    fail(`Steps are not valid JSON: ${err.message}`);
  }
  return Array.isArray(steps) ? steps : [steps];
}

class StepFailed extends Error {}

// The line a step prints. A long string in the step (an eval's script) is cut to its start,
// and a quiet step prints only how it went: a steps script still gets the whole result.
function printed(line) {
  const step = Object.fromEntries(Object.entries(line.step).map(([k, v]) => [k,
    typeof v === 'string' && v.length > 160 ? `${v.slice(0, 60).replace(/\s+/g, ' ')}… (${v.length} chars)` : v]));
  if (line.step.quiet !== true) return { ...line, step };
  const keep = ['i', 'ok', 'error', 'warning', 'pageErrors'];
  return { i: line.i, step, ...Object.fromEntries(keep.filter((k) => k in line).map((k) => [k, line[k]])) };
}

async function runSteps(port, steps, outDir) {
  const cdp = await Cdp.connect(await pageSocket(port));
  const driver = new Driver(cdp, outDir && resolve(outDir), port);
  await driver.init();
  // A hold puts its overrides back within a moment of an earlier call clearing them.
  const state = readState(port);
  if (state.token) await emulated(cdp, state, 2000);
  let failed = 0;
  let i = 0;
  const run = async (step) => {
    const line = { i: i++, step };
    try {
      Object.assign(line, { ok: true }, await driver.step(step));
      if (line.hit === false) line.warning = `covered by ${line.topmost}: a user's click lands there, not on the target`;
    } catch (err) {
      Object.assign(line, { ok: false, error: err.message });
      failed++;
    }
    if (driver.errors.length) line.pageErrors = driver.errors.splice(0);
    console.log(JSON.stringify(printed(line)));
    return line;
  };
  if (typeof steps === 'function') {
    // ui.click('@3', { button: 'right' }) runs {"click":"@3","button":"right"} and returns
    // its result line. A failed step throws and ends the script, unless it is optional.
    const ui = {
      async step(step) {
        const line = await run(step);
        if (!line.ok && step.optional !== true) throw new StepFailed(line.error);
        return line;
      },
    };
    for (const verb of VERBS) ui[verb] = (arg = true, opts = {}) => ui.step({ [verb]: arg, ...opts });
    try {
      await steps(ui);
    } catch (err) {
      if (!(err instanceof StepFailed)) {
        console.log(JSON.stringify({ i, ok: false, error: `steps script: ${err.message}` }));
        failed++;
      }
    }
  } else {
    for (const step of steps) {
      const line = await run(step);
      if (!line.ok && step.optional !== true) break;
    }
  }
  cdp.close();
  return failed;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const [cmd, a, b] = opts._;
  if (opts.help || !cmd) {
    console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 13).join('\n').replace(/^\/\/ ?/gm, ''));
    return;
  }
  if (typeof WebSocket === 'undefined') fail('Needs Node 22 or later (built-in WebSocket)');
  const port = Number(opts.port || DEFAULT_PORT);
  if (opts.sections) process.env.UH_SECTIONS = opts.sections;
  checkOut(opts.out);
  if (cmd === 'open') {
    if (!a) fail('open needs a url or file');
    console.log(JSON.stringify(await launch(a, opts)));
  } else if (cmd === 'do') {
    process.exitCode = (await runSteps(port, await readSteps(a), opts.out)) ? 1 : 0;
  } else if (cmd === 'hold') {
    await hold(port, opts.token);
  } else if (cmd === 'close') {
    rmSync(stateFile(port), { force: true });
    const { webSocketDebuggerUrl } = await getJson(port, '/json/version').catch(() => fail(`No browser on port ${port}`));
    const cdp = await Cdp.connect(webSocketDebuggerUrl);
    await cdp.send('Browser.close').catch(() => {});
    cdp.close();
    // Wait for the port to free, so an open straight after this one works.
    for (let t = 0; t < 50 && await getJson(port, '/json/version').then(() => true, () => false); t++) await sleep(100);
    console.log(JSON.stringify({ closed: port }));
  } else if (cmd === 'run') {
    if (!a || !b) fail('run needs a url and steps');
    const steps = await readSteps(b);
    await launch(a, opts);
    try {
      process.exitCode = (await runSteps(port, steps, opts.out)) ? 1 : 0;
    } finally {
      rmSync(stateFile(port), { force: true });
      const { webSocketDebuggerUrl } = await getJson(port, '/json/version');
      const cdp = await Cdp.connect(webSocketDebuggerUrl);
      await cdp.send('Browser.close').catch(() => {});
      cdp.close();
    }
  } else fail(`Unknown command ${cmd}. Use open, do, close or run.`);
}

main().catch((err) => fail(err.message));
