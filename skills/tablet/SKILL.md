---
name: tablet
description: Use only when the user asks to design a tablet UI screen or flow (split view, adaptive layouts, touch plus pointer), or corrects one or states a lasting design preference for a tablet app. Do not use for phone, desktop, or non-UI work.
---

# ultrahand: tablet

Design tablet screens as an interactive Claude artifact. The artifact switches between
iPad and Android tablet sizes in both orientations, snaps to split widths (1/3, 1/2, 2/3),
and reflows live while you drag a window from full width down to 320. Every rule you apply
is in [references/principles.md](references/principles.md), and each rule cites
[references/sources.md](references/sources.md). The sizes, splits and size classes are in
[references/presets.md](references/presets.md).

**Lessons:** before step 1, read the project's `design/LESSONS.md` and apply the
lessons for this skill. They record what the owner has already corrected, so don't repeat
those mistakes. See [shared/learning/README.md](../../shared/learning/README.md).

## 1. Gather requirements

Ask only for what you can't infer. Settle these before drawing:

- **Platform:** iPadOS, Android, or both. If both, use 48-unit targets and platform-neutral
  patterns.
- **Scope:** one screen or a flow. For a flow, list the screens and how people move between
  them: sidebar or rail, list to detail, sheet, popover or new window.
- **Primary task:** the one thing each screen is for, and which canonical layout fits it
  (list-detail, supporting pane, feed, or a single pane).
- **Real content:** names, lengths, counts and the longest plausible strings. Don't design
  with lorem ipsum.
- **Data states:** what loads, what can be empty, and what can fail or go offline.
- **Inputs:** touch only, or also a keyboard, trackpad or mouse, or Pencil. Assume all of
  them are possible unless told otherwise.
- **Multitasking:** what people do beside this app (side-by-side reference, dragging content
  in or out). Expect windows from 320 wide to full screen.
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
platform's own patterns (sidebar or rail, split view, popovers, menu bar commands) rather
than inventing new ones.

## 3. Compose the screen

Components that each pass their checks can still add up to a messy screen. Before you
build, plan how they form sections and how the sections form the screen, using the
plugin's composition rules in
[shared/composition/principles.md](../../shared/composition/principles.md):

- **Write the section map.** For each screen list its sections (a sidebar, a list pane, a detail pane with its toolbar, and an inspector), each one's single
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
  --presets "${CLAUDE_PLUGIN_ROOT}/skills/tablet/references/presets.md" \
  --config config.json --screen screen.html \
  --title "<design name>" --out index.html
