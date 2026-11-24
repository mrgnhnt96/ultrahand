// node --test shared/handoff/diff.test.mjs   (the last test needs Chrome; it skips without it)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildIndex } from '../theme/tokens.mjs';
import { generate, readPresets } from './spec.mjs';
import {
  plan, driveSteps, diff, report, readMeasured, statesOf, pickPresets, locate, toHref, runName,
  placeOf, columnsOf, layoutAt, patternRe, nearColor, where,
} from './diff.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const DIFF = join(here, 'diff.mjs');
const read = (p) => readFileSync(join(root, p), 'utf8');
const theme = buildIndex(JSON.parse(read('shared/theme/example.tokens.json')));
const presets = readPresets(read('skills/mobile/references/presets.md'));

/* The Pantry spec, with tokens on the header title and New list so the token check has
   something to read. */
function pantry() {
  const { spec } = generate({ blueprint: JSON.parse(read('shared/blueprint/example/blueprint.json')), presets });
  const m = (a) => spec.screens[0].sections.flatMap((s) => s.members).find((x) => x.anchor === a);
  m('lists.header.lists').tokens = { color: 'semantic.color.on-surface', type: 'semantic.type.title' };
  m('lists.your-lists.new-list').tokens = { color: 'component.button.primary-fg', background: 'component.button.primary-bg', type: 'semantic.type.label' };
  spec.screens[0].sections.find((s) => s.id === 'header').tokens = { background: 'semantic.color.surface' };
  return spec;
}

/* Colours of the example theme, light and dark. */
const C = {
  surface: ['#fcf8f4', '#16120f'], raised: ['#ffffff', '#2a2420'], onSurface: ['#1f1a16', '#ebe1d8'],
  primary: ['#8f3f26', '#f2b8a2'], onPrimary: ['#ffffff', '#4a2114'],
};

/* The Lists screen as a build that matches the spec renders it: at small (compact, tabs at the
   bottom) or large-landscape (expanded and height-compact: tabs at the side, header not sticky). */
