// node --test scripts/eval-gate.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gate, required } from './eval-gate.mjs';

const run = (passed, score = passed ? 1 : 0.75, error = null) => ({ passed, score, error });
const result = (...cases) => ({
  partial: false,
  cases: cases.map(([name, runs]) => ({ name, arms: { with: runs } })),
});

test('two thirds of the runs, rounded up', () => {
  assert.equal(required(3), 2);
  assert.equal(required(1), 1);
  assert.equal(required(5), 4);
});

test('2 of 3 passing runs clears the gate', () => {
  const { ok } = gate(result(['a', [run(true), run(true), run(false)]]));
  assert.equal(ok, true);
});

test('1 of 3 fails even when the mean score is high', () => {
  // Mean 0.83: `--threshold 0.66` would have let this through.
  const { ok, lines } = gate(result(['a', [run(true), run(false), run(false)]], ['b', [run(true), run(true), run(true)]]));
  assert.equal(ok, false);
  assert.match(lines[0], /^FAIL {2}a: 1 of 3 runs passed \(needs 2\)/);
  assert.match(lines[1], /^pass {2}b: 3 of 3/);
});

test('a case that errored names the error', () => {
  const err = 'a file in the plugin has more than one name (a hard link)';
  const { ok, lines } = gate(result(['a', [run(false, 0, err), run(false, 0, err), run(false, 0, err)]]));
  assert.equal(ok, false);
  assert.ok(lines[0].endsWith(`— ${err}`));
});

test('partial results, no cases or a case with no runs fail', () => {
  assert.equal(gate({ ...result(['a', [run(true)]]), partial: true }).ok, false);
  assert.equal(gate(result()).ok, false);
  assert.equal(gate(result(['a', []])).ok, false);
});
