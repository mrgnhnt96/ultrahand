// node --test shared/canvas/build.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const example = join(here, '..', 'blueprint', 'example', 'blueprint.json');

const CONFIG = { presets: [{ id: 'phone', label: 'Phone', width: 390, height: 844 }] };
function config(dir) {
  const file = join(dir, 'config.json');
  writeFileSync(file, JSON.stringify(CONFIG));
  return file;
}

function build(screenHtml) {
  const dir = mkdtempSync(join(tmpdir(), 'canvas-'));
  const screen = join(dir, 'screen.html');
  writeFileSync(screen, screenHtml);
  return spawnSync(process.execPath, [join(here, 'build.mjs'), '--screen', screen, '--config', config(dir), '--out', join(dir, 'index.html')], { encoding: 'utf8' });
}
const page = (inner) => `<template id="uh-screen"><section ${inner}</section></template>`;

test('a screen with anchors on every screen, section and member builds without anchor warnings', () => {
  const r = build(page(`data-screen="home" data-uh="home" data-title="Home">
    <div data-section="Main" data-uh="home.main"><button data-member="button" data-uh="home.main.button-1">Go</button></div>`));
  assert.equal(r.status, 0, r.stderr);
  assert.doesNotMatch(r.stderr, /data-uh/);
});

test('a screen, section and member without data-uh each get a warning that names them', () => {
  const r = build(page(`data-screen="home" data-title="Home">
    <div data-section="Main"><button data-member="button">Go</button><p data-member="text">Hi</p></div>`));
  assert.equal(r.status, 0, 'a warning does not fail the build');
  assert.match(r.stderr, /1 screen without a data-uh anchor \("home"\)/);
  assert.match(r.stderr, /1 section without a data-uh anchor \("Main"\)/);
  assert.match(r.stderr, /2 members without a data-uh anchor/);
});

test('a data-uh on another tag does not count for an unanchored section', () => {
  const r = build(page(`data-screen="home" data-uh="home" data-title="Home">
    <div data-section="Main"><button data-uh="home.main.button-1">Go</button></div>`));
  assert.match(r.stderr, /1 section without a data-uh anchor/);
});

test('a blueprint build is generated with anchors and warns about none', () => {
  const dir = mkdtempSync(join(tmpdir(), 'canvas-'));
  const r = spawnSync(process.execPath, [join(here, 'build.mjs'), '--blueprint', example, '--config', config(dir), '--out', join(dir, 'index.html')], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.doesNotMatch(r.stderr, /data-uh/);
});
