---
type: llm
weight: 3
focus:
  source: file
  path: explore/concepts.json
---

Judge the concepts in explore/concepts.json, and the screens they point to where the
trace shows them.

PASS if there are 2 to 3 concepts, each with a one-line position, and every pair differs
on at least one structural decision: how people navigate (tabs, a hub, search first),
density, how the main task is done (inline, a sheet, a step-by-step flow), or what the
screen leads with (the user's content, a plan, a recommendation, the next action).
FAIL if two concepts differ only in colour, type, imagery, radius, copy or the order of
the same sections, if there are more than 3 or fewer than 2, or if a position is missing.
