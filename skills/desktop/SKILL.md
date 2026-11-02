---
name: desktop
description: Use only when the user asks to design a desktop UI screen or flow (resizable windows, min/max sizes, pointer and keyboard). Do not use for mobile, tablet, or non-UI work.
---

# ultrahand: desktop

Design desktop app and web app screens as an interactive Claude artifact. The artifact is a
window you drag to any size between the minimum and maximum you choose, with presets for
common laptops, monitors and snapped halves, and the layout reflows live as you drag. Every
rule you apply is in [references/principles.md](references/principles.md), and each rule
cites [references/sources.md](references/sources.md). The sizes, limits and size classes are
in [references/presets.md](references/presets.md).

## 1. Gather requirements

Ask only for what you can't infer. Settle these before drawing:

- **Platform:** macOS, Windows, a web app, or several. A native macOS app gets a menu bar;
  Windows and web apps get a command bar or toolbar with overflow.
- **Scope:** one screen or a flow. For a flow, list the screens and how people move between
  them: sidebar, tabs, list to detail, side panel, dialog or new window.
- **Primary task:** the one thing each screen is for, and which layout fits it
  (list-detail, supporting pane, feed, or a single document pane).
- **Real content:** names, lengths, counts, column sets and the longest plausible strings.
  Don't design with lorem ipsum.
- **Data states:** what loads, what can be empty, and what can fail or go offline, per pane.
- **Window limits:** the minimum window size, the maximum, and the max content width. Default
  to 640 × 480 for a native app and 320 × 256 for a web app (see presets.md).
- **Inputs:** pointer and keyboard always; touch if it may run on 2-in-1s or touch laptops.
  Which commands are frequent enough to earn a shortcut?
- **Windows:** one window, or several (documents, inspectors, detached panels)?
- **Constraints:** brand colours, fonts, an existing design system or component library.

## 2. Read the references

Read `references/principles.md` and `references/presets.md` before you design. Use the
platform's own patterns (menu bar, toolbar, sidebar, split view, context menu, sheet,
NavigationView) rather than inventing new ones.

## 3. Build the canvas artifact

Build on the plugin's shared resizable canvas (`shared/canvas/`; its `README.md` has the full
contract). Write the screen as `screen.html` and the design's own settings as `config.json`,
then build:

```sh
node <plugin>/shared/canvas/build.mjs \
  --presets <plugin>/skills/desktop/references/presets.md \
  --config config.json --screen screen.html \
  --title "<design name>" --out index.html
```

`<plugin>` is the plugin's root folder. Publish `index.html` as an artifact.

- **`config.json`** sets `title`, `states` (e.g. default, loading, empty, error) and the
  design's **`limits`**: `{ minWidth, minHeight, maxWidth, maxHeight }`. The canvas lets you
  drag any size between them. For a web app also set `"initialPreset": "browser"`.
- **Presets** (from presets.md): laptops (1366 × 768, 1536 × 864, MacBook 1440 × 900),
  monitors (1920 × 1080, 2560 × 1440), snapped halves (960 × 1080, 720 × 900) and a browser
  window (1280 × 720). Checks: your minimum window, a short 1366 × 600 window and 400% zoom
  at 320 × 256.
- **Screen contract:** one `<template id="uh-screen">` with `[data-screen]` sections, and
  `data-nav`, `data-nav-back` and `data-show-state` for clicks. Respond to size with
  `@container screen (width >= …)`, not `@media`. Text in `rem`, colours with
  `light-dark()`. Behaviour goes in `window.ultrahandSetup = function (canvas) { … }`.
- **Built-in toggles:** light/dark, 200% text, state picker, and tap targets (24 px minimum
  for desktop). Call `canvas.refresh()` after opening a menu or popover so the target overlay
  sees it.
- **Make it work like a desktop app:** hover states, a context menu on right-click (and
  Shift+F10), visible focus, working Tab and arrow-key navigation, shortcut hints in menus
  and tooltips, panes that hide and show, and dividers that drag. Never use `alert`,
  `confirm` or `prompt`; draw dialogs in the screen.

## 4. Design every size class

Work from wide to narrow, and fix each problem at the size where it appears:

1. **Large / extra-large** (`laptop-125`, `desktop-fhd`): choose the panes, navigation,
   toolbar groups and density. Cap the content width; extra width goes to panes, not to
   longer lines.
2. **Expanded** (`snap-half`, ~960): collapse the inspector or secondary pane, turn the
   sidebar into a rail, and start moving toolbar items into overflow in your planned order.
3. **Medium and your minimum** (`mac-half`, the min-window check): one or two panes, a menu
   button or rail for navigation, and every command still reachable through menus.
4. **Drag** slowly from the maximum to the minimum and back. Selection, scroll position,
   typed text and open panels must survive every breakpoint.

Then run the checks: the short window (sticky bars, focus not obscured) and, for web apps,
400% zoom at 320 × 256 (one column, vertical scrolling only).

## 5. Self-check before you present

Go through every item. Fix any failure, or name it and say why it's acceptable.

- [ ] The design states its min and max window size and its max content width. Nothing
      overlaps or clips at the minimum, and nothing stretches at the maximum.
- [ ] The layout switches by window width (Material 600 / 840 / 1200, or Windows 641 / 1008),
      not by device. Every feature is reachable at every size.
- [ ] Resizing reflows live and keeps selection, scroll, input and open panels.
- [ ] Panes follow a canonical layout, dividers drag, panes can be hidden by button, menu and
      shortcut, and no pane is ever empty without an explanation.
- [ ] Body text stays at or under 80 characters a line.
- [ ] Every command is in a menu (the menu bar on macOS) or the toolbar overflow; unavailable
      menu items are disabled, not hidden; commands needing input end with "…".
- [ ] Toolbar items overflow in a planned order as the window narrows, with at most three
      groups.
- [ ] Right-click opens a short, relevant context menu, and each of its commands also exists
      somewhere else.
- [ ] Everything works by keyboard with no traps; focus is always visible and never under a
      sticky bar; standard shortcuts aren't repurposed; shortcuts show in menus and tooltips.
- [ ] Nothing is available only on hover. Hover and focus content is dismissible with Esc,
      hoverable and persistent; tooltips carry no vital information.
- [ ] Targets are at least 24 × 24 px (about 40 × 40 where touch is likely).
- [ ] Scrolling: only content scrolls, no nested scroll areas in the same direction, table
      headers stay frozen, and no critical control sits at the window's bottom edge.
- [ ] Editing uses the lightest pattern that fits: inline for a field, a side panel for a
      record, a sheet or dialog for a short blocking task, a window or page for long flows.
      Confirmations are only for destructive, irreversible actions; everything else offers
      Undo.
- [ ] Every drag-and-drop has a non-drag alternative.
- [ ] The layout survives 200% text, and contrast is at least 4.5:1 for text and 3:1 for UI
      in **both** light and dark mode.
- [ ] Loading, empty and error states are designed for each pane, not just the window.
- [ ] Web apps: works at 320 × 256 (400% zoom) without two-way scrolling, and has a skip link.

## 6. Present

Share the artifact link. In a few lines, state the window limits and max content width, the
key decisions and the principle behind each (cite the source key), how the layout changes at
each width class, any self-check item you accepted with a reason, and any open questions.
