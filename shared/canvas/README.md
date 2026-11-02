# shared/canvas

The canvas is the resizable harness that every ultrahand design skill renders its screen into. A skill writes a screen and a config, builds one self-contained HTML page with `build.mjs`, and publishes that page as a Claude artifact.

The page gives the viewer:

- **A device frame.** Phone, tablet (with split view), desktop window, or bare. Drag handles on the left, right, bottom and corner edges resize it live. The handles move by 1px with the arrow keys, or 10px with Shift + arrow.
- **A readout.** It shows the width and height (both editable), the width and height size class, the active preset, and flags such as "at min width" or "3 targets under 44px".
- **Preset buttons.** These come from the platform skill's presets, grouped by platform, plus extra checks such as a 320px reflow pass. Rotate swaps the orientation, including safe areas.
- **Review toggles:**
  - Light / Dark
  - Text 100% / 200%
  - a State picker (default, loading, empty, error…)
  - Tap targets, which outlines every interactive element and marks any that are under the platform minimum
  - Fit / 100% zoom
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
5. **Publish.** Publish `index.html` as an artifact: `publish_files` with `as: "index.html"`, a title and an icon. For small follow-up changes, use `edit_version` against the published page. Rebuild and republish when the screen changes a lot.

`--head head.html` injects extra `<head>` content, such as a Google Fonts `<link>`. `--presets` also accepts a plain `.json` file.

## Config

All fields are optional except `presets`.

| Field | Meaning |
| --- | --- |
| `title` | Shown in the toolbar, the window title bar and the page `<title>`. |
| `platform` | The toolbar label. Defaults to `device`. |
| `device` | `mobile`, `tablet`, `desktop` or `web`. Picks the default frame: phone, tablet, window or none. |
| `frame` | Forces a default frame: `phone`, `tablet`, `window` or `none`. |
| `presets` | The size buttons. See [Preset fields](#preset-fields) below. |
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
- **Safe areas:** pad edges with `var(--uh-safe-top|right|bottom|left)`. These follow the preset and its rotation.
- **Colour:** use `light-dark(light, dark)` or the system colours (`Canvas`, `CanvasText`). The Light/Dark toggle sets `color-scheme` on the viewport, so both follow it. The viewport also carries `data-scheme="light|dark"` for selectors. Don't use `prefers-color-scheme`, which follows the viewer's OS instead of the toggle.
- **Viewport attributes for selectors:** `data-width-class`, `data-height-class`, `data-orientation`, `data-frame`, `data-platform`, `data-scheme`, `data-state`, `data-text-scale`.

### Behaviour

- **Navigation.**
  - Each `[data-screen]` section is one screen, and `data-title` names it in the Screen picker.
  - `data-nav="id"` pushes a screen onto the back stack. Add `data-nav-replace` for tabs, so they don't grow the stack.
  - `data-nav-back` pops.
  - Scroll position is kept per screen. The canvas doesn't set `aria-current` for you, so mark the selected tab yourself in `onNavigate`.
- **States.** An element with `data-show-state="loading empty"` shows only in those states. Declare the states in the config's `states` field. Retry buttons and the like can call `canvas.setState('loading')`.
- **Tap targets.** Elements that match `button, a[href], input, select, textarea, summary, label[for], [role=button|link|tab|switch|checkbox|radio|menuitem], [data-nav], [data-nav-back]` are measured. Add `data-uh-ignore-target` to inline links in running text, which WCAG 2.5.8 exempts. Call `canvas.refresh()` after opening a sheet or menu, so the count updates.
- **Forms** must call `preventDefault()`. A real submit would navigate the artifact away.

### API (`canvas`, also `window.ultrahandCanvas`)

| Member | Use |
| --- | --- |
| `$(sel)`, `$$(sel)` | Query inside the screen. |
| `root`, `viewport` | The shadow root and the element that holds the screen. |
| `size` | `{ width, height, widthClass, heightClass, orientation, preset, resized, frame, split, scheme, platform, textScale, state, safeArea }`. |
| `onResize(fn)` | Called now and on every size change. Returns an unsubscribe function. |
| `screen`, `navigate(id, {replace})`, `back()`, `onNavigate(fn)` | Navigation. `fn` gets `{ screen, from, depth }`. |
| `state`, `setState(id)`, `onState(fn)` | Screen states. `onState` is called now and on every change. |
| `setSize(w, h)`, `usePreset(id)`, `setScheme('light'\|'dark')`, `setTextScale(n)` | Drive the canvas, for example to open on the case under review. |
| `setStatusBar('light'\|'dark'\|'hidden'\|'auto')` | The status-bar glyph colour over a full-bleed header. |
| `toast(text, ms)` | Feedback in place of `alert()`. |
| `refresh()` | Re-measure tap targets after a DOM change. |

Errors in setup or handlers show in a banner above the canvas instead of failing silently.

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
- **44pt minimum hit target:** Apple HIG, *Accessibility* ("a minimum tappable area of 44x44 pt"), <https://developer.apple.com/design/human-interface-guidelines/accessibility>.
- **48dp minimum touch target:** Android Accessibility Help, *Touch target size*, <https://support.google.com/accessibility/android/answer/7101858>.
- **Target size in WCAG:** W3C, *Understanding SC 2.5.8 Target Size (Minimum)*, AA, 24px with spacing and inline exceptions, <https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html>. W3C, *Understanding SC 2.5.5 Target Size (Enhanced)*, AAA, 44px, <https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html>. The canvas defaults to the stricter platform minimums.
- **The Text 200% toggle:** W3C, *Understanding SC 1.4.4 Resize Text*, text resizable to 200% without loss of content or function, <https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html>.
- **The 320px reflow check:** W3C, *Understanding SC 1.4.10 Reflow*, content usable at 320 CSS px wide without two-way scrolling, <https://www.w3.org/WAI/WCAG22/Understanding/reflow.html>.
