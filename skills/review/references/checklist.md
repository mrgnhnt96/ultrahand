# Review checklist

The passes from [SKILL.md](../SKILL.md), step 4. Each check cites a key from
[sources.md](sources.md). Keys with a prefix, like `mobile:HIG-A11Y`, are in that design
skill's own `references/sources.md`; its `principles.md` explains the rule in depth.

A check that doesn't apply (no forms, no drag and drop) is skipped, not passed. List the
skipped areas in the report so the reader knows what was and wasn't covered.

## Pass 1: Task walkthrough

For each flow, take the primary task step by step and ask four questions at every step
[NNG-CW] [WHARTON-94]. Any "no" is a finding at that step.

1. **Will users try to achieve the right result?** Do they know this step is needed? A
   step they don't expect (verify an email, pick a plan first) needs to be explained.
2. **Will users notice that the correct action is available?** Is the control visible at
   this size, or hidden in a menu, behind a gesture, off screen, or under the keyboard?
3. **Will users associate the correct action with the result they want?** Does the label
   or icon say what it does, in the user's words?
4. **After the action, will users see progress toward the goal?** Is there feedback: a
   state change, a confirmation, a new screen, a progress indicator?

Also walk the unhappy paths: cancel halfway, go back, enter something invalid, lose the
connection, come back later.

## Pass 2: Control by control

Every control in the inventory:

- [ ] **Purpose:** its label or icon says what it does. Icon-only controls use a widely
      known icon or have a visible label [NNG-H2] [NNG-H6].
- [ ] **Accessible name:** it has one, and the name contains the visible label text
      [WCAG 4.1.2] [WCAG 2.5.3]. Images that carry meaning have text alternatives
      [WCAG 1.1.1].
- [ ] **Role and state:** it exposes what it is (button, link, tab, switch) and its state
      (selected, expanded, checked, disabled) [WCAG 4.1.2].
- [ ] **Looks like what it is:** buttons look pressable, links look like links, and
      disabled controls look disabled. Its boundary has 3:1 contrast against what's next to
      it [WCAG 1.4.11].
- [ ] **Target size:** at least 44 × 44 pt on iOS and iPadOS, 48 × 48 dp on Android
      [mobile:HIG-A11Y] [mobile:AND-A11Y]. Never below WCAG's 24 × 24 CSS px floor (or
      enough spacing), even for pointer-first desktop UI [WCAG 2.5.8]. Frequent and
      adjacent targets are larger and spaced so people don't hit the neighbour [NNG-FITTS].
- [ ] **States:** default, hover (pointer), pressed, focused, selected, disabled and
      loading are each designed [NNG-H1].
- [ ] **Feedback:** pressing it responds visibly. A slow action shows progress
      [NNG-H1] [mobile:NNG-RESPONSE].
- [ ] **Keyboard:** reachable with Tab, operable with Enter or Space, and arrows move
      within groups (tabs, radios, lists, toolbars) [WCAG 2.1.1] [MS-KBD].
- [ ] **No surprises:** focusing or changing it doesn't move focus, submit or navigate on
      its own [WCAG 3.2.1] [WCAG 3.2.2].
- [ ] **Gestures and drags:** anything done by swipe, pinch, long-press or drag has a
      single-tap or click alternative [WCAG 2.5.1] [WCAG 2.5.7].
- [ ] **Destructive actions:** they are separated from safe ones, worded clearly, and can
      be undone or ask to confirm [NNG-H3] [NNG-H5].
- [ ] **Undo holds up:** it lasts long enough to read and reach, or until the next action,
      and a timed Undo can be extended [WCAG 2.2.1]. Two deletes in a row can both be
      undone. After a delete, focus moves to the next item, not to the page top, and Undo
      puts the item back where it was, in the same pane [NNG-H3] [WCAG 2.4.3].
- [ ] **Unsaved input survives in-app actions:** switching items, tabs or modes, closing a
      panel or toggling a view keeps typed text, or saves it, or asks first. Test it: type
      a draft, then run every command and change every field on the same screen, and check
      the draft is still there. Dismissing a
      sheet or dialog that holds typed input asks before discarding it [NNG-H3] [NNG-H5].
- [ ] **Context menus have a touch route:** where touch is likely, touch-and-hold opens the
      same menu as right-click, and its commands also exist elsewhere [tablet:HIG-CONTEXT]
      [WCAG 2.5.1].

Fields and forms:

- [ ] Every field has a visible label that stays visible while typing; a placeholder isn't
      a label [WCAG 3.3.2] [mobile:NNG-PLACEHOLDER].
