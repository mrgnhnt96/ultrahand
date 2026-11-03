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

Skills only trigger on UI design, theme or UX review requests.

Each design skill builds its screen into the shared canvas in `shared/canvas/`
(see its README): mobile size presets, tablet split view, and free desktop resize
within min/max bounds, with light/dark, 200% text, state and tap-target toggles.
Design claims cite their sources in each skill's `references/sources.md`.

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

## License

MIT
