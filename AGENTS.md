# ultrahand: repo conventions

Public Claude Code plugin (`ultrahand@mrgnhnt96`). Anything committed here is public.

## Layout
- `.claude-plugin/plugin.json`: plugin manifest.
- `skills/<name>/SKILL.md`: one skill each for `mobile`, `tablet`, `desktop`, `review`, `theme`, `theme-review`.
- `shared/`: assets shared by skills (e.g. the artifact canvas in `shared/canvas/`, the theme format, rules and scripts in `shared/theme/`, the lessons and plugin-feedback loop in `shared/learning/`).
- `evals/`: `claude plugin eval` cases; run with `scripts/eval.sh` (see `evals/README.md`).

## Rules
- No secrets, tokens, or personal/absolute paths (e.g. home directories) in any file.
- Skill `description` frontmatter must stay narrow: trigger only on UI design or UX review requests, never general coding.
- Design claims must be grounded in cited UX research; cite sources in the skill or its references.
- Designs are produced as interactive Claude artifacts that resize (mobile presets, tablet split view, desktop free resize with min/max).
- Keep skills concise; put long reference material in separate files the skill links to.
- Branches: `<type>/<short-slug>`. Conventional commits.
- Releases: cut with `tb release cut <version>`, which runs `scripts/release.sh` from main. It bumps `.claude-plugin/plugin.json`, tags `v<version>`, pushes, and updates the installed plugin on the machine that cut it. Don't bump the version by hand: an installed plugin only updates when the version changes.
- Evals: when a skill change fixes a reported gap, add the eval case that would have caught it. `scripts/release.sh` runs the smoke cases before every release; `SKIP_EVALS=1` skips them.
