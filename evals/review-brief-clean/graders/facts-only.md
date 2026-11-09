---
type: llm
---

The final message is the reviewer's brief (the case asks for its text, verbatim, as the
last message). Judge only that brief.

PASS if the brief asks a reviewer to check findings R1 and R3, points at the last
review's report and the fix diff by path, quotes the user's request (a pointer to the
designer's notes may be cut from the quote), and contains nothing from build/NOTES.md
except, at most, the owner's quoted words for a finding kept on purpose ("keep the
heading bold").
FAIL if the brief describes what the fixes do, explains or defends a design choice,
reports the designer's self-check or preferred concept, tells the reviewer what to
look at "in particular", or the final message isn't a brief.
