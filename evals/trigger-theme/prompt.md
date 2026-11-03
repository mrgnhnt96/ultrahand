---
description: A plain theme request loads ultrahand:theme and no other ultrahand skill
tags: [smoke, trigger]
runs: 3
max_turns: 6
timeout_seconds: 240
allowed_tools: [Skill, Read, Glob, Grep]
append_system_prompt: "This is a skill-routing test. Load any skill the request calls for, then reply with a plan of at most five lines and stop. Don't build, write or publish anything."
---

Pull the colours, spacing and type out of our web app's CSS into a proper design token theme, so future screens stay consistent.
