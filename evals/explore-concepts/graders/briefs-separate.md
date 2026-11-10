---
type: llm
---

Look at the concept briefs the run wrote (explore/<id>/brief.md, or the text it used to
start each concept) as they appear in the trace.

PASS if each brief holds the requirements, the theme or its rules, and that concept's own
position, and never names another concept, another position or how many concepts there
are.
FAIL if any brief mentions another concept or the set of concepts, or if no brief was
written and the concepts were built together from one shared plan.
