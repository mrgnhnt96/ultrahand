---
name: mobile
description: Use only when the user asks to design a mobile UI screen or flow (phone-sized layouts, touch targets, thumb reach), or corrects one or states a lasting design preference for a phone app. Do not use for tablet, desktop, or non-UI work.
---

# ultrahand: mobile

Design phone screens as an interactive Claude artifact that switches between three phone
sizes in portrait and landscape. Every rule you apply is in
[references/principles.md](references/principles.md), and each rule cites
[references/sources.md](references/sources.md). The sizes and safe areas are in
[references/presets.md](references/presets.md).

**Lessons:** before step 1, read the project's `design/LESSONS.md` and apply the
lessons for this skill. They record what the owner has already corrected, so don't repeat
those mistakes. See [shared/learning/README.md](../../shared/learning/README.md).

## 1. Gather requirements

Ask only for what you can't infer. Settle these before drawing:

- **Platform:** iOS, Android, or both. If both, use 48-unit targets and platform-neutral
  patterns.
- **Scope:** one screen or a flow. For a flow, list the screens and how people move
  between them: tab, push, sheet or full-screen modal.
- **Primary task:** the one thing each screen is for. That action goes within thumb reach.
- **Real content:** names, lengths, counts and the longest plausible strings. Don't design
  with lorem ipsum.
- **Data states:** what loads, what can be empty, and what can fail or go offline.
- **Constraints:** brand colours, fonts, an existing design system, and whether it's a
  native app or the web.
- **Theme:** look for the project's theme (`design/THEME.md`, `*.tokens.json`; see
  [shared/theme/README.md](../../shared/theme/README.md)) before choosing any colour, size
  or spacing. If there is one, design with it: run `node
  "${CLAUDE_PLUGIN_ROOT}/shared/theme/css.mjs" <tokens.json> --style --out theme.html`, pass
  `--head theme.html` to the build, use only its custom properties (`var(--color-surface)`,
  `var(--space-gap-group)`), and reuse the components in its inventory. When the design
  needs something the theme lacks, use the nearest token and list the addition under open
  questions; don't invent a value. With no theme, follow the non-negotiables in
  [shared/theme/rules.md](../../shared/theme/rules.md) and offer the `theme` skill.

## 2. Read the references

Read `references/principles.md` and `references/presets.md` before you design. Use the
platform's own patterns (tab bar, navigation stack, sheets) rather than inventing new ones.

## 3. Compose the screen

Components that each pass their checks can still add up to a messy screen. Before you
build, plan how they form sections and how the sections form the screen, using the
plugin's composition rules in
[shared/composition/principles.md](../../shared/composition/principles.md):

- **Write the section map.** For each screen list its sections (a navigation bar, the content, a primary action and a tab bar), each one's single
  job, its members ordered by how often they're used, and its one emphasis. Say what is
  primary content and what is chrome: the content dominates and the chrome recedes.
- **Group with space.** Gaps inside a group are clearly smaller than gaps between groups;
  add a container only when space can't show the group.
- **One look per role, one emphasis per section.** Same role, same style; status and labels
  never look like buttons; the strong accent goes to one thing per section, and selected
  states use a quieter treatment.
- **Keep it small.** About three type sizes, one fact in one place, frequent members in
  view and rare ones behind a menu. When a change adds something, reorganise first and
  add only what earns its place.

## 4. Build the canvas artifact

Build on the plugin's shared resizable canvas (`shared/canvas/`; its `README.md` has the full
contract). Write the screen as `screen.html` and the design's own settings as `config.json`
in a working folder, then build:

```sh
node "${CLAUDE_PLUGIN_ROOT}/shared/canvas/build.mjs" \
  --presets "${CLAUDE_PLUGIN_ROOT}/skills/mobile/references/presets.md" \
  --config config.json --screen screen.html \
  --title "<design name>" --out index.html
```

Publish `index.html` as an artifact only after the review in step 7. The presets are `small` 360 (Android), `medium` 393 and
`large` 430 (iOS); Rotate gives each in landscape, and the 320-wide reflow pass sits under
Checks.

- **`config.json`** sets `title` and `states` (e.g. default, loading, empty, error). For an
  iOS-only design set `"initialPreset": "medium"`; for iOS and Android together set
  `"minTarget": 48` so every preset measures against the stricter target.
- **Screen contract:** one `<template id="uh-screen">` with `[data-screen]` sections, and
  `data-nav`, `data-nav-replace` (tabs), `data-nav-back` and `data-show-state` for clicks.
  Pad edges with `var(--uh-safe-top|right|bottom|left)`, which follow the preset and its
  rotation; declare tokens that use them on `[data-screen]`, since `:host` can't see them.
  Respond to size with `@container screen (width >= …)`, not `@media`. Text in `rem`; hit
  areas, icons and gutters in px, so 200% text grows the words, not the controls. Colours
  with `light-dark()`. Behaviour goes in `window.ultrahandSetup = function (canvas) { … }`.
- **Sticky parts:** stack everything pinned to the bottom (tab bar, FAB, snackbar) in one
  dock so nothing overlaps, and set `scroll-padding` on `[data-screen]` so focus scrolls
  clear of sticky bars [WCAG-2.4.11]. At compact height or 200% text, let the header go
  static [WCAG-1.4.4].
