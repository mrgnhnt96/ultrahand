#!/usr/bin/env bash
set -euo pipefail
echo "scaffold cwd=$(pwd) script=$0" >&2
mkdir -p design
cat > design/LESSONS.md <<'MD'
# Design lessons

What this project's owner has taught the ultrahand skills. Every skill reads this before
it starts. Format: ultrahand `shared/learning/README.md`.

## L1 · dialogs · 2026-10-20
- **Rule:** Confirmation dialogs right-align two compact buttons, never full-width ones.
- **Why:** Full-width buttons make the desktop app look like the phone app.
- **Applies to:** desktop, review
- **From:** the owner's correction on the archive dialog

## L2 · copy · 2026-10-22
- **Rule:** A destructive button names the action and the object ("Delete ticket"), never "OK" or "Yes".
- **Why:** Agents confirm dozens of dialogs a day and read only the button.
- **Applies to:** all
- **From:** the owner's correction on the merge dialog
MD
