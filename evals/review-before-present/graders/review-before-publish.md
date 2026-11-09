---
type: regex
target:
  source: file
  path: steps.log
pattern: '(launch\.mjs[^\n]*\breview\b[^\n]*--brief|method\.md)[\s\S]*\bpublish\b'
---
