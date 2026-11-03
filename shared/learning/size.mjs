#!/usr/bin/env node
// Measure a project's design records and say whether they're due for compaction.
//
//   node size.mjs [design dir] [--json]      (default dir: design)
//
// Reads LESSONS.md and THEME.md in the dir (either may be missing) and prints their
// sizes against the limits in README.md ("Compact the records"). Exits 0 either way;
// the "compact:" line is the answer.

import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const LIMITS = {
  lessonsActive: 25,     // active lessons a skill reads on every run
  lessonsSuperseded: 5,  // superseded entries still in the file
  feedbackClosed: 5,     // plugin-feedback lines that are fixed or declined
  lessonsLines: 250,     // the whole file
  changelogEntries: 12,  // THEME.md changelog entries
};

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);

// The text under a "## <title>" heading, up to the next "## " heading.
function section(text, title) {
  const re = new RegExp(`^## ${title}\\s*$`, 'mi');
  const m = re.exec(text);
  if (!m) return '';
  const rest = text.slice(m.index + m[0].length);
  const next = rest.search(/^## /m);
  return next < 0 ? rest : rest.slice(0, next);
}

export function measureLessons(text) {
  const entries = text.split(/^(?=## L\d+\b)/m).filter((e) => /^## L\d+\b/.test(e));
  const superseded = entries.filter((e) => /\*\*Superseded by:\*\*/.test(e));
  const feedback = section(text, 'Plugin feedback').split('\n').filter((l) => /^\s*-\s/.test(l));
  const closed = feedback.filter((l) => /\b(fixed|declined|won't fix|closed)\b/i.test(l));
  return {
    lines: text.split('\n').length,
    lessons: entries.length,
    active: entries.length - superseded.length,
    superseded: superseded.length,
    feedback: feedback.length,
    feedbackClosed: closed.length,
  };
}

export function measureTheme(text) {
  const entries = section(text, 'Changelog').split('\n').filter((l) => /^\s*-\s+\d+\.\d+\.\d+/.test(l));
  return { lines: text.split('\n').length, changelog: entries.length };
}

export function due(lessons, theme, limits = LIMITS) {
  const reasons = [];
  if (lessons) {
    if (lessons.active > limits.lessonsActive) reasons.push(`${lessons.active} active lessons (limit ${limits.lessonsActive})`);
    if (lessons.superseded >= limits.lessonsSuperseded) reasons.push(`${lessons.superseded} superseded lessons (limit ${limits.lessonsSuperseded - 1})`);
    if (lessons.feedbackClosed >= limits.feedbackClosed) reasons.push(`${lessons.feedbackClosed} closed plugin-feedback lines (limit ${limits.feedbackClosed - 1})`);
    if (lessons.lines > limits.lessonsLines) reasons.push(`LESSONS.md is ${lessons.lines} lines (limit ${limits.lessonsLines})`);
  }
  if (theme && theme.changelog > limits.changelogEntries) {
    reasons.push(`${theme.changelog} THEME.md changelog entries (limit ${limits.changelogEntries})`);
  }
  return reasons;
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const dir = args.find((a) => !a.startsWith('--')) ?? 'design';
  const lt = read(join(dir, 'LESSONS.md'));
  const tt = read(join(dir, 'THEME.md'));
  const lessons = lt === null ? null : measureLessons(lt);
  const theme = tt === null ? null : measureTheme(tt);
  const reasons = due(lessons, theme);
  if (json) {
    console.log(JSON.stringify({ dir, lessons, theme, limits: LIMITS, compact: reasons.length > 0, reasons }, null, 2));
  } else {
    if (lessons) {
      console.log(`LESSONS.md: ${lessons.lines} lines, ${lessons.active} active and ${lessons.superseded} superseded lessons, ` +
        `${lessons.feedback} plugin-feedback lines (${lessons.feedbackClosed} closed)`);
    } else console.log('LESSONS.md: none');
    if (theme) console.log(`THEME.md: ${theme.lines} lines, ${theme.changelog} changelog entries`);
    else console.log('THEME.md: none');
    console.log(reasons.length ? `compact: yes (${reasons.join('; ')})` : 'compact: no');
  }
}
