#!/usr/bin/env bash
set -euo pipefail
mkdir -p design
L=design/LESSONS.md
cat > $L <<'MD'
# Design lessons

What this project's owner has taught the ultrahand skills. Every skill reads this before
it starts. Format: ultrahand `shared/learning/README.md`.

## L1 · dialogs · 2026-08-01
- **Rule:** Confirmation dialogs right-align their buttons.
- **Why:** Matches the platform and keeps the primary action in the same place.
- **Applies to:** desktop, review
- **From:** the owner's correction on the archive dialog

## L2 · copy · 2026-08-02
- **Rule:** A destructive button names the action and the object ("Delete ticket"), never "OK".
- **Why:** Agents confirm dozens of dialogs a day and read only the button.
- **Applies to:** all
- **From:** the owner's correction on the merge dialog

## L3 · type · 2026-08-03
- **Rule:** Body text in the console is 14px.
- **Why:** Tables need the density; 16px forces horizontal scrolling.
- **Applies to:** desktop, theme
- **From:** the owner's correction on the ticket table

## L4 · navigation · 2026-08-04
- **Rule:** The sidebar collapses to icons below 1100px.
- **Why:** An older layout; replaced.
- **Applies to:** desktop
- **From:** the owner's correction on the first layout
- **Superseded by:** L30

## L5 · dialogs · 2026-08-05
- **Rule:** Dialog buttons are compact, never full-width.
- **Why:** Full-width buttons make the desktop app look like the phone app.
- **Applies to:** desktop, review
- **From:** the owner's correction on the delete dialog
MD
n=6
for area in tables tables forms forms empty-states empty-states search search toasts toasts \
            menus menus badges badges keyboard keyboard filters filters avatars avatars charts charts; do
  cat >> $L <<MD

## L$n · $area · 2026-09-$(printf %02d $(( (n % 28) + 1 )))
- **Rule:** Distinct rule R$n for $area: keep element $n labelled with its own visible text.
- **Why:** The owner's reason for rule R$n.
- **Applies to:** all
- **From:** a correction on screen $n
MD
  n=$((n+1))
done
for old in 28 29 31 32; do
  cat >> $L <<MD

## L$old · retired · 2026-10-01
- **Rule:** Retired rule X$old.
- **Why:** No longer true.
- **Applies to:** all
- **From:** an early correction
- **Superseded by:** L$((old-20))
MD
done
cat >> $L <<'MD'

## L30 · navigation · 2026-10-10
- **Rule:** The sidebar collapses to an icon rail below 1008px.
- **Why:** Matches the Windows NavigationView breakpoint.
- **Applies to:** desktop, review
- **From:** the owner's correction on the second layout

## Plugin feedback
- 2026-08-10 · desktop step 6 · body-size rule too strict for dense tools · fixed in v0.3.1
- 2026-08-12 · scan.mjs · letter-spacing counted as spacing · fixed in v0.3.1
- 2026-08-20 · check.mjs · alpha lost on hex colours · fixed in v0.3.1
- 2026-09-01 · review · asked for a dark-mode screenshot it can't take · declined
- 2026-09-05 · mobile · suggested a hamburger menu · fixed in v0.2.0
- 2026-10-15 · tablet · split view ignores the keyboard · open
MD
T=design/THEME.md
cat > $T <<'MD'
# Console theme

Version 1.14.0 · tokens: design/theme.tokens.json

## Decisions
| Decision | Value | Status | Why |
| --- | --- | --- | --- |
| Accent | cobalt | open | No brand yet |

## Components
| Component | Variants | Tokens |
| --- | --- | --- |
| Button (`.tb`) | default, primary | radius.control |

## Changelog
MD
for i in $(seq 14 -1 0); do echo "- 1.$i.0 ($(( 2025 + i / 12 ))-$(printf %02d $(( i % 12 + 1 )))-01): change number $i to the console theme." >> $T; done
