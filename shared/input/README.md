# shared/input

`drive.mjs` uses a page the way a person does. It sends trusted mouse, wheel, keyboard and touch events through the Chrome DevTools Protocol. The browser then does what it does for a person: hit testing, focus, default actions, scroll chaining and gestures. A synthetic `element.dispatchEvent(new MouseEvent(…))` or `el.click()` skips all of that. A button covered by an overlay still "works", a wheel never reaches the outer scroller, and Space never pans. That is how real bugs pass a review, so the review skill uses this driver (or another real-input tool) and never synthetic events.

It needs Node 22+ and Google Chrome or Chromium, and nothing else.

The commands below run from the repository root. From the installed plugin, the script is
`${CLAUDE_PLUGIN_ROOT}/shared/input/drive.mjs`.

## Use

```sh
# A session: open once, send as many batches as you like, close.
node shared/input/drive.mjs open shared/canvas/canvas.html --size 1280x800
node shared/input/drive.mjs do '[{"controls":true}]'
node shared/input/drive.mjs do steps.json --out shots
node shared/input/drive.mjs close

# One shot: open, run the steps, close.
node shared/input/drive.mjs run page.html steps.json --size 1440x900 --out shots
```

| Command | Options |
| --- | --- |
| `open <url or file>` | `--size WxH` (default 1280x800), `--zoom` (`2` or `200%`, as the `zoom` step), `--scheme light\|dark` (as the `scheme` step), `--port` (default 9333), `--headed` to watch, `--chrome <path>` (or `CHROME_PATH`) |
| `do <steps>` | Steps as a JSON file, inline JSON, `-` for stdin, or a `.mjs` steps script (see [Steps files](#steps-files)). `--port`, `--out <dir>` for screenshots, `--sections <selectors>` for the composition audit |
| `close` | `--port` |
| `run <url> <steps>` | All of the above |

`open` starts Chrome headless with a throwaway profile. Every step prints one JSON line. A failed step stops the batch unless it has `"optional": true`, and the exit code is 1 when any step failed.

Each line echoes its step. A string in it longer than 160 characters is cut to its start and its length, so a long `eval` doesn't fill the output. A step with `"quiet": true` prints only `i`, the step, `ok` and any `error`, `warning` or `pageErrors`; a steps script still gets the whole result back.

Headless Chrome takes `prefers-color-scheme` from the OS appearance, so on a Mac set to Dark the page sees `dark`, and a page that follows the scheme renders dark. Set it with `--scheme` or the `scheme` step, and check both.

## Targets

| Form | Meaning |
| --- | --- |
| `"#save"`, `"button.primary"` | A CSS selector. It searches the document and every open shadow root, and prefers a visible match. |
| `"@3"` | Control 3 from the last `controls` step. |
| `"text=Save"` | An interactive element whose accessible name or text is "Save". |
| `[x, y]` | A point in the viewport. |

Before acting, the driver scrolls the target into view if a scroller clips it, as a person would, then aims at the middle of its visible part.

## Steps

Each step is an object whose first key is the verb.

| Step | Example | Does |
| --- | --- | --- |
| `size` | `{"size":[1024,768]}` | Resizes the browser window so the viewport is that size. Headless windows stop at about 500px wide, so a smaller size is emulated: the result says `emulated`, and a small helper process keeps it for the rest of the session, across `do` calls, until the next `size` step or `close`. The same process keeps `zoom` and `scheme`. |
| `zoom` | `{"zoom":2}` or `{"zoom":"200%"}` | Browser page zoom, 25% to 500%. The window keeps its size and the CSS viewport shrinks to 1/zoom of it, with `devicePixelRatio` at the zoom, which is how Chrome lays out and draws a zoomed page: at 200% a 1280x800 window is a 640x400 CSS viewport, and at 400% it is 320x200. The result gives `cssViewport`. `shot` saves the window's size in device px, as a screenshot of the zoomed window would. Zoom stays across `size` steps and `do` calls, as browser zoom does, until a `{"zoom":1}` or `close`. |
| `scheme` | `{"scheme":"light"}`, `"dark"` or `"none"` | Emulates `prefers-color-scheme`. `none` follows the OS again. It stays until changed or `close`. |
| `goto` | `{"goto":"other.html"}` | Navigates. It waits up to 10s for the page's load event. |
| `controls` | `{"controls":true}` | Lists every visible interactive element as `@n` refs, with name, centre, size, and whether it is in view, covered by something else, or disabled. |
| `inspect` | `{"inspect":".uh-viewport"}` or `{"inspect":true}` | Measures the layout in place of reading screenshots: every visible text's box, font size/weight, colour, the colour behind it and the WCAG contrast ratio, plus each control's size and the tab order. It prints the issues found, and with `--out` saves everything to `<out>/inspect-<name or WxH>.json`. A selector limits it to that element (a canvas screen is `.uh-viewport`, which leaves out the toolbar and grips); `true` takes the whole page. `min` sets the target size to check (default 24); `all: true` prints every element too. See [inspect](#inspect). |
| `click` | `{"click":"@4","button":"right","count":2,"mods":["Shift"]}` | Moves the mouse there and presses. `button` is `left`, `right` or `middle`. |
| `hover` | `{"hover":"text=Info"}` | Moves the mouse there. |
| `drag` | `{"drag":"[aria-label=Width]","to":{"dx":-120,"dy":0},"cancel":"Escape"}` | Press, move in steps, release. `to` is a target or `{dx,dy}`. `hold` keeps a key down for the drag (`"Space"` to pan). `cancel` presses a key before release. `button` as for click. |
| `wheel` | `{"wheel":"#list","dy":600,"mods":["Ctrl"]}` | Mouse wheel over the target, in 100px ticks (`ticks` to change). |
| `key` | `{"key":"Shift+Tab","repeat":3}` | A key or combo: `Ctrl+=`, `Cmd+0`, `Escape`, `ArrowDown`, `F6`. `Mod` is Cmd on macOS and Ctrl elsewhere, and `Option` is Alt. On macOS, editing shortcuts in a text field run the editor command a person's keypress would (`Cmd+A` select all, `Cmd+C`/`X`/`V`, `Cmd+Z`, `Cmd+Shift+Z`, `Cmd`/`Option` + arrows, `Option+Backspace`), and the result names it as `command`. A shifted character is typed with Shift as on a US keyboard: `Shift+/` and `?` both press Shift and Slash and give `?`, `Shift+1` gives `!`, and `Ctrl++` is Ctrl+Shift+=. When the keydown's `key` differs from the combo as written, the result gives it as `eventKey`. On another layout, use `type` for text. |
| `type` | `{"type":"Hello\n"}` | Types text into the focused element. `\n` presses Enter. |
| `choose` | `{"choose":"#size","text":"Large"}` or `{"choose":"#size","value":"l"}` | Picks an option of a native `<select>`: it focuses the select and types the option's text, the keyboard type-ahead a person can use. `input` in the result says how it went: `keyboard`, or `script` with a `warning` when type-ahead couldn't reach the option (a multiple select, say) and the value was set by script with `input` and `change` events. That part is not real input. `text` matches the whole text first, then a part of it, and skips disabled options, options in a disabled `<optgroup>` and hidden ones, as a person can't pick those: `"Apple"` picks "Apple crumble" when "Apple" is disabled. Naming a disabled or hidden option exactly, or by `value`, fails and says so. A custom listbox isn't a `<select>`: use click and key steps. |
| `tap` | `{"tap":"@2","hold":600}` | A touch tap. `hold` in ms makes it a long press. |
| `touchScroll` | `{"touchScroll":"#list","dy":400}` | A touch swipe that scrolls the content by `dx`/`dy`. |
| `pinch` | `{"pinch":"#stage","scale":1.5}` | A trackpad pinch at the target. |
| `wait` | `{"wait":300}` or `{"wait":"text=Saved"}` | Waits some ms, or up to 5s for a target. |
| `eval` | `{"eval":"document.title"}` | Reads a value from the page: an expression, or statements, whose value is the last statement's, as in the console (`const n = list.children.length; n * 2`). `await` and `return` work. `__uhDrive.resolve(target)` finds an element by any target form above, through shadow roots (a canvas screen is in one). Use it to check state after real input, never to cause it. |
| `shot` | `{"shot":"after-resize"}` | Saves `<out>/<name>.png`. |

## Steps files

A `do` or `run` takes the steps in one of four forms.

- **JSON:** a `.json` file, or the array inline.
- **Heredoc:** `-` reads the JSON from stdin, which saves escaping quotes in the shell:

  ```sh
  node shared/input/drive.mjs do - <<'EOF'
  [{"click":"text=Save"}, {"eval":"const s = __uhDrive.resolve('#status'); s.textContent"}]
  EOF
  ```

- **A steps script exporting an array:** for steps you'd rather build with code.

  ```js
  // steps.mjs
  const sizes = [[1440, 900], [1024, 700], [640, 480]];
  export default sizes.flatMap(([w, h]) => [{ size: [w, h] }, { controls: true }, { shot: `${w}` }]);
  ```

- **A steps script exporting an async function:** for steps that depend on earlier
  results. The function gets one method per verb. `ui.click('@3', { button: 'right' })`
  runs `{"click":"@3","button":"right"}`, prints its line as usual, and returns it. A
  failed step throws and ends the script, unless it has `optional: true`.

  ```js
  // steps.mjs
  export default async function (ui) {
    const { controls } = await ui.controls();
    for (const c of controls.filter((c) => c.control.startsWith('select'))) {
      await ui.choose(c.ref, { text: 'Large', optional: true });
    }
    const { value } = await ui.eval('__uhDrive.resolve("#total").textContent');
    if (value === '') await ui.shot('empty-total');
  }
  ```

## What can't be driven

A few native controls draw outside the page, in UI that headless Chrome doesn't have, so
trusted input can't reach them:

- **A select's popup.** Pick the option with `choose`, which types its text into the closed
  select. A select's arrow keys open the popup on macOS instead of changing the value.
- **File pickers.** List the upload under *Not checked*, or test the page's drop target with
  `drag`.
- **Colour and date pickers** (`<input type="color">`, `type="date"` and its kin). Type into
  a date field's segments with `key` and `type` where it has them, and list the picker
  itself under *Not checked*.

When `choose` reports `input: "script"`, the option was set by script. Say so in the
review rather than counting it as checked with real input.

## What each result tells you

- **`hit` / `topmost`**: what is actually under the pointer at the target's centre. `hit: false` comes with a `warning`, because a person's click lands on `topmost`, not on the control.
- **`scrolled`**: every scroller that moved, with `dx`/`dy`. It is how you see scroll chaining. A wheel over an inner list should move the list, and once the list is at its end, the next scroll should move its parent. If nothing moves, or only the inner list moves while the outer page should, that is a finding.
- **`focus`**: the focused element after the step, read through shadow roots. Tab order and focus return show here.
- **`pageErrors`**: uncaught exceptions and `console.error` output raised during the step.
- **`scrolledIntoView`**: the target was out of view first.

## inspect

One `inspect` answers the checks that need numbers, at the size, zoom and scheme in effect, in about a second. `issues` lists, worst first:

| `kind` | Means |
| --- | --- |
| `contrast` | Text under its WCAG 1.4.3 ratio: 4.5, or 3 for large text (24px, or 18.66px bold). Grouped by colour pair, with `n` elements and up to three `eg`. Opacity, translucent colours and every gradient stop are counted; the worst stop wins. Placeholders count; disabled text doesn't. |
| `field-edge` | A field (input, select, textarea, a checkbox or switch role) whose fill, border and shadow all reach under 3:1 against what surrounds it (1.4.11). |
| `target` | A control under `min` in CSS px (the canvas zoom doesn't change it). `wcag` gives the 2.5.8 verdict at 24px: `pass`, `pass by spacing` (a 24px circle on its centre touches no other target), or `fail` naming the neighbour. A link inside a sentence is exempt and skipped. |
| `cut` | Text clipped by its own hidden overflow (`by: "itself"`, an ellipsis or line clamp) or by an ancestor's, with `px` lost. |
| `offscreen` | Text past the window's side with nothing to scroll it into view: a reflow failure (1.4.10). `pageOverflowX` says the page itself scrolls sideways. |
| `covered` | Something else is on top of the text's middle. With a selector, only things inside it count. |
| `overlap` | Two texts, neither inside the other, drawn over each other. |
| `tabindex`, `focus-up` | A positive tabindex, and a Tab step that jumps up the page: right when it starts a new column, wrong within one. |

`focusOrder` is what Tab visits, `"n name @x,y"`, through shadow roots, with one stop per radio group. `counts` sums it up. `scale` appears when the page is zoomed by a transform, as a canvas frame is, so the boxes are in screen px and `target` sizes are in CSS px.

What it can't tell you, so look or compute yourself:

- **Text on an image** (`url()`, `image-set`) is listed under `unresolved`, with no ratio. So is anything whose background comes from an element that isn't an ancestor (a sibling laid underneath, an overlay): it is measured against the ancestor's background.
- **Icons and graphics** (SVG, icon fonts with no text) get no contrast check; 1.4.11 still applies to them.
- **Focus indicators** only show on focus: Tab to a control, then `inspect` or `shot`.
- **A hit area grown with a pseudo-element** or padding outside the box isn't counted, so a `target` flag there needs a look.
- **Composition**: hierarchy, grouping, alignment and whether it looks right still need a screenshot.

## Recipes

Use every control at several sizes. Inventory first, then use each `@n` the way its kind is meant to be used (click a button, type in a field, drag a slider, pick a select's option with `choose`). Then do it again at the next size:

```json
[{"size":[1440,900]}, {"controls":true}, {"click":"@0"}, {"key":"Escape"}, {"shot":"1440"},
 {"size":[1024,700]}, {"controls":true}, {"shot":"1024"},
 {"size":[640,480]},  {"controls":true}, {"shot":"640"}]
```

Look for a control that is `covered`, missing from the list at one size, or no longer `inView` with no way to reach it.

Measure instead of looking. On a canvas, set each frame size, then 200% text and dark mode, and inspect the screen each time. The frame size, not the window, is what the design sees, and the screen's scheme follows `setScheme`, not the `scheme` step:

```json
[{"eval":"ultrahandCanvas.setSize(1440, 900)"}, {"wait":100}, {"inspect":".uh-viewport","name":"1440"}, {"shot":"1440"},
 {"eval":"ultrahandCanvas.setSize(640, 480)"}, {"wait":100}, {"inspect":".uh-viewport","name":"640"},
 {"eval":"ultrahandCanvas.setTextScale(2)"}, {"wait":100}, {"inspect":".uh-viewport","name":"640-text200"},
 {"eval":"ultrahandCanvas.setTextScale(1); ultrahandCanvas.setScheme('dark')"}, {"wait":100}, {"inspect":".uh-viewport","name":"640-dark"}]
```

For a page that isn't a canvas, use `size`, `zoom` and `scheme` steps with `{"inspect":true}`. Read each line's `issues`; open the saved JSON only when you need one element's numbers.

Scroll chaining. Scroll an inner list past its end and check that the outer scroller takes over:

```json
[{"wheel":"#list","dy":3000}, {"wheel":"#list","dy":400}]
```

The second result's `scrolled` should name the outer scroller. If it is empty, something (often `overscroll-behavior: contain`) is trapping the wheel.

Canvas overscroll. Pan past each edge, then recentre:

```json
[{"wheel":"#stage","dy":5000}, {"shot":"bottom"}, {"wheel":"#stage","dx":5000}, {"shot":"right"},
 {"drag":"#stage","to":{"dx":300,"dy":300},"hold":"Space"}, {"key":"Ctrl+Shift+1"}, {"shot":"fit"}]
```

Keyboard only:

```json
[{"key":"Tab","repeat":12}, {"key":"Shift+Tab"}, {"key":"Enter"}, {"key":"Escape"}]
```

Each line's `focus` gives the tab order. Any line where focus lands on `body` mid-page is a lost focus.

Page zoom and colour scheme. Zoom a 1280-wide window to 200% and 400% in each scheme:

```json
[{"scheme":"light"}, {"zoom":2}, {"controls":true}, {"shot":"light-200"}, {"zoom":4}, {"shot":"light-400"},
 {"scheme":"dark"}, {"shot":"dark-400"}, {"zoom":2}, {"shot":"dark-200"}, {"zoom":1}, {"scheme":"none"}]
```

At 200% the page has a 640x400 CSS viewport and at 400% a 320x200 one. Look for content cut off, a toolbar that no longer fits, and controls `covered` or out of view.

## Data-state fixtures

A tool's data states are as much a part of it as its default one: nothing loaded, loading, each error, and a very large input. Make one page per state from a build, then open each with the driver. For a canvas page from `shared/canvas/build.mjs`, this script swaps the marked CONFIG and SCREEN regions of the built `index.html`. Save it in a scratch folder, not in the repository:

```js
// fixtures.mjs: node fixtures.mjs <built index.html> <out dir>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [src, out] = process.argv.slice(2);
const page = readFileSync(src, 'utf8');
// Replaces the body of a marked region; a function, so "$" in the body stays literal.
const region = (html, name, body) => html.replace(
  new RegExp(`(<!-- ULTRAHAND:${name}:BEGIN -->)[\\s\\S]*?(<!-- ULTRAHAND:${name}:END -->)`),
  (_, begin, end) => `${begin}\n${body}\n${end}`);
const screen = page.match(/<!-- ULTRAHAND:SCREEN:BEGIN -->([\s\S]*?)<!-- ULTRAHAND:SCREEN:END -->/)[1];
const config = JSON.parse(page.match(/<script type="application\/json" id="uh-config">([\s\S]*?)<\/script>/)[1]);
const configTag = (json) => `<script type="application/json" id="uh-config">\n${json.replace(/</g, '\\u003c')}\n</script>`;

const rows = Array.from({ length: 2000 }, (_, i) =>
  `<li>Row ${i + 1}: ${'a fairly long line of text '.repeat(4)}</li>`).join('');
const presets = Array.from({ length: 60 }, (_, i) => ({ ...config.presets[i % config.presets.length],
  id: `p${i}`, label: `Preset ${i + 1} with a long label to wrap` }));

const fixtures = {
  // Nothing loaded: an empty screen.
  'empty.html': region(page, 'SCREEN', '<template id="uh-screen"></template>'),
  // Error: the config isn't valid JSON.
  'bad-config.html': region(page, 'CONFIG', configTag('{')),
  // Error: the screen's setup throws. A later assignment replaces the screen's own setup.
  'setup-error.html': region(page, 'SCREEN', `${screen}<script>window.ultrahandSetup = () => {
    throw new Error('fixture: setup threw'); };</script>`),
  // Error: no screen at all.
  'no-screen.html': region(page, 'SCREEN', ''),
  // Very large: 60 presets, 40 states, a 120-character title, 2000 rows and an unbroken
  // 300-character word.
  'large.html': region(region(page, 'CONFIG', configTag(JSON.stringify({ ...config, presets,
    states: Array.from({ length: 40 }, (_, i) => `state-${i + 1}`), title: 'T'.repeat(120) }))),
  'SCREEN', `<template id="uh-screen"><main><h1>${'W'.repeat(300)}</h1><ul>${rows}</ul></main></template>`),
};
mkdirSync(out, { recursive: true });
for (const [name, html] of Object.entries(fixtures)) writeFileSync(join(out, name), html);
console.log(Object.keys(fixtures).map((n) => join(out, n)).join('\n'));
```

```sh
node fixtures.mjs index.html fx
node shared/input/drive.mjs open fx/empty.html
for f in empty bad-config setup-error no-screen large; do
  node shared/input/drive.mjs do "[{\"goto\":\"$PWD/fx/$f.html\"},{\"controls\":true},{\"shot\":\"$f\"}]" --out shots
done
```

Each error page shows the canvas's "Canvas problem" alert (`#uh-error`) with its message. Check that it says what went wrong and how to fix it, and that the toolbar still works around it.

**Loading.** The canvas page fetches nothing, so its only loading state is the moment before its runtime script runs. A tool that fetches data has a longer one. Either way, serve the page so the end of it, or the data, arrives late. This server holds back each HTML page from its last `<script>` for 15 seconds:

```js
// slow.mjs: node slow.mjs <dir> [port] [seconds]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, normalize } from 'node:path';

const [dir, port = 8123, secs = 15] = process.argv.slice(2);
createServer(async (req, res) => {
  const path = join(dir, normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  const body = await readFile(path).catch(() => null);
  if (!body) return res.writeHead(404).end();
  if (!path.endsWith('.html')) return res.end(body);
  const text = body.toString('utf8');
  const cut = text.lastIndexOf('<script');
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.write(text.slice(0, cut));
  setTimeout(() => res.end(text.slice(cut)), secs * 1000);
}).listen(port, () => console.log(`http://localhost:${port}/`));
```

Run it in the background with `node slow.mjs . 8123 15`, then `{"goto":"http://localhost:8123/index.html"}` and a `shot`. `goto` stops waiting for the load event after 10 seconds, so the shot shows the page still loading (`document.readyState` is `"loading"`). For a tool that fetches its data, delay the data's URL in the same way instead.
