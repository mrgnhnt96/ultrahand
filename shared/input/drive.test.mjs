// node --test shared/input/drive.test.mjs   (needs Chrome; skips without it)
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const DRIVE = fileURLToPath(new URL('./drive.mjs', import.meta.url));

const PAGE = `<!doctype html><html><head><style>
body { margin: 0; font: 16px system-ui; background: #fff; color: #111 }
.grey { color: #999 }
.big { font-size: 24px; color: #949494 }
.dark { background: #222; color: #555 }
.grad { background: linear-gradient(#fff, #ccc); color: #777 }
.img { background: url(data:image/gif;base64,R0lGODlhAQABAAAAACw=) #000; color: #fff }
.fade { opacity: .5 }
.trunc { width: 80px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
.wide { width: 2000px }
.tiny { width: 16px; height: 16px; padding: 0; border: 0 }
.box { position: relative; height: 40px }
.a, .b { position: absolute; top: 0; left: 0 }
input.faint { border: 1px solid #eee; background: #fff }
.cover { position: fixed; left: 0; top: 400px; width: 300px; height: 40px; background: #fff8 }
</style></head><body>
<p class="grey">Grey one</p>
<p class="grey">Grey two</p>
<p class="big">Large text</p>
<p class="dark">Dark low</p>
<p class="grad">Gradient</p>
<p class="img">Image bg</p>
<p class="fade">Faded</p>
<div class="trunc">This text is far too long to fit</div>
<button class="tiny" aria-label="x">x</button><button class="tiny" aria-label="y">y</button>
<button tabindex="2">Positive</button>
<div class="box"><span class="a">Over</span><span class="b">Lapping</span></div>
<input class="faint" placeholder="Search">
<p style="position: absolute; top: 400px">Under the cover</p><div class="cover"></div>
<p>Inline <a href="#">link</a> in a sentence.</p>
<button disabled class="grey">Disabled</button>
<host-el></host-el>
<div class="wide">Wide</div>
<script>customElements.define('host-el', class extends HTMLElement { constructor() { super();
  this.attachShadow({ mode: 'open' }).innerHTML = '<button style="color:#aaa;background:#fff">Shadow</button>'; } });</script>
</body></html>`;

function inspect() {
  const dir = mkdtempSync(join(tmpdir(), 'uh-inspect-'));
  writeFileSync(join(dir, 'page.html'), PAGE);
  const run = spawnSync(process.execPath, [DRIVE, 'run', join(dir, 'page.html'), '[{"inspect":true,"name":"t"}]',
    '--size', '800x600', '--port', '9347', '--out', dir], { encoding: 'utf8', timeout: 60000 });
  if (/Chrome not found/.test(run.stderr + run.stdout)) return null;
  assert.equal(run.status, 0, run.stderr + run.stdout);
  return { line: JSON.parse(run.stdout.trim().split('\n').pop()), saved: JSON.parse(readFileSync(join(dir, 'inspect-t.json'), 'utf8')) };
}

test('inspect measures contrast, targets, clipping and focus order', (t) => {
  const got = inspect();
  if (!got) return t.skip('Chrome not found');
  const { line, saved } = got;
  const of = (kind) => line.issues.filter((i) => i.kind === kind);
  const pair = (fg, bg) => of('contrast').find((i) => i.fg === fg && i.bg === bg);

  const grey = pair('#999999', '#ffffff');
  assert.equal(grey.ratio, 2.85);
  assert.equal(grey.n, 2, 'one finding per colour pair');
  assert.ok(!grey.eg.some((e) => /Disabled/.test(e)), 'disabled text is exempt');
  assert.equal(pair('#555555', '#222222').ratio, 2.13);
  assert.ok(pair('#aaaaaa', '#ffffff'), 'text in a shadow root is measured');
  assert.equal(pair('#777777', '#cccccc').ratio, 2.79, 'the worst gradient stop wins');
  assert.equal(saved.elements.find((e) => /Faded/.test(e.el)).fg, '#888888', 'opacity blends the text');
  assert.equal(saved.elements.find((e) => /Large text/.test(e.el)).need, 3);
  assert.ok(!of('contrast').some((i) => i.fg === '#949494'), 'large text passes at 3:1');
  assert.deepEqual(line.unresolved, ['p.img "Image bg"']);
  const field = saved.elements.find((e) => e.el.startsWith('input.faint'));
  assert.equal(field.text, 'Search', 'an empty field is measured by its placeholder');
  assert.notEqual(field.fg, '#111111', 'in the placeholder colour');

  const tiny = of('target').filter((i) => /tiny/.test(i.el));
  assert.deepEqual(tiny.map((i) => [i.size, i.wcag.split(':')[0]]), [[[16, 16], 'fail'], [[16, 16], 'fail']], 'too close together');
  assert.ok(!of('target').some((i) => /link/.test(i.el)), 'a link in a sentence is exempt');
  assert.equal(of('field-edge')[0].ratio, 1.16);

  assert.equal(of('cut').find((i) => /trunc/.test(i.el)).by, 'itself');
  assert.match(of('covered').find((i) => /Under the cover/.test(i.el)).by, /div.cover/);
  assert.ok(of('overlap').some((i) => /Over/.test(i.el) && /Lapping/.test(i.with)));
  assert.equal(line.pageOverflowX, 1200);

  assert.equal(of('tabindex')[0].tabindex, 2);
  assert.match(line.focusOrder[0], /^1 button "Positive"/, 'a positive tabindex goes first');
  assert.ok(line.focusOrder.some((s) => /Shadow/.test(s)), 'tab order goes through shadow roots');
  assert.equal(line.elements, undefined, 'elements are only saved, unless all is set');
});

