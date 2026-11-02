#!/usr/bin/env node
// Drive a page in Chrome with real input over the Chrome DevTools Protocol: trusted mouse,
// wheel, keyboard and touch events that go through hit testing, focus, default actions and
// scroll chaining, unlike synthetic dispatchEvent calls. Zero dependencies; Node 22+.
//
//   node drive.mjs open <url> [--size 1280x800] [--port 9333] [--headed] [--chrome <path>]
//   node drive.mjs do <steps.json | steps.mjs | '<json>' | -> [--port 9333] [--out <dir>]
//   node drive.mjs close [--port 9333]
//   node drive.mjs run <url> <steps.json | steps.mjs | '<json>'> [--size 1280x800] [--out <dir>]
//
// See README.md for the step list and what each result reports.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DEFAULT_PORT = 9333;
const VERSION = 4;
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
const PUNCT = {
  '=': [187, 'Equal'], '+': [187, 'Equal'], '-': [189, 'Minus'], '_': [189, 'Minus'],
  '−': [189, 'Minus'], ',': [188, 'Comma'], '.': [190, 'Period'], '/': [191, 'Slash'],
  '?': [191, 'Slash'], ';': [186, 'Semicolon'], "'": [222, 'Quote'], '[': [219, 'BracketLeft'],
  ']': [221, 'BracketRight'], '\\': [220, 'Backslash'], '`': [192, 'Backquote'],
  '!': [49, 'Digit1'], '@': [50, 'Digit2'], '#': [51, 'Digit3'],
};

function fail(msg) {
  console.error(`drive: ${msg}`);
  process.exit(1);
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
  const sized = await applySize(cdp, port, w, h);
  await navigate(cdp, toUrl(url));
  cdp.close();
  return { port, pid: child.pid, url: toUrl(url), ...sized };
}

// Per-port state shared by `do` calls: the size a `hold` process is keeping.
const stateFile = (port) => join(tmpdir(), `ultrahand-drive-${port}.json`);

function readState(port) {
  try {
    return JSON.parse(readFileSync(stateFile(port), 'utf8'));
  } catch {
    return {};
  }
}

// Ends a held size: the hold process sees its token gone and disconnects, which drops its
// device-metrics override.
async function releaseSize(port) {
  if (!readState(port).token) return;
  rmSync(stateFile(port), { force: true });
  await sleep(300);
}

// Sizes the viewport. The real window is used when it can reach the size, and it stays for
// later `do` calls. Below the window's minimum (about 500px wide headless) a device-metrics
// override is needed, and CDP drops an override when its connection closes, so a small
// `hold` process keeps one open until the next size step or `close`.
async function applySize(cdp, port, width, height) {
  await releaseSize(port);
  const actual = await setViewport(cdp, width, height);
  if (actual[0] === width && actual[1] === height) return { size: actual };
  const token = `${process.pid}-${Date.now()}`;
  writeFileSync(stateFile(port), JSON.stringify({ token, size: [width, height] }));
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), 'hold', `${width}x${height}`,
    '--port', String(port), '--token', token], { detached: true, stdio: 'ignore' });
  child.unref();
  const end = Date.now() + 5000;
  while (Date.now() < end) {
    await sleep(100);
    const [iw, ih] = await viewportSize(cdp);
    if (iw === width && ih === height) {
      return { size: [width, height], emulated: `the window stops at ${actual.join('x')}, so this `
        + 'size is a device-metrics override. It holds across do calls until the next size step or close.' };
    }
  }
  await releaseSize(port);
  throw new Error(`Could not emulate ${width}x${height}; the window stops at ${actual.join('x')}`);
}

