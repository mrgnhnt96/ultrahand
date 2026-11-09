# shared/canvas

The canvas is the resizable harness that every ultrahand design skill renders its screen into. A skill writes a screen and a config, builds one self-contained HTML page with `build.mjs`, and publishes that page as a Claude artifact.

The page gives the viewer:

- **A device frame.** Phone, tablet (with split view and the iPad window controls), desktop window, or bare. Every edge and corner resizes it: each edge is a hit strip along its full length, with a grip in the middle. The frame grows evenly about its centre and the zoom holds while you drag, so the edge you hold follows the pointer; at Fit it re-fits once you let go. Esc cancels a drag. Each grip is also a slider (the WAI-ARIA slider pattern): Tab to it, or click it, then Up/Right grow it by 1px and Down/Left shrink it (10px with Shift; Left/Right follow the pointer on a divider at the trailing edge), PageUp/PageDown move 100px, and Home/End go to the limits.
- **A readout.** It shows the width and height and their size classes ("large width · medium height", in plain muted text). The fields (labelled Width and Height) are editable: Enter applies, Esc reverts, an empty entry reverts, and a value past the limits is clamped, with the field showing the real size and the flag saying so ("at min width 640").
- **A Size picker.** One select lists the platform skill's presets, grouped by platform, plus extra checks such as a 320px reflow pass. When the frame is rotated or resized away from a preset, the picker says so by name only ("Large phone · resized"), since W × H beside it already has the numbers; "resized" is worked out from the values, so typing a preset's size back selects that preset again. Below 800px the options give names only. Rotate swaps the orientation, including safe areas.
- **Review toggles:**
  - Light / Dark
  - Text 100% / 200%
  - a State picker (default, loading, empty, error…)
  - Tap targets (Hit targets for windows), which outlines every interactive element and marks any under the platform minimum. It is the only toolbar control that uses the accent colour while on; other selected states stay quiet. While it's on, the result shows after it: "all ≥ 44px" or "3 targets under 44px", plus "1 under window controls" when a control overlaps the drawn iPad window controls, which it then outlines. Turning it on moves no other control.
  - Zoom: −, the current zoom, and + step through 10–400%; Fit; 100%. A step goes to the next stop at least 5% away, so Fit at 71% steps in to 100%, not 75%; past the last stop it goes to the limit. At either end the button stays focusable and reports `aria-disabled`. A zoom shortcut flashes the readout, and screen readers hear "Zoom 75%" once the zoom has settled for half a second (`#uh-zoom-live`). Fit leaves a 48px margin round the frame, so the grips stay inside the stage. Ctrl or ⌘ with the wheel, or a trackpad pinch, zooms at the pointer. Shortcuts: Ctrl or ⌘ `=` and `−`, Ctrl or ⌘ `0` for 100%, Ctrl or ⌘ Shift `1` for Fit. They act on the canvas only while the pointer is over the stage or focus is in it; elsewhere, such as in the toolbar, they are the browser's own page zoom.
  - Panning: the stage pans at least half its own size (or half the frame, if larger) past every edge of the frame. Scroll, hold Space and drag (also right after clicking a toolbar button, while the pointer is over the stage), or drag with the middle button. Esc during a pan puts the scroll back. Wheel scrolling over the screen scrolls the screen first. Fit, 100%, Rotate and a new preset recentre it.
  - Canvas colours: Auto / Light / Dark for the canvas's own colours, separate from the screen's Light / Dark. It is set rarely, so it sits in the `?` popover rather than the toolbar.
