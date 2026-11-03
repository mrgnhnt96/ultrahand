---
description: A plain tablet request loads ultrahand:tablet and no other ultrahand skill
tags: [smoke, trigger]
runs: 3
max_turns: 6
timeout_seconds: 240
allowed_tools: [Skill, Read, Glob, Grep]
append_system_prompt: "This is a skill-routing test. Load any skill the request calls for, then reply with a plan of at most five lines and stop. Don't build, write or publish anything."
---

We need the iPad version of our notes app's main screen, with the note list and the editor side by side in split view.
