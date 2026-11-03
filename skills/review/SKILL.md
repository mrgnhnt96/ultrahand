---
name: review
description: Use only when the user asks for a UX review or critique of an existing UI design, screen, or flow. Do not use for code review or non-UI work.
---

# ultrahand: review

Review a UI design the way an expert inspector would. Walk every flow, interaction and
control against the platform's principles, Nielsen's 10 heuristics and WCAG 2.2 AA, then
check that the design still holds at other sizes. The output is a list of findings ranked
by severity. Each finding names the element, the principle and its source, and gives a
concrete fix.

Every check is in [references/checklist.md](references/checklist.md), and each check cites
[references/sources.md](references/sources.md). For the platform rules in depth, use the
design skills' own principles:
[mobile](../mobile/references/principles.md),
[tablet](../tablet/references/principles.md) and
[desktop](../desktop/references/principles.md).
For a project with a theme, check the design against it with the `theme-review` skill:
token use, component reuse and consistency across screens are its job, not this one's.

**Lessons:** before step 1, read the project's `design/LESSONS.md` and apply the
lessons for this skill. They record what the owner has already corrected, so don't repeat
those mistakes. See [shared/learning/README.md](../../shared/learning/README.md).

## 1. Get the design and know what it can show

Use the richest evidence the user can give. Say which kind you have, because it limits what
you can confirm.

- **ultrahand canvas artifact** (a claude.ai artifact link): read its HTML. It holds the
  markup, labels, colours and every screen and state. If a browser tool is available, open
  the artifact. Set up each view through `window.ultrahandCanvas` (see the canvas README in
  `shared/canvas/`): `usePreset(id)`, `setSize(w, h)`, `setScheme('dark')`,
  `setTextScale(2)`, `setState('error')`, `navigate(id)`. Turn on **show tap targets** and
  read its result (`#uh-targets-result`), which counts targets under the platform minimum.
  Call `refresh()` after opening a sheet or menu so the count includes it. The canvas
  README lists the toolbar's element ids. A prototype's stubs (no real network, no
  on-screen keyboard) go under *Not checked*, not in the findings. The hardware keyboard
  is real: drive every flow with it.
- **Local canvas build** (an `index.html` from `build.mjs`) or any page you can open:
  treat it like the artifact, and use it with the input driver (step 4).
- **Code** (HTML, SwiftUI, Compose, Flutter and so on): you can check labels, roles, focus
  order, colours and breakpoints, but not how it looks unless you can run it.
- **Screenshot or mockup:** you can judge layout, hierarchy, wording and approximate
  contrast and sizes. You can't confirm labels, focus order or behaviour; mark those
  findings *Likely* or list them under *Not checked*.

Mark each finding's evidence: **Confirmed** (seen in code or measured on the canvas) or
**Likely** (inferred from an image). Never present a guess about hidden behaviour as fact.

## 2. Establish the context

Write these down before you judge anything; a finding only makes sense against them.

- **Platform:** iOS, iPadOS, Android, macOS, Windows or the web. Read it from the canvas
  (`size.platform`), the code, or the visual style. If it's unclear, ask once.
- **Current size:** width × height, and the width size class: compact < 600, medium
  600–839, expanded 840–1199, large 1200–1599, extra-large 1600+. Height compact < 480,
  medium 480–899, expanded 900+. Note the orientation and any split.
- **Inputs:** touch, pointer, keyboard, or a mix. A tablet or a touch laptop can have all
  three.
- **Users and primary task:** who uses each screen, and the one thing it's for. Ask if you
  can't infer it; a review without a task becomes a list of opinions.
- **Product or tool:** a design for end users, or a tool built for the owner (the canvas
  itself, an editor, a viewer). A tool is a desktop app used in a browser window of any
  size: review it with the desktop rules and pass 8. Its chrome gets the pass 7 checks
  that pass 8 lists (window sizes, browser zoom, its own themes), not the design's
  presets, and the composition pass like any screen.

Pick the platform rules by **window size class and input**, not by device name: compact
touch → mobile principles; medium and expanded touch, or any split → tablet; a pointer and
keyboard window → desktop. A responsive design gets all the sets its sizes cover.

## 3. Inventory the design

List every screen and state, every flow between screens, the **sections** of each screen
(toolbars and their groups, panes, pane headers, form groups, cards, lists, bars), and
every interactive control in each section (buttons, links, fields, toggles, tabs, menus,
gestures, drag targets). The inventory is the review's coverage: a section or control you
didn't list is one you didn't check.

**Review at three levels:** the whole screen, each section, and each component. A screen
whose every control passes can still be cluttered, unordered and confusing; that is a
finding in its own right, not polish.

## 4. Inspect in passes

Work through the passes in [references/checklist.md](references/checklist.md) in order.
Go through the design twice: once to learn it, once to find problems.