- **Platform per preset:** `small` is Android, `medium` and `large` are iOS. Follow
  `canvas.size.platform` for conventions that differ, such as the back control, the
  title alignment and the target size.
- **Built-in toggles:** light/dark, 200% text, the state picker and show tap targets (44 pt,
  or 48 dp on Android presets). Don't build your own. Call `canvas.refresh()` after opening
  a sheet so the target overlay sees it.
- Lay out with flexible units and the insets, not fixed device numbers, so one design
  adapts to every preset.
- Make the main flow clickable: tabs switch, rows push, and sheets open and close. Draw
  sheets and dialogs in the screen; never use `alert`, `confirm` or `prompt`.

## 5. Design every preset

For each screen, work through `small`, then `medium`, then `large`, then each in
landscape. Fix each problem at the size where it appears:

- **small (360):** text and buttons still fit without truncating key information.
- **large (430):** content doesn't stretch into long lines or leave dead space.
- **landscape:** the short height still shows the focused field above the keyboard, and the
  side safe area is respected. Check it with 200% text too: the sticky header and dock
  together must leave most of the screen for content.

Then do a quick pass at the 320-wide reflow check.

## 6. Self-check before the review

Go through every item. Fix any failure, or name it and say why it's acceptable.

**Composition** (run the composition audit,
`node "${CLAUDE_PLUGIN_ROOT}/shared/input/drive.mjs" do "${CLAUDE_PLUGIN_ROOT}/shared/composition/audit.mjs"`,
at the largest and smallest size, or check by eye):

- [ ] Blurred, the screen shows the intended sections, and the primary content draws the eye
      first. No unintended bright spot.
- [ ] Each section has one job, its members grouped by function and frequency, with gaps
      between groups clearly larger than gaps within them.
- [ ] Each section has at most one strongly emphasised element; selected states are quiet.
- [ ] One style per role: count the control styles in each section and justify any extra.
      No label or status looks like a button.
- [ ] Rows and sections align to shared edges; about three type sizes on the screen.
- [ ] No fact shown twice, and nothing on screen that doesn't serve a task here.
- [ ] After a round of changes: list what it added; the screen is no busier than it needs
      to be.
- [ ] Only theme values: no raw colours, no spacing off the 8-point scale, no type sizes
      outside the scale, and inventory components reused rather than rebuilt
      ([shared/theme/rules.md](../../shared/theme/rules.md) NN-1, NN-2, NN-6, EV-4).

**Components and platform:**

- [ ] Tap targets are at least 44 × 44 pt (iOS) or 48 × 48 dp (Android), with spacing, and
      never below 24 × 24.
- [ ] The primary action is reachable with one thumb; destructive actions are away from
      where the thumb rests.
- [ ] Nothing interactive is under the status bar, cutout or home indicator, in either
      orientation.
- [ ] There are 3–5 top-level tabs, each with a text label, and no lone hamburger.
- [ ] Every sheet has a visible Close or Cancel button and a clear detent, and sheets never
      stack. Opening one moves focus into it, Esc closes it, and focus returns to the opener
      [NNG-SHEET].
- [ ] The selected tab is marked by more than colour, such as an indicator pill or weight
      [WCAG-1.4] [M3-NAVBAR], and removing something offers a tappable Undo.
- [ ] Every field has a label above it (not a placeholder), the right keyboard and
      autocomplete type, and stays visible with the keyboard up.
- [ ] Errors appear inline, next to the field, and say how to fix the problem; typed input
      is kept.
- [ ] Every gesture has a visible alternative, and nothing fights the system edge gestures.
- [ ] Body text is 16–17 or larger, and the layout survives 200% text without losing
      information.
- [ ] Contrast is at least 4.5:1 for text and 3:1 for UI in **both** light and dark mode,
      and colour is never the only signal.
- [ ] Loading, empty and error states are designed, and loading uses the right
      indicator for its duration.
- [ ] The design works at 320 wide without horizontal scrolling, and in landscape.

## 7. Review the round

Every round ends with a review by a fresh agent, before you publish or tell the user the
design is ready. A round is the first design and every later change the user asks for.
Follow [shared/review/README.md](../../shared/review/README.md): keep each round in
`rounds/<n>/`, review the first round whole and later rounds by their diff (whole again
when something shared changed), fix what it finds, then publish.

## 8. Present

Share the artifact link. In a few lines, state the section map (each section's job and
emphasis), the key decisions and the principle behind each (cite the source key), any
self-check item you accepted with a reason, and any
proposed theme additions (for the `theme` skill), and any open questions.
End with the **Review** note: its scope, findings by severity, what you fixed and what's
left.

## 9. Learn

When the owner corrects the result, states a lasting preference ("we never…") or
dismisses a finding as intended, add a lesson to `design/LESSONS.md`. When the correction
shows that this skill, its rules or its scripts are wrong for any project, also write a
plugin report, and always log it in LESSONS.md. Both are in
[shared/learning/README.md](../../shared/learning/README.md).
