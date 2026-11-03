#!/usr/bin/env node
// Run one design review as its own headless `claude -p` session.
//
//   node run.mjs --brief rounds/2/brief-1.md [--out rounds/2/review-1] [--cwd <build dir>]
//                [--add-dir <dir>]... [--model opus] [--effort <level>] [--timeout 20]
//
// The reviewer starts lean: none of the user's settings, CLAUDE.md, hooks, plugins, skills
// or MCP servers, and only the tools a review needs. Its system prompt is the review skill,
// its checklist and the drive.mjs reference, the same bytes on every run, so a review that
// starts within five minutes of the last one reads that prefix from the prompt cache. The
// brief goes last, as the message.
//
// Writes <out>.md (the report) and <out>.json (model, turns, seconds, cost, and cache
// tokens), and prints a one-line summary. --out defaults to the brief's path with
// "brief" swapped for "review". Exits 1 when the review didn't finish.
//
// $ULTRAHAND_CLAUDE names the claude program (the tests use a fake).

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// What a reviewer may use: read the design and the plugin, and run drive.mjs and small
// scripts (fixtures, contrast maths) through Bash. The brief tells it not to edit files.
export const TOOLS = ['Read', 'Glob', 'Grep', 'Bash'];

// The files every review reads, in this order. They make up the cached prefix, so keep
// the list stable: adding or reordering one changes every review's prefix once.
export const PREFIX_FILES = [
  'skills/review/SKILL.md',
  'skills/review/references/checklist.md',
  'shared/input/README.md',
];

// The system prompt: a fixed preamble, then each prefix file with the plugin root filled
// in. Nothing here may depend on the round, the time or the brief.
export function systemPrompt(root = ROOT) {
  const parts = [
    '# ultrahand reviewer',
    '',
    'You are a UX reviewer running on your own, with no conversation before this one. The',
    'ultrahand review skill, its checklist and the drive.mjs reference are below: follow',
    'the skill. Where it links another file, the link is relative to the file it appears',
    `in, under the plugin root ${root}; read it there when you need it. The user's message`,
    'is the brief for this review. Answer with the report only.',
  ];
  for (const rel of PREFIX_FILES) {
    const text = readFileSync(join(root, rel), 'utf8').replaceAll('${CLAUDE_PLUGIN_ROOT}', root);
    parts.push('', `<file path="${rel}">`, text.trimEnd(), '</file>');
  }
  return parts.join('\n') + '\n';
}

// The system prompt is written once per content, to a path named after its hash, so runs
// with the same plugin send the same file.
export function writeSystemPrompt(text, dir = tmpdir()) {
  const hash = createHash('sha256').update(text).digest('hex').slice(0, 12);
  const path = join(dir, `ultrahand-review-${hash}.md`);
  if (!existsSync(path)) writeFileSync(path, text);
  return path;
}

export function claudeArgs({ system, model, effort, addDirs = [], root = ROOT }) {
  const args = [
    '-p',
    '--model', model,
    '--system-prompt-file', system,
    '--setting-sources', '',
    '--strict-mcp-config',
    '--disable-slash-commands',
    '--no-session-persistence',
    '--output-format', 'stream-json',
    '--verbose',
    '--tools', TOOLS.join(','),
    '--allowedTools', TOOLS.join(','),
    '--permission-mode', 'dontAsk',
    '--add-dir', root,
  ];
  if (effort) args.push('--effort', effort);
  for (const d of addDirs) args.push('--add-dir', d);
  return args;
}

// Reads a stream-json transcript and sums what it cost.
export function summarise(lines) {
  const seen = new Set();
  const out = {
    ok: false, report: '', turns: 0, seconds: 0, costUsd: 0,
    input: 0, output: 0, cacheWrite: 0, cacheRead: 0,
    firstTurn: null, error: null,
  };
  let lastText = '';
  for (const line of lines) {
    let ev;
    try { ev = JSON.parse(line); } catch { continue; }
    if (ev.type === 'assistant' && ev.message) {
      const m = ev.message;
      const u = m.usage;
      if (u && !seen.has(m.id)) {
        seen.add(m.id);
        out.input += u.input_tokens ?? 0;
        out.output += u.output_tokens ?? 0;
        out.cacheWrite += u.cache_creation_input_tokens ?? 0;
        out.cacheRead += u.cache_read_input_tokens ?? 0;
        out.firstTurn ??= {
          cacheWrite: u.cache_creation_input_tokens ?? 0,
          cacheRead: u.cache_read_input_tokens ?? 0,
        };
      }
      const text = (m.content ?? []).filter((c) => c.type === 'text').map((c) => c.text).join('');
      if (text.trim()) lastText = text;
    }
    if (ev.type === 'result') {
      out.ok = ev.subtype === 'success' && !ev.is_error;
      out.report = typeof ev.result === 'string' && ev.result.trim() ? ev.result : lastText;
      out.turns = ev.num_turns ?? 0;
      out.seconds = Math.round((ev.duration_ms ?? 0) / 1000);
      out.costUsd = ev.total_cost_usd ?? 0;
      // The per-message usage in the stream is written before a message finishes, so its
      // output count runs short. The result's usage is the session's real total.
      const u = ev.usage;
      if (u) {
        out.input = u.input_tokens ?? out.input;
        out.output = u.output_tokens ?? out.output;
        out.cacheWrite = u.cache_creation_input_tokens ?? out.cacheWrite;
        out.cacheRead = u.cache_read_input_tokens ?? out.cacheRead;
      }
      if (!out.ok) out.error = ev.subtype ?? 'error';
    }
  }
  if (!out.report) out.report = lastText;
  return out;
}

