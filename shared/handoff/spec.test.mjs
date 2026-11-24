import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildIndex } from '../theme/tokens.mjs';
import { greybox } from '../blueprint/greybox.mjs';
import {
  generate, inspectSteps, readPresets, parseInspectName, readInspectDir, memberSlug, partsList, matchPart,
  tokenTable, matchColor, matchType, slug,
} from './spec.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const pantry = () => JSON.parse(read('shared/blueprint/example/blueprint.json'));
const tokens = JSON.parse(read('shared/theme/example.tokens.json'));
const theme = buildIndex(tokens);
const presets = readPresets(read('skills/mobile/references/presets.md'));

/* Colours of the example theme, light and dark. */
const C = {
  surface: ['#fcf8f4', '#16120f'], raised: ['#ffffff', '#2a2420'], onSurface: ['#1f1a16', '#ebe1d8'],
  variant: ['#4c443e', '#cfc5bc'], primary: ['#8f3f26', '#f2b8a2'], onPrimary: ['#ffffff', '#4a2114'],
};
const el = (uh, text, font, box, fg, bg, dark) => ({
  ...(uh ? { uh } : {}), el: `span "${text}"`, text, font, box, fg: fg[dark ? 1 : 0], bg: bg[dark ? 1 : 0],
});

/* The Lists screen as the inspect pass sees it, at the small preset (compact) and at
   large-landscape (expanded): tabs at the bottom, then at the side with the rows in two
   columns and New list gone. */
function listsRun(preset, dark, { anchored = true } = {}) {
  const a = (x) => (anchored ? x : null);
  const small = preset === 'small';
  const els = small ? [
    el(a('lists.header.lists'), 'Lists', '20/500', [16, 16, 60, 28], C.onSurface, C.surface, dark),
    el(a('lists.your-lists.list.row'), 'Weekend shop', '16/400', [16, 100, 328, 24], C.onSurface, C.raised, dark),
    el(a('lists.your-lists.list.row'), 'Hardware store', '16/400', [16, 160, 328, 24], C.onSurface, C.raised, dark),
    el(a('lists.your-lists.list.row'), 'Birthday party', '16/400', [16, 220, 328, 24], C.onSurface, C.raised, dark),
    el(a('lists.your-lists.new-list'), 'New list', '14/500', [16, 300, 120, 48], C.onPrimary, C.primary, dark),
    el(a('lists.tabs.nav.lists'), 'Lists', '14/500', [0, 740, 180, 60], C.variant, C.surface, dark),
    el(a('lists.tabs.nav.settings'), 'Settings', '14/500', [180, 740, 180, 60], C.variant, C.surface, dark),
  ] : [
    el(a('lists.header.lists'), 'Lists', '20/500', [96, 8, 60, 28], C.onSurface, C.surface, dark),
    el(a('lists.your-lists.list.row'), 'Weekend shop', '16/400', [96, 80, 400, 24], C.onSurface, C.raised, dark),
    el(a('lists.your-lists.list.row'), 'Hardware store', '16/400', [512, 80, 400, 24], C.onSurface, C.raised, dark),
    el(a('lists.your-lists.list.row'), 'Birthday party', '16/400', [96, 140, 400, 24], C.onSurface, C.raised, dark),
    el(a('lists.tabs.nav.lists'), 'Lists', '14/500', [0, 60, 80, 56], C.variant, C.surface, dark),
    el(a('lists.tabs.nav.settings'), 'Settings', '14/500', [0, 120, 80, 56], C.variant, C.surface, dark),
  ];
  return { screen: 'lists', preset, state: 'default', scheme: dark ? 'dark' : 'light', elements: els, scale: 1 };
}
const listsRuns = (opts) => ['small', 'large-landscape'].flatMap((p) => [listsRun(p, false, opts), listsRun(p, true, opts)]);

const find = (spec, anchor) => {
  for (const s of spec.screens) for (const x of s.sections) {
    if (x.anchor === anchor) return x;
    for (const m of x.members) if (m.anchor === anchor) return m;
  }
  return null;
};

