#!/usr/bin/env node
// Starts the ultrahand binary for this plugin version. No review logic lives here.
//
//   node "${CLAUDE_PLUGIN_ROOT}/shared/review/launch.mjs" --data "${CLAUDE_PLUGIN_DATA}" review ...
//
// Both variables are filled in for skill text and empty in the shell, so the data folder
// arrives as an argument and the plugin root comes from this file's location. Plugins can't
// carry a bin/ folder (claude.ai and Cowork won't install one), so the binary is looked for
// in this order:
//
//   1. <data>/bin/ultrahand-<version>-<target>, checked against checksums.txt on every run.
//   2. The release asset for this version, checked before it is written to disk.
//   3. cargo build of the plugin's cli/ source, when the asset can't be fetched or the
//      plugin has no checksum for it (a checkout between releases).
//
// stdout and the exit code are the binary's (0, 1 or 2). The launcher adds two of its own:
//   3  no binary here: the skill takes its fallback, a general-purpose Agent.
//   4  a checksum didn't match: nothing ran, and nothing should be retried or run instead.
//
// ULTRAHAND_RELEASE_URL swaps the download base, for tests. Checksums still apply.
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RELEASES = 'https://github.com/mrgnhnt96/ultrahand/releases/download';
const TARGETS = {
  'darwin-arm64': 'aarch64-apple-darwin',
  'darwin-x64': 'x86_64-apple-darwin',
  'linux-arm64': 'aarch64-unknown-linux-musl',
  'linux-x64': 'x86_64-unknown-linux-musl',
};
const EXIT_NO_BINARY = 3;
const EXIT_BAD_CHECKSUM = 4;
const DOWNLOAD_LIMIT_MS = 2 * 60_000;
const BUILD_LIMIT_MS = 15 * 60_000;
const FORWARDED_SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP'];

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

class Stop extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const noBinary = (reason) =>
  new Stop(
    EXIT_NO_BINARY,
    `no review binary: ${reason}. Run the review in a general-purpose Agent instead, never in the calling session.`,
  );

function parseArgs(argv) {
  const [flag, data, ...rest] = argv;
  if (flag !== '--data') throw noBinary('the launcher needs --data <plugin data folder> first');
  if (!data) throw noBinary('--data is empty, so the plugin data folder is unknown');
  const args = rest[0] === 'review' ? ['review', '--plugin-root', root, ...rest.slice(1)] : rest;
  return { data: resolve(data), args };
}

function checksumFor(asset) {
  let text;
  try {
    text = readFileSync(join(root, 'shared/review/checksums.txt'), 'utf8');
  } catch {
    return undefined;
  }
  for (const line of text.split('\n')) {
    const [hash, name] = line.trim().split(/\s+/);
    if (name === asset) return hash;
  }
  return undefined;
}

function requireChecksum(bytes, expected, source) {
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual === expected) return;
  throw new Stop(
    EXIT_BAD_CHECKSUM,
    `${source} doesn't match the checksum this plugin carries (expected ${expected}, got ${actual}). ` +
      'Nothing was run. Stop here: no retry and no fallback, and tell the user.',
  );
}

async function download(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_LIMIT_MS) });
    if (response.ok) return Buffer.from(await response.arrayBuffer());
    console.error(`ultrahand: can't fetch ${url}: HTTP ${response.status}`);
  } catch (error) {
    console.error(`ultrahand: can't fetch ${url}: ${error.cause?.message ?? error.message}`);
  }
  return undefined;
}

function install(bytes, path) {
  mkdirSync(dirname(path), { recursive: true });
  const partial = `${path}.${process.pid}.partial`;
  try {
    writeFileSync(partial, bytes, { mode: 0o755 });
    renameSync(partial, path);
  } finally {
    rmSync(partial, { force: true });
  }
}

function buildFromSource(data) {
  const targetDir = join(data, 'cargo-target');
  mkdirSync(data, { recursive: true });
  console.error('ultrahand: building the review binary with cargo');
  const cargoArgs = [
    'build',
    '--release',
    '--locked',
    '--quiet',
    '--manifest-path',
    join(root, 'cli/Cargo.toml'),
    '--target-dir',
    targetDir,
  ];
  const build = spawnSync('cargo', cargoArgs, { stdio: ['ignore', 2, 2], timeout: BUILD_LIMIT_MS });
  if (build.error?.code === 'ENOENT') throw noBinary('no prebuilt binary to use and no cargo to build one');
  if (build.error || build.status !== 0) throw noBinary('cargo build failed');
  return join(targetDir, 'release', 'ultrahand');
}

async function findBinary(data) {
  if (process.platform === 'win32') throw noBinary('there is no Windows build yet');
  const target = TARGETS[`${process.platform}-${process.arch}`];
  const asset = `ultrahand-${target}`;
  const expected = target && checksumFor(asset);
  if (!expected) return buildFromSource(data);

  const { version } = JSON.parse(readFileSync(join(root, '.claude-plugin/plugin.json'), 'utf8'));
  const cached = join(data, 'bin', `ultrahand-${version}-${target}`);
  if (existsSync(cached)) {
    requireChecksum(readFileSync(cached), expected, cached);
    return cached;
  }
  const base = process.env.ULTRAHAND_RELEASE_URL || RELEASES;
  const url = `${base}/v${version}/${asset}`;
  const bytes = await download(url);
  if (!bytes) return buildFromSource(data);
  requireChecksum(bytes, expected, url);
  install(bytes, cached);
  return cached;
}

function run(binary, args) {
  const child = spawn(binary, args, { stdio: 'inherit' });
  for (const signal of FORWARDED_SIGNALS) process.on(signal, () => child.kill(signal));
  child.on('error', finish);
  child.on('exit', (code, signal) => {
    if (signal === null) process.exit(code);
    process.removeAllListeners(signal);
    process.kill(process.pid, signal);
  });
}

function finish(error) {
  const stop = error instanceof Stop ? error : noBinary(error.message);
  console.error(`ultrahand: ${stop.message}`);
  process.exit(stop.code);
}

try {
  const { data, args } = parseArgs(process.argv.slice(2));
  run(await findBinary(data), args);
} catch (error) {
  finish(error);
}