function parse(argv) {
  const o = { model: 'opus', effort: '', timeout: 20, addDirs: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`${a} needs a value`);
      return argv[++i];
    };
    if (a === '--brief') o.brief = next();
    else if (a === '--out') o.out = next();
    else if (a === '--cwd') o.cwd = next();
    else if (a === '--add-dir') o.addDirs.push(resolve(next()));
    else if (a === '--model') o.model = next();
    else if (a === '--effort') o.effort = next();
    else if (a === '--timeout') o.timeout = Number(next());
    else if (a === '-h' || a === '--help') o.help = true;
    else throw new Error(`unknown option ${a}`);
  }
  return o;
}

export function defaultOut(brief) {
  const name = basename(brief, '.md');
  return join(dirname(brief), name.startsWith('brief') ? name.replace(/^brief/, 'review') : `${name}.review`);
}

export async function main(argv = process.argv.slice(2)) {
  const o = parse(argv);
  if (o.help || !o.brief) {
    process.stdout.write(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n\n')[0]
      .split('\n').slice(1).map((l) => l.replace(/^\/\/ ?/, '')).join('\n') + '\n');
    return o.help ? 0 : 2;
  }
  const brief = readFileSync(o.brief, 'utf8');
  const out = resolve(o.out ?? defaultOut(o.brief));
  const cwd = resolve(o.cwd ?? dirname(o.brief));
  const system = writeSystemPrompt(systemPrompt());
  const args = claudeArgs({ system, model: o.model, effort: o.effort, addDirs: o.addDirs });
  const claude = process.env.ULTRAHAND_CLAUDE || 'claude';

  const started = Date.now();
  const lines = [];
  const code = await new Promise((done) => {
    const child = spawn(claude, args, {
      cwd,
      env: { ...process.env, CLAUDE_CODE_PROMPT_CACHE_TTL: '5m' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let buf = '';
    let err = '';
    const timer = setTimeout(() => child.kill('SIGTERM'), o.timeout * 60_000);
    child.stdout.on('data', (d) => {
      buf += d;
      const parts = buf.split('\n');
      buf = parts.pop();
      lines.push(...parts);
    });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => { clearTimeout(timer); lines.stderr = String(e); done(127); });
    child.on('close', (c) => {
      clearTimeout(timer);
      if (buf) lines.push(buf);
      lines.stderr = err;
      done(c ?? 1);
    });
    child.stdin.end(brief);
  });

  const s = summarise(lines);
  if (!s.seconds) s.seconds = Math.round((Date.now() - started) / 1000);
  if (code !== 0 && s.ok) { s.ok = false; s.error = `claude exited ${code}`; }
  if (!s.ok && !s.error) s.error = (lines.stderr || `claude exited ${code}`).trim().slice(0, 500);

  mkdirSync(dirname(out), { recursive: true });
  if (s.report) writeFileSync(`${out}.md`, s.report.trimEnd() + '\n');
  const record = {
    brief: resolve(o.brief), model: o.model, effort: o.effort || null, ok: s.ok, error: s.error,
    turns: s.turns, seconds: s.seconds, costUsd: s.costUsd,
    tokens: { input: s.input, output: s.output, cacheWrite: s.cacheWrite, cacheRead: s.cacheRead },
    firstTurn: s.firstTurn, systemPrompt: basename(system),
  };
  writeFileSync(`${out}.json`, JSON.stringify(record, null, 2) + '\n');

  const first = s.firstTurn ? `, first turn ${s.firstTurn.cacheRead} cached / ${s.firstTurn.cacheWrite} written` : '';
  const line = s.ok
    ? `review: ${out}.md · ${o.model} · ${s.turns} turns · ${s.seconds}s · $${s.costUsd.toFixed(2)}${first}`
    : `review failed: ${s.error} (${out}.json)`;
  (s.ok ? process.stdout : process.stderr).write(line + '\n');
  return s.ok ? 0 : 1;
}

if (process.argv[1] && pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url) {
  main().then((c) => process.exit(c), (e) => { process.stderr.write(`run.mjs: ${e.message}\n`); process.exit(2); });
}
