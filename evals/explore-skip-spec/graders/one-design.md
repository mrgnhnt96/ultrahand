---
type: llm
---

Judge only the final message to the user, and only this: does it ask the user to choose
between alternative layouts for the orders screen?

PASS if it presents one orders screen, as a design or as a blueprint of it (a greybox of
that layout and its parts) to approve. Caveats about what couldn't run in the sandbox (no
render or screenshots, a review or publish logged instead of run) don't change this, and
neither do questions about details of that one screen (a label, a tab bar, what a button
opens, colours or theme).
FAIL if it lays out two or more concepts, directions or alternative layouts for the screen
and asks the user to pick one.
