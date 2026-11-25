# ultrahand: repo conventions

Public Claude Code plugin (`ultrahand@mrgnhnt96`). Anything committed here is public.

## Layout
- `.claude-plugin/plugin.json`: plugin manifest.
- `skills/<name>/SKILL.md`: one skill each for `mobile`, `tablet`, `desktop`, `review`, `theme`, `theme-review`.
- `shared/`: assets shared by skills (e.g. the artifact canvas in `shared/canvas/`, the theme format, rules and scripts in `shared/theme/`, the lessons and plugin-feedback loop in `shared/learning/`).
- `cli/`: the `ultrahand` Rust binary. Skills start it through `shared/review/launch.mjs`, which finds the prebuilt binary for this plugin version or builds this source.
- `.github/workflows/test.yml`: runs the Node tests (`node --test 'shared/**/*.test.mjs' 'scripts/*.test.mjs'`) on Node 22. Only `release-binaries.yml` calls it: no CI runs on PRs or pushes, so run the tests that cover a change locally.
- `.github/workflows/release-binaries.yml`: started by hand (`workflow_dispatch`) from `scripts/release.sh`; runs `test.yml`, then tests and builds the binaries into a draft release.
- `evals/`: `claude plugin eval` cases; run with `scripts/eval.sh` (see `evals/README.md`).

## Rules
- No secrets, tokens, or personal/absolute paths (e.g. home directories) in any file.
- Skill `description` frontmatter must stay narrow: trigger only on UI design or UX review requests, never general coding.
- Design claims must be grounded in cited UX research; cite sources in the skill or its references.
- Designs are produced as interactive Claude artifacts that resize (mobile presets, tablet split view, desktop free resize with min/max).
- Keep skills concise; put long reference material in separate files the skill links to.
- Branches: `<type>/<short-slug>`. Conventional commits.
- Releases: cut with `tb release cut <version>`, which runs `scripts/release.sh` from main. It builds the binaries on that commit, commits the version bump in `.claude-plugin/plugin.json` with the checksums in `shared/review/checksums.txt`, tags `v<version>`, pushes, publishes the binaries, and updates the installed plugin on the machine that cut it. Don't bump the version or edit the checksums by hand: an installed plugin only updates when the version changes, and a binary that doesn't match its checksum never runs.
- Binaries ship as GitHub Release assets, downloaded on first use. Don't add a `bin/` folder or commit binaries: claude.ai and Cowork don't install a plugin that has one.
- UI changes to the plugin's own canvas (`shared/canvas`: toolbar, popovers, comment box, notes panel) get a UX review before the owner sees them, the same as a design round. Build the demo (`canvas.html`, or a `build.mjs` build), then run the review in an independent reviewer with `shared/review/launch.mjs review --brief` (see `shared/review/README.md`), scoped to the changed UI, at narrow and wide widths, in light and dark. Fix the findings that hold up. Only then show it to the owner or publish a demo, and say in one line what the review caught and fixed.
- Evals: when a skill change fixes a reported gap, add the eval case that would have caught it. Releases don't run the evals: run `scripts/eval.sh --tag smoke` by hand when a change to a skill's routing or the lessons loop needs checking.
