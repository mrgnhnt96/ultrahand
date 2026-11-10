#!/usr/bin/env bash
set -euo pipefail
mkdir -p design/rounds/2
printf '# Pocket\n\nAn iPhone budgeting app.\n' > README.md
printf '# Lessons\n\n- Amounts show the currency symbol and two decimals.\n' > design/LESSONS.md
cat > design/config.json <<'JSON'
{ "title": "Transactions", "states": ["default", "empty"] }
JSON
cat > design/screen.html <<'HTML'
<template id="uh-screen">
  <style>
    :host { color-scheme: light dark; font: 1rem/1.4 system-ui, sans-serif; }
    [data-screen] { background: light-dark(#f6f6f8, #000); color: light-dark(#111, #f2f2f7); padding: var(--uh-safe-top) 0 var(--uh-safe-bottom); }
    .title { font-size: 2.125rem; font-weight: 700; margin: 8px 16px 4px; }
    .filters { display: flex; gap: 8px; overflow-x: auto; padding: 8px 16px; }
    .filters button { min-height: 44px; padding: 0 14px; border-radius: 22px; border: 1px solid light-dark(#c7c7cc, #3a3a3c); background: none; color: inherit; font-size: 0.9375rem; }
    .filters button[aria-pressed="true"] { background: light-dark(#0a5fd8, #4c8dff); border-color: transparent; color: light-dark(#fff, #000); }
    .day { font-size: 0.8125rem; text-transform: uppercase; color: light-dark(#6c6c70, #98989f); margin: 16px 16px 6px; }
    .list { list-style: none; margin: 0 16px; padding: 0; background: light-dark(#fff, #1c1c1e); border-radius: 12px; }
    .list li { display: grid; grid-template-columns: 1fr auto; gap: 2px 12px; min-height: 60px; padding: 10px 16px; border-bottom: 1px solid light-dark(#e5e5ea, #2c2c2e); }
    .list li:last-child { border-bottom: 0; }
    .meta { font-size: 0.8125rem; color: light-dark(#6c6c70, #98989f); }
    .amt { grid-row: span 2; align-self: center; font-variant-numeric: tabular-nums; }
    .empty { margin: 48px 16px; text-align: center; }
  </style>

  <section data-screen="transactions" data-title="Transactions">
    <h1 class="title">Transactions</h1>

    <!-- filter bar -->
    <div class="filters" role="group" aria-label="Filter">
      <button aria-pressed="true">All</button>
      <button aria-pressed="false">Groceries</button>
      <button aria-pressed="false">Eating out</button>
      <button aria-pressed="false">Transport</button>
      <button aria-pressed="false">Bills</button>
    </div>
    <!-- /filter bar -->

    <div data-show-state="default">
      <h2 class="day">Today</h2>
      <ul class="list">
        <li><span>Corner Market</span><span class="amt">$23.40</span><span class="meta">Groceries</span></li>
        <li><span>Metro card top-up</span><span class="amt">$40.00</span><span class="meta">Transport</span></li>
      </ul>
      <h2 class="day">Yesterday</h2>
      <ul class="list">
        <li><span>Lucia's Taqueria</span><span class="amt">$18.75</span><span class="meta">Eating out</span></li>
        <li><span>City Power &amp; Light</span><span class="amt">$96.12</span><span class="meta">Bills</span></li>
        <li><span>Corner Market</span><span class="amt">$7.10</span><span class="meta">Groceries</span></li>
      </ul>
    </div>
    <p class="empty" data-show-state="empty">No transactions this month.</p>
  </section>
</template>

<script>
window.ultrahandSetup = function (canvas) {
  canvas.$$('.filters button').forEach(function (b) {
    b.addEventListener('click', function () {
      canvas.$$('.filters button').forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
    });
  });
};
</script>
HTML
cp design/screen.html design/config.json design/rounds/2/
printf 'Round 2 reviewed and published. Owner: "Close. Not sure about the filter chips."\n' > design/rounds/2/NOTES.md
