---
type: regex
target:
  source: file
  path: steps.log
pattern: '^[^\n]*\bpublish\b[\s\S]*(launch\.mjs[^\n]*\breview\b|method\.md)'
match: not_contains
---
