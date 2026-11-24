# Handoff: build to the design, check it fast

An approved design comes with a **spec**, `design/<flow>/spec.json`, that the implementer
builds from: the screens, each screen's sections in order, each section's members with
their real words, the theme component and the theme token for every colour and type style,
the states, and how each section behaves at each size class. The design and the code share
element names, called **anchors** (`lists.your-lists.new-list`). The build is checked by
measuring it against the spec anchor by anchor, in seconds. Screenshots and the full UX
review are kept for the end.

**Why.** Handing a design over as a picture leaves the developer to interpret it, and
handoffs between designers and developers break down: critical details are left out,
edge cases ignored and technical limits overlooked [MAUDET-17]. A shared representation that both sides
treat as the single source of truth helped designers and developers catch more of those
edge cases [ENACT-19]. That study used a live prototype as the shared representation; here
it is the spec plus the shared anchor names. A good spec lists the states of each component, not just its
default look [NNG-SPEC], and handoff tools already tie each design component to the code
component that builds it [FIGMA-CC]. The spec's `component` field does the same, in a file
the code repository keeps. The checks follow the test pyramid: "many more low-level
UnitTests than high level BroadStackTests running through a GUI", because "testing
through the UI like this is slow" [FOWLER-PYRAMID]. So most checking is a fast diff per
section, a little is screenshots, and one full review comes last.

