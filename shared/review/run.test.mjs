// node --test shared/review/run.test.mjs
import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { test } from 'node:test';
import {
  allowedTools, childEnv, claudeArgs, defaultOut, driveCommand, main, PREFIX_FILES, summarise,
  systemPrompt,
} from './run.mjs';

test('the system prompt is the same bytes every time and has no unfilled plugin root', () => {
  const a = systemPrompt();
  assert.equal(a, systemPrompt());
  assert.ok(!a.includes('${CLAUDE_PLUGIN_ROOT}'));
  assert.match(a, /<file path="skills\/review\/references\/method.md">/);
  assert.match(a, /<file path="skills\/review\/references\/checklist.md">/);
  assert.match(a, /<file path="shared\/input\/README.md">/);
});

test('the prefix files keep their order', () => {
  assert.deepEqual(PREFIX_FILES, [
    'skills/review/references/method.md',
    'skills/review/references/checklist.md',
    'shared/input/README.md',
  ]);
});

test('the reviewer gets the method, not the skill that launches it', () => {
  const prompt = systemPrompt();
  assert.ok(prompt.includes('## 4. Inspect in passes'));
  assert.ok(!prompt.includes('shared/review/launch.mjs'));
});

test('the reviewer starts lean, with only review tools', () => {
  const args = claudeArgs({ system: '/s.md', model: 'sonnet', effort: 'medium', addDirs: ['/p'] });
  const flag = (f) => args[args.indexOf(f) + 1];
  assert.equal(flag('--setting-sources'), '');
  assert.ok(args.includes('--strict-mcp-config'));
  assert.ok(args.includes('--disable-slash-commands'));
  assert.equal(flag('--system-prompt-file'), '/s.md');
  assert.equal(flag('--tools'), 'Read,Glob,Grep,Bash');
  assert.equal(flag('--permission-mode'), 'dontAsk');
  assert.equal(flag('--model'), 'sonnet');
  assert.equal(flag('--effort'), 'medium');
  assert.ok(args.includes('/p'));
});

test('the reviewer is locked to reading and the input driver', () => {
  const args = claudeArgs({ system: '/s.md', model: 'opus', root: '/plugin' });
  const flag = (f) => args[args.indexOf(f) + 1];
  assert.equal(flag('--allowedTools'), 'Read,Glob,Grep,Bash(node /plugin/shared/input/drive.mjs *)');
  const denied = args.indexOf('--disallowedTools');
  assert.deepEqual(args.slice(denied + 1, denied + 3), ['Bash(* --chrome *)', 'Bash(* --chrome=*)']);
  assert.equal(args[denied + 3], '--permission-mode');
  for (const tool of ['Write', 'Edit', 'NotebookEdit']) {
    assert.ok(!flag('--tools').includes(tool), tool);
    assert.ok(!flag('--allowedTools').includes(tool), tool);
  }
});

test('a plugin path with a space is quoted in the rule and the command alike', () => {
  assert.equal(driveCommand('/my plugin'), 'node "/my plugin/shared/input/drive.mjs"');
  assert.equal(allowedTools('/my plugin'), 'Read,Glob,Grep,Bash(node "/my plugin/shared/input/drive.mjs" *)');
});

test('the system prompt tells the reviewer what is locked', () => {
  const text = systemPrompt();
  assert.ok(text.includes(`\`${driveCommand()} <args>\``));
  assert.match(text, /Not checked/);
  assert.match(text, /--sections/);
});

test('the child keeps auth, proxy and locale variables and drops the session', () => {
  const env = childEnv({
    HOME: '/h', PATH: '/usr/bin', LC_ALL: 'C', ANTHROPIC_API_KEY: 'k', HTTPS_PROXY: 'p', CHROME_PATH: '/c',
    CLAUDECODE: '1', CLAUDE_CODE_SESSION_ID: 's', MIDNA_SESSION: 'm', UH_SECTIONS: 'x',
  }, '/node/bin');
  assert.deepEqual(Object.keys(env).sort(), [
    'ANTHROPIC_API_KEY', 'CHROME_PATH', 'CLAUDE_CODE_PROMPT_CACHE_TTL', 'HOME', 'HTTPS_PROXY', 'LC_ALL', 'PATH',
  ]);
  assert.equal(env.PATH, `/node/bin${delimiter}/usr/bin`);
  assert.equal(env.CLAUDE_CODE_PROMPT_CACHE_TTL, '5m');
});