function listsRun({ preset = 'small', scheme = 'light', state = 'default' } = {}) {
  const d = scheme === 'dark' ? 1 : 0;
  const small = preset === 'small';
  const [vw, vh] = small ? [360, 800] : [932, 430];
  const x = small ? 0 : 80;
  let i = 0;
  const a = (anchor, box, text, more = {}) => ({ a: anchor, i: i++, rendered: true, box, sticky: false, text, ...more });
  const rows = state === 'empty' ? [] : [
    a('lists.your-lists', [x, 56, vw - x, 300], 'Weekend shop 12 items · 4 left …'),
    a('lists.your-lists.list', [x, 56, vw - x, 200], 'Weekend shop …'),
    a('lists.your-lists.list.row', [x + 16, 64, 300, 48], 'Weekend shop 12 items · 4 left'),
    a('lists.your-lists.list.row', [x + 16, 120, 300, 48], 'Hardware store 3 items'),
    a('lists.your-lists.list.row', [x + 16, 176, 300, 48], 'Birthday party 18 items · shared with Sam'),
    a('lists.your-lists.new-list', [x + 16, 280, 120, 48], 'New list'),
  ];
  const empty = state === 'empty' ? [
    a('lists.no-lists-yet', [x, 56, vw - x, 200], 'Make a list …'),
    a('lists.no-lists-yet.make-a-list-for-your', [x + 16, 64, 300, 48], 'Make a list for your next shop. Items you buy often come back as suggestions.'),
    a('lists.no-lists-yet.make-your-first-list', [x + 16, 140, 160, 48], 'Make your first list'),
  ] : [];
  const anchors = [
    a('lists', [0, 0, vw, vh], ''),
    a('lists.header', [x, 0, vw - x, 56], 'Lists', { sticky: small }),
    a('lists.header.lists', [x + 16, 14, 60, 28], 'Lists', { sticky: small }),
    ...rows, ...empty,
    a('lists.tabs', small ? [0, vh - 64, vw, 64] : [0, 0, 80, vh], 'Lists Settings', { sticky: true }),
    a('lists.tabs.nav', small ? [0, vh - 64, vw, 64] : [0, 0, 80, vh], 'Lists Settings', { sticky: true }),
    a('lists.tabs.nav.lists', small ? [0, vh - 64, 180, 64] : [0, 0, 80, 64], 'Lists', { sticky: true }),
    a('lists.tabs.nav.settings', small ? [180, vh - 64, 180, 64] : [0, 64, 80, 64], 'Settings', { sticky: true }),
  ];
  anchors.forEach((x, k) => { x.i = k; });
  const elements = [
    { uh: 'lists.header.lists', el: 'h1 "Lists"', text: 'Lists', font: '20/500', box: [x + 16, 14, 60, 28], fg: C.onSurface[d], bg: C.surface[d] },
    { uh: 'lists.header', el: 'span ""', text: 'x', font: '14/400', box: [x + 90, 14, 10, 28], fg: C.onSurface[d], bg: C.surface[d] },
    ...(state === 'empty' ? [] : [{ uh: 'lists.your-lists.new-list', el: 'button "New list"', text: 'New list', font: '14/500', box: [x + 16, 280, 120, 48], fg: C.onPrimary[d], bg: C.primary[d] }]),
  ];
  const r = { screen: 'lists', preset, state, scheme };
  return { ...r, name: runName(r), viewport: [vw, vh], rem: 16, elements, anchors };
}
const edit = (run, fn) => { const r = structuredClone(run); fn(r); return r; };
const anchor = (run, a) => run.anchors.find((x) => x.a === a);
const misses = (r) => r.misses.map((m) => `${m.kind} ${m.anchor}${m.what ? ` ${m.what}` : ''}: ${m.spec} → ${m.build}`);
const all = (fn) => ['small', 'large-landscape'].flatMap((preset) => ['light', 'dark'].flatMap((scheme) =>
  ['default', 'empty'].map((state) => fn(listsRun({ preset, scheme, state })))));

test('a build that matches the spec has no misses, in each preset, scheme and state', () => {
  const r = diff({ spec: pantry(), runs: all((x) => x), theme });
  assert.deepEqual(misses(r), []);
  assert.deepEqual(r.warnings, []);
  assert.equal(r.runs, 8);
  assert.match(report(r), /^matches the spec \(8 runs\)$/);
});

test('missing: a member that is absent, one that is in the DOM but hidden, a nav item, a whole section', () => {
  const spec = pantry();
  const run = edit(listsRun(), (r) => {
    r.anchors = r.anchors.filter((x) => x.a !== 'lists.your-lists.new-list' && x.a !== 'lists.tabs.nav.settings');
    anchor(r, 'lists.header.lists').rendered = false;
  });
  assert.deepEqual(misses(diff({ spec, runs: [run], theme })), [
    'layout lists.header.lists show: visible → hidden',
    'missing lists.tabs.nav.settings: a nav item "Settings" → absent',
    'missing lists.your-lists.new-list: a button → absent',
  ]);
  const gone = edit(listsRun(), (r) => { r.anchors = r.anchors.filter((x) => !x.a.startsWith('lists.your-lists')); });
  assert.deepEqual(misses(diff({ spec, runs: [gone], theme })), ['missing lists.your-lists: the section → absent'], 'one line for a section with nothing of it there');
});

test('order: members within a section, and sections within content or chrome', () => {
  const spec = pantry();
  const run = edit(listsRun(), (r) => { anchor(r, 'lists.your-lists.new-list').i = anchor(r, 'lists.your-lists.list').i - 0.5; });
  assert.deepEqual(misses(diff({ spec, runs: [run], theme })), ['order lists.your-lists members: list, new-list → new-list, list']);
  const chrome = edit(listsRun(), (r) => { anchor(r, 'lists.tabs').i = -1; });
  assert.deepEqual(misses(diff({ spec, runs: [chrome], theme })), ['order lists chrome sections: header, tabs → tabs, header']);
});

