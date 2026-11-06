# ultrahand

A Claude Code plugin with research-backed UX design skills for each screen size, built as interactive, resizable Claude artifacts, plus a UX review skill and a pair of theme skills that keep every design on one consistent theme.

## Install

Add ultrahand to a Claude Code marketplace you control by listing it in that
marketplace's `.claude-plugin/marketplace.json`:

```json
{
  "name": "ultrahand",
  "source": { "source": "github", "repo": "mrgnhnt96/ultrahand" },
  "description": "Research-backed UX design skills for mobile, tablet and desktop, plus a UX review skill."
}
```

Then install it (replace `<marketplace>` with that marketplace's name):

```sh
claude plugin marketplace update <marketplace>
claude plugin install ultrahand@<marketplace> --scope user
```

Installs take whatever is on `main`.

## Skills

| Skill | Use it for |
| --- | --- |
| `ultrahand:mobile` | Designing phone UI screens and flows, with mobile size presets |
| `ultrahand:tablet` | Designing tablet UI, including split view |
| `ultrahand:desktop` | Designing desktop UI with free window resize and min/max bounds |
| `ultrahand:review` | Reviewing an existing UI against cited UX research |
| `ultrahand:theme` | Creating, extracting or extending a project's theme (design tokens) |
| `ultrahand:theme-review` | Auditing a theme, and the designs and code that use it, for consistency and component reuse |

Skills only trigger on UI design, theme or UX review requests (including corrections to a
design). They load on their own when a request matches; to pick one yourself, call it by
name: `/ultrahand:mobile design a checkout screen`.

Each design skill builds its screen into the shared canvas in `shared/canvas/`
(see its README): mobile size presets, tablet split view, and free desktop resize
within min/max bounds, with light/dark, 200% text, state and tap-target toggles.
Design claims cite their sources in each skill's `references/sources.md`.

Every design round, the first design and each change after it, is reviewed before you're
told it's ready, by a reviewer following the review method in its own headless `claude -p`
session. It starts lean, on the prompt cache, and records what each review cost. Later
rounds are reviewed by their diff, and the whole design is reviewed again when something
shared changes. The loop and its runner are in `shared/review/`.

The `review` skill doesn't review anything in your session. It splits the request into
screens and flows, writes a plan, and launches the `ultrahand` program, which starts a
separate lean `claude` process for each one. Only their merged findings come back, so a
review of a large app no longer fills the session that asked for it. The skill then judges
duplicates and ranking, checks the worst findings against the code, and writes the report.
The method the reviewers follow is in `skills/review/references/method.md`.

A project's theme lives in the project (`design/theme.tokens.json`, in the W3C design
tokens format, plus `design/THEME.md` for its decisions, component inventory and
changelog). The `theme` skill builds it once, by extracting what the code already uses or
by creating a new one, and then grows it; the design skills design with it, and
`theme-review` audits against it. Every theme keeps fixed non-negotiables (an 8-point
spacing grid, contrast in light and dark, a real type scale, role-named tokens) and makes
fresh choices on open creative axes (hue, neutrals, type voice, corners, depth, density),
so themes are consistent without all looking alike. The rules, format and scripts are in
`shared/theme/`.

Every skill works at three levels: each component, each section (a toolbar, a pane, a form
group) and the whole screen. The composition rules for sections and screens, and an audit
that measures them, are in `shared/composition/`. The review skill uses real mouse, wheel,
keyboard and touch input through the driver in `shared/input/`.

The skills learn as they're used. Each one reads the project's `design/LESSONS.md` before
it starts, and adds to it when you correct it ("we never use toggles for destructive
settings"), so a correction is made once. When the lessons or the theme's changelog grow past set limits, a skill
offers to compact them: anything removed goes to an archive file, so no rule is lost. A correction that shows a skill itself is
wrong becomes a report for this repo. See `shared/learning/`. The eval suite in `evals/`
(`scripts/eval.sh`) checks skill routing, the lessons loop and theme quality, and its
quick cases gate every release.

## License

MIT
