# shared/theme

One theme per project, built once and grown over time. The `theme` skill writes it, the
design skills (`mobile`, `tablet`, `desktop`) design with it, and the `theme-review` skill
audits code and designs against it. Because everything reads the same file, a new screen
reuses what the last one established instead of starting a new look.

The rules a theme must follow, and the choices it's free to make, are in
[rules.md](rules.md). Sources are in [sources.md](sources.md).

## Files in a project

A theme lives in the project it belongs to, never in this plugin. By default:

| File | What it holds |
| --- | --- |
| `design/theme.tokens.json` | The tokens, in the W3C design tokens format [DTCG-FORMAT]. The machine-readable source of truth. |
| `design/THEME.md` | The record: version, personality, each decision and whether it's locked, the component inventory and the changelog. |

A design that lives only as a canvas artifact, with no repository behind it, keeps its
theme in the artifact: publish `design/theme.tokens.json` and `design/THEME.md` beside
`index.html`, and the next session reads them back from the artifact's files.

If the project already keeps tokens elsewhere (a `tokens/` folder, a Style Dictionary
setup), use that location and note it at the top of `THEME.md`. To find an existing theme,
look for `*.tokens.json`, `THEME.md`, `design-tokens`, `tokens/`, or a Style Dictionary
config before assuming there is none.

## Token file

A DTCG file with exactly three top-level groups, the three tiers [M3-TOKENS]: options
become decisions [EIGHTSHAPES-TOKENS].

| Tier | Holds | May reference |
| --- | --- | --- |
| `primitive` | Raw values: the palette, the spacing scale, the type scale, radii, durations. Named by value (`clay.40`, `space.4`). | Nothing; raw values only. |
| `semantic` | Roles: what a value is for (`color.on-surface`, `space.gap-group`, `type.body`). Named by purpose. | Primitives. |
| `component` | One component's decisions (`button.radius`, `card.bg`). Only when a component needs to differ from the role it would otherwise use. | Semantic tokens. |

Screens and code use **semantic and component tokens only**. Primitives are the palette
the theme picks from; a screen that reaches for `primitive.color.clay.40` has skipped the
decision of what that colour means.

Values use the DTCG types: `color` as `{ "colorSpace": "srgb", "components": [r, g, b],
"hex": "#rrggbb" }`, `dimension` as `{ "value": 16, "unit": "px" }` (or `rem`), plus
`fontFamily`, `fontWeight`, `duration`, `cubicBezier`, `shadow` and `typography`.
References are `"{semantic.color.primary}"`. Retire a token with `"$deprecated": "Use
{semantic.color.surface-raised}"`; don't delete it in the same version.

**Dark mode.** Each semantic colour gives its dark value in
`$extensions.ultrahand.dark`, as an alias to a primitive:

```json
"surface": {
  "$value": "{primitive.color.sand.98}",
  "$extensions": { "ultrahand": { "dark": "{primitive.color.sand.6}" } }
}
```

A token that aliases another semantic colour (a component's `button.primary-bg` pointing
at `{semantic.color.primary}`) follows it into dark mode without a dark value of its own.

The DTCG Resolver module is the standard way to express modes as separate token sets
[DTCG-RESOLVER]. ultrahand keeps the dark value beside the light one so a single file
stays readable and every role is visibly paired; when a project exports through a
resolver-based pipeline (Style Dictionary [STYLE-DICT]), split it into a light and a dark
set there.

**Extra contrast pairs.** Every `on-X` is checked against `X`. Declare any other text and
background pair the design uses in the root `$extensions.ultrahand.contrast`:
`[{ "fg": "{semantic.color.on-primary-container}", "bg": "{semantic.color.primary-container}", "min": 4.5 }]`.

**Required roles.** Every theme has these semantic tokens, so every design can rely on them:

- `color`: `surface`, `on-surface`, `on-surface-variant` (secondary text), `primary`,
  `on-primary`, `outline`, `error`, `on-error`, `focus-ring`
- `type`: `body`, plus the other roles the product uses (`headline`, `title`, `label`)
- `focus.width`

Add more roles as the product needs them (`surface-raised`, `primary-container`, `success`,
`warning`), following the `X` / `on-X` naming so contrast is checked automatically.

[example.tokens.json](example.tokens.json) is a complete small theme. Copy its structure,
not its choices: its warm clay palette and serif headings are one personality among many.

## THEME.md

```markdown
# <Product> theme

Version 1.2.0 · tokens: design/theme.tokens.json

## Personality
Three adjectives, and where the theme sits on each axis in rules.md
(e.g. "warm, editorial, calm: warm neutrals, serif display, soft corners, tonal elevation").

## Decisions
| Decision | Value | Status | Why |
| --- | --- | --- | --- |
| Brand hue | clay (terracotta) | locked | from the logo |
| Display type | Fraunces | locked | editorial voice |
| Corner style | soft: 4 controls, 8 containers | open | revisit after the card redesign |

## Components
| Component | Variants | Tokens | Defined in |
| --- | --- | --- | --- |
| Button | primary, secondary, text | button.*, radius.control | src/ui/Button.tsx |

## Changelog
- 1.2.0 (2026-11-02): added `semantic.color.warning` for sync conflicts (needed by the
  sync banner and the conflict dialog).
```

**Status** is `locked` (changes only when the owner asks, and that's a major version) or
`open` (the theme skill may refine it). Non-negotiables from rules.md aren't listed:
they're fixed for every theme.

The changelog keeps its 10 newest entries; older ones move to `design/THEME.changelog.md`
(see "Compact the records" in `shared/learning/README.md`).

**Version** follows semver: patch for a value tweak that keeps every role's meaning;
minor for new tokens, roles or components; major for a locked decision changed or a
token removed.

## Scripts

Node 18+, no dependencies.

| Script | What it does |
| --- | --- |
| `check.mjs <tokens.json> [--json]` | Checks the file against the non-negotiables: tiers, the 4/8 grid, dark values, contrast in both schemes, required roles, type, focus ring, names and deprecations. Exits 1 on an error. |
| `scan.mjs <dir> [--theme <tokens.json>] [--json]` | Lists the colours, spacing, radii and font sizes the code uses, with counts and locations, near-duplicate colours, and spacing off the grid. With `--theme`, sorts them into values that should use an existing token, values off the theme, and tokens nothing mentions. Reads CSS, HTML, JS/TS, Tailwind, Vue, Svelte, Flutter, SwiftUI and Compose by pattern, so treat its output as leads. |
| `css.mjs <tokens.json> [--style] [--selector sel] [--out file]` | Writes the semantic and component tokens as CSS custom properties (`--color-on-surface`, `--space-gap-group`, `--type-body-font-size`), colours as `light-dark()`. `--style` wraps it for the canvas: `build.mjs --head theme.html`. `--selector` scopes it (default `:root`). |

To design on the canvas with a theme:

```sh
node "${CLAUDE_PLUGIN_ROOT}/shared/theme/css.mjs" design/theme.tokens.json --style --out theme.html
node "${CLAUDE_PLUGIN_ROOT}/shared/canvas/build.mjs" --head theme.html ...
```

If the head also needs a font `<link>`, put both in one head file.