test('inspect names the nearest data-uh and data-testid each element sits in', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'uh-anchors-'));
  writeFileSync(join(dir, 'page.html'), `<!doctype html><body style="font: 16px system-ui">
<section data-uh="lists">
  <h1>Lists</h1>
  <div data-uh="lists.your-lists" data-testid="your-lists">
    <p>Your lists</p>
    <button data-uh="lists.your-lists.new-list"><span>New list</span></button>
    <host-el data-uh="lists.your-lists.shadow"></host-el>
  </div>
</section>
<p data-uh="">Loose</p>
<script>customElements.define('host-el', class extends HTMLElement { constructor() { super();
  this.attachShadow({ mode: 'open' }).innerHTML = '<button>Inside</button>'; } });</script>
</body>`);
  const run = spawnSync(process.execPath, [DRIVE, 'run', join(dir, 'page.html'), '[{"inspect":true,"name":"t"}]',
    '--size', '800x600', '--port', '9389', '--out', dir], { encoding: 'utf8', timeout: 60000 });
  if (/Chrome not found/.test(run.stderr + run.stdout)) return t.skip('Chrome not found');
  assert.equal(run.status, 0, run.stderr + run.stdout);
  const { elements } = JSON.parse(readFileSync(join(dir, 'inspect-t.json'), 'utf8'));
  const text = (words) => elements.find((e) => !e.control && e.text === words);
  const control = (name) => elements.find((e) => e.control && e.el.includes(`"${name}"`));

  assert.deepEqual([text('Lists').uh, text('Lists').testid], ['lists', undefined]);
  assert.deepEqual([text('Your lists').uh, text('Your lists').testid], ['lists.your-lists', 'your-lists']);
  assert.equal(text('New list').uh, 'lists.your-lists.new-list', 'text inside a member takes the member anchor');
  assert.equal(control('New list').uh, 'lists.your-lists.new-list', 'a control carries its own anchor');
  assert.equal(control('Inside').uh, 'lists.your-lists.shadow', 'the walk goes out through a shadow root');
  assert.equal(control('Inside').testid, 'your-lists');
  assert.ok(!('uh' in text('Loose')) && !('testid' in text('Loose')), 'no anchor, or an empty one, is left out');
});

test('--sections reaches a steps script', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'uh-sections-'));
  writeFileSync(join(dir, 'page.html'), '<!doctype html><title>Sections</title>');
  writeFileSync(join(dir, 'steps.mjs'), `export default [{ eval: JSON.stringify(process.env.UH_SECTIONS) }];\n`);
  const run = spawnSync(process.execPath, [DRIVE, 'run', join(dir, 'page.html'), join(dir, 'steps.mjs'),
    '--sections', 'header,main', '--port', '9391'], { encoding: 'utf8', timeout: 60_000 });
  if (/Chrome not found/.test(run.stderr)) return t.skip('no Chrome');
  assert.equal(run.status, 0, run.stderr);
  assert.equal(JSON.parse(run.stdout.trim().split('\n').pop()).value, 'header,main');
});

// As the review CLI starts a child: its folder and its own port in the environment.
function locked(folder, port, ...args) {
  const env = { ...process.env, ULTRAHAND_DRIVE_FOLDER: folder, ULTRAHAND_DRIVE_PORT: port };
  if (port === undefined) delete env.ULTRAHAND_DRIVE_PORT;
  return spawnSync(process.execPath, [DRIVE, ...args], { encoding: 'utf8', timeout: 20_000, env });
}

