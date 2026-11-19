// node --test shared/blueprint/parts.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { FALLBACK, check, fill, forceSelector, partStates, readInventory, render } from './parts.mjs';
import { contrast, parseColor } from '../theme/tokens.mjs';

const PARTS = fileURLToPath(new URL('./parts.mjs', import.meta.url));
const EXAMPLE = fileURLToPath(new URL('./parts-example/parts.json', import.meta.url));
const fallbackVars = new Set(Object.keys(FALLBACK));
const INVENTORY = readInventory(`# Shop theme

Version 2.1.0

## Components

| Component | Variants | Tokens | Defined in |
|---|---|---|---|
| Button | primary, secondary | \`button.*\` | src/Button.tsx |
| Card | default | card.* | src/Card.tsx |

## Lessons
`);

const part = (over = {}) => ({
  name: 'Chip',
  status: 'new',
  why: 'Filters the list.',
  html: '<button class="chip" {{attrs}}>{{text}}</button>',
  text: 'Open now',
  long: 'Open now and taking walk-ins',
  css: '.chip { padding: var(--space-inset-tight); color: var(--color-on-surface); }',
  ...over,
});
const run = (parts, opts = {}) => check({ parts, ...opts.doc }, { inventory: INVENTORY, defined: fallbackVars, themed: false, ...opts });

test('forceSelector adds the forced attribute next to each state pseudo-class', () => {
  assert.equal(forceSelector('.b:hover'), '.b:is(:hover, [data-pt-hover], :has([data-pt-hover]))');
  assert.equal(forceSelector('.b:focus-visible'), '.b:is(:focus-visible, [data-pt-focus])');
  assert.equal(forceSelector('.f:focus-within .l'), '.f:is(:focus-within, [data-pt-focus], :has([data-pt-focus])) .l');
  assert.equal(forceSelector('.b:not(:hover)'), '.b:not(:hover)');
  assert.equal(forceSelector('.b::before'), '.b::before');
  assert.equal(forceSelector('[title=":hover"]'), '[title=":hover"]');
  assert.equal(forceSelector('.c:has(.b:active)'), '.c:has(.b:is(:active, [data-pt-active]))');
});

test('fill escapes text, keeps attrs raw and drops empty sections', () => {
  assert.equal(fill('<b {{attrs}}>{{text}}</b>', { text: '<i>', attrs: 'disabled' }), '<b disabled>&lt;i&gt;</b>');
  assert.equal(fill('a{{#message}}<e>{{message}}</e>{{/message}}', { message: '' }), 'a');
  assert.equal(fill('a{{#message}}<e>{{message}}</e>{{/message}}', { message: 'No' }), 'a<e>No</e>');
  assert.equal(fill('{{#icon}}x{{/icon}}{{other}}', { text: '' }), '{{#icon}}x{{/icon}}{{other}}');
});

test('readInventory reads the Components table, title and version', () => {
  assert.equal(INVENTORY.title, 'Shop theme');
  assert.equal(INVENTORY.version, '2.1.0');
  assert.deepEqual(INVENTORY.components.map((c) => c.component), ['Button', 'Card']);
  assert.equal(INVENTORY.components[0].tokens, 'button.*');
  assert.equal(readInventory('# No table').components.length, 0);
});

test('partStates adds error and long when the part has them', () => {
  const ids = (p, d) => partStates(p, d).map((s) => s.id);
  assert.deepEqual(ids({ long: 'x' }), ['default', 'hover', 'pressed', 'focus', 'disabled', 'long']);
  assert.deepEqual(ids({ error: 'Bad' }, ['default', 'focus']), ['default', 'focus', 'error']);
  const [hard] = partStates({ states: { hard: { attrs: 'data-level="hard"' } } });
  assert.deepEqual([hard.label, hard.attrs, hard.force], ['Hard', 'data-level="hard"', '']);
  assert.equal(partStates({ states: ['pressed'] })[0].force, 'hover active');
});

test('a clean new part passes', () => {
  const r = run([part()]);
  assert.deepEqual(r.errors, []);
  assert.equal(r.parts[0].id, 'chip');
});

test('raw colours are errors and raw spacing warns', () => {
  const r = run([part({ css: '.chip { color: #333; background: rgb(0 0 0); border-color: red; margin: 13px; }' })]);
  assert.equal(r.errors.filter((e) => /raw colour/.test(e)).length, 3);
  assert.match(r.warnings.join('\n'), /off the 8-point grid/);
  assert.match(run([part({ html: '<b style="color:#fff">{{text}}</b>' })]).errors.join('\n'), /raw colour/);
});

test('unknown custom properties: error bare, allowed with a fallback when there is no theme', () => {
  const css = '.chip { color: var(--chip-fg); background: var(--chip-bg, var(--color-surface)); border-color: var(--chip-fg); }';
  const plain = run([part({ css })]);
  assert.equal(plain.errors.length, 1, 'reported once per var');
  assert.match(plain.errors[0], /--chip-fg/);
  const themed = run([part({ css })], { themed: true, defined: new Set([...fallbackVars, '--chip-fg']) });
  assert.deepEqual(themed.errors, []);
  assert.match(themed.warnings.join('\n'), /--chip-bg.*fallback value will show/);
});

