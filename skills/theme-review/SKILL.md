---
name: theme-review
description: Use only when the user asks to review or audit a UI theme, design tokens, or a design or codebase for visual consistency and component reuse against its theme. Do not use for general code review, UX flow reviews, or non-UI work.
---

# ultrahand: theme-review

Audit how well a project holds to its theme: whether the theme file itself is sound, and
whether the designs and code actually use it. The output is a ranked list of findings plus
a list of proposed theme changes. The reviewer **builds on the project's theme; it never
invents a new one**. A gap in the theme becomes a proposed addition for the `theme` skill
to make, not a fresh palette.

The rules are in [shared/theme/rules.md](../../shared/theme/rules.md) (non-negotiables
NN-n, creative axes CR-n, evolution rules EV-n); every check is in
[references/checklist.md](references/checklist.md), and both cite
[shared/theme/sources.md](../../shared/theme/sources.md). For UX problems beyond the theme
(flows, labels, platform conventions), point to the `review` skill instead.

The scripts below live in `${CLAUDE_PLUGIN_ROOT}/shared/theme/`.

**Lessons:** before step 1, read the project's `design/LESSONS.md` and apply the
lessons for this skill. They record what the owner has already corrected, so don't repeat
those mistakes. See [shared/learning/README.md](../../shared/learning/README.md).

## 1. Get the theme and the target

- **The theme:** find `design/THEME.md` and the token file (search as the `theme` skill's
  step 1 does). Read THEME.md: its personality, which decisions are locked, its component
  inventory and its changelog. Those are what the target is held to.
- **No theme yet:** don't make one up. Run `node scan.mjs <src dir>` to show the values
  the code uses today, and review against the non-negotiables alone. Recommend the
  `theme` skill to extract a theme from it, and put the scan's main clusters in the report
  as the starting point.
- **The target:** code (a source folder, a diff or a PR), a canvas artifact, or a
  screenshot. As with `review`, say which you have and mark each finding **Confirmed**
  (measured in code, the token file or the canvas) or **Likely** (judged from an image).
  For a diff, review what it changes, and note any drift it adds.

## 2. Run the checks

1. **Theme file:** `node check.mjs design/theme.tokens.json --json`. Every error is a
   finding; read the contrast table for both schemes.
2. **Token use in code:** `node scan.mjs <src dir> --theme design/theme.tokens.json`.
   - *raw values that match a token*: a hard-coded copy of a theme value. When the theme
     changes, these won't [HIG-COLOR] [PRIMER-LINT].
   - *values with no token*: drift off the theme. Each one is either a mistake (snap it to
     the nearest token shown) or a real need (propose a token).
   - *tokens no file mentions*: possibly unused. Confirm before proposing removal; the
     scan matches names by pattern.
   - *near-duplicate colours* and *spacing off the grid*: one finding per cluster, not per
     line.
   Also search for primitive tokens used directly in code (`primitive.`, or the
   platform's equivalent), which skips the role (NN-1).
3. **On the canvas or a live page:** read computed styles for the elements under review.
   The composition audit (`shared/composition/audit.mjs`, run through
   `shared/input/drive.mjs`) reports control styles, type sizes and gaps per section,
   which shows a second button style or a stray type size at once.
4. Work through the passes in [references/checklist.md](references/checklist.md):
   theme health, token use, component reuse, consistency across screens, both schemes,
   and character.

The scripts find patterns, not proof. Open each lead and confirm it before it becomes a
finding.

## 3. Rate and report

Rate with the same 0–4 scale as `review` (see its checklist's severity guide), using the
anchors in this skill's checklist. One problem in many places is one finding with a
count and its main locations.

```markdown
## Verdict
<Theme version and target, evidence, counts by severity, the single biggest source of
drift.>

## Findings
### T1 · 3 Major · <short title>
- **Where:** <file:line, screen › element, or token path>; ×<count>
- **Evidence:** Confirmed | Likely
- **Problem:** <what drifts, and what it costs: inconsistency people see, or a value that
  won't follow the next theme change>
- **Rule:** <NN-n / EV-n / CR-n> [<source key>]
- **Fix:** <concrete: "replace #8e3f27 with var(--color-primary) in 3 places">

## Proposed theme changes
<For the theme skill to apply. Each: add / deprecate / lock, the token or decision, its
value as an alias, why, and which findings need it. Leave out anything that existing
tokens already cover.>

## What works
## Not checked
```

Keep fixes inside the theme: snap to an existing token first, propose a token second, and
never suggest a value that breaks a non-negotiable. Offer to apply the code fixes, and to
run the `theme` skill for the proposed changes.

## 4. Learn

When the owner corrects the result, states a lasting preference ("we never…") or
dismisses a finding as intended, add a lesson to `design/LESSONS.md`. When the correction
shows that this skill, its rules or its scripts are wrong for any project, also write a
plugin report, and always log it in LESSONS.md. Afterwards run
`node "${CLAUDE_PLUGIN_ROOT}/shared/learning/size.mjs" design`, and if it says
`compact: yes`, offer to compact the records. All three are in
[shared/learning/README.md](../../shared/learning/README.md).
