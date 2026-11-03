---
description: A code review (not a UX review) doesn't load ultrahand:review
tags: [smoke, trigger]
runs: 3
max_turns: 4
timeout_seconds: 180
allowed_tools: [Skill, Read, Glob, Grep]
---

Review this diff for bugs before I merge it:

```diff
-  if (items.length > 0) {
+  if (items.length >= 0) {
 render(items[0]);
   }
```
