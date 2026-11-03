# Theme review checklist

The passes from [SKILL.md](../SKILL.md), step 2. Rule keys (NN-n, CR-n, EV-n) are in
[shared/theme/rules.md](../../../shared/theme/rules.md); source keys are in
[shared/theme/sources.md](../../../shared/theme/sources.md). A check that doesn't apply is
skipped, not passed; list skipped areas under *Not checked*.

## Pass 1: Theme health

The file itself, from `check.mjs` and a read of THEME.md.

- [ ] Every token sits in a tier; semantic tokens alias primitives, component tokens alias
      semantic ones (NN-1) [M3-TOKENS].
- [ ] Every spacing step is on the 8-point scale (NN-2) [GRID-8PT].
- [ ] Every semantic colour has a dark value; raised surfaces get lighter in dark mode
      (NN-3) [HIG-DARK].
- [ ] Every `on-X` pair, and every declared pair, passes 4.5:1 for text and 3:1 for UI,
      in both schemes (NN-4) [WCAG-1.4.3] [WCAG-1.4.11].
- [ ] The required roles exist (NN-5); status colours come with an icon or text in use
      [WCAG-1.4.1].
- [ ] One type scale of about 6–10 sizes, by role; body at least 16 (NN-6)
      [MODULAR-SCALE] [M3-COMPOSE].
- [ ] A short radius scale and at most six elevation levels (NN-7, NN-8) [M3-SHAPE]
      [M3-ELEVATION].
- [ ] Motion durations and easings are tokens (NN-9) [M3-MOTION]; a focus ring of 2 px or
      more at 3:1 (NN-10) [WCAG-2.4.13].
- [ ] Semantic names describe roles, not values (NN-11) [EIGHTSHAPES-NAMING].
- [ ] Deprecated tokens name their replacement, and nothing new uses them (NN-12, EV-6).
- [ ] THEME.md is current: the version matches the last change, every locked decision is
      reflected in the tokens, and the changelog explains each addition (EV-5).

## Pass 2: Token use

How the code and designs use the theme, from `scan.mjs --theme`.

- [ ] No raw colour, spacing, radius or font size where a token exists (NN-1)
      [HIG-COLOR] [ANDROID-DARK] [PRIMER-LINT].
- [ ] No primitive tokens used directly in screens or components (NN-1).
- [ ] No values off the theme: each is snapped to a token, or proposed as one (EV-2).
- [ ] No near-duplicate colours: two values within a hair of each other are one colour
      typed twice.
- [ ] Spacing in layouts uses the semantic gaps, so gaps between groups stay larger than
      gaps within them (SEC-2 in
      [shared/composition/principles.md](../../../shared/composition/principles.md)).
- [ ] Text sizes use the type roles, not ad hoc sizes; on the web, in `rem` (NN-6)
      [WCAG-1.4.12].
- [ ] Dark mode comes from the tokens, not from per-screen overrides or `filter: invert`.

## Pass 3: Component reuse

Against THEME.md's component inventory [NNG-DS101] [ATOMIC].

- [ ] Each job has one component. Two buttons, cards or list rows built separately for the
      same job are a finding: merge them into one with variants (EV-4).
- [ ] Every component in the code is in the inventory, and every inventory entry still
      exists. A component used in two or more places but missing from the inventory is a
      proposed addition.
- [ ] Variants are a short, named set (primary, secondary, text), not one-off overrides at
      each call site (an extra `style=` or `className` that changes colour or padding).
- [ ] Component tokens exist only where the component differs from its role (EV-2); a
      component token that just repeats the semantic value can go.
- [ ] Components take their values from tokens; none re-declares a colour, radius or
      padding locally.

## Pass 4: Consistency across screens

The same thing looks the same everywhere [NNG-H4].

- [ ] One role, one look: every primary action, every card, every text field matches
      across screens (SEC-4 in the composition principles).
- [ ] The same kind of surface sits at the same elevation and radius everywhere (NN-7,
      NN-8); nested corners shrink inward.
- [ ] One icon style and stroke weight (CR-10); one depth method (CR-7).
- [ ] Spacing rhythm holds between screens: the same density (CR-8) for the same kind of
      screen.
- [ ] Status, error and empty states use the same tokens and patterns on every screen.

## Pass 5: Both schemes and text size

- [ ] Every screen under review in light and dark: no hard-coded colour that stays light,
      no illegible text, no lost borders (NN-3, NN-4).
- [ ] The focus ring is visible on every surface in both schemes (NN-10) [WCAG-2.4.7].
- [ ] At 200% text, the type scale still holds its order and nothing clips
      [WCAG-1.4.12].
- [ ] With reduced motion, movement becomes a fade or stops (NN-9) [HIG-A11Y].

## Pass 6: Character

The theme's personality, as THEME.md records it, holds across the target.

- [ ] The choices on each creative axis are applied throughout, not drifting back to
      defaults (a system-blue link, a stock grey, an 8 px radius) where the theme says
      otherwise.
- [ ] New work extends the personality rather than adding a second one (a playful
      illustration style in a calm, editorial product).
- [ ] If the owner says the product feels generic, compare it with the default look in
      rules.md and name the axes to move. That's a proposed theme change on an `open`
      axis, never a new theme.

## Severity anchors

Uses the 0–4 scale and factors from the `review` skill's
[checklist](../../review/references/checklist.md#severity-guide). For theme findings:

| Rating | Typical findings |
| --- | --- |
| **4 Catastrophe** | Text unreadable in one scheme on a primary flow (contrast far below the minimum, or text invisible in dark mode); the focus ring invisible everywhere. |
| **3 Major** | A contrast failure on a primary flow; no dark values while the product ships dark mode; two different components for one job on primary screens; widespread raw values (most styled files) so a theme change won't reach the product. |
| **2 Minor** | Raw values or off-grid spacing in a few places; a duplicate component on a secondary screen; a missing required role; near-duplicate colours; an inventory out of date. |
| **1 Cosmetic** | A one-off stray value; an unused token; a naming slip; a changelog gap. |

A contrast failure (NN-4, WCAG AA) is never below 2.
