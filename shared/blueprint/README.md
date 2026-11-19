# Blueprint: a greybox before the full design

A blueprint is the section map of a design written as a file: its screens, the sections
on each screen, each section's one job, and its members with their real words. The
`greybox.mjs` generator turns it into a greybox screen on the shared canvas. The greybox
uses grey blocks, labels each section with its name and job, shows the real text, makes the
one emphasis visible, and resizes across every preset. The owner can comment on what goes
where, in what order and in which words, before any time goes into the look.

**Why.** A rough prototype is cheap to change, and people are more willing to criticise
it: they "may better understand that you are indeed testing the design and not them … and
be more likely to express negative reactions" (Pernice 2016). The greybox is built on the
composition rules in [shared/composition/principles.md](../composition/principles.md):
one job per section (SEC-1), at most one emphasis per section (SEC-5), frequent members
in view and rare ones behind More (SEC-8), and chrome that recedes behind the work
(SCR-1). It shows those decisions without the theme's colours getting in the way.
Sources: [sources](#sources).

## Files

| File | What it is |
| --- | --- |
| `greybox.mjs` | The generator. Checks a blueprint and writes a `screen.html` that follows the [canvas screen contract](../canvas/README.md#screen-contract). Node 18+, no dependencies. |
| `example/blueprint.json` | A small four-screen shopping-list app ("Pantry") with tabs, a back stack, a sheet, a secondary pane, rare actions and an empty state. |
| `parts.mjs` | The parts sheet generator: a canvas page of the components a design will use, in their states. See [Parts sheet](#parts-sheet). |
| `parts-example/` | A trail log's `parts.json` and `THEME.md`. |

## Build it

Pass `--blueprint` to the canvas build in place of `--screen`:

```sh
node <plugin>/shared/canvas/build.mjs \
  --presets <plugin>/skills/mobile/references/presets.md \
  --blueprint blueprint.json --out index.html
```

The build:

- fails with the blueprint's errors, and prints its warnings;
- takes the State picker's states from the blueprint when the config doesn't set `states`;
- titles the page `Blueprint · <title>` (from `--title`, the config, or the blueprint's
  `title`), so the browser tab, the window title bar and the notes all say it is a
  blueprint;
- shows a **Blueprint** tag and "not the final look" in the bar under the toolbar, with
  what to comment on in its tooltip and, in a large enough window, on a line beside it.

Notes work as they do on any canvas. Section ids are `<screen>-<section name>`, so a
note's anchor reads like `#lists-your-lists …`. Because of the title prefix, blueprint
notes are kept apart from the notes on the full design.

**Concepts as greyboxes.** In a `--concepts` file, give each concept a `blueprint` in
place of `screen`: `{ "id": "a", "label": "…", "position": "…", "blueprint": "a.json" }`.
All of a file's concepts are blueprints, or none of them is. See
[Concepts side by side](../canvas/README.md#concepts-side-by-side).

**On its own.** `node greybox.mjs blueprint.json --out screen.html` writes the screen,
or prints it to stdout without `--out`. It also exports `check(blueprint)`, which returns
`{ errors, warnings }`, and `greybox(blueprint)`.

## Format

```json
{
  "title": "Pantry",
  "states": ["default", "empty"],
  "screens": [
    {
      "id": "lists",
      "title": "Lists",
      "sections": [
        { "name": "Header", "job": "Say which screen this is", "role": "chrome", "place": "top",
          "members": [{ "kind": "title", "text": "Lists" }] },
        { "name": "Your lists", "job": "Open the list you're shopping from", "role": "content",
          "members": [
            { "kind": "list", "items": [{ "text": "Weekend shop", "meta": "12 items · 4 left", "nav": "list" }] },
            { "kind": "button", "text": "New list", "emphasis": true }
          ] }
      ]
    }
  ]
}
```

### Blueprint

| Field | Meaning |
| --- | --- |
| `title` | The app or flow's name. The page is titled `Blueprint · <title>`. |
| `states` | Optional. State ids for the State picker, such as `["default", "empty", "error"]`. |
| `screens` | The screens, in order. The canvas opens on the first one. |

### Screen

| Field | Meaning |
| --- | --- |
| `id` | Letters, digits and dashes. Used by `nav` and the Go to picker. |
| `title` | The screen's name in the Go to picker. |
| `sections` | The screen's sections, in reading order. |

### Section

| Field | Meaning |
| --- | --- |
| `name` | Shown in capitals on the block. Unique on its screen. |
| `job` | The one thing the section is for, in a short phrase ("Tick items off while shopping"). It is shown next to the name. A job written as two sentences or with a semicolon gets a warning. |
| `role` | `chrome` (bars, tabs, rails: the frame around the work) or `content` (the work itself). Chrome is drawn as a filled grey band, and content as a dashed outline. |
| `place` | Chrome only: `top`, `bottom` or `side`. Top and bottom bars stick to the screen's edges. |
| `compactPlace` | `side` chrome only: where it goes below 600px, `top` or `bottom` (the default). |
| `pane` | Content only: `primary` (the default) or `secondary`. The secondary pane sits beside the primary one from 840px, and below it when narrower. |
| `states` | Optional. Show the section only in these states (for example an empty state in place of the list). |
| `members` | What the section holds, **most used first**. |

### Member

Every member has a `kind`. Use the real words the design will show: the checks warn on
"Lorem ipsum", "Button", "Item 1" and similar filler.

| Kind | Fields | Draws |
| --- | --- | --- |
| `title` | `text` | A heading. The first on a screen is its `h1`. |
| `text` | `text` | A paragraph of body copy. |
| `stat` | `text` (the value), `label` | A value with its label. |
| `list` | `items`: strings, or `{ text, meta, nav }` | Rows. A row with `nav` is a tappable row with a chevron. |
| `button` | `text` | A button. |
| `field` | `label`, and `text` (a value) or `placeholder`; `multiline` | A labelled text field. |
| `toggle` | `label`, `on` | A labelled switch. |
| `image` | `text` (what it shows), `ratio` such as `"4:3"` | A grey block at that ratio, with the text inside. |
| `nav` | `items`: `{ text, nav }` | Tabs or a rail. The item for the current screen is marked current. |

These fields work on any kind:

| Field | Meaning |
| --- | --- |
| `emphasis` | `true` on **at most one** member per section: the thing most people come to do. An emphasised button is filled in solid; any other emphasised member gets a heavy outline. A second emphasis in a section is an error. |
| `rare` | `true` puts the member behind a **More** menu at the end of the section. In a bar, More opens as a small menu. |
| `nav` | On a `button`, `image` or `stat`: the id of the screen it opens. List and nav items take `nav` too. |
| `back` | `true` on a `button`, `image` or `stat`: goes back a screen, like a Back, Cancel or Done button. |

### How screens link

`nav` pushes a screen, `back` pops one, and `nav` items (tabs) replace the current screen
rather than stacking. Every `nav` must name a screen in the file. A screen after the first
that nothing links to gets a warning, since nobody could reach it.

## Layout

The generator lays the sections out the same way for every blueprint, using container
queries on the canvas viewport, so the greybox holds at every preset:

| Width | Layout |
| --- | --- |
| Under 600px | One column. `side` chrome moves into the top or bottom bar (`compactPlace`). |
| 600px and up | `side` chrome becomes a rail beside the content. |
| 840px and up | A `secondary` pane sits beside the primary one (2:3). Without one, the content is capped at 60rem and centred. |

- The top and bottom bars stick to the screen's edges. Below 480px of height, and at
  200% text, they scroll with the content so they never cover most of the screen.
- The bars respect the safe areas and, in iPad split view, the window controls.
- Text is sized in rem and grows with the canvas's 200% text toggle. Controls are at least
  44px.
- The greys come from `light-dark()`, so the Light/Dark toggle works. No theme colour is
  used, so the greybox can't be mistaken for the final look.

## Parts sheet

`parts.mjs` builds a canvas page of every component a design will use, before the full design is drawn. Each part is either **reused** from the theme's component inventory (the `## Components` table in `design/THEME.md`) or proposed **new**. Each part is shown in each of its states, with one line on why the design needs it. The owner comments on it like any canvas design, and once they approve it the new parts join the theme's inventory.

```sh
# With the theme: the head file from shared/theme/css.mjs --style
node shared/blueprint/parts.mjs design/parts.json --inventory design/THEME.md \
  --head theme.html --presets skills/mobile/references/presets.md --out parts/index.html

# No theme yet: neutral stand-in roles that keep the non-negotiables in shared/theme/rules.md
node shared/blueprint/parts.mjs design/parts.json --presets skills/mobile/references/presets.md --out parts/index.html

# Only check parts.json
node shared/blueprint/parts.mjs design/parts.json --check
```

| Option | Means |
|---|---|
| `--inventory <THEME.md>` | The theme's component inventory. Defaults to `inventory` in parts.json, relative to that file. |
| `--head <theme.html>` | The theme's custom properties, passed on to `build.mjs --head`. A head that declares `--color-surface` counts as a theme; without one the sheet draws with the neutral fallback. |
| `--presets`, `--title`, `--out` | Passed on to `shared/canvas/build.mjs`. |
| `--work <dir>` | Where `parts.screen.html` and `parts.config.json` go (default: the folder of `--out`). |
| `--no-build` | Write those two files and stop. |
| `--check` | Check parts.json and stop. |

Problems stop the build and are listed one a line. Warnings print but don't stop it.

### parts.json

`parts-example/` is a small one: a trail log with two new parts and two reused from its `THEME.md`.

```json
{
  "title": "Trail log · parts",
  "inventory": "THEME.md",
  "states": ["default", "pressed", "focus", "disabled"],
  "css": ".label-type { font-size: var(--type-label-font-size); }",
  "parts": [
    {
      "name": "Button",
      "variant": "primary",
      "status": "reused",
      "why": "Saves the hike at the end of the log form.",
      "usedIn": ["Log hike"],
      "html": "<button class=\"btn\" type=\"button\" {{attrs}}>{{text}}</button>",
      "text": "Save hike",
      "long": "Save hike and share it with the group",
      "css": ".btn { background: var(--button-primary-bg, var(--color-primary)); } .btn:active { … }"
    }
  ]
}
```

Top level:

| Field | Means |
|---|---|
| `title` | The sheet's heading and page title. |
| `inventory` | Path to `THEME.md`, relative to parts.json. |
| `states` | The states a part shows when it doesn't list its own. Default: `default`, `hover`, `pressed`, `focus`, `disabled`. |
| `css` | Styles shared by every part, such as a type-role class. |
| `parts` | The parts, in any order. The sheet shows new parts first, then reused ones. |

Each part:

| Field | Means |
|---|---|
| `name` | Required. For a reused part, the inventory's component name unless `component` gives it. |
| `status` | Required: `reused` or `new`. A reused part must be in the inventory. A new part that has the name of an inventory component gets a warning: reuse the component unless it can't do the job. |
| `why` | Required. One line on why the design needs this part. |
| `html` | Required. A snippet that draws the part, with the placeholders below. |
| `css` | The part's styles. They may use theme custom properties only: a raw colour is a problem (NN-1), and raw spacing or px type gets a warning (NN-1, NN-2, NN-6). |
| `id` | The screen id is `part-<id>`. Default: the name in lowercase with dashes. |
| `component`, `variant` | The inventory component and the variant used. A variant the inventory doesn't list gets a warning, because it is a theme change. |
| `usedIn` | The screens that use it. |
| `size` | `fit` (default): the states sit side by side. `full`: each state takes the full width, as a list row does. |
| `text` | The usual text, which fills `{{text}}`. |
| `long` | The longest plausible text, used by the `long` state. Without it, a part that has `{{text}}` gets a warning. |
| `error` | The error message, which fills `{{message}}` in the `error` state. Setting it adds the `error` state. |
| `states` | The part's own states, in place of the top-level list: an array of ids, or an object of id → overrides. |

Placeholders in `html`: `{{text}}` and `{{message}}` are escaped. `{{attrs}}` is inserted as written. `{{uid}}` is unique to each copy the sheet draws, so a field can be tied to its label and message: `<label for="{{uid}}">…<input id="{{uid}}" aria-describedby="{{uid}}-msg">`. `{{#key}}…{{/key}}` is kept only when that value isn't empty, as in `{{#message}}…{{/message}}`. Any other placeholder is a problem.

### States

| Id | Shows it by |
|---|---|
| `default` | Nothing added. |
| `hover` | Forcing `:hover`. |
| `pressed` | Forcing `:hover` and `:active`. |
| `focus` | Forcing `:focus`, `:focus-visible` and `:focus-within`. |
| `disabled` | `{{attrs}}` = `disabled`. |
| `error` | `{{attrs}}` = `aria-invalid="true"` and `{{message}}` = `error`. |
| `long` | `{{text}}` = `long`. |

A state override can set `label`, `force` (`"hover"`, `"active"`, `"focus"`, or several separated by spaces), `attrs`, `html`, `text`, `message` and `note`, a line shown under that state. Any other id is a state of your own, such as a level or variant: `"hard": { "attrs": "data-level=\"hard\"", "note": "…" }`. It shows on the part's screen only, not in the canvas's State picker.

A forced state is real CSS. The sheet rewrites each selector in the parts' styles so that `:hover`, `:active` and `:focus*` also match an element marked `data-pt-hover`, `data-pt-active` or `data-pt-focus`, or one that contains that element. Write the part's styles as you would in the app. The forced element is the one marked `data-pt-target` in the snippet, else its first focusable element, else its first element. Real pointer and keyboard input still work.

### Theme or no theme

With `--head`, every `var(--…)` must be a property the theme declares. A var with a fallback, such as `var(--chip-bg, var(--color-surface))`, gets a warning when the theme lacks it.

Without a theme the sheet sets neutral grey stand-ins on `:host` for these roles:

- `--color-surface`, `-surface-raised`, `-on-surface`, `-on-surface-variant`, `-outline`, `-primary`, `-on-primary`, `-primary-container`, `-on-primary-container`, `-error`, `-on-error`, `-focus-ring`
- `--space-inset-tight`, `-inset`, `-inset-loose`, `-gap-related`, `-gap-group`, `-gap-section`
- `--radius-control`, `-container`, `-pill`
- `--focus-width`, `--focus-offset`
- `--motion-duration-feedback`, `-move`, `--motion-easing`
- `--type-{headline,title,body,label}-{font-family,font-size,font-weight,letter-spacing,line-height}`

They keep the non-negotiables: the required roles in both schemes with measured contrast, 8-point spacing, rem type and a 2px focus ring. A component token can't exist yet, so give it a role as its fallback: `var(--button-primary-bg, var(--color-primary))`. That draws now and picks up the theme's token later.

### The sheet

- **All parts** (`parts`) groups the parts as new or reused. Each card shows the part in the state chosen in the canvas's State picker, or "No … state" when the part doesn't have that state.
- One screen per part (`part-<id>`, titled `<name> · new` or `<name> · reused`) shows every state side by side, then the part's facts. A reused part lists its variants, tokens and file from the inventory. A new part lists the theme roles it uses, grouped by family, in a closed section.
- Moving between screens puts focus on the new screen's heading, or back on the card the part was opened from.

Canvas notes name the part. On a part's screen, `where` starts with the screen title, `Button · reused`, and the selector names the state cell, `#button--pressed > button`. On the overview, a pin lands on the part's card, `li.pt-card "Trail row, new part"`. The state in `where` is the canvas's State picker; on a part's screen, the cell id in the selector (`--pressed`) is the state the pin is on.

## Sources

- **Pernice 2016:** Kara Pernice, "UX Prototypes: Low Fidelity vs. High Fidelity",
  Nielsen Norman Group, 18 December 2016. It finds low-fidelity prototypes cheap to change
  ("Ripping up a prototype is not [expensive]"). It says they "put less pressure on
  users", who become "more likely to express negative reactions".
  https://www.nngroup.com/articles/ux-prototype-hi-lo-fidelity/
- The section and screen rules (SEC-1, SEC-5, SEC-8, SCR-1) and their sources are listed in
  [shared/composition/principles.md](../composition/principles.md#sources).
