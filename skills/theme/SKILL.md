---
name: theme
description: Use only when the user asks to create, extract, define or extend a UI theme, design tokens or visual design system (colours, type, spacing, radius, elevation) for an app or site. Do not use for reviewing a theme, designing screens, or non-UI work.
---

# ultrahand: theme

Build a project's theme once and grow it from then on. The theme is a design token file
plus a short record of its decisions, kept in the project, so every later design and
review builds on the same foundation instead of starting a new look. The file format is in
[shared/theme/README.md](../../shared/theme/README.md); the rules are in
[shared/theme/rules.md](../../shared/theme/rules.md), and each rule cites
[shared/theme/sources.md](../../shared/theme/sources.md).

Every theme keeps the **non-negotiables** (NN-1 to NN-12: tiers, the 8-point grid, both
schemes, contrast, a real type scale and the rest) and makes a fresh choice on every
**creative axis** (CR-1 to CR-10: hue, neutrals, type voice, corners, depth, density…).
The rules are fixed so every theme feels well made; the axes are open so no two
products look the same. Read rules.md before you start.

The scripts below live in `${CLAUDE_PLUGIN_ROOT}/shared/theme/`.

**Lessons:** before step 1, read the project's `design/LESSONS.md` and apply the
lessons for this skill. They record what the owner has already corrected, so don't repeat
those mistakes. See [shared/learning/README.md](../../shared/learning/README.md).

## 1. Find what exists

Look before you ask. For a design that exists only as a canvas artifact, list the
artifact's files and read `design/` from there. In the project, search for `design/THEME.md`, `*.tokens.json`,
`tokens/`, a Style Dictionary config, and the platform's theme code: CSS custom
properties, `tailwind.config.*`, Flutter `ThemeData` / `ColorScheme`, SwiftUI colour
assets, Compose `MaterialTheme`. The result picks the mode:

| Found | Mode |
| --- | --- |
| A theme file and THEME.md | **Evolve** (step 4). Never regenerate it. |
| No theme file, but styled code | **Extract** (step 2), then evolve. |
| Nothing (a new product) | **Create** (step 3). |

## 2. Extract the theme the code already has

The goal is to capture the current look, cleaned up, not to redesign it.

1. Run `node scan.mjs <src dir>` (add `--json` for the full lists). It lists every colour,
   spacing value, radius and font size with counts and locations, groups near-duplicate
   colours and flags spacing off the grid. Read the platform theme code too: the values a
   theme object names are the intended ones, and the scattered raw values are the drift.
2. **Name the roles.** For each colour cluster, find what it's used for (page background,
   body text, buttons, borders, errors) and map it to a semantic role (README.md lists the
   required ones). One role, one value: when two near-duplicates serve one role, keep the
   more used one.
3. **Snap to the rules.** Fold spacing onto the NN-2 scale, sizes onto a type scale
   (NN-6), radii onto a short scale (NN-7). Fix contrast failures by moving along the
   same hue's tonal steps (NN-4). Each change is a visible change to the product, so list
   them as a table (`13px → 12px, 4 places`) for the owner to approve, and keep anything
   they want unchanged.
4. **Fill the gaps.** Most code has no dark mode, no focus ring and no `on-` roles.
   Design them in the theme's own palette (NN-3, NN-10) rather than adding generic ones.
5. **Inventory the components.** List the reusable components (look in `components/`,
   `ui/`, `widgets/`, `views/`), their variants and where each is defined. Note any job
   done by two different components: it's a merge candidate (EV-4), not something to copy
   into the theme.
6. **Record the personality it already has.** Place the existing look on each creative
   axis and write it into THEME.md. Brand-given choices (logo hue, licensed fonts) are
   `locked`; the rest are `open`.

Then write the files (step 5).

## 3. Create a new theme

1. **Personality.** Ask for three adjectives and who it's for, plus anything fixed: brand
   colours, logo, fonts, platform (native iOS or Android apps lean on the system font and
   colours; the theme maps onto them [HIG-COLOR] [M3-COMPOSE]).
2. **Three directions.** Propose three directions that differ on at least three creative
   axes, each with a one-line reason tied to the adjectives. Steer clear of the default
   look rules.md describes unless the owner wants it. Show them side by side (step 6), and
   let the owner pick one or mix them.
