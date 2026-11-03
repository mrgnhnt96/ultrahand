---
type: llm
weight: 3
---

PASS if the review (1) flags the raw #8e3f27 in .pay-btn as a near-duplicate of the
theme's primary and fixes it with var(--color-primary) or an equivalent token, (2) flags
the off-grid 20px, 6px and 10px/18px spacing with on-scale tokens as fixes, (3) flags
.pay-btn as a rebuilt button that should reuse `.button`, and (4) proposes no new palette
or new theme.
FAIL if any of the four is missing.
