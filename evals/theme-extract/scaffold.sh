#!/usr/bin/env bash
set -euo pipefail
mkdir -p src/components
cat > src/styles.css <<'CSS'
:root { --brand: #0f766e; --text: #1f2933; --bg: #ffffff; --muted: #616e7c; --line: #cbd2d9; }
body { font: 16px/1.5 system-ui, sans-serif; color: var(--text); background: var(--bg); margin: 0; }
h1 { font-size: 28px; font-weight: 700; }
h2 { font-size: 20px; font-weight: 600; }
.page { padding: 24px; max-width: 960px; }
.card { border: 1px solid var(--line); border-radius: 6px; padding: 14px; margin-bottom: 16px; }
.muted { color: var(--muted); font-size: 13px; }
.error { color: #c81e1e; }
.banner-error { background: #fde8e8; color: #c51f1f; padding: 10px 16px; border-radius: 6px; }
CSS
cat > src/components/button.css <<'CSS'
.btn { background: var(--brand); color: #fff; border: 0; border-radius: 6px; padding: 10px 16px; font-size: 16px; }
.btn:hover { background: #0e6f67; }
.btn-secondary { background: transparent; color: #0f766e; border: 1px solid #0f766e; border-radius: 6px; padding: 10px 16px; }
.icon-btn { width: 40px; height: 40px; border-radius: 8px; }
CSS
cat > src/components/list.css <<'CSS'
.row { display: flex; gap: 6px; padding: 12px 16px; border-bottom: 1px solid var(--line); }
.row:hover { background: #f5f7fa; }
.row .meta { color: #616e7c; font-size: 13px; margin-left: auto; }
.tag { background: #e6f4f1; color: #0f766e; border-radius: 999px; padding: 2px 8px; font-size: 12px; }
CSS