test('copy: fixed words exactly, sample words not empty, nav item words', () => {
  const spec = pantry();
  const run = edit(listsRun(), (r) => {
    anchor(r, 'lists.your-lists.new-list').text = 'Add  list';
    anchor(r, 'lists.tabs.nav.settings').text = 'Prefs';
    for (const x of r.anchors.filter((x) => x.a.startsWith('lists.your-lists.list'))) x.text = '';
    r.anchors = r.anchors.filter((x) => x.a !== 'lists.your-lists.list.row');
  });
  assert.deepEqual(misses(diff({ spec, runs: [run], theme })), [
    'copy lists.tabs.nav.settings: "Settings" → "Prefs"',
    'copy lists.your-lists.list rows: rows with words → (empty)',
    'copy lists.your-lists.new-list text: "New list" → "Add list"',
  ]);
  const spaced = edit(listsRun(), (r) => { anchor(r, 'lists.your-lists.new-list').text = '  New\nlist '; });
  assert.deepEqual(misses(diff({ spec, runs: [spaced], theme })), [], 'white space is not a difference');
});

test('copy: a pattern is checked against each row, a when override against its state', () => {
  const spec = pantry();
  const list = spec.screens[0].sections[2].members[0];
  list.pattern = '{n} items';
  const run = edit(listsRun(), (r) => { r.anchors.filter((x) => x.a === 'lists.your-lists.list.row')[1].text = 'Hardware store'; });
  assert.deepEqual(misses(diff({ spec, runs: [run], theme })), [
    'copy lists.your-lists.list rows: the pattern "{n} items" → 1 of 3 rows don\'t fit, such as "Hardware store"',
  ]);
  assert.ok(patternRe('{n} items · {left} left').test('12 items · 4 left'));
  assert.ok(!patternRe('{n} items · {left} left').test('12 items'));

  const button = spec.screens[0].sections[2].members[1];
  button.when = { busy: { text: 'Saving…' } };
  const busy = edit(listsRun(), (r) => { r.state = 'busy'; anchor(r, 'lists.your-lists.new-list').text = 'New list'; });
  spec.screens[0].sections[2].states.push('busy');
  assert.deepEqual(misses(diff({ spec, runs: [busy], theme })), ['copy lists.your-lists.new-list text: "Saving…" → "New list"']);
});

test('token: text colour, background and type against the token in the run\'s scheme', () => {
  const spec = pantry();
  const run = edit(listsRun({ scheme: 'dark' }), (r) => {
    const b = r.elements.find((e) => e.uh === 'lists.your-lists.new-list');
    b.fg = '#ffffff'; b.bg = '#f2b8a3'; b.font = '16/500';
  });
  assert.deepEqual(misses(diff({ spec, runs: [run], theme })), [
    'token lists.your-lists.new-list color: component.button.primary-fg #4a2114 → #ffffff',
    'token lists.your-lists.new-list type: semantic.type.label 14px/500 → 16px/500',
  ], 'a colour one step off on a channel is within tolerance');
  const strict = diff({ spec, runs: [run], theme, tol: { color: 0, px: 2, font: 0.5, columns: 4 } });
  assert.ok(misses(strict).some((m) => m.startsWith('token lists.your-lists.new-list background')));
  const header = edit(listsRun(), (r) => { for (const e of r.elements.filter((e) => e.uh.startsWith('lists.header'))) e.bg = '#ffffff'; });
  assert.deepEqual(misses(diff({ spec, runs: [header], theme })), ['token lists.header background: semantic.color.surface #fcf8f4 → #ffffff']);
  assert.deepEqual(misses(diff({ spec, runs: [run], theme: null })), [], 'no token file, no token check');
  spec.screens[0].sections[0].members[0].tokens.color = 'semantic.color.nope';
  assert.deepEqual(diff({ spec, runs: [listsRun()], theme }).warnings.map((w) => w.text),
    ['token semantic.color.nope isn\'t an opaque colour in the token file; not checked']);
});