- [ ] Fields declare their purpose (name, email, one-time code) so autofill works, and use
      the right keyboard [WCAG 1.3.5] [mobile:HIG-KEYBOARD].
- [ ] Errors name the field, say what's wrong in words (not only colour), and say how to fix
      it, next to the field [WCAG 3.3.1] [WCAG 3.3.3] [NNG-H9].
- [ ] Information already given isn't asked for again in the same flow [WCAG 3.3.7].
- [ ] Sign-in doesn't rely on remembering or transcribing: paste and password managers
      work [WCAG 3.3.8].
- [ ] Formats and constraints are stated before the user types, not only after an error
      [NNG-H5].

## Pass 3: Nielsen's 10 heuristics

Each screen, and the flow as a whole [NNG-HEURISTICS]:

| Key | Heuristic | Look for |
| --- | --- | --- |
| NNG-H1 | Visibility of system status | Loading, saving, syncing and offline shown. Selected tab, current step and selected row marked. In the error or offline state, commands never report success they didn't have. |
| NNG-H2 | Match between the system and the real world | The user's words, not internal or technical terms. Familiar icons and natural order. |
| NNG-H3 | User control and freedom | Back, cancel, close and undo. No dead ends. Sheets and dialogs can be dismissed. |
| NNG-H4 | Consistency and standards | Same thing, same name and look everywhere. Platform conventions for navigation, controls and gestures. |
| NNG-H5 | Error prevention | Constraints instead of error messages. Confirmation or undo for destructive actions. Sensible defaults. |
| NNG-H6 | Recognition rather than recall | Options visible. No codes or values to remember between screens. Recent and suggested items. |
| NNG-H7 | Flexibility and efficiency of use | Shortcuts, bulk actions, search and defaults for frequent users, without getting in a newcomer's way. |
| NNG-H8 | Aesthetic and minimalist design | Every element earns its place. Clear hierarchy, one primary action per screen. |
| NNG-H9 | Help users recognize, diagnose, and recover from errors | Plain-language errors that say what happened and what to do, without blame. |
| NNG-H10 | Help and documentation | Help in context where it's needed, findable in the same place on every screen [WCAG 3.2.6]. |

## Pass 4: WCAG 2.2 AA

Check these success criteria, in addition to the ones cited in pass 2 [WCAG22].

**Perceivable**

- [ ] **Contrast (1.4.3):** text at least 4.5:1; large text (24 px, or 18.66 px bold) at
      least 3:1. Check every text colour on every background it sits on, in **both** light
      and dark mode and in every state (disabled controls are exempt). Compute it with
      the formula below.
- [ ] **Non-text contrast (1.4.11):** icons, control borders, focus indicators and chart
      lines at least 3:1 against what's next to them.
- [ ] **Use of colour (1.4.1):** colour isn't the only signal: errors, required fields,
      selected items, links in text and chart series also differ in text, icon, shape or
      underline.
- [ ] **Structure (1.3.1):** headings, lists, tables and groups are marked up as such;
      related fields are grouped.
- [ ] **Resize text (1.4.4)** and **text spacing (1.4.12):** at 200% text nothing is cut
      off, overlaps or is lost; containers grow instead of clipping.
- [ ] **Reflow (1.4.10):** at 320 CSS px wide, content reads without scrolling in two
      directions (tables, maps and toolbars excepted).
- [ ] **Orientation (1.3.4):** works in portrait and landscape unless one is essential.
- [ ] **Hover and focus content (1.4.13):** tooltips and popovers can be dismissed (Esc),
      can be hovered without vanishing, and stay until dismissed.

**Operable**

- [ ] **Keyboard (2.1.1)** and **no keyboard trap (2.1.2):** every function works from the
      keyboard, and focus can always leave a component, including dialogs and embedded
      content.
- [ ] **Focus order (2.4.3):** focus follows reading order. Opening a dialog moves focus
      into it; closing it returns focus to what opened it. While a modal (dialog, sheet,
      menu) is open, focus stays inside it: the background is `inert` and Tab wraps
      [desktop:APG-DIALOG].
- [ ] **Focus visible (2.4.7)** and **not obscured (2.4.11):** the focused element is
      always visibly marked and never fully hidden under a sticky header, footer, toolbar
      or the keyboard. Test it: Tab through at the shortest height, and for each focused
      element check that `elementFromPoint` at its centre returns it, not a sticky bar (on the
      canvas, call it on `canvas.root`: the document version returns the shadow host).
- [ ] **Titles and headings (2.4.2, 2.4.6):** each screen has a title that says what it is;
      headings and labels describe their content.

**Understandable and robust**

