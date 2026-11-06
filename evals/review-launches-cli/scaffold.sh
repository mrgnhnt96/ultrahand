#!/usr/bin/env bash
set -euo pipefail
mkdir -p app design
cat > README.md <<'MD'
# Helpdesk

A desktop helpdesk app (resizable window, mouse and keyboard) for support agents, who use
it all day. The main task is finding a ticket by its title.
MD
printf '# Lessons\n\n- Times are 12-hour.\n' > design/LESSONS.md
cat > app/search.html <<'HTML'
<main class="search"><input placeholder="Search tickets" aria-label="Search tickets">
<ul class="results"><li><a href="#">T231 · Printer offline</a></li></ul>
<p class="empty" hidden>No tickets match.</p></main>
HTML
cat > app/settings.html <<'HTML'
<main class="settings"><h1>Settings</h1>
<label><input type="checkbox"> Email me when a ticket is assigned</label>
<button>Save</button></main>
HTML
