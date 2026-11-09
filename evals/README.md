# ultrahand evals

Cases for `claude plugin eval`, which runs each prompt in a sandbox with the plugin
loaded and scores the run with graders. They catch a skill change that makes things
worse before it ships. The format is documented at
https://code.claude.com/docs/en/plugin-evals.

```sh
scripts/eval.sh --tag smoke                 # the release gate: routing and lessons
scripts/eval.sh --tag quality               # the slower theme cases
scripts/eval.sh                             # everything, with and without the plugin
scripts/eval.sh --case theme-extract --runs 1 --ablation none   # one quick try
```

`scripts/eval.sh` adds the flags the suite needs (`--scaffold`, `--allow-tools Write
Edit Bash`, `--trust-plugin`, `--no-publish`). Results and an HTML report go to
`evals/results/`, which git ignores. `scripts/release.sh` runs the smoke cases before
every release and stops when a case passes fewer than 2 of its 3 runs.

## Cases

| Case | Tags | Checks |
| --- | --- | --- |
| `trigger-mobile`, `-tablet`, `-desktop`, `-review`, `-theme`, `-theme-review` | smoke | A plain request loads that skill and no other ultrahand skill. |
| `no-trigger-refactor`, `no-trigger-code-review` | smoke | Coding work and code review load no ultrahand skill. |
| `lessons-applied` | smoke | A design skill reads `design/LESSONS.md` and follows the lessons for it. |
| `lessons-recorded` | smoke | A lasting correction becomes a lesson in the documented format. |
| `plugin-feedback` | smoke | A correction to the skill itself becomes a plugin report, kept in LESSONS.md, with no public issue opened unasked. |
| `review-brief-clean` | smoke | A fix-check reviewer brief names the finding IDs, the last report and the fix diff by path, and carries none of the designer's notes, reasons or account of the fixes. |
| `review-before-present` | smoke | A first design round starts the independent review on its own, before it publishes or presents, and the reply opens with one line on what the review caught. The sandbox can't start a reviewer, so the run logs the review and publish steps to `steps.log` and the graders check their order. |
| `review-launches-cli` | smoke | A review request becomes a written plan and a launcher dry run, and the session never reads the checklist or the method itself. |
| `lessons-compacted` | quality | Over-limit LESSONS.md and THEME.md are compacted: superseded and closed items archived, overlapping lessons merged, a theme value promoted, the old changelog moved out, and no rule lost. |
| `theme-extract` | quality | Extraction from drifting CSS keeps the brand, snaps to the grid, passes `check.mjs` and records its decisions. |
| `sheet-fits-screen` | quality | A bottom sheet that keeps its height between views caps that height at the screen, so it still fits, and its list still scrolls, after the frame gets shorter. |
| `theme-review-drift` | quality | A theme review finds a raw colour, off-grid spacing and a rebuilt button, and fixes them with the existing theme. |

## Adding a case

Add one whenever a correction or plugin report (see
[shared/learning/README.md](../shared/learning/README.md)) leads to a skill change: the
case that would have caught it keeps it fixed. Each case is a folder with a `case.yaml`
or `prompt.md` and a `graders/` folder:

- Phrase the prompt the way a user would, without naming the skill.
- Use cheap, exact graders first: `tool_used` for which skill loaded (set `arm: both` so it
  counts in the score), `file_exists`, and `regex` on a file or the trace (`check.mjs …
  0 error(s)` proves the theme check ran clean). Add an `llm` rubric only for what a
  pattern can't judge, and write it as PASS/FAIL conditions.
- Files the case needs go in a `scaffold.sh`. It runs in the empty workspace, and `$0`
  is its own path, so `"$(dirname "$0")/../.."` is the plugin root.
- Tag it `smoke` only if it's quick (a few turns) and should block a release; otherwise
  tag it `quality`.
