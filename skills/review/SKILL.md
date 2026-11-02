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

## 1. Get the design and know what it can show

Use the richest evidence the user can give. Say which kind you have, because it limits what
you can confirm.

- **ultrahand canvas artifact** (a claude.ai artifact link): read its HTML. It holds the
  markup, labels, colours and every screen and state. If a browser tool is available, open
  the artifact and drive it through `window.ultrahandCanvas` (see the canvas README in
  `shared/canvas/`): `usePreset(id)`, `setSize(w, h)`, `setScheme('dark')`,
  `setTextScale(2)`, `setState('error')`, `navigate(id)`. Turn on **show tap targets** and
  read the canvas readout (`#uh-flag`), which flags targets under the platform minimum.
  Call `refresh()` after opening a sheet or menu so the count includes it. The canvas
  README lists the toolbar's element ids for scripted checks. A prototype's stubs (no real
  network, no on-screen keyboard) go under *Not checked*, not in the findings. The
  hardware keyboard is real: drive every flow with it.
- **Local canvas build** (an `index.html` from `build.mjs`): treat it like the artifact.
  Open it in a headless browser if one is available, and drive keys, right-click and drags
  with real input (for example Playwright's `page.keyboard` and `page.mouse`), not
  synthetic `dispatchEvent` calls, which skip focus and default actions.
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

Pick the platform rules by **window size class and input**, not by device name: compact
touch → mobile principles; medium and expanded touch, or any split → tablet; a pointer and
keyboard window → desktop. A responsive design gets all the sets its sizes cover.

## 3. Inventory the design

List every screen and state, every flow between screens, and every interactive control on
each screen (buttons, links, fields, toggles, tabs, menus, gestures, drag targets). The
inventory is the review's coverage: a control you didn't list is a control you didn't
check.

## 4. Inspect in passes

Work through the passes in [references/checklist.md](references/checklist.md) in order.
Go through the design twice: once to learn it, once to find problems.

1. **Task walkthrough:** for each flow, ask the four cognitive walkthrough questions at
   every step.
2. **Control by control:** every control in the inventory against the control checks.
3. **Heuristics:** each screen against Nielsen's 10.
4. **Accessibility:** WCAG 2.2 AA. Compute contrast; don't eyeball it.
5. **Platform:** the rules for the platform and size class from step 2.
6. **Resize and variants:** every preset, the split widths, 320-wide reflow, 200% text,
   dark mode, each data state, and on touch devices both orientations and the keyboard up
   (desktop windows don't rotate: check the minimum, maximum and short window instead).

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
the counts by severity, and the top problem. Then list the findings, highest severity first
and in flow order within a severity, using the template in the checklist:

- **ID and severity**, e.g. `R3 · 3 Major`
- **Element:** screen › element, and the size, scheme or state where it shows
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