Status: this file sets the format and the rules; the tools that follow them aren't built
yet. Still to come: the generator (`shared/handoff/spec.mjs`), anchors in the greybox and
the canvas build's warning for a missing one, the handoff step in the mobile, tablet and
desktop skills, the one-command check for a web build, and a check path for Flutter and
other non-web stacks. Until the skills have the step, run this stage when the owner asks
for a handoff. Until a stack has its check, tier 1 there is done by hand (see
[Other stacks](#other-stacks)).

## The handoff stage

It runs once the owner approves the full design and someone is going to build it. The
mobile, tablet and desktop skills will run it as a step of their own. Skip it when the design is only being explored or reviewed,
and say so in one line.

### 1. Anchor the design

Every screen, section and member in the approved `screen.html` carries a `data-uh` anchor
([Anchors](#anchors)). Add them as you build the design. Once the greybox writes them and
the canvas build warns on a missing one, start from the greybox's and fix every warning
before writing the spec.

### 2. Write spec.json

Generate it from three inputs. Until the generator exists, write it by hand from the same
three, using the [field tables](#specjson):

- `blueprint/blueprint.json`: screens, section names and jobs, member order, emphasis,
  rare members, navigation and states.
- `blueprint/parts.json`: the theme components and variants the design uses, and which
  parts are new. Each member is matched to one of them.
- A measuring pass over the built design with the driver in `shared/input`, at each
  preset, in light and dark: each anchor's words, computed colours and type, and its box.
  Today's [inspect](../input/README.md#inspect) step measures text colour, the colour
  behind it, font size and weight, and boxes; the generator reads the rest it needs.
  Measured values map back to theme tokens; a value that matches no token is a warning,
  because the design itself used a raw value.

The full design is the source of truth where it departs from the blueprint, since that is
what the owner approved. Write the spec to `design/<flow>/spec.json` in the project, where
`<flow>` is the design's name in lowercase with dashes. Check it into the repository with
the code.

### 3. Build section by section

1. **Parts first.** Map each `component` to its code (the "Defined in" column of the
   inventory in `design/THEME.md`). Build each `new` part as a component, with the states
   from `parts.json`, before any screen uses it.
2. **Then the shell.** Screens and their routes, the chrome sections (bars, tabs, rails)
   and the panes, with their `layout` at every size class. Anchor them and run tier 1 on
   them.
3. **Then the content sections, in spec order,** primary pane before secondary. For each
   section: its members in order, each with its anchor; fixed copy word for word (into the
   project's strings file if it has one); the named component and variant; the named
   tokens, never a raw value; the states it shows in; and its layout per size class.
4. **Check the section** with tier 1 before starting the next one. Fix every miss, or
   record it as a [departure](#departures). Commit.
5. When a screen's sections all pass, run tier 2 for that screen. When the flow is done,
   run tier 3.

A section is the unit the design was planned in, with one job and one emphasis (SEC-1 and
SEC-5 in [shared/composition/principles.md](../composition/principles.md)). Checking it
before moving on finds a miss next to its cause, while the section is still small.

### 4. Check in three tiers

| Tier | When | What | Finds |
| --- | --- | --- | --- |
| 1. Spec diff | After each section | Every anchor of the section, at one preset per size class the spec uses, in each state the section shows in, in light and dark. Seconds. | A missing anchor, members out of order, copy that differs, a colour or type style off its token, layout wrong for a size class. |
| 2. Screenshot pair | Once per screen | One screenshot of the running build at each of the spec's two `shots` presets, in the default state, beside the approved design at the same preset. | What numbers miss: alignment, visual weight, imagery and icons, spacing that reads wrong. |
| 3. Full review | Once, at the end | One `ultrahand:review` of the running build, every screen of the flow, with the spec and the approved design as the reference. | Flow and usability problems, accessibility (contrast, targets, focus order, 200% text), anything the first two tiers can't see. |

Tier 1 compares structure and tokens, not pixels: an element can sit 2px off and still
pass, because its spacing comes from a token the check already compared. A tier 3 finding
that is a problem in the design itself goes back to the designer as a new design round,
and the spec is regenerated from it.

Each state needs a way in for the checks: a URL, a fixture or a debug switch the build
exposes outside production. Tier 1 can't check a state it can't reach, and says so.

### Departures

When the build has to differ from the spec (a platform control that can't take a token, a
field the API doesn't provide), the owner decides. Either the design changes, in a new
design round and a regenerated spec, or the departure goes in `design/<flow>/accepted.json`
beside the spec:

```json
[
  { "anchor": "add.item.note", "check": "copy",
    "why": "The API caps notes at 80 characters; the placeholder says so.",
    "approved": "Owner, 2026-11-24" }
]
```

`check` is one of `missing`, `order`, `copy`, `token` or `layout`. The checks report an
accepted departure as accepted, not as a miss. Only the owner adds one.

## Anchors

An anchor names one screen, section or member, the same in the design and in the code:

| Level | Form | Example |
| --- | --- | --- |
| Screen | `<screen>` | `lists` |
| Section | `<screen>.<section>` | `lists.your-lists` |
| Member | `<screen>.<section>.<member>` | `lists.your-lists.new-list` |
| Part of a member | `<screen>.<section>.<member>.<part>` | `lists.tabs.nav.settings` |

- Each segment is lowercase letters, digits and single dashes: `[a-z0-9]+(-[a-z0-9]+)*`.
  The dot only separates segments.
- `<screen>` is the screen's `id` run through the same slug as a section name: lowercase,
  each run of other characters made one dash, dashes trimmed from the ends (the blueprint
  allows capitals and extra dashes in an id). `<section>` is the section's name in lowercase with
  dashes, the same slug the greybox uses for its ids (`Your lists` is `your-lists`).
  `<member>` is the member's `id`, a blueprint field the anchors add. Without one it is a
  slug of the member's `text`, else its `label`, else its `kind` (`New list` is
  `new-list`; a list with no words is `list`). A `field`, `toggle` or `stat` uses its
  `label` first, since its `text` is a value (`Quantity`, not `1 bag`). A second slug that's the same in one
  section gets `-2`.
- A part is used only for the items of a `nav` member, named by the screen each opens
  (`lists.tabs.nav.settings`), and for the rows of a `list`, which all share `row`
  (`lists.your-lists.list.row`). Rows are data, so they aren't named one by one.
- Anchors are unique in a spec. Chrome that appears on several screens has one anchor per
  screen (`lists.tabs`, `settings.tabs`). Code that builds it once sets the anchor from the
  current screen.
- **Anchors don't change when the words do.** Once a spec is published, a member keeps its
  anchor through later rounds. The generator keeps the previous spec's ids for every
  member it can match, so a copy edit doesn't rename one. Give a member an explicit `id`
  in the blueprint when its words are likely to change. A renamed anchor is listed in the
  spec's `renamed`, so the code can follow.

### On the canvas

The design carries anchors in a `data-uh` attribute: on the `[data-screen]` element, on
each section's outermost element, and on each member's element.

```html
<section data-screen="lists" data-title="Lists" data-uh="lists">
  <div class="your-lists" data-uh="lists.your-lists">
    <ul data-uh="lists.your-lists.list">
      <li data-uh="lists.your-lists.list.row">…</li>
    </ul>
    <button data-uh="lists.your-lists.new-list" data-nav="add">New list</button>
  </div>
</section>
```

A member's element is the whole thing a person sees as that member: the button itself;
for a field, the wrapper that holds its label, input and message. The canvas's own
attributes start with `data-uh-` (`data-uh-ignore-target`), so `data-uh` alone is free for
anchors.

### In code

Anchors are for the checks, not for people. They never go into an accessible name, an
`id`, a class or visible text.

**Web.** Use the same `data-uh` attribute:

```html
<button data-uh="lists.your-lists.new-list" class="btn btn-primary">New list</button>
```

HTML reserves `data-*` attributes for data "private to the page or application", and
"user agents must not derive any implementation behavior" from them [HTML-DATA], so an
anchor changes nothing a person or a screen reader gets. A component that doesn't pass
unknown attributes through to its element needs an `anchor` prop that does. If the
project's tests already use `data-testid`, the anchor can go there instead, with the same
value; tell the check which attribute to read. Playwright reads a custom attribute with
`testIdAttribute` [PW-TESTID], so `page.getByTestId('lists.your-lists.new-list')` finds
it. Keeping anchors in production is harmless; strip them at build time only if the
checked build still has them.

**Flutter.** Wrap the member's widget in `Semantics` with an `identifier`:

```dart
Semantics(
  identifier: 'lists.your-lists.new-list',
  child: FilledButton(onPressed: onNewList, child: Text(l10n.newList)),
)
```

`identifier` is never shown or read to people. It becomes `resource-id` on Android,
`accessibilityIdentifier` on iOS and `flt-semantics-identifier` on the web, which UI test
tools read [FLUTTER-SEMID], and widget tests find it with
`find.bySemanticsIdentifier('lists.your-lists.new-list')` [FLUTTER-FINDSEMID]. It gives
the widget a semantics node of its own, so put it around the whole control, not around a
piece of its label. Use a `Key('lists.your-lists.new-list')` only where a test needs
`find.byKey` [FLUTTER-KEY] and the widget has no key yet: a key also decides how Flutter
matches widgets between builds, so never replace one that is already there.

### Other stacks

Use the platform's test identifier: `.accessibilityIdentifier(…)` in SwiftUI, a
`Modifier.testTag(…)` in Jetpack Compose. Until there is a check command for the stack,
run tier 1 by hand: for each anchor of the section, find it in a UI test by its
identifier and assert its text, order and visibility at each size class. Testing Library
puts finding by role and text first and keeps test ids as the explicit fallback
[TL-QUERIES]; Playwright calls test ids "the most resilient way of testing" but "not user
facing" [PW-LOCATORS]. The anchors serve the spec check. The full review in tier 3 still
uses the app the way a person does, by role and name.

## spec.json

A small spec: one screen of the Pantry example in
[shared/blueprint/example](../blueprint/example/blueprint.json), with one section.

```json
{
  "spec": 1,
  "title": "Pantry",
  "platform": "mobile",
  "design": { "artifact": "https://claude.ai/…", "round": 3, "approved": "2026-11-24" },
  "theme": { "tokens": "design/theme.tokens.json", "version": "1.2.0" },
  "locale": "en",
  "sizeClasses": {
    "width": [{ "name": "compact", "min": 0 }, { "name": "medium", "min": 600 }, { "name": "expanded", "min": 840 }]
  },
  "presets": [
    { "id": "small", "width": 360, "height": 800 },
    { "id": "large", "width": 430, "height": 932 },
    { "id": "large-landscape", "width": 932, "height": 430 }
  ],
  "shots": ["small", "large-landscape"],
  "states": [{ "id": "default" }, { "id": "empty", "label": "No lists" }],
  "screens": [
    {
      "id": "lists", "anchor": "lists", "title": "Lists",
      "sections": [
        {
          "id": "your-lists", "anchor": "lists.your-lists", "name": "Your lists",
          "job": "Open the list you're shopping from", "role": "content", "pane": "primary",
          "states": ["default"],
          "tokens": { "gap": "semantic.space.gap-group" },
          "layout": { "compact": { "columns": 1 }, "expanded": { "columns": 2, "maxWidth": "60rem" } },
          "members": [
            {
              "id": "list", "anchor": "lists.your-lists.list", "kind": "list",
              "component": "List row", "variant": "navigable", "part": "reused",
              "items": [{ "text": "Weekend shop", "meta": "12 items · 4 left", "nav": "list" }],
              "copy": "sample",
              "tokens": { "color": "semantic.color.on-surface", "type": "semantic.type.body" }
            },
            {
              "id": "new-list", "anchor": "lists.your-lists.new-list", "kind": "button",
              "text": "New list", "copy": "fixed", "emphasis": true, "nav": "add",
              "component": "Button", "variant": "primary", "part": "reused",
              "tokens": {
                "background": "component.button.primary-bg",
                "color": "component.button.primary-fg",
                "type": "semantic.type.label"
              }
            }
          ]
        }
      ]
    }
  ]
}
```

### Top level

| Field | Meaning |
| --- | --- |
| `spec` | The format version, `1`. A change that breaks readers of this format bumps it. |
| `title` | The design's name. |
| `platform` | `mobile`, `tablet` or `desktop`: the skill that designed it. |
| `design` | Where the approved design lives: `artifact` (its URL), `round` and the `approved` date. |
| `theme` | The token file, relative to the project root, and the theme `version` the design used. `null` with no theme: token fields are then `null`, the token check is skipped, and the generator warns. |
| `locale` | The language the copy is in. The copy check runs the build in it. |
| `sizeClasses` | The width classes (and optional `height` classes) that `layout` keys use, as `{ name, min }` in px. Default: Material 3's window size classes [AND-WSC], as on the canvas ([size classes](../canvas/README.md#default-size-classes)). |
| `presets` | The sizes the checks use, with `width` and `height`; a rotated preset is its own entry (`large-landscape`). Tier 1 picks one per size class from these. |
| `shots` | The two presets for tier 2: the narrowest and the widest the platform designs for ([defaults](#shot-presets)). |
| `states` | The screen states, as on the canvas's State picker: `id` and an optional `label`. |
| `screens` | The screens, in the flow's order. |
| `renamed` | Optional. `{ "<old anchor>": "<new anchor>" }` for anchors renamed since the last published spec. |

### Screen

| Field | Meaning |
| --- | --- |
| `id`, `anchor` | The screen id, which is also its anchor. |
| `title` | Its name, as in the Go to picker. |
| `sections` | Its sections in reading order, the order a screen reader and Tab reach them. |

### Section

| Field | Meaning |
| --- | --- |
| `id`, `anchor` | The section's slug and its full anchor. |
| `name`, `job` | Its name and its one job, from the blueprint. The check doesn't compare them; they tell the implementer what the section is for. |
| `role` | `chrome` or `content`. |
| `place` | Chrome only: `top`, `bottom` or `side`, at the smallest size class. Larger classes override it in `layout`. From a blueprint: `side` chrome gets its `compactPlace` (default `bottom`) here and `side` in `layout.medium.place`; other chrome keeps its `place`. |
| `pane` | Content only: `primary` or `secondary`. |
| `states` | Shown only in these states. Absent: shown in every state. |
| `tokens` | Optional. `background`, and the spacing tokens `gap` (between members) and `padding`. |
| `layout` | Its behaviour per size class ([Layout](#layout)). |
| `members` | What it holds, in order, most used first. |

### Member

| Field | Meaning |
| --- | --- |
| `id`, `anchor` | The member's id and its full anchor. |
| `kind` | The blueprint kind: `title`, `text`, `stat`, `list`, `button`, `field`, `toggle`, `image` or `nav`. |
| `text`, `label`, `placeholder`, `meta` | The real words, as the blueprint fields of that kind. `items` for a `list` or `nav`: `{ text, meta, nav }`, with each nav item's part anchor. |
| `name` | The accessible name, when it differs from the visible text (an icon-only button). |
| `copy` | `fixed`: words the product always shows, checked exactly after collapsing whitespace. `sample`: someone's data (list rows, names, counts), checked only for being there and not empty. Default: `sample` for `list` items and `stat` values, `fixed` for the rest. |
| `pattern` | Optional, for sample copy: its shape with `{slots}`, such as `"{n} items · {left} left"`. The check matches the words around the slots. |
| `emphasis`, `rare` | As in the blueprint: the section's one emphasis; a member that sits behind More. |
| `nav`, `back` | The screen it opens, or `true` when it goes back. |
| `component`, `variant` | The theme inventory component and variant that draws it. `part` is `reused` or `new`, from `parts.json`. A `new` part is built as a component before the screens that use it. |
| `tokens` | The theme token for each colour and type style it uses ([Tokens](#tokens)). |
| `states` | Shown only in these states. Absent: shown wherever its section is. |
| `when` | Changes in a state: `{ "<state>": { "text": "…", "disabled": true, "tokens": { … } } }`. Hover, pressed, focus and disabled styles belong to the component and its parts sheet, not here. |
| `layout` | Its behaviour per size class: `show` only ([Layout](#layout)). |

### Tokens

Tokens are named by their path in the token file, without braces:
`semantic.color.on-primary`, `component.button.primary-bg`, `semantic.type.label`. Only
semantic and component tokens appear, as in code ([token file](../theme/README.md#token-file)).

| Key | The style it names |
| --- | --- |
| `color` | The text colour. |
| `background` | The fill. |
| `border` | The border or outline colour. |
| `icon` | An icon's colour, when it differs from `color`. |
| `type` | The typography token: family, size, weight, line height and letter spacing together. |
| `radius` | Optional: the corner radius. |

A measured style doesn't keep the name of the custom property behind it, so the check
compares values. It resolves each token in the token file, in light and in dark (the dark
value is in `$extensions.ultrahand.dark`), and compares it with the computed style in each
scheme. A colour matches when it is the same sRGB colour once both are rounded to 8 bits
per channel. A type style matches when family, size, weight and line height all do. When
two tokens share a value, either name passes.

### Layout

`layout` maps a width class to how the section or member behaves there. It cascades
upwards: a class that isn't listed takes the nearest smaller one that is. The extra key
`height-compact` applies on top of the width class when the height is in the compact
class (under 480px by default).

| Key | On | Means | Measured as |
| --- | --- | --- | --- |
| `place` | chrome | `top`, `bottom` or `side` | Which edge of the screen the section touches. |
| `sticky` | chrome | `true` or `false`: stays at its edge while the content scrolls | Whether it moves on scroll. |
| `beside` | secondary pane | `true`: beside the primary pane; `false`: below it | Whether the two panes share a row. |
| `columns` | content | How many columns its members or rows sit in | Distinct left edges among the rows. |
| `maxWidth` | content | Its width cap, such as `"60rem"` | Its width at the widest preset of the class. |
| `show` | member | `visible`, `more` (behind the section's More) or `hidden` | Whether it is in view, inside the More menu, or absent. |

Layout is checked as these relations, not as pixel positions. Sizes and gaps come from
tokens, which the token check already compares.

### Shot presets

Tier 2 takes one screenshot at each of two presets, the narrowest and the widest the
platform's presets list (landscape counts). The defaults, from each skill's
`references/presets.md`:

| Platform | Narrowest | Widest |
| --- | --- | --- |
| Mobile | `small`, 360 × 800 | `large` in landscape, 932 × 430 |
| Tablet | `ipad-split`, 590 × 820 | `ipad-13` in landscape, 1376 × 1032 |
| Desktop | `mac-half`, 720 × 900 | `desktop-qhd`, 2560 × 1440 |

A design for one platform only (iOS only, say) uses its own narrowest and widest.

## What the checks report

Tier 1 reports one line per miss, grouped by section:

| Kind | Means |
| --- | --- |
| `missing` | An anchor in the spec that the build doesn't have, in a state and size class where the spec shows it. |
| `extra` | An anchor in the build that the spec doesn't have. A warning: the build added something the design didn't. |
| `order` | Members of a section, or sections of a screen, in a different reading order. |
| `copy` | Fixed copy that differs, or sample copy that is empty or doesn't fit its `pattern`. |
| `token` | A colour or type style that matches no token named for it, in light or dark. |
| `layout` | A `place`, `sticky`, `beside`, `columns`, `maxWidth` or `show` that differs at a size class. |
| `unreachable` | A state the check had no way into. |

Each line names the anchor, the state, the preset and scheme, what the spec says and what
the build has. An accepted departure is listed apart, with its reason.

## Sources

Checked in November 2026.

| Key | Source |
| --- | --- |
| MAUDET-17 | Nolwenn Maudet, Germán Leiva, Michel Beaudouin-Lafon and Wendy Mackay, "Design Breakdowns: Designer-Developer Gaps in Representing and Interpreting Interactive Systems", *Proceedings of CSCW '17*, 630–641, 2017. Studies the breakdowns between designers and developers; the follow-up study (ENACT-19) sums them up as leaving out critical details, ignoring edge cases and overlooking technical limitations. https://doi.org/10.1145/2998181.2998190 |
| ENACT-19 | Germán Leiva, Nolwenn Maudet, Wendy Mackay and Michel Beaudouin-Lafon, "Enact: Reducing Designer–Developer Breakdowns When Prototyping Custom Interactions", *ACM TOCHI* 26(3), 2019. A shared representation kept as a single source of truth helped designer–developer pairs detect more edge cases. Its representation is a live prototype. https://doi.org/10.1145/3310276 |
| NNG-SPEC | Nielsen Norman Group, "Use Good Prototype Specifications to Empower Team Collaboration", 2022. A spec covers the "different states of UI components" and what happens when constraints are violated. https://www.nngroup.com/articles/prototype-specifications/ |
| FIGMA-CC | Figma, *Code Connect*. "Code Connect is a bridge between your codebase and Figma's Dev Mode": each design component is linked to the code component that builds it. https://developers.figma.com/docs/code-connect |
| FOWLER-PYRAMID | Martin Fowler, "TestPyramid", 2012. "You should have many more low-level UnitTests than high level BroadStackTests running through a GUI"; "testing through the UI like this is slow". https://martinfowler.com/bliki/TestPyramid.html |
| HTML-DATA | WHATWG, *HTML Living Standard*, "Embedding custom non-visible data with the data-* attributes". Custom data attributes "are intended to store custom data, state, annotations, and similar, private to the page or application"; "user agents must not derive any implementation behavior from these attributes or values". https://html.spec.whatwg.org/multipage/dom.html#embedding-custom-non-visible-data-with-the-data-*-attributes |
| TL-QUERIES | Testing Library, *About Queries: Priority*. `getByRole` "should be your top preference for just about everything"; a test id "is only recommended for cases where you can't match by role or text". https://testing-library.com/docs/queries/about/#priority |
| PW-LOCATORS | Playwright, *Locators*. Recommends "prioritizing user-facing attributes and explicit contracts"; "testing by test ids is the most resilient way of testing", but "not user facing". https://playwright.dev/docs/locators |
| PW-TESTID | Playwright, *Locators* (locating by test id). `testIdAttribute` in the test config, or `selectors.setTestIdAttribute()`, makes `getByTestId` read another attribute. https://playwright.dev/docs/locators |
| FLUTTER-SEMID | Flutter API, `SemanticsProperties.identifier`. An identifier in the native accessibility tree that isn't shown to people, for UI test tools: `resource-id` on Android, `accessibilityIdentifier` on iOS, `flt-semantics-identifier` on the web. https://api.flutter.dev/flutter/semantics/SemanticsProperties/identifier.html |
| FLUTTER-FINDSEMID | Flutter API, `CommonFinders.bySemanticsIdentifier`: "Finds Semantics widgets matching the given identifier". https://api.flutter.dev/flutter/flutter_test/CommonFinders/bySemanticsIdentifier.html |
| FLUTTER-KEY | Flutter API, `Key`: "A Key is an identifier for Widgets, Elements and SemanticsNodes"; `find.byKey` finds a widget by it. https://api.flutter.dev/flutter/foundation/Key-class.html |
| AND-WSC | Android Developers, *Window size classes* (width: compact < 600, medium 600–839, expanded 840–1199, large 1200–1599, extra-large ≥ 1600; height: compact < 480, medium 480–899, expanded ≥ 900). https://developer.android.com/develop/ui/compose/layouts/adaptive/window-size-classes |

The token format and tiers (DTCG-FORMAT, M3-TOKENS) are in
[shared/theme/sources.md](../theme/sources.md). The section rules (SEC-1, SEC-5) and
their sources are in [the composition principles' sources](../composition/principles.md#sources).
The independent review behind tier 3 is in [shared/review/README.md](../review/README.md).
