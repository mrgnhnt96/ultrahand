#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
mkdir -p design src
cp "$root/shared/theme/example.tokens.json" design/theme.tokens.json
node "$root/shared/theme/css.mjs" design/theme.tokens.json --out src/theme.css
cat > design/THEME.md <<'MD'
# Field notes theme

Version 1.0.0 · tokens: design/theme.tokens.json

## Decisions
| Decision | Value | Status |
| --- | --- | --- |
| Accent | clay (#8f3f26) | locked |
| Corners | 4 on controls, 8 on containers | locked |

## Components
| Component | Defined in |
| --- | --- |
| Button (`.button`) | src/button.css |
| Card (`.card`) | src/card.css |
MD
cat > src/button.css <<'CSS'
.button { background: var(--color-primary); color: var(--color-on-primary); border-radius: var(--button-radius); padding: 0 var(--button-padding-x); }
CSS
cat > src/card.css <<'CSS'
.card { background: var(--card-bg); border-radius: var(--card-radius); padding: var(--space-inset); }
CSS
cat > src/checkout.css <<'CSS'
.checkout { padding: 20px; display: grid; gap: 6px; }
.pay-btn { background: #8e3f27; color: #fff; border-radius: 6px; padding: 10px 18px; }
.total { color: #1d1b19; font-size: 15px; }
CSS
