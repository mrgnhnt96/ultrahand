// node --test shared/review/launch.test.mjs
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const VERSION = '9.9.9';
const TARGETS = [
  'aarch64-apple-darwin',
  'x86_64-apple-darwin',
  'aarch64-unknown-linux-musl',
  'x86_64-unknown-linux-musl',
];
const FAKE_BINARY = `#!/bin/sh
echo "fake binary: $*"
exit 7
`;
const FAKE_CARGO = `#!/bin/sh
echo "cargo $*" >> "$CARGO_LOG"
echo "cargo noise on stdout"
while [ $# -gt 0 ]; do
  [ "$1" = --target-dir ] && dir="$2"
  shift
done
mkdir -p "$dir/release"
printf '#!/bin/sh\\necho "built binary: $*"\\n' > "$dir/release/ultrahand"
chmod +x "$dir/release/ultrahand"
`;

const sha256 = (text) => createHash('sha256').update(text).digest('hex');

function plugin({ checksum = sha256(FAKE_BINARY), nested = false } = {}) {
  const made = mkdtempSync(join(realpathSync(tmpdir()), 'launch plugin '));
  const root = nested ? join(made, 'plugins', 'ultrahand') : made;
  mkdirSync(join(root, '.claude-plugin'), { recursive: true });
  mkdirSync(join(root, 'shared/review'), { recursive: true });
  writeFileSync(join(root, '.claude-plugin/plugin.json'), JSON.stringify({ version: VERSION }));
  copyFileSync(join(HERE, 'launch.mjs'), join(root, 'shared/review/launch.mjs'));
  if (checksum) {
    const lines = TARGETS.map((target) => `${checksum}  ultrahand-${target}\n`);
    writeFileSync(join(root, 'shared/review/checksums.txt'), lines.join(''));
  }
  const bin = join(root, 'tools');
  mkdirSync(bin);
  writeFileSync(join(bin, 'cargo'), FAKE_CARGO);
  chmodSync(join(bin, 'cargo'), 0o755);
  mkdirSync(join(root, 'cli/src'), { recursive: true });
  mkdirSync(join(root, 'cli/tests'));
  writeFileSync(join(root, 'cli/src/main.rs'), 'fn main() {}\n');
  writeFileSync(join(root, 'cli/tests/cli.rs'), '');
  return {
    root,
    repo: made,
    data: join(root, 'plugin data', 'not made yet'),
    cargoLog: join(root, 'cargo.log'),
    pathWithCargo: `${bin}:/usr/bin:/bin`,
    pathWithoutCargo: join(root, 'no such folder'),
  };
}

