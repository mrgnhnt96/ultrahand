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
| `open <url or file>` | `--size WxH` (default 1280x800), `--port` (default 9333), `--headed` to watch, `--chrome <path>` (or `CHROME_PATH`) |
| `do <steps>` | Steps as a JSON file, inline JSON, `-` for stdin, or a `.mjs` steps script (see [Steps files](#steps-files)). `--port`, `--out <dir>` for screenshots |
| `close` | `--port` |
| `run <url> <steps>` | All of the above |

`open` starts Chrome headless with a throwaway profile. Every step prints one JSON line. A failed step stops the batch unless it has `"optional": true`, and the exit code is 1 when any step failed.

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
| `size` | `{"size":[1024,768]}` | Resizes the browser window so the viewport is that size. Headless windows stop at about 500px wide, so a smaller size is emulated: the result says `emulated`, and a small helper process keeps it for the rest of the session, across `do` calls, until the next `size` step or `close`. |
| `goto` | `{"goto":"other.html"}` | Navigates. |
| `controls` | `{"controls":true}` | Lists every visible interactive element as `@n` refs, with name, centre, size, and whether it is in view, covered by something else, or disabled. |
| `click` | `{"click":"@4","button":"right","count":2,"mods":["Shift"]}` | Moves the mouse there and presses. `button` is `left`, `right` or `middle`. |
| `hover` | `{"hover":"text=Info"}` | Moves the mouse there. |
| `drag` | `{"drag":"[aria-label=Width]","to":{"dx":-120,"dy":0},"cancel":"Escape"}` | Press, move in steps, release. `to` is a target or `{dx,dy}`. `hold` keeps a key down for the drag (`"Space"` to pan). `cancel` presses a key before release. `button` as for click. |
| `wheel` | `{"wheel":"#list","dy":600,"mods":["Ctrl"]}` | Mouse wheel over the target, in 100px ticks (`ticks` to change). |
| `key` | `{"key":"Shift+Tab","repeat":3}` | A key or combo: `Ctrl+=`, `Cmd+0`, `Escape`, `ArrowDown`, `F6`. `Mod` is Cmd on macOS and Ctrl elsewhere, and `Option` is Alt. On macOS, editing shortcuts in a text field run the editor command a person's keypress would (`Cmd+A` select all, `Cmd+C`/`X`/`V`, `Cmd+Z`, `Cmd+Shift+Z`, `Cmd`/`Option` + arrows, `Option+Backspace`), and the result names it as `command`. |
| `type` | `{"type":"Hello\n"}` | Types text into the focused element. `\n` presses Enter. |
| `choose` | `{"choose":"#size","text":"Large"}` or `{"choose":"#size","value":"l"}` | Picks an option of a native `<select>`: it focuses the select and types the option's text, the keyboard type-ahead a person can use. `input` in the result says how it went: `keyboard`, or `script` with a `warning` when type-ahead couldn't reach the option (a multiple select, say) and the value was set by script with `input` and `change` events. That part is not real input. A custom listbox isn't a `<select>`: use click and key steps. |
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

## Recipes

Use every control at several sizes. Inventory first, then use each `@n` the way its kind is meant to be used (click a button, type in a field, drag a slider, pick a select's option with `choose`). Then do it again at the next size:

```json
[{"size":[1440,900]}, {"controls":true}, {"click":"@0"}, {"key":"Escape"}, {"shot":"1440"},
 {"size":[1024,700]}, {"controls":true}, {"shot":"1024"},
 {"size":[640,480]},  {"controls":true}, {"shot":"640"}]
```

Look for a control that is `covered`, missing from the list at one size, or no longer `inView` with no way to reach it.

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
