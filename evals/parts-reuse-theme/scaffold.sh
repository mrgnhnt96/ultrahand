#!/usr/bin/env bash
# A themed project whose inventory has Button, Text field and Card.
set -euo pipefail
plugin="$(cd "$(dirname "$0")/../.." && pwd)"
mkdir -p design
printf '# Switchback\n\nAn iPhone app for logging hikes.\n' > README.md
cp "$plugin/shared/theme/example.tokens.json" design/switchback.tokens.json
cat > design/THEME.md <<'MD'
# Switchback theme

Version 1.0.0 · tokens: switchback.tokens.json

Warm and editorial, built for reading outdoors. Light and dark.

## Components
| Component | Variants | Tokens | Defined in |
| --- | --- | --- | --- |
| Button | primary, secondary, text | button.*, radius.control | src/ui/Button.swift |
| Text field | default, multiline | color.outline, radius.control | src/ui/TextField.swift |
| Card | default | card.* | src/ui/Card.swift |

## Changelog
- 1.0.0 (2026-10-01): first version.
MD