- [ ] **Status messages (4.1.3):** toasts, "saved", result counts and errors that appear
      without moving focus are announced to screen readers.
- [ ] **Consistent help (3.2.6):** help, contact and support links that repeat across
      screens appear in the same relative order on each.

### Contrast formula

Contrast ratio = (L1 + 0.05) / (L2 + 0.05), where L1 is the lighter colour's relative
luminance and L2 the darker one's [WCAG-LUM]. For each sRGB channel c (0–1):
c ≤ 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055)^2.4, then
L = 0.2126 R + 0.7152 G + 0.0722 B. Run it rather than guessing:

```js
const lum = h => { const [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
  .map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
ratio('#767676', '#ffffff') // 4.54
```

Resolve `light-dark()` and semi-transparent colours to the final colour on its actual
background before computing.

## Pass 5: Platform

Use the rules for the platform and size classes from step 2. These are the checks reviews
most often miss; the linked principles hold the rest.

**Mobile, compact width** ([principles](../../mobile/references/principles.md))

- [ ] Primary actions within thumb reach, in the lower half; destructive actions away from
      frequent ones [mobile:HOOBER-13] [mobile:PARHI].
- [ ] Bottom navigation with 3–5 labelled destinations; no hamburger hiding the main
      sections [mobile:HIG-TABS] [mobile:M3-NAVBAR] [mobile:NNG-HAMBURGER].
- [ ] Nothing interactive under the notch, status bar or home indicator [mobile:HIG-LAYOUT].
- [ ] The focused field and its submit button stay visible with the keyboard up
      [mobile:HIG-KEYBOARD].
- [ ] Text scales with the system setting (Dynamic Type, font scale) [mobile:HIG-TYPE].
- [ ] Loading, empty and error states are designed, with a way forward from each
      [mobile:NNG-EMPTY] [mobile:NNG-SKELETON].

**Tablet, medium and expanded touch, and split views**
([principles](../../tablet/references/principles.md))

- [ ] Layout changes by width class (600 / 840), not by device, and every feature is
      reachable at every width [tablet:HIG-LAYOUT] [tablet:AND-WSC].
- [ ] Navigation fits the width: bar at compact, rail or sidebar above [tablet:AND-NAV].
- [ ] Multi-pane layouts follow a canonical pattern; selection is kept and shown in each
      pane; no empty detail pane [tablet:AND-CANON] [tablet:HIG-SPLIT].
- [ ] Content and controls have max widths; nothing stretches edge to edge on a wide screen
      [tablet:AND-T2].
- [ ] Pointer and keyboard work as well as touch: hover states, context menus, visible
      focus, standard shortcuts [tablet:HIG-POINTER] [tablet:HIG-KEYBOARD].
- [ ] Content clear of the iPad window controls and Android taskbar [tablet:HIG-WINDOWS]
      [tablet:AND-MW]. The canvas doesn't draw the iPad window controls, so check the top
      leading corner by measurement or list it under Not checked.
- [ ] Each pane has its own loading, empty and error state, and actions that need content
      (Edit, Delete, Share) are disabled while a pane is empty or loading [tablet:AND-CANON].
- [ ] On narrowing to one pane, the open item stays: at expanded, the item shown in the
      detail pane counts as open, so narrowing shows that detail, not the list
      [tablet:AND-CANON].

**Desktop, pointer and keyboard windows**
([principles](../../desktop/references/principles.md))

- [ ] Large displays used to show more in fewer nested levels, with less modality, at a
      density that stays comfortable to read [HIG-MACOS].
- [ ] Windows can be resized, hidden, moved and made full screen; the layout reflows across
      the whole range [HIG-MACOS].
- [ ] Every command is reachable from a menu (menu bar on macOS, a menu or command bar on
      Windows and the web), with its shortcut shown there or in the tooltip
      [HIG-MACOS] [MS-KBD].
- [ ] Standard shortcuts work (Ctrl or Cmd + C, V, X, Z, A, S, F) and aren't reassigned
      [MS-KBD]. Web apps don't rely on keys the browser keeps (Ctrl or Cmd + N, T, W).
- [ ] Tab order is logical and follows visual order; initial focus is on the most likely
      action, never on a destructive one [MS-KBD].
- [ ] Arrow keys move inside groups (lists, grids, toolbars, radio groups), which take one
      tab stop. Esc cancels transient UI (menus, dialogs, pickers) but doesn't navigate
      back [MS-KBD].
- [ ] Panes can be reached from the keyboard without tabbing through everything (F6 on
      Windows, landmarks on the web) [MS-KBD] [WCAG 2.4.1].