test('reused parts must be in the inventory; new ones that duplicate it warn', () => {
  assert.match(run([part({ name: 'Toggle', status: 'reused' })]).errors.join('\n'), /no component "Toggle"/);
  assert.deepEqual(run([part({ name: 'Primary', component: 'Button', status: 'reused', variant: 'primary' })]).errors, []);
  assert.match(run([part({ name: 'Button', status: 'reused', variant: 'ghost' })]).warnings.join('\n'), /variant "ghost"/);
  assert.match(run([part({ name: 'Card' })]).warnings.join('\n'), /already has "Card"/);
});

test('missing fields, a long state without long text and unfilled placeholders are errors', () => {
  const e = run([part({ why: '', status: 'maybe', long: undefined, states: ['default', 'long'], html: '<b>{{text}}{{icon}}</b>' })]).errors.join('\n');
  assert.match(e, /why is required/);
  assert.match(e, /status must be/);
  assert.match(e, /long state needs "long"/);
  assert.match(e, /\{\{icon\}\} unfilled/);
  assert.match(run([part(), part()]).errors.join('\n'), /used twice/);
});

test('render gives one screen per part, titled with its name, and the overview first', () => {
  const r = run([part(), part({ name: 'Button', status: 'reused', error: 'Try again' })]);
  const { screen, config } = render({ title: 'Shop parts', parts: r.parts, themed: false, inventory: INVENTORY });
  assert.equal(config.initialScreen, 'parts');
  assert.ok(config.states.some((s) => s.id === 'error'));
  assert.match(screen, /data-screen="part-chip" data-title="Chip · new"/);
  assert.match(screen, /data-screen="part-button" data-title="Button · reused"/);
  assert.match(screen, /id="chip--pressed" data-pt-force="hover active"/);
  assert.match(screen, /aria-label="Chip, new part"/);
  assert.match(screen, /--color-surface: light-dark/, 'no theme: fallback roles on :host');
  assert.doesNotMatch(render({ title: 't', parts: r.parts, themed: true }).screen, /--color-surface: light-dark/);
});

test('custom states stay on the part screen, out of the State picker; uid is unique per copy', () => {
  const r = run([part({ html: '<b id="{{uid}}">{{text}}</b>', states: { default: {}, hard: { text: 'Hard' } } })]);
  assert.deepEqual(r.errors, []);
  const { screen, config } = render({ title: 't', parts: r.parts, themed: false });
  assert.deepEqual(config.states.map((s) => s.id), ['default']);
  assert.match(screen, /id="chip--hard" data-pt-force=""><b id="chip--hard">Hard<\/b>/);
  assert.match(screen, /<b id="ov-chip--default">/);
  assert.doesNotMatch(screen, /ov-chip--hard/);
});

test('the fallback colours meet WCAG contrast in both schemes', () => {
  const pick = (name, i) => parseColor(FALLBACK[name].match(/light-dark\(([^,]+),\s*([^)]+)\)/)[i + 1]);
  const pairs = [
    ['--color-on-surface', '--color-surface', 4.5], ['--color-on-surface-variant', '--color-surface', 4.5],
    ['--color-on-surface', '--color-surface-raised', 4.5], ['--color-on-primary', '--color-primary', 4.5],
    ['--color-on-primary-container', '--color-primary-container', 4.5], ['--color-error', '--color-surface', 4.5],
    ['--color-on-error', '--color-error', 4.5], ['--color-outline', '--color-surface', 3],
    ['--color-focus-ring', '--color-surface', 3],
  ];
  for (const scheme of [0, 1]) {
    for (const [fg, bg, min] of pairs) {
      const ratio = contrast(pick(fg, scheme), pick(bg, scheme));
      assert.ok(ratio >= min, `${fg} on ${bg} (${scheme ? 'dark' : 'light'}) is ${ratio.toFixed(2)}, under ${min}`);
    }
  }
});

test('the example checks clean with and without a theme', () => {
  const dir = mkdtempSync(join(tmpdir(), 'parts-'));
  try {
    const plain = spawnSync(process.execPath, [PARTS, EXAMPLE, '--check'], { encoding: 'utf8' });
    assert.equal(plain.status, 0, plain.stderr);
    assert.equal(plain.stderr, '', 'no warnings without a theme');
    const head = join(dir, 'theme.html');
    writeFileSync(head, `<style>:root { ${[...fallbackVars].map((v) => `${v}: 0;`).join(' ')} --card-bg: 0; --card-padding: 0; --card-radius: 0; --button-padding-x: 0; --button-radius: 0; --button-primary-bg: 0; --button-primary-fg: 0; }</style>`);
    const themed = spawnSync(process.execPath, [PARTS, EXAMPLE, '--head', head, '--no-build', '--out', join(dir, 'index.html')], { encoding: 'utf8' });
    assert.equal(themed.status, 0, themed.stderr);
    assert.match(readFileSync(join(dir, 'parts.screen.html'), 'utf8'), /data-screen="part-trail-row"/);
    assert.ok(JSON.parse(readFileSync(join(dir, 'parts.config.json'), 'utf8')).states.length >= 5);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