**Use every control with real input, at several sizes.** Reading the markup, or calling
`el.click()`, `dispatchEvent` or a setter, skips hit testing, focus, default actions and
scroll chaining, so a covered button or a trapped wheel still looks fine. Use the page the
way a person does: trusted mouse, wheel, key and touch events from
`node "${CLAUDE_PLUGIN_ROOT}/shared/input/drive.mjs"` (its
[README](../../shared/input/README.md) has the steps and recipes), or a browser tool's real
clicks and keys. Script is only for setting up a view and reading state afterwards.

- Do it at three sizes or more: the largest, a middle one and the smallest supported (for
  a design, its presets; for a tool, browser windows such as 1440×900, 1024×700 and
  640×480).
- At each size, list the controls (`controls`), then use every one as its kind is meant to
  be used: click or tap, type, drag and cancel with Esc, right-click, open and close with
  the keyboard, and wheel or swipe over every scroller past its end.
- A few native controls can't be driven with trusted input headless: a select's popup,
  file pickers, and colour and date pickers. Choose a select's option with the driver's
  `choose` step, and list the rest under *Not checked*.
- Read each result: a control that is `covered`, out of view with no way to reach it, or
  missing at one size; a `scrolled` that shows the wheel trapped; focus lost to `body`;
  page errors. Each is a finding at that size.

1. **Task walkthrough:** for each flow, ask the four cognitive walkthrough questions at
   every step.
2. **Composition:** each screen as a whole, then each section, against the composition
   rules ([shared/composition/principles.md](../../shared/composition/principles.md)).
   Run its audit at the largest and smallest size and read the blurred screenshot first,
   before you look at any one control. When reviewing a revision, also compare it with
   the previous version: what did the round add, and is the screen busier for it?
3. **Control by control:** every control in the inventory against the control checks.
4. **Heuristics:** each screen against Nielsen's 10.
5. **Accessibility:** WCAG 2.2 AA. Compute contrast; don't eyeball it.
6. **Platform:** the rules for the platform and size class from step 2.
7. **Resize and variants:** every preset, the split widths, 320-wide reflow, 200% text,
   dark mode, each data state, and on touch devices both orientations and the keyboard up
   (desktop windows don't rotate: check the minimum, maximum and short window instead).
8. **Tools:** for a tool built for the owner, the work stays in view at every window size,
   the stage pans past its edges, zoom has limits, and shortcuts and drags behave.

Record a problem the moment you see it, with where you saw it (screen › element, plus the
size, scheme and state). One problem that shows up in several places is one finding with
several locations.

## 5. Rate severity

Use Nielsen's 0–4 scale. Weigh how many users hit the problem, how badly it hurts them,
and whether it keeps hurting once they know about it. See the checklist's severity guide.

| Rating | Meaning |
| --- | --- |
| 4 Catastrophe | Stops people finishing a task, or loses their data. Fix before release. |
| 3 Major | Slows or confuses many people, or fails WCAG AA on a primary flow. Fix soon. |
| 2 Minor | Slows some people, or there's an obvious workaround. |
| 1 Cosmetic | Polish. Fix if there's time. |

Don't report 0s. A WCAG AA failure is never below 2.

## 6. Report

Lead with a one-paragraph verdict: the platform, the sizes reviewed, the evidence you had,
the first impression (what the blurred screen shows, and whether the screen reads as
organised or cluttered), the counts by severity, and the top problem. Weigh a disorganised
primary surface against bugs on equal terms: it slows every use, not just one path. Then list the findings, highest severity first
and in flow order within a severity, using the template in the checklist:

- **ID and severity**, e.g. `R3 · 3 Major`
- **Element:** screen › section › element (or screen › section, or the whole screen, for
  a composition finding), and the size, scheme or state where it shows
- **Evidence:** Confirmed or Likely
- **Problem:** what goes wrong for the user, in one or two sentences
- **Principle:** the rule it breaks, with its source key (`WCAG 1.4.3`, `NNG-H4`,
  `tablet:AND-T2`)
- **Fix:** a concrete change with values (`raise the label to #595959 for 7.0:1`, not
  `improve contrast`)

Close with what works well (keep it short), what you couldn't check and why (screen reader
output, real devices, motion), and a note that one reviewer misses problems that others
catch, so a second reviewer or a usability test is worth doing.

If the report is going to someone else, offer to publish it as an artifact. Offer to apply
the fixes with the matching ultrahand design skill.

## 7. Learn

When the owner corrects the result, states a lasting preference ("we never…") or
dismisses a finding as intended, add a lesson to `design/LESSONS.md`. When the correction
shows that this skill, its rules or its scripts are wrong for any project, also write a
plugin report, and always log it in LESSONS.md. Both are in
[shared/learning/README.md](../../shared/learning/README.md).
