// node --test shared/blueprint/greybox.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { check, greybox, readBlueprint } from './greybox.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const example = join(here, 'example', 'blueprint.json');

const one = (sections, more = []) => ({
  title: 'Test',
  screens: [{ id: 'home', title: 'Home', sections }, ...more],
});
const content = (members, extra = {}) => ({ name: 'Main', job: 'Do the thing', role: 'content', members, ...extra });

test('the example blueprint is clean', () => {
  const { errors, warnings } = check(readBlueprint(example));
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
});

test('the example renders every screen, its links and its states', () => {
  const r = greybox(readBlueprint(example), { file: example });
  assert.match(r.html, /<template id="uh-screen">/);
  for (const id of ['lists', 'list', 'add', 'settings']) assert.match(r.html, new RegExp(`data-screen="${id}"`));
  assert.match(r.html, /data-nav="list"/);
  assert.match(r.html, /data-nav-back/);
  assert.match(r.html, /data-nav="settings" data-nav-replace/);
  assert.match(r.html, /data-show-state="empty"/);
  assert.match(r.html, /<details class="bp-more">/);
  assert.match(r.html, /id="lists-your-lists"/);
  assert.doesNotMatch(r.html, /#[0-9a-f]{3,6}\b(?![^(]*\))/i, 'colours come only from the grey light-dark() tokens');
  assert.deepEqual(r.states, ['default', 'empty']);
  assert.equal(r.title, 'Pantry');
});

test('more than one emphasis in a section is an error', () => {
  const bp = one([content([
    { kind: 'button', text: 'Save', emphasis: true },
    { kind: 'button', text: 'Share', emphasis: true },
  ])]);
  assert.match(check(bp).errors.join('\n'), /2 emphasised members/);
  assert.throws(() => greybox(bp), (err) => err.problems.length === 1);
});

test('a link to a missing screen is an error, and an unreachable screen a warning', () => {
  const bp = one([content([{ kind: 'button', text: 'Open', nav: 'nowhere' }])], [
    { id: 'lost', title: 'Lost', sections: [content([{ kind: 'text', text: 'Nothing links here.' }])] },
  ]);
  const { errors, warnings } = check(bp);
  assert.match(errors.join('\n'), /nav "nowhere" is not a screen id/);
  assert.match(warnings.join('\n'), /screen "lost" has no way in/);
});

test('sections need one job, a role and a valid place', () => {
  const { errors, warnings } = check(one([
    { name: 'Bar', job: 'Show the title', role: 'chrome', members: [{ kind: 'title', text: 'Home' }] },
    content([{ kind: 'text', text: 'Hello there.' }], { name: 'Two', job: 'Show things. Also edit them.', place: 'top' }),
    content([{ kind: 'text', text: 'Hi.' }], { name: 'Three', job: '' }),
  ]));
  assert.match(errors.join('\n'), /chrome section needs place/);
  assert.match(errors.join('\n'), /place is for chrome/);
  assert.match(errors.join('\n'), /needs a job/);
  assert.match(warnings.join('\n'), /more than one job/);
});

test('filler copy gets a warning, a real one-word label does not', () => {
  const { warnings } = check(one([content([
    { kind: 'text', text: 'Lorem ipsum dolor sit amet' },
    { kind: 'button', text: 'Button 2' },
    { kind: 'field', label: 'Item', placeholder: 'e.g. Basmati rice' },
  ])]));
  assert.equal(warnings.length, 2);
  assert.match(warnings[0], /Lorem ipsum/);
  assert.match(warnings[1], /Button 2/);
});

test('side chrome renders as a rail and as a compact copy', () => {
  const r = greybox(one([
    { name: 'Tabs', job: 'Move between areas', role: 'chrome', place: 'side', members: [{ kind: 'nav', items: [{ text: 'Home', nav: 'home' }] }] },
    content([{ kind: 'text', text: 'Welcome back.' }]),
  ]));
  assert.match(r.html, /class="bp-side"/);
  assert.match(r.html, /bp-only-compact/);
  assert.match(r.html, /data-bottom="compact"/);
  assert.match(r.html, /aria-current="page"/);
});

test('the CLI writes the screen and fails on a broken blueprint', () => {
  const dir = mkdtempSync(join(tmpdir(), 'greybox-'));
  const out = join(dir, 'screen.html');
  const ok = spawnSync(process.execPath, [join(here, 'greybox.mjs'), example, '--out', out], { encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(readFileSync(out, 'utf8'), /data-screen="lists"/);
  const bad = join(dir, 'bad.json');
  writeFileSync(bad, JSON.stringify({ screens: [] }));
  const fail = spawnSync(process.execPath, [join(here, 'greybox.mjs'), bad], { encoding: 'utf8' });
  assert.equal(fail.status, 1);
  assert.match(fail.stderr, /screens must be a non-empty array/);
});
