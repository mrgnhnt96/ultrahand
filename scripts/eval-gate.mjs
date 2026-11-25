#!/usr/bin/env node
// The pass bar for a smoke eval run: every case must pass at least two thirds of its
// runs (2 of 3), counting a run as passed only when all its scored graders pass.
// `claude plugin eval --threshold` can't say this: it compares each case's mean score,
// so a case with 1 passing run of 3 and two at 0.75 (mean 0.83) would get through 0.66.
//
//   node scripts/eval-gate.mjs evals/results/<run>/aggregate-result.json
//
// Exits 0 when every case clears the bar, 1 when one doesn't or the run was cut short,
// 2 when the file can't be read.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Runs a case needs to pass out of `runs`: two thirds, rounded up. */
export const required = (runs) => Math.ceil((runs * 2) / 3);

/** Checks an aggregate-result.json object; returns { ok, lines } to print. */
export function gate(result) {
  const lines = [];
  let ok = true;
  if (result.partial) {
    ok = false;
    lines.push('the eval run stopped early (partial results), so not every case ran');
  }
  const cases = result.cases ?? [];
  if (cases.length === 0) {
    ok = false;
    lines.push('no cases ran');
  }
  for (const c of cases) {
    const runs = c.arms?.with ?? [];
    const passes = runs.filter((r) => r.passed === true).length;
    const need = required(runs.length);
    const pass = runs.length > 0 && passes >= need;
    if (!pass) ok = false;
    const errors = [...new Set(runs.map((r) => r.error).filter(Boolean))];
    lines.push(
      `${pass ? 'pass' : 'FAIL'}  ${c.name}: ${passes} of ${runs.length} runs passed (needs ${need})` +
        (pass || errors.length === 0 ? '' : ` — ${errors.join('; ')}`),
    );
  }
  return { ok, lines };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  let result;
  try {
    result = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    console.error(`eval-gate: can't read ${file ?? '(no file given)'}: ${err.message}`);
    process.exit(2);
  }
  const { ok, lines } = gate(result);
  for (const line of lines) console.log(`eval-gate: ${line}`);
  process.exit(ok ? 0 : 1);
}
