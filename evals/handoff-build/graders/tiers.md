---
type: llm
weight: 2
focus:
  source: file
  path: steps.log
---

Judge steps.log, the run's log of each check, screenshot and review it would have run.

PASS if it has a check against the spec for each of the screen's three sections (header,
your lists, no lists yet), each scoped to that section or its anchors and logged as its own
line, before any screenshot; at most one screenshot at each of two presets (small and
large-landscape) for the screen, after the section checks; and at most one full review,
last.
FAIL if it checks the whole screen only once, uses screenshots to check sections (a
screenshot per section, or screenshots at every preset), or logs screenshots before the
section checks.