async function assetServer(t, respond) {
  const requests = [];
  const server = createServer((request, response) => {
    requests.push(request.url);
    respond(response);
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  t.after(() => server.close());
  return { url: `http://127.0.0.1:${server.address().port}`, requests };
}

const serving = (body) => (response) => response.end(body);
const missing = (response) => {
  response.statusCode = 404;
  response.end();
};

function start(p, { path = p.pathWithCargo, url, args = ['--data', p.data, 'review', '--brief', 'a b.md'] } = {}) {
  const env = { PATH: path, CARGO_LOG: p.cargoLog, ULTRAHAND_RELEASE_URL: url };
  return spawn(process.execPath, [join(p.root, 'shared/review/launch.mjs'), ...args], { env });
}

function launch(p, options) {
  const child = start(p, options);
  const out = { stdout: '', stderr: '' };
  child.stdout.on('data', (text) => (out.stdout += text));
  child.stderr.on('data', (text) => (out.stderr += text));
  return new Promise((done) => child.on('close', (code, signal) => done({ ...out, code, signal })));
}

// A git repository at `dir` holding everything in it, committed and tagged v<VERSION> unless
// `tag` is false. Its config is its own, so the user's hooks and signing don't apply.
function gitInit(dir, { tag = true } = {}) {
  const env = { PATH: '/usr/bin:/bin', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
  const git = (...args) => {
    const result = spawnSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { env });
    assert.equal(result.status, 0, `git ${args.join(' ')}: ${result.stderr}`);
  };
  git('init', '--quiet');
  git('add', '-A');
  git('commit', '--quiet', '--no-gpg-sign', '-m', 'release');
  if (tag) git('tag', `v${VERSION}`);
  return git;
}

const installed = (p) => join(p.data, 'bin', readdirSync(join(p.data, 'bin'))[0]);

test('downloads the asset, checks it, runs it, and passes stdout and the exit code through', async (t) => {
  const p = plugin();
  const server = await assetServer(t, serving(FAKE_BINARY));
  const result = await launch(p, { url: server.url });
  assert.equal(result.code, 7);
  assert.equal(result.stdout, `fake binary: review --plugin-root ${p.root} --brief a b.md\n`);
  assert.match(server.requests[0], new RegExp(`^/v${VERSION}/ultrahand-[a-z0-9_-]+$`));
  assert.match(installed(p), new RegExp(`/bin/ultrahand-${VERSION}-[a-z0-9_-]+$`));
  assert.ok(!existsSync(p.cargoLog));
});

test('a verified install removes the other versions\' binaries and leaves the rest', async (t) => {
  const p = plugin();
  const bin = join(p.data, 'bin');
  mkdirSync(bin, { recursive: true });
  const old = ['ultrahand-0.9.0-aarch64-apple-darwin', 'ultrahand-0.10.0-x86_64-unknown-linux-musl'];
  const kept = ['ultrahand-0.10.0-aarch64-apple-darwin.123.partial', 'notes.txt'];
  for (const name of [...old, ...kept]) writeFileSync(join(bin, name), 'old');
  const server = await assetServer(t, serving(FAKE_BINARY));
  const result = await launch(p, { url: server.url });
  assert.equal(result.code, 7);
  const left = readdirSync(bin).sort();
  assert.equal(left.filter((name) => !kept.includes(name)).length, 1, left.join(', '));
  assert.match(left.find((name) => !kept.includes(name)), new RegExp(`^ultrahand-${VERSION}-`));
  for (const name of kept) assert.ok(left.includes(name), name);
});

test('a binary whose checksum fails removes nothing', async (t) => {
  const p = plugin();
  const bin = join(p.data, 'bin');
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, 'ultrahand-0.9.0-aarch64-apple-darwin'), 'old');
  const server = await assetServer(t, serving(`${FAKE_BINARY}# tampered\n`));
  const result = await launch(p, { url: server.url });
  assert.equal(result.code, 4);
  assert.deepEqual(readdirSync(bin), ['ultrahand-0.9.0-aarch64-apple-darwin']);
});

test('a binary already in the data folder runs with no download', async (t) => {
  const p = plugin();
  const server = await assetServer(t, serving(FAKE_BINARY));
  await launch(p, { url: server.url });
  const result = await launch(p, { url: server.url });
  assert.equal(result.code, 7);
  assert.equal(server.requests.length, 1);
});

test('an asset with the wrong checksum is never written, run, retried or replaced by a build', async (t) => {
  const p = plugin();
  const server = await assetServer(t, serving(`${FAKE_BINARY}# tampered\n`));
  const result = await launch(p, { url: server.url });
  assert.equal(result.code, 4);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /doesn't match the checksum/);
  assert.match(result.stderr, /no retry and no fallback/);
  assert.equal(server.requests.length, 1);
  assert.ok(!existsSync(join(p.data, 'bin')));
  assert.ok(!existsSync(p.cargoLog));
});

test('a binary changed in the data folder does not run', async (t) => {
  const p = plugin();
  const server = await assetServer(t, serving(FAKE_BINARY));
  await launch(p, { url: server.url });
  writeFileSync(installed(p), `${FAKE_BINARY}echo tampered\n`);
  const result = await launch(p, { url: server.url });
  assert.equal(result.code, 4);
  assert.equal(result.stdout, '');
  assert.ok(!existsSync(p.cargoLog));
});

test('a missing asset falls back to cargo, and cargo output stays off stdout', async (t) => {
  const p = plugin();
  const server = await assetServer(t, missing);
  const result = await launch(p, { url: server.url });
  assert.equal(result.code, 0);
  assert.equal(result.stdout, `built binary: review --plugin-root ${p.root} --brief a b.md\n`);
  assert.match(result.stderr, /HTTP 404/);
  const cargo = readFileSync(p.cargoLog, 'utf8');
  assert.match(cargo, /build --release --locked/);
  assert.ok(cargo.includes(join(p.root, 'cli/Cargo.toml')));
});

test('an unreachable release falls back to cargo', async () => {
  const p = plugin();
  const result = await launch(p, { url: 'http://127.0.0.1:1' });
  assert.equal(result.code, 0);
  assert.match(result.stdout, /^built binary: /);
});

