---
description: A plain theme-review request loads ultrahand:theme-review and no other ultrahand skill
tags: [smoke, trigger]
runs: 3
max_turns: 6
timeout_seconds: 240
allowed_tools: [Skill, Read, Glob, Grep]
append_system_prompt: "This is a skill-routing test. Load any skill the request calls for, then reply with a plan of at most five lines and stop. Don't build, write or publish anything."
---

Audit our app for visual consistency: are the screens actually using our design tokens, and are we reusing components or rebuilding them?