```

Publish `index.html` as an artifact. From `references/presets.md` the canvas gets:

- **Full screen:** `ipad-mini` 744, `ipad` 820, `ipad-13` 1032 and `android-tablet` 800.
  Rotate gives each in landscape.
- **Split view:** `ipad-split`, `ipad-13-split` and `android-split`, the landscape device
  with your app on one side of a divider. The divider snaps to 1/3, 1/2 and 2/3 (drag it,
  or focus it and press the arrow keys); Full is the full-screen preset in landscape.
- **Free resize:** drag handles from the preset size down to 320 × 450.
- **Checks:** 320-wide reflow, and landscape with the keyboard up (1180 × 420).

While dragging, the layout must **reflow live**. Going from full width to half width has to
re-render continuously, crossing the 840 and 600 breakpoints with no reload and no lost
state. The readout shows the current width and its size class (compact, medium, expanded,
large).

- **`config.json`** sets `title` and `states` (e.g. default, loading, empty, error). For an
  Android-only design set `"initialPreset": "android-tablet"`; for iPadOS and Android
  together set `"minTarget": 48`.
- **Screen contract:** one `<template id="uh-screen">` with `[data-screen]` sections, and
  `data-nav`, `data-nav-replace`, `data-nav-back` and `data-show-state` for clicks. Lay out
  by **size class** with `@container screen (width >= 600px)` and `(width >= 840px)`, or
  the viewport's `data-width-class`, never by preset or `@media`. Pad edges with
  `var(--uh-safe-*)`, declared on `[data-screen]` (`:host` can't see them). Text in `rem`;
  hit areas, icons and gutters in px, so 200% text grows the words, not the controls.
  Colours with `light-dark()`. Behaviour goes in
  `window.ultrahandSetup = function (canvas) { … }`.
- **Built-in toggles:** light/dark, 200% text, the state picker and show tap targets. Don't
  build your own. Call `canvas.refresh()` after opening a sheet, popover or menu.
- **Pointer and keyboard are always live:** the viewer drives the artifact with a mouse and
  keyboard, so give every control a hover state, a right-click context menu where the
  platform has one, visible `:focus-visible` focus and shortcut hints. Check touch with the
  tap-target overlay. Don't hide any of this behind a toggle of your own.
- In windowed iPad states, keep leading toolbar buttons clear of the top-leading window
  controls.
- Make the main flow clickable: navigation switches, rows select or push, panes hide and
  show, and sheets and popovers open and close. Never use `alert`, `confirm` or `prompt`.

## 5. Design every size class

Work from wide to narrow, and fix each problem at the size where it appears:

1. **Expanded / large, landscape full screen** (e.g. `ipad` 1180): choose the panes,
   navigation (sidebar or rail) and density. Cap line lengths and control widths.
2. **Medium, portrait full screen and 2/3 split** (e.g. 820, 787): collapse to fewer panes,
   with a rail or a top tab bar.
3. **Compact, 1/2 and 1/3 split** (e.g. 590, 393): the phone layout, with a bottom bar or
   tab bar, one pane at a time and Back to the list.
4. **Drag** slowly from full width to 320 and back. Check that the selection, scroll
   position and typed text survive. Check that list-detail keeps the open detail when it
   narrows, and selects that item when it widens.

Then check the extra cases: 320-wide reflow, landscape with the keyboard up, and the
`android-tablet` preset (if Android is in scope) in both orientations.

## 6. Self-check before you present

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

- [ ] The layout switches by width class (600 / 840), not by device. Every feature is
      reachable at every width, from 320 to full screen.
- [ ] Resizing reflows live and keeps selection, scroll, input and playback. Nothing resets
      at a breakpoint.
- [ ] Navigation fits the width: a bottom bar at compact, and a rail, top tab bar or sidebar
      above it. There are five or fewer top-level tabs, none hidden or disabled.
- [ ] Multi-pane layouts follow a canonical pattern. Selection is highlighted in each pane,
      hidden panes have more than one way back, and no detail pane is left empty.
- [ ] Nothing stretches: buttons, fields, sheets, dialogs and images have max widths, and
      text has a readable line length.
- [ ] Tap targets are at least 44 × 44 pt (iOS) or 48 × 48 dp (Android) and never below
      24 × 24, even with a pointer. Primary content sits in the centre and frequent
      controls are reachable from the side edges.
- [ ] Nothing interactive sits under the status bar, home indicator, taskbar or the iPad
      window controls, in either orientation.
- [ ] Pointer: every control has a hover state, right-click and touch-and-hold open a
      context menu, and nothing is available only on hover.
- [ ] Switching items, closing a panel or dismissing a sheet never loses typed text; Undo
      survives two deletes in a row and returns the item to its pane.
- [ ] Keyboard: main flows work with Tab and the arrows, focus is always visible, standard
      shortcuts work, and Esc closes, cancels or clears.
- [ ] Every drag-and-drop has a non-drag alternative, shows valid targets and can be undone.
- [ ] Both orientations work, and the focused field stays visible in landscape with the
      keyboard up.
- [ ] The layout survives 200% text, and contrast is at least 4.5:1 for text and 3:1 for UI
      in **both** light and dark mode.
- [ ] Loading, empty and error states are designed for each pane, not just the screen.
- [ ] The design works at 320 wide without horizontal scrolling.

## 7. Present

Share the artifact link. In a few lines, state the section map (each section's job and
emphasis), the key decisions and the principle behind each (cite the source key), how the
layout changes at each width class, any self-check item you accepted with a reason, and any
proposed theme additions (for the `theme` skill), and any open questions.

## 8. Learn

When the owner corrects the result, states a lasting preference ("we never…") or
dismisses a finding as intended, add a lesson to `design/LESSONS.md`. When the correction
shows that this skill, its rules or its scripts are wrong for any project, also write a
plugin report, and always log it in LESSONS.md. Both are in
[shared/learning/README.md](../../shared/learning/README.md).