- [ ] Hover reveals extra detail but never the only path to a command. Right-click opens a
      context menu next to the item [NNG-FITTS] [desktop:HIG-POINTER]. Shift+F10 or the
      Menu key opens the same menu on the focused item, and its commands act on that
      item, not on an earlier selection [desktop:HIG-CONTEXT] [WCAG 2.1.1].
- [ ] Frequent targets are large and close to where the pointer already is; related
      controls are grouped [NNG-FITTS].

## Pass 6: Resize and variants

On a canvas, use the presets and the readout. From code, read the breakpoints and container
queries. From a screenshot, say which sizes you couldn't see.

- [ ] **Every preset** for the platform, in both orientations on touch devices, renders
      without overlap, clipping or a lost control.
- [ ] **Split widths** (1/3, 1/2, 2/3 on tablet) and a slow drag across the 600 and 840
      breakpoints: the layout changes class cleanly, and selection, scroll position and
      typed text survive [tablet:HIG-MULTI] [tablet:AND-MW].
- [ ] **Desktop window range:** the minimum and the maximum size both work; nothing
      stretches past a readable line length at the maximum.
- [ ] **320 wide** reflow [WCAG 1.4.10] and **200% text** [WCAG 1.4.4]. A `label[for]`
      flagged as a small target passes when its field is big enough (the 2.5.8
      equivalent-control exception).
- [ ] **Dark mode:** contrast rechecked; no hard-coded light colours, no lost borders or
      shadows [mobile:HIG-DARK] [mobile:NNG-DARK].
- [ ] **Each data state** (loading, empty, error, offline, long content, one item, many
      items) at the smallest and the largest size, in every pane of a multi-pane layout.
- [ ] **Keyboard up** on touch devices, in landscape: the focused field is still visible
      [WCAG 2.4.11]. The canvas has no keyboard: simulate it with `setSize(w, h - 300)`
      or the `keyboard-up` extra check, or list it under Not checked.
- [ ] **Short heights** (compact height under 480, landscape phone): sticky headers and
      footers leave room for content.
- [ ] **Short height × 200% text together:** the sticky header plus footer stay well under
      the screen height. Overflow detectors miss content covered by sticky layers, so
      look at the screenshot or measure the bars [WCAG 1.4.4] [WCAG 1.4.10].

## Severity guide

Rate each finding 0–4 by three factors: **frequency** (how many users hit it),
**impact** (how hard it is to overcome) and **persistence** (whether it keeps hurting once
they know) [NNG-SEVERITY]. These anchors are this skill's convention for applying that scale:

| Rating | Typical findings |
| --- | --- |
| **4 Catastrophe** | The primary task can't be finished at some size, state or input: control unreachable or hidden at a breakpoint, keyboard trap, unlabelled icon-only primary action for screen-reader users, data lost on resize, Back, or an in-app action (switching items, closing a panel), destructive action with no confirm or undo next to a frequent one. |
| **3 Major** | WCAG AA failure on a primary flow (text contrast, target size, missing label, invisible focus); frequent confusion or a wrong-path step in the walkthrough; error with no way to recover; feature missing at one size class. |
| **2 Minor** | WCAG AA failure on a secondary screen; inconsistency that slows people; missing loading or empty state with a workaround; a platform convention ignored but learnable. |
| **1 Cosmetic** | Spacing, alignment or wording polish that doesn't affect the task. |

Raise a rating one step when the problem appears on every screen or blocks a common task,
and lower it one step when it's on a rare path with an obvious workaround. Weigh what is
lost: a missing undo on a one-tap re-add is minor, on deleting a document it is a
catastrophe. A WCAG AA failure is never below 2.

Stubbed or faked behaviour in a prototype (no real network, a toast standing in for a
snackbar) goes under **Not checked**, not in the findings, unless the design itself is
missing the state. A simulated state is still a design: when the empty state shows a
count, header or enabled command that contradicts it, that is a finding.

## Report template

```markdown
## Verdict

<Platform, sizes reviewed, evidence (canvas / code / screenshot), counts by severity,
and the single most important problem.>

## Findings

### R1 · 4 Catastrophe · <short title>
- **Element:** <Screen › element> at <width × height, size class, scheme, state>
- **Evidence:** Confirmed | Likely
- **Problem:** <what goes wrong for the user>
- **Principle:** <rule> [<source key>]
- **Fix:** <concrete change with values>

### R2 · 3 Major · …

## What works

<Two to four strengths worth keeping.>

## Not checked

<Areas skipped and why: screen reader output, real devices, motion, sizes not shown.>
One reviewer finds only some of the problems; a second reviewer or a usability test will
find more [NNG-HE].
```
