#!/usr/bin/env bash
set -euo pipefail
mkdir -p design src
printf '# Notes app\n\nA phone notes app (iOS and Android).\n' > README.md
printf '.row { padding: 16px; }\n' > src/settings.css
