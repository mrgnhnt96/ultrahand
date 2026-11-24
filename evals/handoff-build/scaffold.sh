#!/usr/bin/env bash
# A small web app with an approved design handed off as spec.json plus the plugin's implementer brief.
set -euo pipefail
plugin="$(cd "$(dirname "$0")/../.." && pwd)"
mkdir -p design/pantry src
printf '# Pantry\n\nA shopping list web app for phones. Plain HTML, CSS and JavaScript in src/, no build step.\n' > README.md
cp "$plugin/shared/handoff/implement.md" design/pantry/HANDOFF.md
cat > design/pantry/spec.json <<'JSON'
{
  "spec": 1,
  "title": "Pantry",
  "platform": "mobile",
  "design": { "artifact": "https://claude.ai/artifact/0a1b2c3d-pantry-eval", "round": 3, "approved": "2026-11-20" },
  "theme": null,
  "locale": "en",
  "sizeClasses": { "width": [{ "name": "compact", "min": 0 }, { "name": "medium", "min": 600 }, { "name": "expanded", "min": 840 }] },
  "presets": [
    { "id": "small", "width": 360, "height": 800 },
    { "id": "large", "width": 430, "height": 932 },
    { "id": "large-landscape", "width": 932, "height": 430 }
  ],
  "shots": ["small", "large-landscape"],
  "states": [{ "id": "default" }, { "id": "empty", "label": "No lists" }],
  "screens": [
    {
      "id": "lists", "anchor": "lists", "title": "Lists",
      "sections": [
        {
          "id": "header", "anchor": "lists.header", "name": "Header",
          "job": "Say which screen this is", "role": "chrome", "place": "top",
          "layout": { "compact": { "place": "top", "sticky": true } },
          "members": [
            { "id": "lists", "anchor": "lists.header.lists", "kind": "title", "text": "Lists",
              "copy": "fixed", "component": "Title", "part": "new", "tokens": null }
          ]
        },
        {
          "id": "your-lists", "anchor": "lists.your-lists", "name": "Your lists",
          "job": "Open the list you're shopping from", "role": "content", "pane": "primary",
          "states": ["default"],
          "layout": { "compact": { "columns": 1 }, "medium": { "columns": 2, "maxWidth": "60rem" } },
          "members": [
            { "id": "list", "anchor": "lists.your-lists.list", "kind": "list",
              "component": "List row", "part": "new", "copy": "sample", "pattern": "{n} items",
              "items": [
                { "text": "Weekend shop", "meta": "12 items · 4 left" },
                { "text": "Hardware store", "meta": "3 items" }
              ], "tokens": null },
            { "id": "new-list", "anchor": "lists.your-lists.new-list", "kind": "button",
              "text": "New list", "copy": "fixed", "emphasis": true,
              "component": "Button", "variant": "primary", "part": "new", "tokens": null }
          ]
        },
        {
          "id": "no-lists-yet", "anchor": "lists.no-lists-yet", "name": "No lists yet",
          "job": "Get someone to their first list", "role": "content", "pane": "primary",
          "states": ["empty"],
          "layout": { "compact": { "columns": 1 } },
          "members": [
            { "id": "intro", "anchor": "lists.no-lists-yet.intro", "kind": "text",
              "text": "Make a list for your next shop.", "copy": "fixed", "component": "Text", "part": "new", "tokens": null },
            { "id": "make-your-first-list", "anchor": "lists.no-lists-yet.make-your-first-list", "kind": "button",
              "text": "Make your first list", "copy": "fixed", "emphasis": true,
              "component": "Button", "variant": "primary", "part": "new", "tokens": null }
          ]
        }
      ]
    }
  ]
}
JSON
cat > src/index.html <<'HTML'
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Pantry</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <main id="app"></main>
  <script src="app.js"></script>
</body>
</html>
HTML
cat > src/app.js <<'JS'
// Lists come from the server; ?state=empty shows the empty state for testing.
const lists = new URLSearchParams(location.search).get('state') === 'empty' ? [] : [
  { name: 'Weekend shop', items: 12, left: 4 },
  { name: 'Hardware store', items: 3, left: 0 },
];
document.getElementById('app').textContent = 'TODO: Lists screen';
JS
printf 'body { margin: 0; font: 1rem/1.4 system-ui, sans-serif; }\n' > src/styles.css
