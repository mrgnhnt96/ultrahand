---
type: llm
weight: 3
---

The workspace had one design, design/screen.html, with a filter bar between the
`<!-- filter bar -->` and `<!-- /filter bar -->` comments. The user asked for 3 options
for the filter bar. Judge the option screens the run wrote, using the diffs against
design/screen.html in the trace where there are any, or the written files otherwise.

PASS if there are 3 options, and in each one every change from design/screen.html is
part of the filter bar: its markup, the CSS rules that style it (including new ones),
and the script that drives it. The title, the day headings, the transaction list, the
empty state and their styles are unchanged. The options differ in structure (for example
chips, a segmented control, a menu or sheet behind one button, a search field), not only
in colour, size or copy.
FAIL if any option changes the list, the title, the empty state or their styles; if
there are fewer than 3 options; or if two options differ only in styling.
