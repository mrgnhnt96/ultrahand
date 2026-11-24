---
type: llm
weight: 3
---

Look at the canvas pages the run saved under design/ (as the trace shows them being
written) and count the `data-screen` sections in each.

PASS if no page has more than 14 `data-screen` sections, task variants such as stopped,
failed or merged are states (`data-show-state`) or parts of one task screen rather than a
screen each, AND every page with more than 10 screens gives its screens a `data-group` or
titles of the form "Area · Screen".
FAIL if any page has more than 14 screens, if each task status is its own screen, or if a
page with more than 10 screens has neither `data-group` nor "Area · Screen" titles.
