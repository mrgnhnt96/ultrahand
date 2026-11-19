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

## Sources

- **Pernice 2016:** Kara Pernice, "UX Prototypes: Low Fidelity vs. High Fidelity",
  Nielsen Norman Group, 18 December 2016. It finds low-fidelity prototypes cheap to change
  ("Ripping up a prototype is not [expensive]"). It says they "put less pressure on
  users", who become "more likely to express negative reactions".
  https://www.nngroup.com/articles/ux-prototype-hi-lo-fidelity/
- The section and screen rules (SEC-1, SEC-5, SEC-8, SCR-1) and their sources are listed in
  [shared/composition/principles.md](../composition/principles.md#sources).
