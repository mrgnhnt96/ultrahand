---
type: llm
weight: 2
---

Judge only the final message to the user.

PASS if it hands the design over as the spec (design/pantry/spec.json) and the brief beside
it, not only as the design's link or a picture, and tells the developer all three: put the
same anchors in the code; build section by section, checking each section against the
spec before starting the next; keep screenshots to one pair per screen and one full review
for the end.
FAIL if it hands over only the design or screenshots, leaves out the anchors, tells the
developer to check the build by comparing screenshots of each section or every screen at
every size, or says the spec still needs writing.
