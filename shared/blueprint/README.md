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
Rough prototypes find usability problems as well as polished ones do: Virzi, Sokolov and
Karis (1996) found "substantially the same sets of usability problems" with low- and
high-fidelity prototypes, and Walker, Takayama and Landay (2002) found them "equally good
at uncovering usability issues". Rudd, Stern and Isensee (1996) weigh both kinds: low
fidelity is cheap and good for comparing concepts and settling the layout, but it is weak
on detail, navigation and flow. That's why the full design still follows, with every
preset, the self-check and the independent review. Sources: [sources](#sources).

## The blueprint stage

The mobile, tablet and desktop skills run this stage after step 3, before they build the
full design. It shows the owner two cheap pages: the **blueprint** (the layout as grey
blocks with the real words) and the **parts sheet** (the components the design will use,
any new ones in their states). The owner comments on them. The full design is built only
from an approved blueprint.

### When

- **Show a blueprint** for every new screen or flow: after the owner picks an explore
  concept, or straight after step 3 when explore was skipped. A spec still gets one. It
  sets the sections, but the blueprint also checks the order, the emphasis, the words and
  any new parts.
- **Skip it** for a correction, notes on a published design, a small change (one
  section or less, such as a moved button, new copy or a colour), any later round of a
  design whose blueprint was approved, and whenever the owner says to go straight to the
  design. Say so in one line: "Went straight to the design: this is a correction to the
  published screen."
- "N options for <section>" isn't this stage. See
  [shared/explore](../explore/README.md#section-options).

### 1. Write blueprint.json

Work in a `blueprint/` folder. Write step 3's section map as `blueprint/blueprint.json`
([format](#format)):

- One `screen` per screen in the flow, with `nav`, `back` and tab `nav` items where the
  flow moves between them.
- Each section keeps the map's name, its one `job`, `role` (chrome or content), and
  `place` for chrome, following the platform: a bottom tab bar on a phone, a `side`
  sidebar or rail on a tablet or desktop.
- Members go in order, most used first. Mark the one `emphasis`, and mark the members
  that belong behind a menu as `rare`.
- `states` come from step 1's data states (empty, error, offline), with the sections
  that only show in them.
- Use the real content from step 1, at its longest plausible length.

After explore with greybox concepts, start from the chosen concept's `blueprint.json`
and fold in what the owner took from the others.

### 2. Write parts.json

List every component the screens use in `blueprint/parts.json`
([format](#partsjson)). **Reuse before you propose** (EV-4 in
[shared/theme/rules.md](../theme/rules.md)):

1. For each component, look in the theme's inventory (`## Components` in
   `design/THEME.md`). Any component there that can do the job is `reused`, with its
   `component` and an existing `variant`.
2. A variant the inventory lacks comes next. It is a theme change, so say why in `why`.
3. A `new` part only when no component or variant can do the job. Its `why` says what
   the inventory's nearest component can't do ("Card isn't tappable").

Draw each part with the theme's custom properties only. Give each new part the states it
has on this platform: `pressed` on a phone, and `hover` and `pressed` where there's a
pointer (tablet and desktop). Add `focus` and `disabled`, `error` for anything that takes
input, and `long` text. With no theme every part is new, drawn on the sheet's stand-in
roles, and the `theme` skill is worth offering.

### 3. Build both

```sh
node "${CLAUDE_PLUGIN_ROOT}/shared/canvas/build.mjs" \
  --presets "${CLAUDE_PLUGIN_ROOT}/skills/<skill>/references/presets.md" \
  --blueprint blueprint/blueprint.json --title "<design name>" --out blueprint/index.html

node "${CLAUDE_PLUGIN_ROOT}/shared/blueprint/parts.mjs" blueprint/parts.json \
  --inventory design/THEME.md --head theme.html \
  --presets "${CLAUDE_PLUGIN_ROOT}/skills/<skill>/references/presets.md" \
  --title "<design name> · parts" --out blueprint/parts.html
```

Leave out `--inventory` and `--head` when there's no theme.

### 4. Check it lightly

The blueprint doesn't go through the independent review. The owner reviews it, as with
explore concepts. The reviewer's method judges a finished design (contrast, targets,
states, platform patterns), and a greybox has none of that yet. Structure and words are
the owner's call. The review gate applies in full to the design built from the
blueprint. Before publishing, check:

- [ ] Both builds finish with no problems. Every warning is fixed, or you can say why it
      stays.
- [ ] Each section has one job and at most one emphasis. Members are ordered by use.
      Every screen can be reached.
- [ ] The words are the real ones, and the longest plausible text is in.
- [ ] Every reused part names an inventory component. Every new part says what the
      inventory can't do.

### 5. Publish and present

Publish `blueprint/index.html` and `blueprint/parts.html` as two artifacts, each with the
capabilities `{ "db": {} }` so the owner's notes reach you. Present both links, then in
a few lines:

- One line on what this is: a greybox of the layout, order and words, not the final look.
- The section map, one line per screen: its sections and the one emphasis.
- The parts: how many are reused, and each new part with its `why`.
- Open questions.
- Ask the owner to comment (Comment or `C`, then pin or drag) or to approve. Say that the
  full design follows their approval.

Then stop and wait for the owner. Don't start the full design until they approve.

### 6. Iterate

When the owner says they left notes, read them from both artifacts with `ArtifactData`
(`list`, collection `uh-notes`, on each URL). Change `blueprint.json` and `parts.json`,
rebuild, and publish to the same two URLs. Repeat until the owner approves. If they
approve with small changes ("looks good, just swap those two"), make the changes and go
on without another round.

### 7. After approval

- **Build the full design from it,** from step 4 of the skill. Keep the approved screens,
  sections, jobs, member order, emphasis, words and navigation. Start each part from its
  approved markup and styles in `parts.json`. When the full design has to depart from
  the blueprint, list each change and its reason when you present.
- **Fold the approved new parts into the theme.** Load the `theme` skill and run its
  evolve flow (step 4). Add each new part to the inventory in `THEME.md` with its
  variants and tokens. Its "Defined in" is `blueprint/parts.json` until the code has it.
  Add any token it needed, bump the minor version and log it in the changelog. With no
  theme, list the new parts as the first components when you offer the `theme` skill.

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

### Anchors

The greybox marks every element with a stable `data-uh` anchor, so the approved design and
the code share names: the screen is `screen`, a section is `screen.section` (the section name
in lowercase with dashes), and a member is `screen.section.kind-n`, where `n` counts that kind
in the section's `members` array, "More" members included. For example `lists.your-lists.button-2`
is the second button of "Your lists" on the `lists` screen. Members carry `data-member="<kind>"` too.
Reordering members of a kind renumbers them, but adding or removing a member of another kind
doesn't. A side section that collapses below 600px is rendered twice with the same anchor; only
one shows at a time. Anchors are invisible. `build.mjs` warns about hand-written screens
that lack them (see the screen contract in `shared/canvas/README.md`).

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

Canvas notes name the part. On a part's screen, `where` starts with the screen title, `Button · reused`, and the selector names the state cell, `#button--pressed > button`. On the overview, a pin lands on the part's card, `li.pt-card "Trail row, new part"`. On a part's screen each state's figure carries `data-note-state`, so a note in it records that state (`cellState`, and its label in `where`), not the canvas's State picker; on the overview, the state in `where` is the State picker's.

## Sources

- **Pernice 2016:** Kara Pernice, "UX Prototypes: Low Fidelity vs. High Fidelity",
  Nielsen Norman Group, 18 December 2016. It finds low-fidelity prototypes cheap to change
  ("Ripping up a prototype is not [expensive]"). It says they "put less pressure on
  users", who become "more likely to express negative reactions".
  https://www.nngroup.com/articles/ux-prototype-hi-lo-fidelity/
- **Rudd, Stern & Isensee 1996:** Jim Rudd, Ken Stern and Scott Isensee, "Low vs.
  high-fidelity prototyping debate", *interactions* 3(1), 76–85, January 1996. It lists
  what each kind of prototype is good for. Low fidelity costs less, can compare several
  concepts and settles screen layout, but it is weak on error checking, detailed
  specification, navigation and flow. High fidelity covers those, at a higher cost.
  https://doi.org/10.1145/223500.223514
- **Virzi, Sokolov & Karis 1996:** Robert A. Virzi, Jeffrey L. Sokolov and Demetrios
  Karis, "Usability problem identification using both low- and high-fidelity
  prototypes", *Proceedings of CHI '96*, 236–243. Over two experiments, "substantially
  the same sets of usability problems were found in the low- and high-fidelity
  conditions". https://doi.org/10.1145/238386.238516
- **Walker, Takayama & Landay 2002:** Miriam Walker, Leila Takayama and James A. Landay,
  "High-fidelity or low-fidelity, paper or computer? Choosing attributes when testing
  web prototypes", *Proceedings of the Human Factors and Ergonomics Society Annual
  Meeting* 46(5), 661–665, 2002. Sketched and HTML prototypes "are equally good at
  uncovering usability issues", on paper or on screen.
  https://doi.org/10.1177/154193120204600513
- **EV-4** (components before variants, variants before new components) is in
  [shared/theme/rules.md](../theme/rules.md), with its sources.
- The section and screen rules (SEC-1, SEC-5, SEC-8, SCR-1) and their sources are listed in
  [shared/composition/principles.md](../composition/principles.md#sources).