test('layout per size class: place, sticky, show, columns, maxWidth, states', () => {
  const spec = pantry();
  const land = { preset: 'large-landscape' };
  const bottomTabs = edit(listsRun(land), (r) => { anchor(r, 'lists.tabs').box = [0, 366, 932, 64]; });
  assert.deepEqual(misses(diff({ spec, runs: [bottomTabs], theme })), ['layout lists.tabs place: side → bottom'], 'tabs move to the side from medium up');
  const stuck = edit(listsRun(land), (r) => { anchor(r, 'lists.header').sticky = true; });
  assert.deepEqual(misses(diff({ spec, runs: [stuck], theme })), ['layout lists.header sticky: false → true'], 'height-compact unsticks the header');
  const loose = edit(listsRun(), (r) => { anchor(r, 'lists.header').sticky = false; });
  assert.deepEqual(misses(diff({ spec, runs: [loose], theme })), ['layout lists.header sticky: true → false']);

  const grid = edit(listsRun(land), (r) => { r.anchors.filter((x) => x.a === 'lists.your-lists.list.row')[1].box = [500, 64, 300, 48]; });
  assert.deepEqual(misses(diff({ spec, runs: [grid], theme })), ['layout lists.your-lists columns: 1 → 2']);
  spec.screens[0].sections[2].layout.expanded.columns = 2;
  assert.deepEqual(misses(diff({ spec, runs: [grid], theme })), []);

  spec.screens[0].sections[2].layout.expanded.maxWidth = '40rem';
  assert.deepEqual(misses(diff({ spec, runs: [grid], theme })), ['layout lists.your-lists maxWidth: 40rem (640px) → 852px']);

  spec.screens[0].sections[2].members[1].layout = { expanded: { show: 'more' } };
  assert.ok(misses(diff({ spec, runs: [grid], theme })).includes('layout lists.your-lists.new-list show: more → visible'));
  assert.ok(!misses(diff({ spec, runs: [listsRun()], theme })).some((m) => m.includes('new-list')), 'still shown at compact');

  const listInEmpty = edit(listsRun({ state: 'empty' }), (r) => { r.anchors.push({ ...anchor(listsRun(), 'lists.your-lists'), i: 99 }); });
  assert.deepEqual(misses(diff({ spec: pantry(), runs: [listInEmpty], theme })), ['layout lists.your-lists states: only in default → shown in empty']);
});

test('the same miss across runs is one line, with where it shows', () => {
  const runs = all((r) => edit(r, (x) => { const b = anchor(x, 'lists.header.lists'); if (b) b.text = 'My lists'; }));
  const r = diff({ spec: pantry(), runs, theme });
  assert.equal(r.misses.length, 1);
  assert.equal(r.misses[0].at.length, 8);
  assert.equal(where(r.misses[0].at), 'default, empty · small, large-landscape · light, dark');
  const text = report(r);
  assert.match(text, /^lists\.header\n {2}copy {5}lists\.header\.lists text: spec "Lists", build "My lists" {2}\[default, empty · small, large-landscape · light, dark\]$/m);
  assert.match(text, /1 miss in 1 section \(8 runs\)$/);
});

