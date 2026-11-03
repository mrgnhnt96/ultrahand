---
description: A plain review request loads ultrahand:review and no other ultrahand skill
tags: [smoke, trigger]
runs: 3
max_turns: 6
timeout_seconds: 240
allowed_tools: [Skill, Read, Glob, Grep]
append_system_prompt: "This is a skill-routing test. Load any skill the request calls for, then reply with a plan of at most five lines and stop. Don't build, write or publish anything."
---

Can you critique this checkout screen for usability problems?

```html
<form>
  <input placeholder="Card number">
  <input placeholder="MM/YY"> <input placeholder="CVC">
  <a href="#" style="color:#aaa;font-size:11px">Pay now</a>
</form>
```