test('with no asset and no cargo it exits 3 and names the fallback', async (t) => {
  const p = plugin();
  const server = await assetServer(t, missing);
  const result = await launch(p, { url: server.url, path: p.pathWithoutCargo });
  assert.equal(result.code, 3);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /general-purpose Agent/);
  assert.match(result.stderr, /never in the calling session/);
});

test('with no checksum for this version it downloads nothing and builds', async (t) => {
  const p = plugin({ checksum: null });
  const server = await assetServer(t, serving(FAKE_BINARY));
  const result = await launch(p, { url: server.url });
  assert.equal(result.code, 0);
  assert.equal(server.requests.length, 0);
  assert.match(result.stdout, /^built binary: /);
});

test('a missing or empty data folder exits 3', async () => {
  const p = plugin();
  for (const args of [['review'], ['--data', '', 'review']]) {
    const result = await launch(p, { args });
    assert.equal(result.code, 3);
    assert.match(result.stderr, /--data/);
  }
});

test('a binary that will not start exits 3', async (t) => {
  const p = plugin({ checksum: sha256('not a program') });
  const server = await assetServer(t, serving('not a program'));
  const result = await launch(p, { url: server.url });
  assert.equal(result.code, 3);
  assert.match(result.stderr, /general-purpose Agent/);
});

test('a stop signal reaches the binary', async (t) => {
  const trapping = `#!/bin/sh
trap 'echo stopped; exit 5' TERM
echo ready
while :; do sleep 0.05; done
`;
  const p = plugin({ checksum: sha256(trapping) });
  const server = await assetServer(t, serving(trapping));
  const child = start(p, { url: server.url });
  let stdout = '';
  child.stdout.on('data', (text) => {
    stdout += text;
    if (text.includes('ready')) child.kill('SIGTERM');
  });
  const code = await new Promise((done) => child.on('close', done));
  assert.equal(code, 5);
  assert.match(stdout, /stopped/);
});

test('a checkout whose cli/ matches the release tag uses the release binary', async (t) => {
  const p = plugin();
  gitInit(p.root);
  writeFileSync(join(p.root, 'cli/tests/cli.rs'), '// a test the binary does not carry\n');
  const server = await assetServer(t, serving(FAKE_BINARY));
  const result = await launch(p, { url: server.url });
  assert.equal(result.code, 7);
  assert.equal(server.requests.length, 1);
  assert.ok(!existsSync(p.cargoLog));
});

test('a checkout whose cli/ changed since the release builds it, committed or not', async (t) => {
  for (const commit of [true, false]) {
    const p = plugin();
    const git = gitInit(p.root);
    writeFileSync(join(p.root, 'cli/src/main.rs'), 'fn main() { println!("new"); }\n');
    if (commit) git('commit', '--quiet', '--no-gpg-sign', '-am', 'change the cli');
    const server = await assetServer(t, serving(FAKE_BINARY));
    const result = await launch(p, { url: server.url });
    assert.equal(result.code, 0, `commit: ${commit}`);
    assert.match(result.stdout, /^built binary: /);
    assert.match(result.stderr, new RegExp(`cli/ has changed since v${VERSION}`));
    assert.equal(server.requests.length, 0);
  }
});

test('a checkout without the release tag builds cli/', async (t) => {
  const p = plugin();
  gitInit(p.root, { tag: false });
  const server = await assetServer(t, serving(FAKE_BINARY));
  const result = await launch(p, { url: server.url });
  assert.equal(result.code, 0);
  assert.match(result.stdout, /^built binary: /);
  assert.match(result.stderr, new RegExp(`no v${VERSION} tag`));
  assert.equal(server.requests.length, 0);
});

test('a plugin folder inside another repository is not a checkout of it', async (t) => {
  const p = plugin({ nested: true });
  gitInit(p.repo, { tag: false });
  const server = await assetServer(t, serving(FAKE_BINARY));
  const result = await launch(p, { url: server.url });
  assert.equal(result.code, 7);
  assert.equal(server.requests.length, 1);
  assert.ok(!existsSync(p.cargoLog));
});

test('a changed checkout with no cargo exits 3 rather than run the older release', async (t) => {
  const p = plugin();
  gitInit(p.root);
  writeFileSync(join(p.root, 'cli/src/main.rs'), 'fn main() { println!("new"); }\n');
  const server = await assetServer(t, serving(FAKE_BINARY));
  const result = await launch(p, { url: server.url, path: `/usr/bin:/bin` });
  assert.equal(result.code, 3);
  assert.equal(result.stdout, '');
  assert.equal(server.requests.length, 0);
});
