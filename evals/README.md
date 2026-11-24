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
every release and stops when a case passes fewer than 2 of its 3 runs, where a run passes
only when every scored grader does. `scripts/eval-gate.mjs` counts the runs; the CLI's
`--threshold` can't, since it compares each case's mean score.

The suite runs on a copy of the files git sees (tracked and untracked, minus the ignored
ones), uncommitted edits included. `claude plugin eval` refuses a plugin folder holding a
hard-linked file, and cargo's `target/` folders are full of them, so the checkout itself
can't be the plugin under test once the CLI has been built.

## Cases

| Case | Tags | Checks |
| --- | --- | --- |
| `trigger-mobile`, `-tablet`, `-desktop`, `-review`, `-theme`, `-theme-review` | smoke | A plain request loads that skill and no other ultrahand skill. |
| `no-trigger-refactor`, `no-trigger-code-review` | smoke | Coding work and code review load no ultrahand skill. |
| `lessons-applied` | smoke | A design skill reads `design/LESSONS.md` and follows the lessons for it. |
| `lessons-recorded` | smoke | A lasting correction becomes a lesson in the documented format. |
| `plugin-feedback` | smoke | A correction to the skill itself becomes a plugin report, kept in LESSONS.md, with no public issue opened unasked. |
| `review-brief-clean` | smoke | A fix-check reviewer brief names the finding IDs, the last report and the fix diff by path, and carries none of the designer's notes, reasons or account of the fixes. |
| `review-before-present` | smoke | A first design round starts the independent review on its own, before it publishes or presents (the owner says to go straight to the design, so there's no blueprint), and the reply opens with one line on what the review caught. The sandbox can't start a reviewer, so the run logs the review and publish steps to `steps.log` and the graders check their order. |
| `notes-from-artifact` | smoke | When the user says they left notes on a published design, the session reads them from the artifact's `uh-notes` collection with `ArtifactData` (logged to `steps.log` in the sandbox) and never asks for a paste. |
| `blueprint-skipped` | smoke | A correction to a published design changes the design directly: no `blueprint.json`, no `parts.json`, no `--blueprint` or `parts.mjs` build, and no layout to approve first. |
| `explore-skip-spec` | smoke | A request that already sets the layout skips the explore stage (no `concepts.json`, no `--concepts` build) and presents one design or its blueprint. |
| `review-launches-cli` | smoke | A review request becomes a written plan and a launcher dry run, and the session never reads the checklist or the method itself. |
| `handoff-spec` | quality | Handing off an approved phone design anchors its screen with `data-uh`, writes `design/pantry/spec.json` with the sections in order and `small`/`large-landscape` shots, copies the implementer's brief beside it, and tells the developer to carry the anchors, build section by section and check in three tiers. |
| `handoff-build` | quality | Building a screen from a handed-off spec puts the spec's anchors and fixed copy in the code, and logs a spec check per section before one screenshot pair for the screen, not a screenshot per section. |
| `explore-concepts` | quality | An open-ended request starts with 2–3 concepts (up to 5 as greyboxes) whose positions differ in structure, not styling, each built from a brief that names only its own position, and shown in one `--concepts` canvas. |
| `blueprint-shown` | quality | A new flow is shown first as a blueprint: a `--blueprint` greybox and a `parts.mjs` sheet, with no full `--screen` build, and the reply asks the owner to comment or approve before the full design. |
| `parts-reuse-theme` | quality | With a themed project, `parts.json` reuses the inventory's Button and Text field and proposes a new part only for what no inventory component can do, saying why. |
| `section-options` | quality | "3 options for the filter bar" on a design in progress changes only the filter bar in each option, builds them with `--concepts` and a `section`, and asks the user to pick before any review. |
| `lessons-compacted` | quality | Over-limit LESSONS.md and THEME.md are compacted: superseded and closed items archived, overlapping lessons merged, a theme value promoted, the old changelog moved out, and no rule lost. |
| `theme-extract` | quality | Extraction from drifting CSS keeps the brand, snaps to the grid, passes `check.mjs` and records its decisions. |
| `audit-passes-out` | quality | A requested composition audit runs `audit.mjs` through `drive.mjs do` with `--out`, which its blurred screenshot needs, so the audit doesn't stop at `shot needs --out`. |
| `screens-per-page` | quality | A whole-app desktop redesign is split into pages of at most about a dozen screens, task variants become states rather than screens, and a page with more than 10 screens groups them with `data-group` or "Area · Screen" titles. |
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
