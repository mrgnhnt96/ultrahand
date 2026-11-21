// node --test shared/theme/css.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const example = join(here, 'example.tokens.json');
const css = (...args) => {
  const r = spawnSync(process.execPath, [join(here, 'css.mjs'), ...args], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
};

test('a theme with dark values lets light-dark() pick them: color-scheme light dark, zero specificity', () => {
  const out = css(example);
  assert.match(out, /light-dark\(/);
  assert.match(out, /^:where\(:root\) \{ color-scheme: light dark; \}$/m);
  // Before the tokens, and never inside the specific selector, so the canvas's own scheme rules win.
  assert.ok(out.indexOf(':where(:root)') < out.indexOf(':root {'));
  assert.doesNotMatch(out.slice(out.indexOf(':root {')), /color-scheme/);
});

test('--selector scopes color-scheme with it', () => {
  const out = css(example, '--selector', '[data-state="a"]', '--style');
  assert.match(out, /^:where\(\[data-state="a"\]\) \{ color-scheme: light dark; \}$/m);
  assert.match(out, /^<style>\n/);
});

test('a theme whose colours match in both schemes leaves color-scheme alone', () => {
  const theme = JSON.parse(readFileSync(example, 'utf8'));
  const strip = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.$extensions) delete node.$extensions;
    for (const v of Object.values(node)) strip(v);
  };
  strip(theme);
  const file = join(mkdtempSync(join(tmpdir(), 'uh-css-')), 'light.tokens.json');
  writeFileSync(file, JSON.stringify(theme));
  const out = css(file);
  assert.doesNotMatch(out, /light-dark\(/);
  assert.doesNotMatch(out, /color-scheme/);
});
