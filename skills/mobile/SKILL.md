---
name: mobile
description: Use only when the user asks to design a mobile UI screen or flow (phone-sized layouts, touch targets, thumb reach). Do not use for tablet, desktop, or non-UI work.
---

# ultrahand: mobile

Design phone screens as an interactive Claude artifact that switches between three phone
sizes in portrait and landscape. Every rule you apply is in
[references/principles.md](references/principles.md), and each rule cites
[references/sources.md](references/sources.md). The sizes and safe areas are in
[references/presets.md](references/presets.md).

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

## 2. Read the references

Read `references/principles.md` and `references/presets.md` before you design. Use the
platform's own patterns (tab bar, navigation stack, sheets) rather than inventing new ones.

## 3. Build the canvas artifact

Build on the plugin's shared resizable canvas (`shared/canvas/`). Load the mobile presets
from the JSON block in `references/presets.md`: `small` 360, `medium` 393 and `large` 430,
each in portrait and landscape.

- Draw the safe-area insets for the current preset, and keep content inside them.
- Lay out with flexible units and the insets, not fixed device numbers, so one design
  adapts to every preset.
- Add toggles for **light/dark**, **large text (200%)** and **state** (default, loading,
  empty, error).
- Add a **show tap targets** toggle that outlines every hit area.
- Make the main flow clickable: tabs switch, rows push, and sheets open and close.

## 4. Design every preset

For each screen, work through `small`, then `medium`, then `large`, then each in
landscape. Fix each problem at the size where it appears:

- **small (360):** text and buttons still fit without truncating key information.
- **large (430):** content doesn't stretch into long lines or leave dead space.
- **landscape:** the short height still shows the focused field above the keyboard, and the
  side safe area is respected.

Then do a quick pass at the 320-wide reflow check.

## 5. Self-check before you present

Go through every item. Fix any failure, or name it and say why it's acceptable.

- [ ] Tap targets are at least 44 × 44 pt (iOS) or 48 × 48 dp (Android), with spacing, and
      never below 24 × 24.
- [ ] The primary action is reachable with one thumb; destructive actions are away from
      where the thumb rests.
- [ ] Nothing interactive is under the status bar, cutout or home indicator, in either
      orientation.
- [ ] There are 3–5 top-level tabs, each with a text label, and no lone hamburger.
- [ ] Every sheet has a visible Close or Cancel button and a clear detent, and sheets never
      stack.
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

## 6. Present

Share the artifact link. In a few lines, state the key decisions and the principle behind
each (cite the source key), any self-check item you accepted with a reason, and any open
questions.
