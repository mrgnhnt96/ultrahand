---
name: review
description: Use only when the user asks for a UX review or critique of an existing UI design, screen, or flow. Do not use for code review or non-UI work.
---

# ultrahand: review

Get a UI design reviewed by inspectors that run outside this session. One command starts a
separate, locked-down `claude` process for each screen or flow. Each one walks its flows and
controls against the platform's principles, Nielsen's 10 heuristics and WCAG 2.2 AA, and
only a merged findings file comes back. This session plans the review, judges what comes
back and writes the report, so it stays small enough to finish.

**Don't do the review here.** Never read `references/checklist.md`,
`references/method.md`, source files or captures for the review itself: they belong to the
reviewers. Reading them here fills this session until it stops.

For a project with a theme, check the design against it with the `theme-review` skill:
token use, component reuse and consistency across screens are its job, not this one's.

## 1. Split the scope into units

A unit is one screen or one flow, and each gets its own reviewer. Work the units out from
the request, file names and the project's README, without reading the code to judge it. A
unit may hold at most 16 captures and 64 KB of code; the launcher refuses a bigger one and
names it, so split it rather than cut what it covers.

Keep captures as a local folder, such as `design/captures/<run>/`, as well as in any
artifact: a plan names only local files, and a reviewer can't open a link. A design that
exists only as an artifact: save its HTML into the project and list that file under `code`.

## 2. Write the plan

Write it to `design/reviews/<run>.json`, where `<run>` is a short name for this review. The
report folder takes the same name. Paths are absolute, or relative to the plan's folder.

```json
{
  "version": 1,
  "platform": "macOS",
  "users": "Support agents, all day",
  "primary_task": "Find a ticket by its title",
  "lessons": "../LESSONS.md",
  "units": [
    {
      "name": "Search",
      "scope": "The search overlay: open, type, pick a result, no results",
      "code": ["../../src/search.rs"],
      "captures": [
        { "path": "../captures/search/empty.png", "state": "empty", "theme": "dark", "size": "1440x900" }
      ]
    }
  ]
}
```

- **`platform`, `users`, `primary_task`:** required, for the whole plan or on a unit that
  differs. Infer them from the request and the project. In an interactive session, ask the
  user only for what can't be inferred. Otherwise write `unknown`: the reviewer lists it
  under *Not checked*.
- **`lessons`:** the path to the project's `design/LESSONS.md`, if it has one. Pass the path
  on without reading the file for the review: each reviewer reads it and applies it.
- **`code`, `captures`:** every unit needs at least one of them. `state`, `theme` and `size`
  are optional labels for a capture.

## 3. Launch it

Check the plan first, then run it. Use Bash with `run_in_background: true` for both, because
the first use on a machine fetches or builds the program and a review takes minutes. Wait
for the notification each time: no polling, and nothing read from the report folder in the
meantime.

```sh
node "${CLAUDE_PLUGIN_ROOT}/shared/review/launch.mjs" --data "${CLAUDE_PLUGIN_DATA}" review --plan design/reviews/<run>.json --dry-run
node "${CLAUDE_PLUGIN_ROOT}/shared/review/launch.mjs" --data "${CLAUDE_PLUGIN_DATA}" review --plan design/reviews/<run>.json
```

The run prints the path of the merged findings and the counts by severity.

| Exit | Meaning | Do this |
| --- | --- | --- |
| 0 | Every unit finished. | Go to step 4. |
| 1 | A unit failed. The merged file is still written, with the failure under *Not checked*. | Rerun it once with `--only "<unit name>"`, then go to step 4. |
| 2 | The plan or a flag was refused, and nothing started. | Fix what it names and launch again. |
| 3 | There's no program for this machine. | Use the fallback below. |
| 4 | A checksum didn't match, and nothing ran. | Stop and tell the user. No retry and no fallback. |

**Fallback:** if the launcher can't start, run the review in a general-purpose agent, one per
unit, started with the Agent tool. Never run it in this session, and never in a fork, which
shares this context. Tell the agent: the plugin root is `${CLAUDE_PLUGIN_ROOT}`; read
`skills/review/references/method.md` under it and follow it, using that root for the plugin
paths the file names; review this unit, with its fields from the plan; write the report to
`design/reviews/<run>/<unit>.md`; answer with that path and the counts by severity. Say in
your report that the fallback ran.

## 4. Read the findings

Read `findings.json` from the path the run printed, and only that. Leave the `units/` folder,
the reviewers' records and the captures alone.

## 5. Judge them

The merge is mechanical, so the judgement is yours:

- **Duplicates:** two units reporting one problem become one finding with both locations.
- **Ranking:** set the final order, so what hurts the primary task most comes first.
- **Spot-check:** before you rely on them, check every 4 and up to three 3s against the code
  they name, reading only those lines. Mark each finding `checked` or `not checked`. Correct
  or drop one that doesn't hold, and say which.

## 6. Report

Give the verdict, the counts by severity and the findings in their format (ID and severity,
element, evidence, problem, principle, fix), with each spot-check mark. Then what works well,
and everything under *Not checked*: failed units, unknowns and what no reviewer could reach.
Close with a note that one review misses problems that others catch, so a second reviewer or
a usability test is worth doing.

If the report is going to someone else, offer to publish it as an artifact. Offer to apply
the fixes with the matching ultrahand design skill. Use `ultrahand:desktop` (or `mobile` or
`tablet` for those platforms) for concepts only on findings that need a new layout.

## 7. Learn

When the owner corrects the result, states a lasting preference ("we never…") or
dismisses a finding as intended, add a lesson to `design/LESSONS.md`. When the correction
shows that this skill, its rules or its scripts are wrong for any project, also write a
plugin report, and always log it in LESSONS.md. Afterwards run
`node "${CLAUDE_PLUGIN_ROOT}/shared/learning/size.mjs" design`, and if it says
`compact: yes`, offer to compact the records. All three are in
[shared/learning/README.md](../../shared/learning/README.md).
