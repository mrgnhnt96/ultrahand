// node --test shared/input/drive.test.mjs   (needs Chrome; skips without it)
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
