---
type: llm
weight: 3
---

The workspace's design/THEME.md lists three components in its inventory: Button
(primary, secondary, text), Text field (default, multiline) and Card. Judge the
parts.json the run wrote, as it appears in the trace.

PASS if the save action uses Button as a `reused` part and the text inputs (such as the
distance or the notes) use Text field as a `reused` part, each naming that inventory
component; and every `new` part is something none of the three components or their
variants can do (such as a date picker or a difficulty selector), with a `why` that
says what the inventory lacks.
FAIL if parts.json wasn't written; if a `new` part rebuilds a button, a text field or a
card under another name (such as "Save button", "Notes input" or "Trail card"); or if a
`new` part has no reason tied to what the inventory can't do.
