# Composition: components, sections, screens

The design skills' principles cover each component and each platform. This file covers how
components form **sections** and sections form a **screen**. A screen can pass every
component check and still feel messy: controls in no order, everything highlighted, four
styles side by side, the same fact shown twice. The design skills apply these rules while
they compose; the review skill checks them in its composition pass. Sources are at the end.

## Levels

- **Component:** one control or piece of content. Covered by each platform's principles.
- **Section:** a set of components with one job, seen as a unit: a toolbar or one of its
  groups, a pane header, a form group, a card, a sidebar, a list.
- **Screen:** every section at once, at one size: what the eye lands on, how the sections
  relate, and how much is there.

## Section rules

- **SEC-1 One job.** Each section does one job, and its members serve it. Group by function
  first and frequency second; put a member where people look for it, not where it fitted
  when it was added [HIG-TOOLBARS] [NNG-PROX].
- **SEC-2 Space groups, boxes only when space can't.** Members of a group sit closer to
  each other than to anything else; the gap between groups is clearly larger than the gap
  inside one (a working rule: at least twice). Use a container (border, fill, card) only
  when space alone can't show the group; decorative boxes add clutter [NNG-PROX]
  [NNG-REGION].
- **SEC-3 Few groups.** A bar or panel has few groups: Apple's guidance is at most three in
  a toolbar. More groups than that is a sign that some members belong elsewhere, in a menu,
  or nowhere [HIG-TOOLBARS].
- **SEC-4 One look per role.** Everything with the same role looks the same, and different
  roles look different. Count the control styles in the section; each extra style needs a
  reason. Static text and status never look like controls: no button-like fill, border or
  pill on a label or a readout, and no link colour on text you can't click [NNG-SIM]
  [NNG-CLICK].
- **SEC-5 One emphasis.** Each section has at most one strongly emphasised element: its
  primary action, or the one state that matters most. Selected states in segmented
  controls and toggles use a quiet treatment (a subtle fill, weight, an indicator), not
  the brand accent on every group. If everything is contrasted, nothing stands out
  [NNG-VH] [NNG-SIM].
- **SEC-6 Consistent labels.** Either every group in a section has a visible label or none
  does, and labels share one style and position [NNG-SIM] [NNG-H4].