test('accepted departures come off the misses; extra anchors and missing routes are warnings', () => {
  const run = edit(listsRun(), (r) => {
    anchor(r, 'lists.your-lists.new-list').text = 'Add list';
    r.anchors.push({ a: 'lists.your-lists.promo', i: 7.5, rendered: true, box: [0, 400, 360, 40], text: 'Try Pro' });
    r.anchors.push({ a: 'lists.your-lists.list.row.badge', i: 4.5, rendered: true, box: [0, 70, 10, 10], text: '1' });
    r.anchors.push({ a: 'settings.header', i: 40, rendered: true, box: [0, 0, 10, 10], text: 'Settings' });
  });
  const accepted = [{ anchor: 'lists.your-lists.new-list', check: 'copy', why: 'Shorter for the button', approved: '2026-11-20' }];
  const r = diff({ spec: pantry(), runs: [run], theme, accepted });
  assert.deepEqual(r.misses, []);
  assert.equal(r.accepted.length, 1);
  assert.deepEqual(r.warnings.map((w) => w.text), ['extra lists.your-lists.promo: in the build, not in the spec'],
    'parts of a member and other screens\' anchors are not extra');
  const text = report(r, { unreachable: [{ screen: 'lists', state: 'empty' }] });
  assert.match(text, /accepted\n {2}copy {5}lists\.your-lists\.new-list text: Shorter for the button \(2026-11-20\)/);
  assert.match(text, /unreachable lists · empty: no route/);
  assert.match(text, /matches the spec, 1 accepted, 2 warnings/);
});

test('--screen keeps to the anchors given', () => {
  const run = edit(listsRun(), (r) => {
    anchor(r, 'lists.your-lists.new-list').text = 'Add list';
    anchor(r, 'lists.header.lists').text = 'My lists';
  });
  assert.deepEqual(misses(diff({ spec: pantry(), runs: [run], theme, only: ['lists.header'] })), ['copy lists.header.lists text: "Lists" → "My lists"']);
  assert.deepEqual(misses(diff({ spec: pantry(), runs: [run], theme, only: ['lists.your-lists.new-list'] })), ['copy lists.your-lists.new-list text: "New list" → "Add list"']);
  assert.equal(diff({ spec: pantry(), runs: [run], theme, only: ['lists'] }).misses.length, 2);
  assert.deepEqual(statesOf(pantry().screens[0], ['lists.header']), ['default'], 'a section in every state needs only the default');
  assert.deepEqual(statesOf(pantry().screens[0]), ['default', 'empty']);
});

