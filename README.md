# ultrahand

A Claude Code plugin with research-backed UX design skills for each screen size, built as interactive, resizable Claude artifacts, plus a UX review skill.

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

Skills only trigger on UI design or UX review requests.

Each design skill builds its screen into the shared canvas in `shared/canvas/`
(see its README): mobile size presets, tablet split view, and free desktop resize
within min/max bounds, with light/dark, 200% text, state and tap-target toggles.
Design claims cite their sources in each skill's `references/sources.md`.

## License

MIT