- **SEC-7 One fact, one place.** A value appears once in a section. Two readouts of the
  same thing that can disagree (a preset's size next to the live size) are one too many
  [NNG-H8].
- **SEC-8 Frequent in view, rare behind.** What people use often stays visible; rare and
  advanced members go to a menu or a secondary place. Don't hide what's frequent, and don't
  show everything because there's room [NNG-PD] [HIG-TOOLBARS].

## Screen rules

- **SCR-1 The work dominates.** The primary content (the document, the list, the design on
  a canvas) is the biggest, highest-contrast thing on the screen. Chrome (toolbars, panels,
  status) recedes: smaller type, quieter colour, less contrast [NNG-VH] [NNG-H8].
- **SCR-2 The squint test passes.** Blur the screen (or squint): the shapes you see should
  be the intended sections in the intended order of importance, with the primary content
  first. An unexpected bright spot is an unintended focal point [NNG-VH].
- **SCR-3 A small type scale.** About three type sizes across the screen and no more than
  two large elements; one font family for UI text (a second, such as a monospace for
  numbers, only with a clear role) [NNG-VH].
- **SCR-4 Aligned to a grid.** Sections and their rows share edges. Rows in one bar align
  to the same edge, or mirror each other deliberately; a row that starts left and another
  that starts right with nothing in between reads as broken [NNG-GRID].
- **SCR-5 Every element earns its place.** Each element supports a task on this screen.
  Count the sections, the controls and the styles; when a screen grows, ask what can be
  merged, moved behind a menu or removed [NNG-MINIMAL] [NNG-PD].
- **SCR-6 The order holds as it narrows.** As the window or screen narrows, sections
  collapse in a planned order (overflow, menus, panes hiding) while their grouping and
  order stay recognisable [HIG-TOOLBARS].

## How to apply it when designing

1. **Before building, write the section map.** For each screen list the sections, each
   section's one job, its members ordered by how often they're used, and its single
   emphasis. Decide what is primary content and what is chrome.
2. **Build to the map.** Spacing from SEC-2, one style per role from SEC-4, one emphasis
   per section from SEC-5.
3. **Audit what you built** at the largest and smallest size with the composition audit
   (below) or by eye: the blurred screenshot, the emphasis count, the style count, the
   type sizes, the row edges and the gaps.
4. **On every round of changes, audit the additions.** List what the round added, moved and
   removed. Fixing problems tends to add controls, labels and menus; each addition must
   earn its place against SCR-5, and the round must leave the screen no busier than it
   needs to be. Reorganise before you add.

## Composition audit

`audit.mjs` is a steps script for [`shared/input/drive.mjs`](../input/README.md). It prints
one JSON line of measures per section and saves a blurred screenshot:

```sh
node shared/input/drive.mjs open page.html --size 1440x900
UH_SECTIONS='header,main' node shared/input/drive.mjs do shared/composition/audit.mjs --out shots
node shared/input/drive.mjs close
```

`UH_SECTIONS` takes CSS selectors (searched in shadow roots too, so a canvas screen works);
without it the audit takes the page's top-level header, toolbar, nav, aside and main.

| Measure | Read it against |
| --- | --- |
| `accentFills` | SEC-5: more than one per section, or a status among them |
| `controlStyles` | SEC-4: one style per role; list each extra and its reason |
| `lookClickable` | SEC-4: static text styled like a control |
| `typeSizes`, `fonts` | SCR-3 |
| `rows` (`left`, `right`) | SCR-4: rows in one section that start or end on unrelated edges |
| `rows[].gaps` | SEC-2: gaps inside groups clearly smaller than gaps between them; many different gaps means no grouping |
| `textOrder` | SEC-7: the same fact twice; SEC-6: some groups labelled, others not |
| `blur-<size>.png` | SCR-1, SCR-2: what the eye lands on |

The numbers point at problems. Whether a second style or a second emphasis is justified is
a judgement, and the finding says why.

## Sources

Checked in November 2026.

| Key | Source |
| --- | --- |
| NNG-VH | Kelley Gordon, *Visual Hierarchy in UX: Definition*, Nielsen Norman Group, 2021 (hierarchy from contrast, scale and grouping; "if everything is contrasted, then nothing stands out"; no more than three contrast variations and three type sizes, at most two large elements; squint or blur the design to check groupings and hierarchy). https://www.nngroup.com/articles/visual-hierarchy-ux-definition/ |
| NNG-PROX | Aurora Harley, *Proximity Principle in Visual Design*, Nielsen Norman Group, 2020 (items close together are seen as a group; vary whitespace to unite or separate; unrelated items placed together camouflage each other). https://www.nngroup.com/articles/gestalt-proximity/ |
| NNG-REGION | Aurora Harley, *The Principle of Common Region: Containers Create Groupings*, Nielsen Norman Group, 2020 (a border or background groups items; too many borders and coloured boxes add clutter; prefer whitespace where it works). https://www.nngroup.com/articles/common-region/ |
| NNG-SIM | Aurora Harley, *Similarity Principle in Visual Design*, Nielsen Norman Group, 2020 (items that share a visual characteristic are seen as related; consistent visual rules for each type of UI element; reserve a separate colour for primary calls to action). https://www.nngroup.com/articles/gestalt-similarity/ |
| NNG-CLICK | Hoa Loranger, *Beyond Blue Links: Making Clickable Elements Recognizable*, Nielsen Norman Group, 2015 (buttons look like buttons; don't make non-clickable items look like buttons or links). https://www.nngroup.com/articles/clickable-elements/ |
| NNG-GRID | Kelley Gordon, *Using Grids in Interface Designs*, Nielsen Norman Group, 2022 (grids give a consistent reference point that improves scannability; breaking the grid produces a chaotic experience). https://www.nngroup.com/articles/using-grids-in-interface-designs/ |
| NNG-MINIMAL | Therese Fessenden, *Aesthetic and Minimalist Design (Usability Heuristic #8)*, Nielsen Norman Group, 2021 (every extra unit of information competes with the relevant ones; communicate, don't decorate). https://www.nngroup.com/articles/aesthetic-minimalist-design/ |
| NNG-PD | Jakob Nielsen, *Progressive Disclosure*, Nielsen Norman Group, 2006 (defer rare features to a secondary place; disclose everything users frequently need up front). https://www.nngroup.com/articles/progressive-disclosure/ |
| NNG-H4, NNG-H8 | Jakob Nielsen, *10 Usability Heuristics for User Interface Design*, Nielsen Norman Group (consistency and standards; aesthetic and minimalist design). https://www.nngroup.com/articles/ten-usability-heuristics/ |
| HIG-TOOLBARS | Apple, *Human Interface Guidelines: Toolbars* (choose items deliberately to avoid overcrowding; group items logically by function and frequency of use; minimise the number of groups, aiming for at most three; prioritise the most important items and put the rest in a More menu; plan what overflows as the window narrows). https://developer.apple.com/design/human-interface-guidelines/toolbars |