test('the report path follows the brief', () => {
  assert.equal(defaultOut('r/2/brief-1.md'), 'r/2/review-1');
  assert.equal(defaultOut('r/2/notes.md'), 'r/2/notes.review');
});

test('usage is summed once per message', () => {
  const msg = (id, u) => JSON.stringify({ type: 'assistant', message: { id, usage: u, content: [] } });
  const s = summarise([
    msg('a', { input_tokens: 1, output_tokens: 10, cache_creation_input_tokens: 100, cache_read_input_tokens: 0 }),
    msg('a', { input_tokens: 1, output_tokens: 10, cache_creation_input_tokens: 100, cache_read_input_tokens: 0 }),
    msg('b', { input_tokens: 2, output_tokens: 20, cache_creation_input_tokens: 5, cache_read_input_tokens: 100 }),
    JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: '## Verdict\nok', num_turns: 2, duration_ms: 3000, total_cost_usd: 0.5 }),
  ]);
  assert.equal(s.ok, true);
  assert.equal(s.output, 30);
  assert.equal(s.cacheWrite, 105);
  assert.deepEqual(s.firstTurn, { cacheWrite: 100, cacheRead: 0 });
  assert.equal(s.costUsd, 0.5);
  assert.equal(s.report, '## Verdict\nok');
});

test("the result's usage overrides the stream's short counts", () => {
  const s = summarise([
    JSON.stringify({ type: 'assistant', message: { id: 'a', usage: { output_tokens: 3 }, content: [] } }),
    JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'r', usage: { input_tokens: 9, output_tokens: 2870, cache_creation_input_tokens: 10, cache_read_input_tokens: 20 } }),
  ]);
  assert.equal(s.output, 2870);
  assert.equal(s.cacheRead, 20);
});

test('a run writes the report and its cost record, with the 5-minute cache', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'uh-run-'));
  const fake = join(dir, 'claude');
  writeFileSync(fake, `#!/bin/sh
cat > "${dir}/stdin.txt"
echo "$CLAUDE_CODE_PROMPT_CACHE_TTL" > "${dir}/ttl.txt"
echo '{"type":"assistant","message":{"id":"m1","usage":{"input_tokens":3,"output_tokens":7,"cache_creation_input_tokens":40,"cache_read_input_tokens":0},"content":[{"type":"text","text":"## Verdict"}]}}'
echo '{"type":"result","subtype":"success","is_error":false,"result":"## Verdict: ship it.","num_turns":1,"duration_ms":1000,"total_cost_usd":0.12}'
`);
  chmodSync(fake, 0o755);
  writeFileSync(join(dir, 'brief-1.md'), 'Review a UI design.\n');
  process.env.ULTRAHAND_CLAUDE = fake;
  const code = await main(['--brief', join(dir, 'brief-1.md')]);
  delete process.env.ULTRAHAND_CLAUDE;
  assert.equal(code, 0);
  assert.equal(readFileSync(join(dir, 'stdin.txt'), 'utf8'), 'Review a UI design.\n');
  assert.equal(readFileSync(join(dir, 'ttl.txt'), 'utf8').trim(), '5m');
  assert.equal(readFileSync(join(dir, 'review-1.md'), 'utf8'), '## Verdict: ship it.\n');
  const rec = JSON.parse(readFileSync(join(dir, 'review-1.json'), 'utf8'));
  assert.equal(rec.costUsd, 0.12);
  assert.equal(rec.tokens.cacheWrite, 40);
  assert.equal(rec.ok, true);
});