test('presets: rotated entries for landscape, shots at the narrowest and widest', () => {
  assert.equal(presets.platform, 'mobile');
  assert.deepEqual(presets.presets.map((p) => p.id),
    ['small', 'medium', 'large', 'small-landscape', 'medium-landscape', 'large-landscape']);
  assert.deepEqual(presets.presets.find((p) => p.id === 'small-landscape'), { id: 'small-landscape', width: 800, height: 360 });
  const { spec } = generate({ blueprint: pantry(), presets });
  assert.deepEqual(spec.shots, ['small', 'large-landscape']);
  assert.equal(spec.platform, 'mobile');
  assert.deepEqual(spec.states, [{ id: 'default' }, { id: 'empty' }]);
  assert.equal(spec.sizeClasses.width[1].name, 'medium');
});

test('anchors follow the handoff README', () => {
  const { spec, errors } = generate({ blueprint: pantry(), presets });
  assert.deepEqual(errors, []);
  assert.deepEqual(spec.screens.map((s) => s.anchor), ['lists', 'list', 'add', 'settings']);
  assert.deepEqual(spec.screens[0].sections.map((s) => s.anchor),
    ['lists.header', 'lists.tabs', 'lists.your-lists', 'lists.no-lists-yet']);
  const nav = find(spec, 'lists.tabs.nav');
  assert.deepEqual(nav.items.map((i) => i.anchor), ['lists.tabs.nav.lists', 'lists.tabs.nav.settings']);
  assert.deepEqual(find(spec, 'lists.your-lists.list').items.map((i) => i.anchor),
    ['lists.your-lists.list.row', 'lists.your-lists.list.row', 'lists.your-lists.list.row']);
  assert.ok(find(spec, 'list.still-to-get.oat-milk-2-litres'), 'a toggle is named by its label');
  assert.ok(find(spec, 'add.item.quantity'), 'a field is named by its label, not its value');
  assert.ok(find(spec, 'lists.no-lists-yet.make-a-list-for-your'), 'long text takes its first five words');
});

