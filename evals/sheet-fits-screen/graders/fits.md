---
type: llm
weight: 3
focus:
  source: file
  path: design/purchase-sheet.html
---

Look at how the bottom sheet's height is set, in its CSS and in the script that switches
its views. `min-height` beats `max-height` in CSS, so a px floor larger than the screen
pushes the sheet off the top.

PASS if the sheet's tallest size is tied to the screen (a percentage, `dvh`, or the screen
height less the top inset) AND every height or `min-height` the script sets in px, such
as one kept so the sheet doesn't jump between views, is capped by that same limit (for
example `min(<n>px, <limit>)`) or recomputed when the screen resizes.
FAIL if the script sets a bare px `min-height`, or a px `height` with no `max-height`
tied to the screen, that stays in place after the frame gets shorter.