test('a locked run refuses an --out outside its folder before any browser starts', () => {
  const folder = mkdtempSync(join(tmpdir(), 'uh-lock-'));
  const outside = mkdtempSync(join(tmpdir(), 'uh-outside-'));
  for (const out of [outside, join(folder, '..', basename(outside)), join(outside, 'new', 'deeper')]) {
    const run = locked(folder, '9399', 'do', '[{"shot":"x"}]', '--port', '9399', '--out', out);
    assert.equal(run.status, 1, out);
    assert.match(run.stderr, /--out must be inside/, out);
  }
  symlinkSync(outside, join(folder, 'link'));
  const linked = locked(folder, '9399', 'do', '[{"shot":"x"}]', '--port', '9399', '--out', join(folder, 'link', 'shots'));
  assert.match(linked.stderr, /--out must be inside/, 'a link out of the folder is followed');
  assert.deepEqual(readdirSync(outside), []);
});

test('a locked run lets an --out inside its folder through to the browser', () => {
  const folder = mkdtempSync(join(tmpdir(), 'uh-lock-'));
  const run = locked(folder, '9398', 'do', '[{"shot":"x"}]', '--port', '9398', '--out', join(folder, 'shots'));
  assert.doesNotMatch(run.stderr, /--out must be inside/);
  assert.match(run.stderr, /No browser on port 9398/);
});

test('a locked run refuses any steps script but the composition audit', () => {
  const folder = mkdtempSync(join(tmpdir(), 'uh-lock-'));
  const canary = join(folder, 'canary.txt');
  const script = join(folder, 'steps.mjs');
  writeFileSync(script, `import { writeFileSync } from 'node:fs';\nwriteFileSync(${JSON.stringify(canary)}, 'ran');\nexport default [];\n`);
  for (const cmd of [['do', script], ['run', 'about:blank', script]]) {
    const run = locked(folder, '9397', ...cmd, '--port', '9397');
    assert.equal(run.status, 1);
    assert.match(run.stderr, /only steps script it runs is/);
  }
  assert.equal(existsSync(canary), false, 'the script never ran');
  const audit = fileURLToPath(new URL('../composition/audit.mjs', import.meta.url));
  const allowed = locked(folder, '9397', 'do', audit, '--port', '9397');
  assert.doesNotMatch(allowed.stderr, /only steps script/);
  assert.match(allowed.stderr, /No browser on port 9397/);
});

test('a locked run drives only its own port', () => {
  const folder = mkdtempSync(join(tmpdir(), 'uh-lock-'));
  for (const cmd of [['close'], ['do', '[{"shot":"x"}]'], ['open', 'about:blank']]) {
    const sibling = locked(folder, '9394', ...cmd, '--port', '9393');
    assert.equal(sibling.status, 1, cmd[0]);
    assert.match(sibling.stderr, /drives only its own browser: pass --port 9394/, cmd[0]);
  }
  for (const cmd of [['close'], ['do', '[{"shot":"x"}]']]) {
    assert.match(locked(folder, '9394', ...cmd, '--port', '9394').stderr, /No browser on port 9394/, cmd[0]);
  }
  assert.match(locked(folder, '9394', 'close').stderr, /No browser on port 9394/, 'the port comes from the lock');
  const unset = locked(folder, undefined, 'close', '--port', '9394');
  assert.equal(unset.status, 1);
  assert.match(unset.stderr, /a review run needs its port in ULTRAHAND_DRIVE_PORT/);
});

test('a locked run refuses --chrome before starting anything', () => {
  const folder = mkdtempSync(join(tmpdir(), 'uh-lock-'));
  const canary = join(folder, 'canary.txt');
  const program = join(folder, 'chrome.sh');
  writeFileSync(program, `#!/bin/sh\necho ran > ${JSON.stringify(canary)}\n`, { mode: 0o755 });
  for (const cmd of [['open', 'about:blank'], ['run', 'about:blank', '[]']]) {
    const run = locked(folder, '9392', ...cmd, '--port', '9392', '--chrome', program);
    assert.equal(run.status, 1, cmd[0]);
    assert.match(run.stderr, /takes no --chrome/, cmd[0]);
  }
  assert.equal(existsSync(canary), false, 'the program never ran');
});

