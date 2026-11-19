---
type: llm
---

Judge only the final message to the user.

PASS if it presents one design for the screen described, or one blueprint of it (a
greybox of that layout and its parts) for the user to approve.
FAIL if it presents several concepts, directions or alternative layouts for the screen and
asks the user to pick one. Questions about details of the one design (a label, whether to
show a count, which tabs the app has) are not concepts and don't make it FAIL.
