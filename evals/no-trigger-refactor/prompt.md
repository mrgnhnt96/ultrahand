---
description: Plain coding work loads no ultrahand skill
tags: [smoke, trigger]
runs: 3
max_turns: 4
timeout_seconds: 180
allowed_tools: [Skill, Read, Glob, Grep]
---

Refactor this function to use async/await instead of .then chains:

```js
function load(id) {
  return fetch(`/api/items/${id}`).then(r => r.json()).then(d => d.item);
}
```