test('a display:contents box that clips is no box: its control is clickable and its text not cut', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'uh-contents-'));
  // The wrapper's overflow would clip against its 0x0 rect if it were treated as a box.
  writeFileSync(join(dir, 'page.html'), `<!doctype html><div style="display: contents; overflow: hidden">
    <button id="b" onclick="this.textContent = 'clicked'">Menu</button><p>Some text</p></div>`);
  const run = spawnSync(process.execPath, [DRIVE, 'run', join(dir, 'page.html'),
    '[{"click":"#b"},{"eval":"document.querySelector(\\"#b\\").textContent"},{"inspect":true}]', '--port', '9392'],
  { encoding: 'utf8', timeout: 60_000 });
  if (/Chrome not found/.test(run.stderr)) return t.skip('no Chrome');
  assert.equal(run.status, 0, run.stderr + run.stdout);
  const [, clicked, inspected] = run.stdout.trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(clicked.value, 'clicked');
  assert.deepEqual(inspected.issues.filter((i) => i.kind === 'cut'), []);
});

test('ULTRAHAND_DRIVE_PORT sets the port, and --port overrides it', () => {
  const drive = (env, ...args) => spawnSync(process.execPath, [DRIVE, 'close', ...args], {
    encoding: 'utf8', timeout: 20_000, env: { ...process.env, ULTRAHAND_DRIVE_PORT: env },
  });
  assert.match(drive('9396').stderr, /No browser on port 9396/);
  assert.match(drive('9396', '--port', '9395').stderr, /No browser on port 9395/);
  const bad = drive('nope');
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /ULTRAHAND_DRIVE_PORT must be a port number/);
});

// A temp folder of the test's own, so what drive leaves in it is all that's there.
function ownTmp(t) {
  const dir = mkdtempSync(join(realpathSync(tmpdir()), 'uh-tmp-'));
  const drive = (...args) => spawnSync(process.execPath, [DRIVE, ...args], {
    encoding: 'utf8', timeout: 60_000, env: { ...process.env, TMPDIR: dir },
  });
  const left = () => readdirSync(dir).filter((name) => name.startsWith('ultrahand-drive-'));
  return { dir, drive, left };
}

test('close deletes the profile of a browser that already ended, and only a folder open made', (t) => {
  const { dir, drive, left } = ownTmp(t);
  const outside = mkdtempSync(join(realpathSync(tmpdir()), 'uh-keep-'));
  // No live process has this pid: it is past the largest pid macOS and Linux hand out.
  const dead = 99_999_999;
  mkdirSync(join(dir, 'ultrahand-drive-abc123', 'Default'), { recursive: true });
  writeFileSync(join(dir, 'ultrahand-drive-9394.browser.json'), JSON.stringify({ pid: dead, profile: join(dir, 'ultrahand-drive-abc123') }));
  writeFileSync(join(dir, 'ultrahand-drive-9393.browser.json'), JSON.stringify({ pid: dead, profile: outside }));
  for (const port of ['9394', '9393']) {
    const close = drive('close', '--port', port);
    assert.equal(close.status, 1);
    assert.match(close.stderr, new RegExp(`No browser on port ${port}`));
  }
  assert.deepEqual(left(), []);
  assert.ok(existsSync(outside), 'a record naming a folder outside the temp folder deletes nothing');
});

test('open then close, and run, leave no profile behind', (t) => {
  const { drive, left } = ownTmp(t);
  const open = drive('open', 'about:blank', '--port', '9390');
  if (/Chrome not found/.test(open.stderr)) return t.skip('no Chrome');
  t.after(() => drive('close', '--port', '9390'));
  assert.equal(open.status, 0, open.stderr);
  assert.ok(left().some((name) => /^ultrahand-drive-\w{6}$/.test(name)), 'the profile is there while the browser is open');
  const close = drive('close', '--port', '9390');
  assert.equal(close.status, 0, close.stderr);
  assert.deepEqual(left(), []);
  const run = drive('run', 'about:blank', '[{"eval":"1"}]', '--port', '9390');
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(left(), []);
});

test('every documented composition audit run passes --out, which its screenshot needs', () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const docs = ['skills/mobile/SKILL.md', 'skills/tablet/SKILL.md', 'skills/desktop/SKILL.md',
    'shared/composition/principles.md', 'shared/composition/audit.mjs'];
  let runs = 0;
  for (const doc of docs) {
    for (const line of readFileSync(join(root, doc), 'utf8').split('\n')) {
      if (!/drive\.mjs"? do \S*audit\.mjs/.test(line)) continue;
      runs++;
      assert.match(line, /--out \S/, `${doc}: ${line.trim()}`);
    }
  }
  assert.ok(runs >= docs.length, 'each doc shows the audit run');
});