async function hold(port, size, token) {
  const [width, height] = parseSize(size);
  const cdp = await Cdp.connect(await pageSocket(port));
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  cdp.ws.addEventListener('close', () => process.exit(0));
  setInterval(() => {
    if (readState(port).token !== token) {
      cdp.close();
      process.exit(0);
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
  window.__uhDrive = {
    version: ${VERSION},
    refs: window.__uhDrive?.refs || [],
    desc, deepActive, deepHit, resolve,
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
      const i = by === 'value' ? opts.findIndex((o) => o.value === want)
        : [(o) => clean(o.text).toLowerCase() === w, (o) => clean(o.text).toLowerCase().includes(w)]
          .map((f) => opts.findIndex(f)).find((n) => n >= 0) ?? -1;
      return { target: desc(el), index: i, text: i >= 0 ? clean(opts[i].text) : null,
        value: i >= 0 ? opts[i].value : null, current: el.selectedIndex,
        focused: deepActive() === el, multiple: el.multiple,
        disabled: el.disabled || (i >= 0 && opts[i].disabled),
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
    if (!['eval', 'shot', 'controls', 'wait'].includes(verb)) result.focus = await this.js('() => __uhDrive.focus()');
    return result;
  }

  mods(step) {
    return (step.mods || []).reduce((m, k) => m | (MODS[k] ?? fail(`Unknown modifier ${k}`)), 0);
  }

  async do_size([width, height]) {
    const result = await applySize(this.cdp, this.port, width, height);
    await sleep(150);
    return result;
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
    return command ? { key: combo, command } : { key: combo };
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
    const { data } = await this.cdp.send('Page.captureScreenshot', { format: 'png' });
    const file = join(this.outDir, `${String(name).replace(/[^\w.-]+/g, '-')}.png`);
    writeFileSync(file, Buffer.from(data, 'base64'));
    return { file };
  }
}

const VERBS = ['size', 'goto', 'click', 'hover', 'drag', 'wheel', 'key', 'type', 'choose', 'tap',
  'touchScroll', 'pinch', 'controls', 'eval', 'wait', 'shot'];

function parseCombo(combo) {
  if (combo === '+') return { key: '+', mods: [] };
  const parts = combo.endsWith('++') ? [...combo.slice(0, -2).split('+'), '+'] : combo.split('+');
  const key = parts.pop();
  for (const m of parts) if (!(m in MODS)) fail(`Unknown modifier ${m} in ${combo}`);
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

function keyInfo(key, shift) {
  if (NAMED_KEYS[key]) {
    const [code, codeName, text] = NAMED_KEYS[key];
    return [code, key === 'Esc' ? 'Escape' : key === 'Space' ? ' ' : key, codeName, text];
  }
  if (key.length !== 1 && !PUNCT[key]) fail(`Unknown key ${key}`);
  if (/^[a-z]$/i.test(key)) {
    const upper = key.toUpperCase();
    const text = shift ? upper : key.toLowerCase();
    return [upper.charCodeAt(0), text, `Key${upper}`, text];
  }
  if (/^\d$/.test(key)) return [48 + Number(key), key, `Digit${key}`, key];
  const [code, codeName] = PUNCT[key] || [0, ''];
  return [code, key === '−' ? '-' : key, codeName, key === '−' ? '-' : key];
}

// Steps are JSON (a file, inline, or `-` for stdin), or a .mjs/.js file whose default
// export is an array of steps or an async function given one method per verb.
async function readSteps(arg) {
  if (!arg) fail('No steps given');
  if (/\.m?js$/.test(arg)) {
    if (!existsSync(arg)) fail(`No such file: ${arg}`);
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

async function runSteps(port, steps, outDir) {
  const cdp = await Cdp.connect(await pageSocket(port));
  const driver = new Driver(cdp, outDir && resolve(outDir), port);
  await driver.init();
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
    console.log(JSON.stringify(line));
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
    console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 11).join('\n').replace(/^\/\/ ?/gm, ''));
    return;
  }
  if (typeof WebSocket === 'undefined') fail('Needs Node 22 or later (built-in WebSocket)');
  const port = Number(opts.port || DEFAULT_PORT);
  if (cmd === 'open') {
    if (!a) fail('open needs a url or file');
    console.log(JSON.stringify(await launch(a, opts)));
  } else if (cmd === 'do') {
    process.exitCode = (await runSteps(port, await readSteps(a), opts.out)) ? 1 : 0;
  } else if (cmd === 'hold') {
    await hold(port, a, opts.token);
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