- **Comments on the design.** Comment and its notes are one split pill in the toolbar: the left half (or the `C` key) turns on comment mode, and the right half, the note count, opens the Notes menu. In comment mode, hovering with a mouse or pen outlines the element a click would pin to with a thin dashed line (the screen itself gets none), so you can aim before clicking; a click on the screen drops a numbered pin (each note keeps its number for good, so deleting one never renumbers the rest), a drag marks an area, and either opens a comment box (`Ctrl`/`⌘` `Enter`, `Esc` and a click elsewhere all keep what was typed; only Cancel discards it). A pin is anchored to the element under it, and an area is redrawn around the elements it covers, with the margin it was drawn with, so both follow the design through resizes, reflows and scrolling. Pins show only on the screen and state they were left on. A note left at another frame size has a hollow pin, and its comment box has a "View at 430×932" button that puts the frame back to that size. The Notes menu lists every note, grouped by screen with the current one first once they span more than one; the list scrolls between a fixed header and footer, so the footer stays in view however long it gets. Opening a note goes to its screen and state, a trash button on each row deletes it at once, with Undo in the panel, `+` adds a note about the whole screen (the keyboard route), and Clear all (also undoable) sits in the header; when the list holds other people's notes it reads Clear mine and leaves theirs. A line under the list says where the notes are: saved with the design, some only in this browser so far (with Save now), or only in this browser so Claude can't read them.
  - **Saved with the design.** Where the page was published with the `db` capability, each note is a document in the artifact's database, collection `uh-notes`, keyed by the note's id, with its `text`, its number, the raw position fields, and `where`: the screen, state, frame size, element and selector in one readable block. Claude reads them with `ArtifactData` (`list`, collection `uh-notes`) when the user says they left notes, so nothing is copied or pasted. Saving, deleting, Clear all and Undo write through; every viewer of the artifact sees the same notes, live, and rows from other people say so. Each note carries an `author` key (a random id kept in the viewer's browser). Notes are also kept in the viewer's browser: a note the database hasn't confirmed shows "This browser only" on its row and is never replaced by the database's copy, and a note saved before the database answered goes up with the viewer's next change or Save now. A viewer who can't write (signed out, or a Viewer or Commenter) keeps their notes in the browser, and the panel says Claude can't read them.

  Each note says where it is in terms Claude can act on: the screen, state, frame size and preset, scheme and text size, the element under a pin (and the control it sits in) or the elements an area covers, a selector, and a position in screen px. Notes survive a reload and a republish to the same link.
- **Keyboard:** each segmented group in the toolbar is one tab stop, and the arrow keys move within it. Rotate only shows for phones and tablets. The `?` button at the end of the toolbar, or the `?` key anywhere outside a text field and the screen, opens a list of every shortcut (pan, zoom, zoom step, 100%, Fit, grip keys, Esc to cancel a drag or pan, the W and H fields, the button groups) and the Canvas colours; Esc closes it. While focus is inside the screen, the canvas keys (`C`, `?`, zoom) leave it alone; an Esc the screen doesn't use moves focus out to the stage (with a focus ring), so pressing Esc until the screen is done with it, then `C`, turns on comment mode without a click outside. The canvas never cancels the screen's Esc: if it closed a dialog or menu, cleared a field, or moved focus, focus stays in the screen for that press.
- **Toolbar layout.** Three groups, in order of use: **Frame size** (the Size picker, W × H, the size classes), **Zoom**, and **Preview** (Go to, State, Rotate, Light / Dark, Text size, Tap targets), plus `?`. Every control is 32px tall with one label style, and the zoom readout is plain text.
  - From 1024px wide: two rows (89px). Frame size, Zoom and `?`, then Preview.
  - Below 1024px: one row (49px). Preview moves into a menu (a disclosure button: Esc or a click outside closes it). The button names whatever differs from the defaults ("Preview · Dark · Text 200% · Tap targets"). The size flag and the hit-target result hang just under the bar. While the menu is open, it shows a copy of the result beside the Tap targets toggle, so the result stays visible and the menu never moves.
  - Below 800px: the Size and W × H labels hide and the picker gives preset names only.
  - Below 720px: the zoom controls fold behind a button that shows the zoom ("71%"), and Comment becomes an icon.
  - Below 520px: Frame size folds behind a button that shows W × H, the Comment / notes pill shrinks to an icon and the count, and the bar stays one 45px row down to 320px wide (a 1280px window at 400% page zoom).
  - Below 400px: Notes moves into the Preview menu. The Comment icon stays in the bar, since it's used most.
- **The screen itself.** It renders in a shadow root and stays fully interactive: buttons, multi-screen navigation with a back stack, form state, scroll position per screen.

`canvas.html` is a working example as it stands (the "Trail log" demo), so you can open it directly to see every feature.

## Files

| File | What it is |
| --- | --- |
| `canvas.html` | The harness: styles, runtime, and three marked regions (`HEAD`, `CONFIG`, `SCREEN`) holding the demo. |
| `build.mjs` | Puts a skill's config, presets and screen into those regions and writes one page. Node 18+, no dependencies. |

## How a skill uses it

1. **Presets.** Each platform skill keeps its presets as a `json` block in `skills/<name>/references/presets.md`. (The mobile skill's file is the model to follow.)
2. **Screen.** Write the design to a working folder as `screen.html`, following the [screen contract](#screen-contract).
3. **Config (optional).** Write `config.json` with anything specific to this design: `title`, `states`, `initialPreset`, and so on. It is merged over the presets, and its keys win.
4. **Build:**

   ```sh
   node <plugin>/shared/canvas/build.mjs \
     --presets <plugin>/skills/mobile/references/presets.md \
     --config config.json --screen screen.html --title "Checkout" --out index.html
   ```

   `<plugin>` is the plugin's root folder: `${CLAUDE_PLUGIN_ROOT}` inside a skill. The build fails, with a list of problems, on a broken config. It warns about screen code that won't work in an artifact or that defeats the review toggles (see [Limits](#limits-inside-an-artifact)).
5. **Publish.** Publish `index.html` as an artifact: `publish_files` with `as: "index.html"`, a title and an icon, and the capabilities `{ "db": {} }` so the viewer's notes are saved where Claude can read them. Without it, or where artifacts have no capabilities, the canvas works the same and notes stay in the viewer's browser. For small follow-up changes, use `edit_version` against the published page. Rebuild and republish when the screen changes a lot.

`--head head.html` injects extra `<head>` content, such as a Google Fonts `<link>`. `--presets` also accepts a plain `.json` file.

## Config

All fields are optional except `presets`.

| Field | Meaning |
| --- | --- |
| `title` | Shown in the toolbar, the window title bar and the page `<title>`. |
| `platform` | The toolbar label. Defaults to `device`. |
| `device` | `mobile`, `tablet`, `desktop` or `web`. Picks the default frame: phone, tablet, window or none. |
| `frame` | Forces a default frame: `phone`, `tablet`, `window` or `none`. |
| `presets` | The Size picker's options. See [Preset fields](#preset-fields) below. |
| `extraChecks` | Presets for extra review passes, shown in a "Checks" group (for example `reflow` at 320×568). |
| `initialPreset` | The id of the preset to open with. Defaults to the first preset. |
| `limits` | `{ minWidth, minHeight, maxWidth, maxHeight }` for free resizing. The active preset's own size always fits. |
| `sizeClasses` | Overrides the breakpoints: `{ width: [{name, min}], height: [{name, min}] }`. |
| `states` | Screen states for the State picker, as strings (`"loading"`) or `{ id, label }`. |
| `initialState` | The state to open in. Defaults to the first state. |
| `initialScreen` | The `data-screen` id to open on. Defaults to the first screen. |
| `scheme` | Opens in `light` or `dark`. |
| `minTarget` | The tap-target minimum in CSS px for every preset. Without it, the minimum comes from each preset's platform. |

### Preset fields

| Field | Meaning |
| --- | --- |
| `id` | Required, and unique across `presets` and `extraChecks`. |
| `label` | Required in practice: the text on the button. |
| `width`, `height` | Required. The portrait or default size in CSS px (pt or dp). |
| `group` | The heading the button sits under, e.g. `Phone`. Presets without one sit in an unlabelled group; `extraChecks` default to `Checks`. |
| `frame` | Overrides the frame for this preset. |
| `platform` | `ios`, `android`, `web`, `macos`, `windows`… Sets `data-platform` on the screen, and `android` raises the tap-target minimum to 48. |
| `safeArea` | `{ top, right, bottom, left }`, plus `landscapeSide` and `landscapeBottom` for the rotated phone (the notch side and the home-indicator inset). |
| `landscapeSafeArea` | The full landscape insets, if the two shorthands above aren't enough. |
| `statusBar`, `homeIndicator` | Show or hide the drawn status bar and home indicator. Both default to on when the matching inset is above 0. |
| `radius` | The screen corner radius. |
| `window` | Window chrome for `frame: "window"`: `mac`, `windows` or `plain`. |
| `split` | Split view: `{ width, height?, divider?, side?, snaps?, minWidth?, minOther? }`. `width` is the whole device and must be larger than the preset `width`, which is the app's share. Drag the divider, or focus it and use the arrow keys to step between `snaps`. `side` is `leading` or `trailing`. |
| `windowControls` | The iPadOS window controls, drawn over the app's top-leading corner in the toolbar row below the status bar. `true`, `false`, or `{ width, height }` for the area they take (default 96 × 44). Defaults to on for a `tablet` frame with `platform: "ios"` and a `split`, because iPadOS 26 shows them in a window but not full screen. |
| `minTarget` | The tap-target minimum for this preset. |

### Default size classes

These are the window size classes from Material 3, measured on the screen (the app's pane in split view), not on the device.

| Axis | compact | medium | expanded | large | extra-large |
| --- | --- | --- | --- | --- | --- |
| Width | < 600 | 600–839 | 840–1199 | 1200–1599 | ≥ 1600 |
| Height | < 480 | 480–899 | ≥ 900 | | |

Apple's size classes are coarser: compact or regular on each axis, and fixed per device and multitasking state rather than set by breakpoints. A skill that wants them passes `sizeClasses`, for example `{ "width": [{"name":"compact","min":0},{"name":"regular","min":600}] }`. Choose the threshold to match the devices the skill covers.

## Screen contract

`screen.html` holds one `<template id="uh-screen">`, plus an optional plain `<script>` placed after it:

```html
<template id="uh-screen">
  <style>
    :host { color-scheme: light dark; }
    .list { display: grid; gap: 0.5rem; }
    @container screen (width >= 600px) { .list { grid-template-columns: 1fr 1fr; } }
  </style>

  <section data-screen="inbox" data-title="Inbox">
    <ul class="list" data-show-state="default">…</ul>
    <p data-show-state="empty">No messages yet.</p>
    <button data-nav="compose">New message</button>
  </section>

  <section data-screen="compose" data-title="Compose">
    <button data-nav-back>Cancel</button>
    <form id="compose-form">…</form>
  </section>
</template>

<script>
window.ultrahandSetup = function (canvas) {
  canvas.$('#compose-form').addEventListener('submit', function (e) {
    e.preventDefault();
    canvas.toast('Sent');
    canvas.back();
  });
};
</script>
```

Scripts inside the template don't run. Put behaviour in `window.ultrahandSetup`, which receives the canvas API once the screen is mounted.

### Layout

- The screen lives in a shadow root on a viewport with `container: screen / size`. Respond to its size with `@container screen (width >= …)` and with `cqw`/`cqh` units. `@media` size queries and `vw`/`vh` see the whole artifact window, not the screen.
- **Size text in `rem`.** The Text 200% toggle doubles the root font size, so only `rem` text scales with it. The canvas chrome uses px, so it stays the same size.
- **Size controls in px, text in `rem`.** Give hit areas, icons and gutters px sizes so 200% text grows the words, not the controls, and let rows wrap instead of truncating.
- **Breakpoints:** keep window-class breakpoints (600, 840, 1200) in px. Write content-fit breakpoints (which table columns show, labels beside or above fields) in `rem`, such as `@container screen (width < 52.5rem)`, so they also fire at 200% text.
- **Safe areas:** pad edges with `var(--uh-safe-top|right|bottom|left)`. These follow the preset and its rotation. Where the preset draws iPad window controls, `--uh-window-controls-width` and `--uh-window-controls-height` give the area they take below the top inset (both `0px` otherwise): indent the leading items of the first toolbar row by the width, such as `padding-inline-start: max(16px, var(--uh-window-controls-width))`, rather than pushing the whole toolbar down. `:host` sits outside the viewport that defines them, so declare tokens that use `--uh-safe-*` or `cqw`/`cqh` on `[data-screen]`, not on `:host`.
- **Scrolling:** each `[data-screen]` is its own scroll container. With a sticky header or bottom bar, set `scroll-padding-top`/`scroll-padding-bottom` on it so focused controls scroll clear of the bar (WCAG 2.4.11). At short heights or 200% text, let sticky bars go static so they never cover most of the screen. Stack all bottom-fixed parts (tab bar, FAB, snackbar) in one container so they can't overlap.
- **Colour:** use `light-dark(light, dark)` or the system colours (`Canvas`, `CanvasText`). The Light/Dark toggle sets `color-scheme` on the viewport, so both follow it. The viewport also carries `data-scheme="light|dark"` for selectors. Don't use `prefers-color-scheme`, which follows the viewer's OS instead of the toggle.
- **Viewport attributes for selectors:** `data-width-class`, `data-height-class`, `data-orientation`, `data-frame`, `data-platform`, `data-scheme`, `data-state`, `data-text-scale`, and `data-window-controls` while the iPad window controls show.

### Behaviour

- **Navigation.**
  - Each `[data-screen]` section is one screen, and `data-title` names it in the Go to picker.
  - `data-nav="id"` pushes a screen onto the back stack. Add `data-nav-replace` for tabs, so they don't grow the stack.
  - `data-nav-back` pops.
  - Scroll position is kept per screen. The canvas doesn't set `aria-current` for you, so mark the selected tab yourself in `onNavigate`.
- **States.** An element with `data-show-state="loading empty"` shows only in those states. Declare the states in the config's `states` field. Retry buttons and the like can call `canvas.setState('loading')`.
- **Tap targets.** Elements that match `button, a[href], input, select, textarea, summary, label[for], [role=button|link|tab|switch|checkbox|radio|menuitem|slider]`, a focusable `[role=separator]` (a pane divider), `[data-nav], [data-nav-back]` are measured. The readout checks size only: a control that is hidden at some size isn't flagged, so check that every command is still reachable yourself. Add `data-uh-ignore-target` to inline links in running text, which WCAG 2.5.8 exempts. A `label[for]` beside its own field is counted too, but under 2.5.8's equivalent-control exception it passes when the field itself is big enough, so judge those flags rather than counting them. Call `canvas.refresh()` after opening a sheet or menu, so the count updates.
- **Forms** must call `preventDefault()`. A real submit would navigate the artifact away.
- **Scripted keyboard checks:** Tab from the page passes the canvas toolbar (11 stops at full width, 6 below 1024px, 4 below 520px) and the frame's Width and Height grips before it reaches the screen, so focus a control inside the screen first. Inside the shadow root, use `canvas.root.elementFromPoint(x, y)`; `document.elementFromPoint` returns the host.
- **Shortcuts.** Key events on `canvas.root` arrive only while focus is inside the screen. For app-wide shortcuts, also listen on `document` and skip events from text fields and the canvas toolbar, or move focus into the screen on load.

### API (`canvas`, also `window.ultrahandCanvas`)

| Member | Use |
| --- | --- |
| `$(sel)`, `$$(sel)` | Query inside the screen. |
| `root`, `viewport` | The shadow root and the element that holds the screen. |
| `size` | `{ width, height, widthClass, heightClass, orientation, preset, resized, frame, split, scheme, platform, textScale, state, safeArea, windowControls }`. `windowControls` is `{ top, left, width, height }` in screen px, or `null` when none are drawn. |
| `onResize(fn)` | Called now and on every size change. Returns an unsubscribe function. Change callbacks run on the next animation frame, so after `usePreset` or `setSize` wait two frames before reading the layout. |
| `screen`, `navigate(id, {replace})`, `back()`, `onNavigate(fn)` | Navigation. `fn` gets `{ screen, from, depth }`. |
| `state`, `setState(id)`, `onState(fn)` | Screen states. `onState` is called now and on every change. |
| `setSize(w, h)`, `usePreset(id)`, `setScheme('light'\|'dark')`, `setTextScale(n)` | Drive the canvas, for example to open on the case under review. |
| `setStatusBar('light'\|'dark'\|'hidden'\|'auto')` | The status-bar glyph colour over a full-bleed header. |
| `toast(text, ms)` | Text-only feedback in place of `alert()`. It has no action, so build an Undo snackbar in the screen when one is needed. |
| `refresh()` | Re-measure tap targets and re-place comment pins after a DOM change. |
| `notes`, `notesText()` | The viewer's notes as data, and as text (each note's `where` and its words). |

Errors in setup or handlers show in a banner ("Canvas problem", or "Canvas problems (3)") in the page flow between the toolbar and the canvas, instead of failing silently. Dismiss collapses it to a "1 problem" button in the toolbar, which brings it back. A config that doesn't parse shows only the banner, since nothing else would be right.

### Toolbar, for scripted checks

The toolbar lives in the page document, outside the shadow root, so a review script can drive it directly:

| Element | Does |
| --- | --- |
| `#uh-preview-btn`, `#uh-preview-menu` | Below 1024px, the Preview menu button and its menu (`aria-expanded` gives its state). Open it before driving the items inside it; from 1024px the items sit in the toolbar and the button is hidden. |
| `#uh-size-btn`, `#uh-zoom-btn` | Below 520px and 720px, the buttons that fold Frame size and Zoom away; open them before driving what's inside. |
| `#uh-presets`, `#uh-w`, `#uh-h`, `#uh-class` | The Size picker, the Width and Height fields, and the size classes. Prefer `usePreset` and `setSize`. |
| `#uh-nav`, `#uh-state` | The Go to and State pickers, inside the Preview menu. Prefer `navigate` and `setState`. |
| `#uh-targets` | Toggles the tap-target overlay. `aria-pressed` gives its state. |
| `#uh-targets-result` | The overlay's result, e.g. "3 targets under 44px" or "all ≥ 44px". Hidden while the overlay is off. A status region. `#uh-targets-echo` is an `aria-hidden` copy shown in the open Preview menu. |
| `#uh-flag` | Size limits hit, e.g. "at min width 640". Empty when the size is within limits. |
| `#uh-rotate` | Swaps orientation. Hidden for windows and bare frames. |
| `#uh-zoom-out`, `#uh-zoom`, `#uh-zoom-in`, `[data-zoom="fit"]`, `[data-zoom="1"]` | A step out, the current zoom (text such as "71%", `aria-hidden`), a step in, zoom to fit, and 100%. At 10% or 400% the step button has `aria-disabled="true"` and ignores clicks. |
| `#uh-zoom-live` | A polite live region that says "Zoom 75%" half a second after the zoom stops changing. |
| `#uh-help-btn`, `#uh-keys` | The `?` button and the popover it opens: the shortcuts and the canvas colours. |
| `#uh-error`, `#uh-error-dismiss`, `#uh-problems` | The problem banner, its Dismiss button, and the toolbar button that reopens it. |
| `[data-edge]` | The frame's resize strips; the `e`, `s` and `divider` ones are focusable sliders. |
| `#uh-theme` | The canvas's own colours, inside `#uh-keys`: `auto`, `light` or `dark`. |
| `[data-scheme]`, `[data-text]` | The Light/Dark and Text 100%/200% toggles. Prefer `setScheme` and `setTextScale`. |
| `#uh-comment`, `#uh-notes`, `#uh-composer` | Comment mode's toggle (`aria-pressed`), the layer over the screen that holds the pins (`.uh-pin`) and areas (`.uh-region`), and the comment box. |
| `#uh-notes-btn`, `#uh-notes-pop` | The Notes menu: a header with the count, `#uh-note-screen` (a note about the whole screen) and `#uh-notes-clear`; `#uh-notes-undo` takes back the last delete or clear; the scrolling list `#uh-note-scroll`, with a delete button on each row; a footer, `#uh-notes-foot`, with `#uh-notes-where`, which says where the notes are, and `#uh-notes-save` (Save now). |

There is no on-screen keyboard. To check a keyboard-up layout, shrink the height with `setSize(width, height - 300)`, or use the platform's `keyboard-up` extra check where it has one.

## Limits inside an artifact

An artifact is one HTML file served with a strict Content Security Policy:

- Inline scripts and styles are fine, as are scripts from the allowed CDNs and stylesheets from Google Fonts.
- No `fetch` to other hosts, so keep sample data inline.
- Images only as `data:` or `blob:` URIs, or drawn in CSS or SVG.
- No iframes of other sites.
- No `alert`, `confirm` or `prompt`.
- `localStorage` may throw, so wrap it in `try`.
- The whole page must stay under 16 MiB.

`build.mjs` warns about the patterns it can detect.

## Research behind the defaults

- **Width and height classes:** Material Design 3, *Window size classes*, <https://m3.material.io/foundations/layout/applying-layout/window-size-classes>. Android Developers, *Use window size classes*, <https://developer.android.com/develop/ui/compose/layouts/adaptive/use-window-size-classes>.
- **Apple size classes and safe areas:** Apple Human Interface Guidelines, *Layout*, <https://developer.apple.com/design/human-interface-guidelines/layout>.
- **Split view:** Apple HIG, *Multitasking*, <https://developer.apple.com/design/human-interface-guidelines/multitasking>.
- **iPad window controls:** Apple HIG, *Windows* (window controls at the toolbar's leading edge), <https://developer.apple.com/design/human-interface-guidelines/windows>. Apple publishes no frame for them; UIKit only offers corner-adapted margin guides, which are zero full screen (Apple Developer Forums, *How to get the frame or insets of the new iPadOS 26 window control buttons*, <https://developer.apple.com/forums/thread/790994>). So the drawn size is a typical value, like the safe areas: override it with `windowControls: { width, height }`.
- **44pt minimum hit target:** Apple HIG, *Accessibility* ("a minimum tappable area of 44x44 pt"), <https://developer.apple.com/design/human-interface-guidelines/accessibility>.
- **48dp minimum touch target:** Android Accessibility Help, *Touch target size*, <https://support.google.com/accessibility/android/answer/7101858>.
- **Target size in WCAG:** W3C, *Understanding SC 2.5.8 Target Size (Minimum)*, AA, 24px with spacing and inline exceptions, <https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html>. W3C, *Understanding SC 2.5.5 Target Size (Enhanced)*, AAA, 44px, <https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html>. The canvas defaults to the stricter platform minimums.
- **Toolbar composition:** the rules in [`shared/composition/principles.md`](../composition/principles.md). Apple HIG, *Toolbars* (group by function and frequency, at most three groups, overflow into a menu as the window narrows), <https://developer.apple.com/design/human-interface-guidelines/toolbars>. Nielsen Norman Group, *Progressive Disclosure* (rare settings such as the canvas colours go to a secondary place), <https://www.nngroup.com/articles/progressive-disclosure/>, and *Visual Hierarchy in UX* (one emphasis; if everything is contrasted, nothing stands out), <https://www.nngroup.com/articles/visual-hierarchy-ux-definition/>.
- **Grip keys:** W3C WAI-ARIA Authoring Practices, *Slider pattern* (arrows, Page Up/Down, Home/End), <https://www.w3.org/WAI/ARIA/apg/patterns/slider/>. The Preview menu and the Frame size and Zoom folds follow the *Disclosure pattern*, <https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/>.
- **Visible focus:** W3C, *Understanding SC 2.4.7 Focus Visible*, <https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html>, and *Understanding SC 2.4.13 Focus Appearance* (AAA: a 2px outline with 3:1 contrast), <https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html>. Focus in a segmented group draws a 2px ring with a gap in the toolbar colour, above its neighbours.
- **Shortcuts:** W3C, *Understanding SC 2.1.4 Character Key Shortcuts*, <https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts.html>. Zoom shortcuts all take Ctrl or ⌘; the single-key `?` is ignored in text fields and inside the screen, so it never takes a keystroke the design needs.
- **The Text 200% toggle:** W3C, *Understanding SC 1.4.4 Resize Text*, text resizable to 200% without loss of content or function, <https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html>.
- **The 320px reflow check:** W3C, *Understanding SC 1.4.10 Reflow*, content usable at 320 CSS px wide without two-way scrolling, <https://www.w3.org/WAI/WCAG22/Understanding/reflow.html>.