test('plan: one preset per width class, both schemes, each state with a route', () => {
  const spec = pantry();
  assert.deepEqual(pickPresets(spec).map((p) => p.id), ['small', 'small-landscape', 'medium-landscape']);
  assert.deepEqual(pickPresets(spec, ['large-landscape']).map((p) => p.id), ['large-landscape']);
  assert.throws(() => pickPresets(spec, ['huge']), /the spec's presets are small/);

  const p = plan({ spec, url: 'http://localhost:5173/{screen}?state={state}', only: ['lists'], presets: ['small'] });
  assert.deepEqual(p.runs.map((r) => r.name), ['lists.small', 'lists.small.dark', 'lists.small.empty', 'lists.small.empty.dark']);
  assert.equal(p.runs[2].url, 'http://localhost:5173/lists?state=empty');
  assert.deepEqual(p.unreachable, []);

  const noState = plan({ spec, url: 'http://localhost:5173/{screen}', only: ['lists'], schemes: ['light'] });
  assert.deepEqual(noState.unreachable, [{ screen: 'lists', state: 'empty' }]);
  assert.equal(noState.runs.length, 3);

  const routed = plan({ spec, url: 'http://localhost:5173/', only: ['lists'], routes: { 'lists.empty': { url: '/?seed=none', steps: [{ click: '#clear' }] } }, presets: ['small'], schemes: ['dark'] });
  assert.deepEqual(routed.runs.map((r) => [r.name, r.url, r.steps.length]), [
    ['lists.small.dark', 'http://localhost:5173/', 0], ['lists.small.empty.dark', 'http://localhost:5173/?seed=none', 1],
  ], 'a single screen takes a plain --url; a route is resolved against it');
  assert.equal(locate({ url: 'http://x/{screen}', screen: 'lists', state: 'empty' }), null);
  assert.match(toHref('build/{screen}.html?x=1'), /^file:\/\/.*\/build\/%7Bscreen%7D\.html\?x=1$/);
  assert.equal(toHref('https://a.b/c'), 'https://a.b/c');

  const { steps, evals } = driveSteps(p.runs.slice(0, 1), { attr: 'data-testid', wait: 100 });
  assert.deepEqual(steps.slice(0, 5), [{ size: [360, 800] }, { scheme: 'light' }, { goto: 'http://localhost:5173/lists?state=default' },
    { wait: '[data-testid="lists"], [data-testid^="lists."]', optional: true }, { wait: 100 }]);
  assert.deepEqual(steps[5], { inspect: true, name: 'lists.small', quiet: true });
  assert.equal(evals[6], 'lists.small');
  assert.match(steps[6].eval, /"data-testid"/);
});

test('geometry helpers', () => {
  assert.equal(placeOf([0, 0, 80, 430], [932, 430], null), 'side');
  assert.equal(placeOf([0, 366, 932, 64], [932, 430], null), 'bottom');
  assert.equal(placeOf([0, 0, 360, 56], [360, 800], null), 'top');
  assert.equal(placeOf([0, 100, 360, 40], [360, 800], { left: 0, top: 140, right: 360, bottom: 700 }), 'top', 'a bar above the content, not at the edge');
  assert.equal(columnsOf([[16, 0, 1, 1], [18, 50, 1, 1], [400, 0, 1, 1]]), 2);
  assert.equal(columnsOf([[16, 0, 1, 1]]), null);
  const classes = pantry().sizeClasses.width;
  const L = { compact: { sticky: true, columns: 1 }, expanded: { columns: 2 }, 'height-compact': { sticky: false } };
  assert.deepEqual(layoutAt(L, classes, 'large', false), { sticky: true, columns: 2 });
  assert.deepEqual(layoutAt(L, classes, 'medium', true), { sticky: false, columns: 1 });
  assert.ok(nearColor('#101010', '#111111') && !nearColor('#101010', '#121212'));
});

test('the command: --measured diffs a kept pass, exit 0 on a match, 1 on a miss, 2 when it cannot check', () => {
  const dir = mkdtempSync(join(tmpdir(), 'uh-diff-test-'));
  try {
    const spec = pantry();
    spec.theme = { tokens: 'shared/theme/example.tokens.json' };
    writeFileSync(join(dir, 'spec.json'), JSON.stringify(spec));
    for (const r of [listsRun(), listsRun({ scheme: 'dark' })]) {
      writeFileSync(join(dir, `inspect-${r.name}.json`), JSON.stringify({ viewport: r.viewport, elements: r.elements }));
      writeFileSync(join(dir, `anchors-${r.name}.json`), JSON.stringify({ viewport: r.viewport, rem: 16, anchors: r.anchors }));
    }
    assert.deepEqual(readMeasured(dir).map((r) => [r.name, r.scheme, r.anchors.length]).sort(), [['lists.small', 'light', 13], ['lists.small.dark', 'dark', 13]]);
    const cmd = (...a) => spawnSync(process.execPath, [DIFF, '--spec', join(dir, 'spec.json'), '--root', root, ...a], { encoding: 'utf8' });
    const ok = cmd('--measured', dir);
    assert.equal(ok.status, 0, ok.stderr);
    assert.match(ok.stdout, /matches the spec \(2 runs: 1 screen × 1 presets × 2 schemes\)/);

    const bad = listsRun({ scheme: 'dark' });
    bad.elements[0].fg = '#000000';
    writeFileSync(join(dir, `inspect-${bad.name}.json`), JSON.stringify({ viewport: bad.viewport, elements: bad.elements }));
    const miss = cmd('--measured', dir);
    assert.equal(miss.status, 1);
    assert.match(miss.stdout, /token +lists\.header\.lists color: spec semantic\.color\.on-surface #ebe1d8, build #000000 {2}\[default · small · dark\]/);
    const json = JSON.parse(cmd('--measured', dir, '--json').stdout);
    assert.equal(json.misses[0].kind, 'token');

    writeFileSync(join(dir, 'accepted.json'), JSON.stringify([{ anchor: 'lists.header.lists', check: 'token', why: 'darker for contrast' }]));
    assert.equal(cmd('--measured', dir).status, 0, 'accepted.json beside the spec is read');

    assert.equal(cmd('--measured', dir, '--scheme', 'blue').status, 2);
    assert.match(cmd('--measured', dir, '--screen', 'nope').stderr, /--screen nope: the spec's screens are lists/);
    assert.equal(cmd().status, 2, 'no --url, --routes or --measured prints the usage');
    const steps = cmd('--url', 'http://localhost:1/{screen}?s={state}', '--screen', 'lists', '--preset', 'small', '--steps');
    assert.equal(steps.status, 0);
    assert.equal(JSON.parse(steps.stdout).filter((s) => s.inspect).length, 4);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('live: measures a page in Chrome and finds what it misses', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'uh-diff-live-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const spec = pantry();
  writeFileSync(join(dir, 'spec.json'), JSON.stringify(spec));
  /* Lists at small: the header and tabs stick, the rows are there; New list says "Add list"
     and the empty state has no page of its own. */
  writeFileSync(join(dir, 'lists.html'), `<!doctype html><meta name="viewport" content="width=device-width">
<style>body{margin:0;font:16px system-ui;background:#fcf8f4;color:#1f1a16} header{position:sticky;top:0;height:56px;background:#fcf8f4}
h1{margin:0;padding:14px 16px;font-size:20px;font-weight:500} nav{position:fixed;bottom:0;left:0;right:0;height:64px;display:flex;background:#fff}
nav a{flex:1;text-align:center;padding:20px} li{padding:12px 16px} ul{list-style:none;margin:0;padding:0}</style>
<div data-uh="lists"><header data-uh="lists.header"><h1 data-uh="lists.header.lists">Lists</h1></header>
<main data-uh="lists.your-lists"><ul data-uh="lists.your-lists.list"><li data-uh="lists.your-lists.list.row">Weekend shop · 12 items</li>
<li data-uh="lists.your-lists.list.row">Hardware store · 3 items</li></ul><button data-uh="lists.your-lists.new-list">Add list</button></main>
<nav data-uh="lists.tabs"><div data-uh="lists.tabs.nav" style="display:contents"><a data-uh="lists.tabs.nav.lists">Lists</a><a data-uh="lists.tabs.nav.settings">Settings</a></div></nav></div>`);
  const run = spawnSync(process.execPath, [DIFF, '--spec', join(dir, 'spec.json'), '--url', join(dir, '{screen}.html'),
    '--screen', 'lists', '--preset', 'small', '--scheme', 'light', '--wait', '50', '--port', '9351', '--keep', join(dir, 'kept')], { encoding: 'utf8', timeout: 120000 });
  if (/Chrome not found/.test(run.stderr + run.stdout)) return t.skip('Chrome not found');
  assert.equal(run.status, 1, run.stderr + run.stdout);
  assert.match(run.stdout, /copy +lists\.your-lists\.new-list text: spec "New list", build "Add list"/);
  assert.match(run.stdout, /unreachable lists · empty/);
  assert.match(run.stdout, /1 miss in 1 section/, run.stdout);
  const kept = readMeasured(join(dir, 'kept'));
  assert.equal(kept.length, 1);
  const nav = kept[0].anchors.find((x) => x.a === 'lists.tabs.nav');
  assert.ok(nav.rendered && nav.box[2] > 300, 'a display: contents anchor takes its children\'s box');
  assert.ok(kept[0].anchors.find((x) => x.a === 'lists.header').sticky);
});
