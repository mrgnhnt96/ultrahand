# Build this design

`spec.json` in this folder is an approved design, written as data: its screens, each
screen's sections in reading order, each section's members with their real words, the
component and theme tokens that draw each one, the states, and how each section behaves at
each size class. Build from it, not from a screenshot. The design itself is linked in its
`design.artifact`; open it beside the spec.

## 1. Carry the anchors

Every screen, section and member in the spec has an `anchor`, such as
`lists.your-lists.new-list`. Put the same anchor on the element that builds it, so the
build can be checked against the spec by name:

| Stack | Where the anchor goes |
| --- | --- |
| Web | `data-uh="lists.your-lists.new-list"` (or `data-testid`, if the tests already use it) |
| Flutter | `Semantics(identifier: 'lists.your-lists.new-list', child: …)` around the whole control |
| SwiftUI | `.accessibilityIdentifier("lists.your-lists.new-list")` |
| Jetpack Compose | `Modifier.testTag("lists.your-lists.new-list")` |

A member's element is the whole thing a person sees as that member: the button itself; for
a field, the wrapper holding its label, input and message. A list's rows all share
`<list anchor>.row`. Anchors never go into visible text, an accessible name, an `id` or a
class.

## 2. Build section by section

1. **Parts first.** Each member names its `component` and `variant`. Map each one to the
   project's own component. A member with `"part": "new"` needs a component that doesn't
   exist yet: build it, with its states, before any screen uses it.
2. **Then the shell.** The screens and their routes, the chrome sections (bars, tabs,
   rails) and the panes, with their `layout` at every size class.
3. **Then the content sections, in spec order,** primary pane before secondary. For each
   section: its members in order; `"copy": "fixed"` words exactly as written (into the
   strings file, if the project has one); the named component and variant; the named
   tokens, never a raw colour, size or spacing; the `states` it shows in, and what
   changes in each (`when`); its `layout` per size class.
4. **Check the section (tier 1) before starting the next.** Fix every miss, then commit.

## 3. Check in three tiers

Most checking is a fast check of one section against the spec. Screenshots are kept to one
pair per screen, and the full review to one at the end. Don't take a full-screen
screenshot to check each section.

| Tier | When | What |
| --- | --- | --- |
| 1. Spec check | After each section | Each of the section's anchors is there, in spec order, with its fixed copy, its colour and type matching the named tokens, and its layout right, at one preset per size class the spec uses, in each state the section shows in, in light and dark. |
| 2. Screenshot pair | Once per screen, when all its sections pass | One screenshot at each of the two presets in the spec's `shots`, in the default state, beside the design at the same preset. Look for what the numbers miss: alignment, visual weight, icons, spacing that reads wrong. |
| 3. Full review | Once, when the flow is done | One UX review of the running build, every screen of the flow, with the spec and the design as the reference (`ultrahand:review` if the ultrahand plugin is installed). |

Status: a one-command tier 1 check for web builds is coming in the ultrahand plugin. Until
the project has one, write tier 1 as a UI test: find each of the section's anchors by its
attribute or identifier, and assert the points above.

Each state needs a way in for the checks: a URL, a fixture or a debug switch the build
exposes outside production. Note any state you couldn't reach.

## When the build can't match

When something has to differ from the spec (a platform control that can't take a token, a
field the API doesn't provide), ask the owner; don't decide it yourself. They either change
the design, which comes back as a new spec, or add the difference to `accepted.json` in
this folder:

```json
[
  { "anchor": "add.item.note", "check": "copy",
    "why": "The API caps notes at 80 characters; the placeholder says so.",
    "approved": "Owner, 2026-11-24" }
]
```

`check` is one of `missing`, `order`, `copy`, `token` or `layout`.