3. **Build it.**
   - **Palette:** for each key colour (primary, neutral, plus error and any accent), a
     tonal scale of about 10–13 steps from dark to light [M3-HCT] [M3-COMPOSE], so every
     role can find a step that meets contrast in both schemes.
   - **Semantic colours:** every required role, each with its dark value, each `on-X`
     designed against `X`.
   - **Space:** the NN-2 scale, then semantic spacing by job: `inset` steps for padding,
     and `gap-related`, `gap-group` and `gap-section` so the composition rule that gaps
     between groups are clearly larger than gaps within them (SEC-2 in
     [shared/composition/principles.md](../../shared/composition/principles.md)) is built
     in.
   - **Type:** one scale from the chosen ratio (CR-5), with roles display, headline,
     title, body, label; body at the platform's default (16 on the web, 17 pt on
     iOS; 13–14 only for a dense desktop tool, see NN-6).
   - **Shape, depth, motion, focus:** a radius scale in the chosen corner style; elevation
     levels in the chosen depth method; duration and easing tokens; a focus ring of 2 px
     or more.
   - **Components:** only the component tokens a component needs to differ from its role
     (EV-2). Most components need none.

Start every value at version `1.0.0`.

## 4. Evolve an existing theme

For a request like "add a warning colour", "we need a denser table", "make it feel
warmer", or a design skill or `theme-review` proposing additions:

- Read THEME.md and the tokens first (EV-1). Respect `locked` decisions; if the request
  needs one changed, say so and ask.
- Reuse an existing role if one fits (EV-2). Add a token only for a real gap, aliased to an
  existing primitive step (EV-3).
- A broad change ("warmer", "more playful") moves an `open` creative axis: shift the
  primitives, keep every semantic name, and re-run the contrast check. Names stay true
  through a rebrand (NN-11).
- Retire with `$deprecated` naming the replacement; remove in a later version (EV-6).
- Bump the version and add a changelog line saying what changed and which screens needed
  it (EV-5).

## 5. Write and check

1. Write `design/theme.tokens.json` (or the project's existing token location) and
   `design/THEME.md`, following README.md. [example.tokens.json](../../shared/theme/example.tokens.json)
   shows the structure.
2. Run `node check.mjs design/theme.tokens.json` and fix every error. A warning needs a
   fix or a reason in THEME.md.
3. **Hand it to the code.** For the web, `node css.mjs design/theme.tokens.json --out
   <path>/theme.css` gives CSS custom properties with dark mode built in. For other
   platforms, or several at once, recommend Style Dictionary, which reads this format and
   writes Swift, Android, Compose and Flutter [STYLE-DICT]. Offer to replace the raw
   values the scan found with tokens; don't do it without asking, since it touches every
   styled file.

## 6. Show the theme

Build a specimen on the plugin canvas (`shared/canvas/`; its README has the contract) so
the owner sees the theme working, not a list of hex codes:

```sh
node "${CLAUDE_PLUGIN_ROOT}/shared/theme/css.mjs" design/theme.tokens.json --style --out theme.html
node "${CLAUDE_PLUGIN_ROOT}/shared/canvas/build.mjs" \
  --presets "${CLAUDE_PLUGIN_ROOT}/skills/desktop/references/presets.md" \
  --head theme.html --screen screen.html --title "<Product> theme" --out index.html
```

The specimen's `screen.html` uses only the theme's custom properties and shows: colour
roles as `on-X` text on `X` with the measured ratio; the type scale with real copy; the
spacing scale; radius and elevation levels; each inventoried component in its states; and
one small realistic screen (a list and a form) built from it. The canvas Light / Dark and
200% text toggles test both schemes and text scaling. If the theme needs a web font, put
its `<link>` in the same head file.

**Comparing directions** (step 3): emit each direction without `--style`, scoped with
`--selector '[data-state="a"]'` (then `b`, `c`), and paste them into the top of the
screen template's own `<style>`: the canvas sets `data-state` inside the screen, where the
page head can't reach. Declare `states` `a`, `b`, `c` in `config.json` with the direction
names as labels, and the State picker switches between them.

Publish `index.html` as an artifact. When the design itself is an artifact, republish it
built with the theme (`--head theme.html`) and include the two `design/` files.

## 7. Present

Share the artifact link. In a few lines: the mode (created, extracted or evolved), the
version, where the personality sits on the creative axes and why, what's locked and what's
open, any snapping changes the owner needs to approve, the check result, and the next
step: design with it (the `mobile`, `tablet` and `desktop` skills read it), or audit the
code against it with `theme-review`.

## 8. Learn

When the owner corrects the result, states a lasting preference ("we never…") or
dismisses a finding as intended, add a lesson to `design/LESSONS.md`. When the correction
shows that this skill, its rules or its scripts are wrong for any project, also write a
plugin report, and always log it in LESSONS.md. Both are in
[shared/learning/README.md](../../shared/learning/README.md).