test('the greybox carries the same anchors as the spec', () => {
  const bp = pantry();
  bp.screens[0].sections[2].members[1].id = 'start-list';
  const { spec } = generate({ blueprint: bp, presets });
  const want = new Set();
  for (const s of spec.screens) {
    want.add(s.anchor);
    for (const x of s.sections) {
      want.add(x.anchor);
      for (const m of x.members) { want.add(m.anchor); for (const it of m.items || []) want.add(it.anchor); }
    }
  }
  const got = new Set([...greybox(bp).html.matchAll(/data-uh="([^"]+)"/g)].map((m) => m[1]));
  assert.deepEqual([...got].sort(), [...want].sort());
  assert.ok(got.has('lists.your-lists.start-list'), 'an explicit member id names the anchor');
});

test('memberSlug: id first, label first for fields, toggles and stats, else kind', () => {
  assert.equal(memberSlug({ kind: 'button', id: 'Save It', text: 'Save' }), 'save-it');
  assert.equal(memberSlug({ kind: 'field', label: 'Email', text: 'sam@example.com' }), 'email');
  assert.equal(memberSlug({ kind: 'stat', label: 'Done', text: '8 of 12' }), 'done');
  assert.equal(memberSlug({ kind: 'image' }), 'image');
  assert.equal(memberSlug({ kind: 'text', text: '—' }), 'text');
});

test('members of a section with the same name get -2, -3', () => {
  const bp = pantry();
  const actions = bp.screens[2].sections.find((s) => s.name === 'Actions');
  actions.members.push({ kind: 'button', text: 'Save' }, { kind: 'button', text: 'Save' });
  const { spec } = generate({ blueprint: bp, presets });
  assert.deepEqual(spec.screens[2].sections.at(-1).members.map((m) => m.id), ['add-to-weekend-shop', 'save', 'save-2']);
});

test('members carry copy, emphasis, rare and the More menu at the smallest class', () => {
  const { spec } = generate({ blueprint: pantry(), presets });
  const list = find(spec, 'lists.your-lists.list');
  assert.equal(list.copy, 'sample');
  assert.equal(list.items[0].nav, 'list');
  assert.equal(find(spec, 'list.already-in-the-basket').members[0].kind, 'stat');
  assert.equal(find(spec, 'list.already-in-the-basket').members[0].copy, 'sample');
  const btn = find(spec, 'lists.your-lists.new-list');
  assert.equal(btn.copy, 'fixed');
  assert.equal(btn.emphasis, true);
  const share = find(spec, 'list.header.share');
  assert.equal(share.rare, true);
  assert.deepEqual(share.layout, { compact: { show: 'more' } });
});

test('section layout from the blueprint: side chrome, sticky bars, secondary pane, max width', () => {
  const { spec } = generate({ blueprint: pantry(), presets });
  const tabs = find(spec, 'lists.tabs');
  assert.equal(tabs.place, 'bottom');
  assert.deepEqual(tabs.layout, { compact: { sticky: true }, medium: { place: 'side' } });
  assert.deepEqual(find(spec, 'lists.header').layout, { compact: { sticky: true }, 'height-compact': { sticky: false } });
  assert.deepEqual(find(spec, 'list.already-in-the-basket').layout, { compact: { beside: false }, expanded: { beside: true } });
  assert.deepEqual(find(spec, 'lists.your-lists').layout, { expanded: { maxWidth: '60rem' } });
  assert.equal(find(spec, 'list.still-to-get').layout, undefined, 'a screen with a secondary pane has no max width');
  assert.deepEqual(find(spec, 'lists.your-lists').states, ['default']);
});

test('a previous spec keeps its ids through copy edits and records renamed anchors', () => {
  const first = generate({ blueprint: pantry(), presets }).spec;
  const bp = pantry();
  bp.screens[0].sections[2].members[1].text = 'Start a list';
  bp.screens[1].sections[0].name = 'Top bar';
  const { spec } = generate({ blueprint: bp, presets, previous: first });
  assert.ok(find(spec, 'lists.your-lists.new-list'), 'the button keeps its id after its words changed');
  assert.equal(find(spec, 'lists.your-lists.new-list').text, 'Start a list');
  assert.ok(find(spec, 'list.top-bar.share'));
  assert.equal(spec.renamed['list.header'], 'list.top-bar');
  assert.equal(spec.renamed['list.header.share'], 'list.top-bar.share');
  assert.equal(spec.renamed['lists.your-lists.new-list'], undefined);
  assert.equal(generate({ blueprint: pantry(), presets, previous: first }).spec.renamed, undefined);
});

test('blueprint problems stop it', () => {
  const bp = pantry();
  bp.screens[0].sections[0].members[0].kind = 'carousel';
  const r = generate({ blueprint: bp, presets });
  assert.equal(r.spec, null);
  assert.ok(r.errors.length);
});

test('no theme: theme null, token fields null, one warning', () => {
  const { spec, warnings } = generate({ blueprint: pantry(), presets, inspect: listsRuns() });
  assert.equal(spec.theme, null);
  assert.equal(find(spec, 'lists.your-lists.new-list').tokens, null);
  assert.equal(warnings.filter((w) => w.startsWith('no theme')).length, 1);
});

test('token table: semantic and component colours with dark values, type styles resolved', () => {
  const t = tokenTable(theme);
  assert.ok(t.colors.every((c) => !c.path.startsWith('primitive')));
  assert.deepEqual(t.colors.find((c) => c.path === 'component.card.bg'), { path: 'component.card.bg', tier: 'component', light: '#ffffff', dark: '#2a2420' });
  const body = t.types.find((x) => x.path === 'semantic.type.body');
  assert.deepEqual([body.size, body.weight, body.lineHeight, body.family], [16, 400, 24, 'Inter Tight']);
});

test('matchColor: light and dark must both match; the member component and role decide ties', () => {
  const t = tokenTable(theme);
  assert.equal(matchColor(t, ...C.primary, 'background').token, 'component.button.primary-bg');
  assert.equal(matchColor(t, ...C.primary, 'color').token, 'semantic.color.primary');
  assert.equal(matchColor(t, ...C.onPrimary, 'color').token, 'semantic.color.on-primary');
  assert.equal(matchColor(t, ...C.onPrimary, 'color', 'Button').token, 'component.button.primary-fg');
  assert.equal(matchColor(t, ...C.raised, 'background').token, 'semantic.color.surface-raised');
  assert.equal(matchColor(t, ...C.raised, 'background', 'Card').token, 'component.card.bg');
  assert.equal(matchColor(t, '#FFFFFF', '#601410', 'color').token, 'semantic.color.on-error');
  const half = matchColor(t, '#ffffff', '#000000', 'color');
  assert.equal(half.token, null);
  assert.match(half.why, /in light matches .* but no token .* #000000 in dark/);
  assert.match(matchColor(t, '#123456', null, 'color').why, /#123456 \(light\) matches no token/);
});

test('matchType: size and weight, and family and line height when measured', () => {
  const t = tokenTable(theme);
  assert.equal(matchType(t, { size: 16, weight: 400 }).token, 'semantic.type.body');
  assert.equal(matchType(t, { size: 20, weight: 500, lineHeight: 28, family: 'fraunces' }).token, 'semantic.type.title');
  assert.equal(matchType(t, { size: 20, weight: 500, family: 'Inter Tight' }).token, null);
  assert.equal(matchType(t, { size: 16, weight: 400, lineHeight: 30 }).token, null);
  assert.match(matchType(t, { size: 22, weight: 700 }).why, /22px\/700 matches no type token/);
});

for (const anchored of [true, false]) {
  test(`tokens from the inspect pass (${anchored ? 'data-uh on the elements' : 'matched by copy'})`, () => {
    const { spec, warnings } = generate({ blueprint: pantry(), presets, theme, tokensPath: 'design/theme.tokens.json', inspect: listsRuns({ anchored }) });
    assert.deepEqual(spec.theme, { tokens: 'design/theme.tokens.json', version: null });
    assert.deepEqual(find(spec, 'lists.header.lists').tokens, { color: 'semantic.color.on-surface', type: 'semantic.type.title' });
    assert.deepEqual(find(spec, 'lists.your-lists.list').tokens, { color: 'semantic.color.on-surface', type: 'semantic.type.body' });
    assert.deepEqual(find(spec, 'lists.your-lists.new-list').tokens,
      { color: 'semantic.color.on-primary', background: 'component.button.primary-bg', type: 'semantic.type.label' });
    assert.deepEqual(find(spec, 'lists.tabs.nav').tokens, { color: 'semantic.color.on-surface-variant', type: 'semantic.type.label' });
    assert.deepEqual(find(spec, 'lists.your-lists').tokens, { background: 'semantic.color.surface-raised' });
    assert.deepEqual(find(spec, 'lists.header').tokens, { background: 'semantic.color.surface' });
    assert.equal(find(spec, 'lists.no-lists-yet.make-your-first-list').tokens, undefined, 'the empty state was not measured');
    assert.ok(!warnings.some((w) => /raw value/.test(w)), warnings.join('\n'));
    assert.ok(warnings.some((w) => /^list: no inspect pass/.test(w)));
  });
}

test('measured layout: chrome place, list columns and members hidden at a class', () => {
  const { spec, warnings } = generate({ blueprint: pantry(), presets, theme, inspect: listsRuns() });
  assert.deepEqual(find(spec, 'lists.tabs').layout, { compact: { sticky: true }, medium: { place: 'side' } });
  assert.deepEqual(find(spec, 'lists.your-lists').layout, { expanded: { maxWidth: '60rem', columns: 2 } });
  assert.deepEqual(find(spec, 'lists.your-lists.new-list').layout, { expanded: { show: 'hidden' } });
  assert.equal(find(spec, 'lists.your-lists.list').layout, undefined);
  assert.ok(!warnings.some((w) => /the blueprint/.test(w)), warnings.join('\n'));
});

test('the design wins where it departs from the blueprint, with a warning', () => {
  const runs = listsRuns();
  for (const r of runs.filter((x) => x.preset === 'small')) {
    r.elements.find((e) => e.uh === 'lists.header.lists').box = [16, 760, 60, 28];
    r.elements.find((e) => e.uh === 'lists.your-lists.new-list').text = 'Add a list';
  }
  const { spec, warnings } = generate({ blueprint: pantry(), presets, theme, inspect: runs });
  assert.equal(find(spec, 'lists.header').place, 'bottom');
  assert.deepEqual(find(spec, 'lists.header').layout.expanded, { place: 'top' });
  assert.ok(warnings.some((w) => w.startsWith('lists.header: the design has place "bottom" at compact, the blueprint "top"')));
  assert.equal(find(spec, 'lists.your-lists.new-list').text, 'Add a list');
  assert.ok(warnings.some((w) => /the design says "Add a list", the blueprint "New list"/.test(w)));
});

test('raw values are flagged once per value, and anchors the blueprint lacks are reported', () => {
  const runs = listsRuns();
  for (const r of runs) {
    for (const e of r.elements.filter((x) => x.uh === 'lists.your-lists.list.row')) e.fg = r.scheme === 'dark' ? '#eeeeee' : '#123456';
    r.elements.push(el('lists.promo.banner', 'Try Pro', '16/400', [0, 0, 10, 10], C.onSurface, C.surface, r.scheme === 'dark'));
  }
  const { spec, warnings } = generate({ blueprint: pantry(), presets, theme, inspect: runs });
  assert.equal(find(spec, 'lists.your-lists.list').tokens.color, null);
  const raw = warnings.filter((w) => /raw value/.test(w));
  assert.equal(raw.length, 1);
  assert.match(raw[0], /^color #123456 \(light\), #eeeeee \(dark\) matches no token, so the design used a raw value: lists\.your-lists\.list$/);
  assert.ok(warnings.some((w) => /the design has anchor "lists\.promo\.banner"/.test(w)));
});

test('parts: an explicit part, else one of the member kind used on the screen', () => {
  const parts = partsList({
    parts: [
      { name: 'Button', status: 'reused', component: 'Button', variant: 'primary' },
      { name: 'Button', status: 'reused', component: 'Button', variant: 'text' },
      { name: 'Pantry row', status: 'new', usedIn: ['Lists'] },
      { name: 'Basket row', id: 'basket', status: 'new', usedIn: ['Weekend shop'] },
      { name: 'Quiet switch', status: 'new' },
      { name: 'Loud switch', status: 'new' },
    ],
  });
  const lists = { id: 'lists', title: 'Lists' }, list = { id: 'list', title: 'Weekend shop' };
  assert.equal(matchPart({ kind: 'button', emphasis: true }, lists, parts).part.variant, 'primary');
  assert.equal(matchPart({ kind: 'button' }, lists, parts).part.variant, 'text');
  assert.equal(matchPart({ kind: 'list' }, lists, parts).part.name, 'Pantry row');
  assert.equal(matchPart({ kind: 'list' }, list, parts).part.name, 'Basket row');
  assert.equal(matchPart({ kind: 'list', part: 'basket' }, lists, parts).part.name, 'Basket row');
  assert.match(matchPart({ kind: 'list', part: 'Nope' }, lists, parts).warning, /doesn't have/);
  const two = matchPart({ kind: 'toggle' }, lists, parts);
  assert.equal(two.part.name, 'Quiet switch');
  assert.match(two.warning, /could be "Quiet switch" or "Loud switch"/);
  assert.equal(matchPart({ kind: 'title' }, lists, parts).warning, null);
  assert.equal(parts[2].part, 'new');
  assert.equal(parts[2].component, 'Pantry row');
});

test('parts drive component, variant and part on members, and component tokens', () => {
  const parts = { parts: [{ name: 'Button', status: 'reused', component: 'Button', variant: 'primary' }] };
  const inventory = { title: 'Pantry', version: '1.2.0', components: [{ component: 'Button' }] };
  const { spec } = generate({ blueprint: pantry(), presets, theme, parts, inventory, inspect: listsRuns() });
  const btn = find(spec, 'lists.your-lists.new-list');
  assert.deepEqual([btn.component, btn.variant, btn.part], ['Button', 'primary', 'reused']);
  assert.equal(btn.tokens.color, 'component.button.primary-fg');
  assert.equal(spec.theme.version, '1.2.0');
  assert.deepEqual([find(spec, 'lists.header.lists').component, find(spec, 'lists.header.lists').part], [null, null]);
});

test('parseInspectName', () => {
  assert.deepEqual(parseInspectName('inspect-lists.small.json'), { screen: 'lists', preset: 'small', state: 'default', scheme: 'light' });
  assert.deepEqual(parseInspectName('out/inspect-lists.large-landscape.empty.dark.json'),
    { screen: 'lists', preset: 'large-landscape', state: 'empty', scheme: 'dark' });
  assert.equal(parseInspectName('inspect-lists.json'), null);
  assert.equal(parseInspectName('shot-lists.small.json'), null);
});

test('inspectSteps: one preset per width class, light and dark, each limited state', () => {
  const steps = inspectSteps({ blueprint: pantry(), presets });
  const names = steps.filter((s) => s.inspect).map((s) => s.name);
  assert.equal(names.length, 30);
  assert.ok(names.includes('lists.small'));
  assert.ok(names.includes('lists.medium-landscape.empty.dark'));
  assert.ok(names.includes('settings.small-landscape'));
  assert.ok(!names.some((n) => n.startsWith('settings.') && n.includes('empty')));
  assert.ok(names.every((n) => parseInspectName(`inspect-${n}.json`)));
  const evals = steps.filter((s) => s.eval).map((s) => s.eval);
  assert.ok(evals[0].includes('ultrahandCanvas.usePreset("small")'));
  assert.ok(evals.some((e) => e.includes('ultrahandCanvas.setSize(800, 360)')));
  assert.ok(steps.filter((s) => s.inspect).every((s) => s.inspect === '.uh-viewport'));
});

test('CLI: writes the spec from files and prints the steps', () => {
  const dir = mkdtempSync(join(tmpdir(), 'uh-spec-'));
  try {
    const ins = join(dir, 'inspect');
    mkdirSync(ins);
    for (const r of listsRuns()) {
      writeFileSync(join(ins, `inspect-${r.screen}.${r.preset}${r.scheme === 'dark' ? '.dark' : ''}.json`),
        JSON.stringify({ viewport: [1400, 1000], scale: 1, elements: r.elements }));
    }
    assert.equal(readInspectDir(ins).length, 4);
    const tokensFile = join(dir, 'theme.tokens.json');
    writeFileSync(tokensFile, JSON.stringify(tokens));
    const out = join(dir, 'design', 'pantry', 'spec.json');
    const cli = join(here, 'spec.mjs');
    const r = spawnSync(process.execPath, [cli, '--blueprint', join(root, 'shared/blueprint/example/blueprint.json'),
      '--presets', join(root, 'skills/mobile/references/presets.md'), '--tokens', tokensFile, '--inspect', ins,
      '--round', '3', '--approved', '2026-11-20', '--root', dir, '--out', out], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const spec = JSON.parse(readFileSync(out, 'utf8'));
    assert.equal(spec.spec, 1);
    assert.deepEqual(spec.design, { artifact: null, round: 3, approved: '2026-11-20' });
    assert.equal(spec.theme.tokens, 'theme.tokens.json');
    assert.equal(find(spec, 'lists.header.lists').tokens.type, 'semantic.type.title');
    assert.match(r.stderr, /wrote .*spec\.json \(4 screens, 30 members/);

    const s = spawnSync(process.execPath, [cli, '--steps', '--blueprint', join(root, 'shared/blueprint/example/blueprint.json'),
      '--presets', join(root, 'skills/mobile/references/presets.md')], { encoding: 'utf8' });
    assert.equal(s.status, 0, s.stderr);
    assert.equal(JSON.parse(s.stdout).filter((x) => x.inspect).length, 30);

    const bad = spawnSync(process.execPath, [cli, '--blueprint', 'x.json'], { encoding: 'utf8' });
    assert.equal(bad.status, 2);
    assert.match(bad.stdout, /--steps/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('slug', () => {
  assert.equal(slug('Oat milk, 2 litres'), 'oat-milk-2-litres');
  assert.equal(slug('  Already in the basket '), 'already-in-the-basket');
});
