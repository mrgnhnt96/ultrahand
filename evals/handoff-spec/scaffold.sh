#!/usr/bin/env bash
# An approved, published phone design for one screen, with its blueprint and parts, and no anchors yet.
set -euo pipefail
mkdir -p design/pantry/blueprint design/pantry/rounds/3
printf '# Pantry\n\nA shopping list app for phones, built in React Native.\n' > README.md
cat > design/pantry/config.json <<'JSON'
{ "title": "Pantry", "states": ["default", "empty"] }
JSON
cat > design/pantry/blueprint/blueprint.json <<'JSON'
{
  "title": "Pantry",
  "states": ["default", "empty"],
  "screens": [
    {
      "id": "lists",
      "title": "Lists",
      "sections": [
        { "name": "Header", "job": "Say which screen this is", "role": "chrome", "place": "top",
          "members": [{ "kind": "title", "text": "Lists" }] },
        { "name": "Your lists", "job": "Open the list you're shopping from", "role": "content", "states": ["default"],
          "members": [
            { "kind": "list", "items": [
              { "text": "Weekend shop", "meta": "12 items · 4 left" },
              { "text": "Hardware store", "meta": "3 items" }
            ] },
            { "kind": "button", "text": "New list", "emphasis": true }
          ] },
        { "name": "No lists yet", "job": "Get someone to their first list", "role": "content", "states": ["empty"],
          "members": [
            { "kind": "text", "text": "Make a list for your next shop." },
            { "kind": "button", "text": "Make your first list", "emphasis": true }
          ] }
      ]
    }
  ]
}
JSON
cat > design/pantry/blueprint/parts.json <<'JSON'
{
  "title": "Pantry · parts",
  "parts": [
    { "name": "List row", "status": "new", "why": "Each list shows its name and how many items are left.", "usedIn": ["Your lists"] },
    { "name": "Button", "variant": "primary", "status": "new", "why": "The one action of each section.", "usedIn": ["Your lists", "No lists yet"] }
  ]
}
JSON
cat > design/pantry/screen.html <<'HTML'
<template id="uh-screen">
  <style>
    :host { color-scheme: light dark; font: 1rem/1.4 system-ui, sans-serif; }
    [data-screen] { background: light-dark(#f6f6f8, #000); color: light-dark(#111, #f2f2f7); padding: var(--uh-safe-top) 0 var(--uh-safe-bottom); }
    .title { font-size: 2.125rem; font-weight: 700; margin: 8px 16px; }
    .lists { list-style: none; margin: 0 16px; padding: 0; background: light-dark(#fff, #1c1c1e); border-radius: 12px; }
    .lists a { display: grid; min-height: 60px; padding: 10px 16px; color: inherit; text-decoration: none; }
    .meta { font-size: 0.8125rem; color: light-dark(#6c6c70, #98989f); }
    .primary { display: block; min-height: 48px; margin: 16px; width: calc(100% - 32px); border: 0; border-radius: 24px; background: light-dark(#0a5fd8, #4c8dff); color: light-dark(#fff, #000); font: 600 1rem system-ui; }
    .empty p { margin: 48px 16px 0; text-align: center; }
  </style>

  <section data-screen="lists" data-title="Lists">
    <header><h1 class="title">Lists</h1></header>
    <div data-show-state="default">
      <ul class="lists">
        <li><a href="#"><span>Weekend shop</span><span class="meta">12 items · 4 left</span></a></li>
        <li><a href="#"><span>Hardware store</span><span class="meta">3 items</span></a></li>
      </ul>
      <button class="primary" type="button">New list</button>
    </div>
    <div class="empty" data-show-state="empty">
      <p>Make a list for your next shop.</p>
      <button class="primary" type="button">Make your first list</button>
    </div>
  </section>
</template>
HTML
cp design/pantry/screen.html design/pantry/config.json design/pantry/rounds/3/
printf 'Round 3 reviewed and published at https://claude.ai/artifact/0a1b2c3d-pantry-eval.\nOwner, 2026-11-20: "Approved. Ship it."\n' > design/pantry/rounds/3/NOTES.md
