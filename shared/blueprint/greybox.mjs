#!/usr/bin/env node
// Turn a blueprint (blueprint.json: screens, their sections, each section's job and members)
// into a greybox screen.html that follows the canvas screen contract. Zero dependencies; Node 18+.
//
//   node greybox.mjs blueprint.json [--out screen.html]
//
// build.mjs calls greybox() directly for --blueprint, and for concepts that name a blueprint.
// See README.md for the format.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const KINDS = ['title', 'text', 'stat', 'list', 'button', 'field', 'toggle', 'image', 'nav'];
const ROLES = ['chrome', 'content'];
const PLACES = ['top', 'bottom', 'side'];
const PANES = ['primary', 'secondary'];
const ID = /^[a-z0-9][a-z0-9-]*$/i;
const FILLER = /\blorem\b|\bipsum\b|^(button|title|label|text|heading|subtitle|item|link|value|placeholder|image|photo|tbd|todo|xxx+)( ?\d+)?$/i;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';
const str = (v) => typeof v === 'string' && v.trim() !== '';

/* ---------- Anchors (shared/handoff/README.md#anchors) ---------- */

/* One anchor segment: lowercase letters, digits and single dashes. */
export const segment = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/* A member named by its words takes the first five, so a paragraph doesn't become its anchor. */
const WORDS = 5;
const LABEL_FIRST = ['field', 'toggle', 'stat'];

/* A member's own segment: its id, else a slug of its words (label first for a field, toggle or
   stat, whose text is a value), else its kind. */
export function memberSlug(m) {
  if (str(m.id)) return segment(m.id) || m.kind;
  const words = LABEL_FIRST.includes(m.kind) ? [m.label, m.text] : [m.text, m.label];
  for (const w of words) if (str(w) && segment(w)) return segment(w).split('-').slice(0, WORDS).join('-');
  return m.kind;
}

/* The segments of a section's members, in order: base(m, i) for each, with -2, -3… on a
   segment already taken in the section. The spec passes a base that keeps earlier ids. */
export function memberSegments(members, base = memberSlug) {
  const ids = [];
  members.forEach((m, i) => {
    const b = base(m, i);
    let id = b, n = 1;
    while (ids.includes(id)) id = `${b}-${++n}`;
    ids.push(id);
  });
  return ids;
}

/* The strings a member shows as content, so the checks can look for filler copy. Labels
   are left out: a one-word label such as "Item" is often the real one. */
function strings(m) {
  const out = [m.text, m.placeholder];
  for (const it of Array.isArray(m.items) ? m.items : []) {
    if (typeof it === 'string') out.push(it);
    else if (it) out.push(it.text, it.meta);
  }
  return out.filter(str);
}

/* Problems that stop the build (errors) and ones worth a look (warnings). */
export function check(bp) {
  const errors = [], warnings = [];
  if (!bp || typeof bp !== 'object' || Array.isArray(bp)) return { errors: ['the blueprint must be an object with a screens array'], warnings };
  const screens = Array.isArray(bp.screens) ? bp.screens : [];
  if (!screens.length) errors.push('screens must be a non-empty array');
  if (bp.states !== undefined && !Array.isArray(bp.states)) errors.push('states must be an array');
  const ids = new Set(screens.map((s) => s && s.id));
  const seen = new Set(), linked = new Set();
  screens.forEach((s, si) => {
    const at = `screen ${s && s.id ? `"${s.id}"` : si + 1}`;
    if (!s || typeof s !== 'object') return errors.push(`${at} is not an object`);
    if (!ID.test(s.id || '')) errors.push(`${at} needs an id of letters, digits and dashes`);
    else if (seen.has(s.id)) errors.push(`${at}: duplicate id`);
    seen.add(s.id);
    if (!str(s.title)) errors.push(`${at} needs a title`);
    const sections = Array.isArray(s.sections) ? s.sections : [];
    if (!sections.length) errors.push(`${at} needs a non-empty sections array`);
    const names = new Set();
    sections.forEach((sec, xi) => {
      const sat = `${at}, section ${sec && sec.name ? `"${sec.name}"` : xi + 1}`;
      if (!sec || typeof sec !== 'object') return errors.push(`${sat} is not an object`);
      if (!str(sec.name)) errors.push(`${sat} needs a name`);
      else if (names.has(slug(sec.name))) errors.push(`${sat}: two sections share this name`);
      names.add(slug(sec.name || ''));
      if (!str(sec.job)) errors.push(`${sat} needs a job: the one thing it is for`);
      else if (/[;\n]|[.!?]\s+\S/.test(sec.job.trim())) warnings.push(`${sat}: the job reads as more than one job; a section does one`);
      if (!ROLES.includes(sec.role)) errors.push(`${sat}: role must be ${ROLES.join(' or ')}`);
      if (sec.role === 'chrome' && !PLACES.includes(sec.place)) errors.push(`${sat}: a chrome section needs place: ${PLACES.join(', ')}`);
      if (sec.role === 'content' && sec.place !== undefined) errors.push(`${sat}: place is for chrome; content goes in a pane`);
      if (sec.compactPlace !== undefined && (sec.place !== 'side' || !['top', 'bottom'].includes(sec.compactPlace))) {
        errors.push(`${sat}: compactPlace is top or bottom, and only for place: side`);
      }
      if (sec.pane !== undefined && (sec.role !== 'content' || !PANES.includes(sec.pane))) errors.push(`${sat}: pane is ${PANES.join(' or ')}, and only for content`);
      if (sec.states !== undefined && !(Array.isArray(sec.states) && sec.states.every(str))) errors.push(`${sat}: states must be an array of state ids`);
      const members = Array.isArray(sec.members) ? sec.members : [];
      if (!members.length) errors.push(`${sat} needs a non-empty members array`);
      let em = 0;
      const memberIdsSeen = new Set();
      members.forEach((m, mi) => {
        const mat = `${sat}, member ${mi + 1}${m && m.kind ? ` (${m.kind})` : ''}`;
        if (!m || typeof m !== 'object') return errors.push(`${mat} is not an object`);
        if (!KINDS.includes(m.kind)) return errors.push(`${mat}: kind must be one of ${KINDS.join(', ')}`);
        if (m.id !== undefined) {
          if (typeof m.id !== 'string' || !ID.test(m.id)) errors.push(`${mat}: id is letters, digits and dashes`);
          else if (memberIdsSeen.has(segment(m.id))) errors.push(`${mat}: another member of the section has the id "${m.id}"`);
          else memberIdsSeen.add(segment(m.id));
        }
        if (m.emphasis) em++;
        const items = Array.isArray(m.items) ? m.items : null;
        if (m.kind === 'list' || m.kind === 'nav') {
          if (!items || !items.length) errors.push(`${mat} needs items`);
          (items || []).forEach((it, ii) => {
            const text = typeof it === 'string' ? it : it && it.text;
            if (!str(text)) errors.push(`${mat}, item ${ii + 1} needs text`);
            if (m.kind === 'nav' && !(it && it.nav)) errors.push(`${mat}, item ${ii + 1} needs nav: the screen it opens`);
          });
        } else if (m.kind === 'field' || m.kind === 'toggle') {
          if (!str(m.label)) errors.push(`${mat} needs a label`);
        } else if (m.kind === 'stat') {
          if (!str(m.text) || !str(m.label)) errors.push(`${mat} needs text (the value) and a label`);
        } else if (!str(m.text)) errors.push(`${mat} needs text: the real words it shows`);
        if (m.kind === 'image' && m.ratio !== undefined && !/^\d+(\.\d+)?:\d+(\.\d+)?$/.test(String(m.ratio))) errors.push(`${mat}: ratio is like "16:9"`);
        if (m.nav !== undefined && m.back) errors.push(`${mat}: nav and back can't both be set`);
        const navs = [m.nav, ...(items || []).map((it) => it && typeof it === 'object' ? it.nav : undefined)].filter((n) => n !== undefined);
        for (const n of navs) {
          if (!ids.has(n)) errors.push(`${mat}: nav "${n}" is not a screen id`);
          else if (n !== s.id) linked.add(n);
        }
        if ((m.nav !== undefined || m.back) && !['button', 'image', 'stat'].includes(m.kind)) errors.push(`${mat}: nav and back go on a button, or on list and nav items`);
        const filler = [...strings(m).filter((t) => FILLER.test(t.trim())), ...[m.label].filter((t) => str(t) && /\blorem\b|\bipsum\b/i.test(t))];
        if (filler.length) warnings.push(`${mat}: "${filler[0]}" looks like filler; use the real words`);
      });
      if (em > 1) errors.push(`${sat} has ${em} emphasised members; a section has at most one`);
    });
  });
  screens.slice(1).forEach((s) => {
    if (s && s.id && !linked.has(s.id)) warnings.push(`screen "${s.id}" has no way in: nothing links to it`);
  });
  return { errors, warnings };
}

/* ---------- Rendering ---------- */

function navAttrs(target, opts = {}) {
  if (opts.back) return ' data-nav-back';
  if (target === undefined) return '';
  return ` data-nav="${esc(target)}"${opts.replace ? ' data-nav-replace' : ''}`;
}

/* The anchor of each member of a section: screen.section.member, the member named by its id,
   else its words, else its kind, the same as in the handoff spec. */
function anchors(sec, screenAnchor) {
  const ids = memberSegments(sec.members);
  return new Map(sec.members.map((m, i) => [m, `${screenAnchor}.${slug(sec.name)}.${ids[i]}`]));
}

/* Marks a member's root element with its anchor and kind. Nav items and list rows get a
   part anchor of their own inside it. */
function member(m, ctx) {
  ctx.at = ctx.anchors.get(m);
  const html = memberHtml(m, ctx);
  return html.replace(/^<([a-z0-9]+)/, `<$1 data-uh="${esc(ctx.at)}" data-member="${esc(m.kind)}"`);
}

function memberHtml(m, ctx) {
  const em = m.emphasis ? ' bp-em' : '';
  const emAttr = m.emphasis ? ' data-emphasis' : '';
  switch (m.kind) {
    case 'title': {
      const tag = ctx.titles++ === 0 ? 'h1' : 'h2';
      return `<${tag} class="bp-title${em}"${emAttr}>${esc(m.text)}</${tag}>`;
    }
    case 'text':
      return `<p class="bp-text${em}"${emAttr}>${esc(m.text)}</p>`;
    case 'stat': {
      const inner = `<span class="bp-stat-value">${esc(m.text)}</span><span class="bp-stat-label">${esc(m.label)}</span>`;
      return m.nav !== undefined || m.back
        ? `<button type="button" class="bp-stat bp-tap${em}"${emAttr}${navAttrs(m.nav, m)}>${inner}</button>`
        : `<p class="bp-stat${em}"${emAttr}>${inner}</p>`;
    }
    case 'button':
      return `<button type="button" class="bp-btn${em}"${emAttr}${navAttrs(m.nav, m)}>${esc(m.text)}</button>`;
    case 'field': {
      const id = `${ctx.prefix}-f${ctx.fields++}`;
      const value = str(m.text) ? ` value="${esc(m.text)}"` : '';
      const ph = str(m.placeholder) ? ` placeholder="${esc(m.placeholder)}"` : '';
      const control = m.multiline
        ? `<textarea id="${id}" rows="3"${ph}>${str(m.text) ? esc(m.text) : ''}</textarea>`
        : `<input id="${id}" type="text"${value}${ph}>`;
      return `<div class="bp-field${em}"${emAttr}><label for="${id}">${esc(m.label)}</label>${control}</div>`;
    }
    case 'toggle':
      return `<label class="bp-toggle${em}"${emAttr}><span>${esc(m.label)}</span><input type="checkbox" role="switch"${m.on ? ' checked' : ''}></label>`;
    case 'image': {
      const [w, h] = String(m.ratio || '16:9').split(':');
      const body = `<span class="bp-image-text">${esc(m.text)}</span>`;
      const style = ` style="aspect-ratio: ${Number(w)} / ${Number(h)}"`;
      return m.nav !== undefined || m.back
        ? `<button type="button" class="bp-image bp-tap${em}"${emAttr}${style}${navAttrs(m.nav, m)}>${body}</button>`
        : `<div class="bp-image${em}"${emAttr}${style} role="img" aria-label="${esc(m.text)}">${body}</div>`;
    }
    case 'list': {
      const row = ` data-uh="${esc(`${ctx.at}.row`)}"`;
      const rows = m.items.map((it) => {
        const o = typeof it === 'string' ? { text: it } : it;
        const inner = `<span class="bp-row-text">${esc(o.text)}</span>${str(o.meta) ? `<span class="bp-row-meta">${esc(o.meta)}</span>` : ''}`;
        return o.nav !== undefined
          ? `<li${row}><button type="button" class="bp-row bp-tap"${navAttrs(o.nav)}>${inner}<span class="bp-chev" aria-hidden="true">›</span></button></li>`
          : `<li class="bp-row"${row}>${inner}</li>`;
      }).join('');
      return `<ul class="bp-list${em}"${emAttr}>${rows}</ul>`;
    }
    case 'nav': {
      const items = m.items.map((it) => {
        const current = it.nav === ctx.screen ? ' aria-current="page"' : '';
        return `<button type="button" class="bp-navitem" data-uh="${esc(`${ctx.at}.${segment(it.nav)}`)}"${navAttrs(it.nav, { replace: true })}${current}>${esc(it.text)}</button>`;
      }).join('');
      return `<nav class="bp-nav${em}"${emAttr} aria-label="${esc(ctx.section)}">${items}</nav>`;
    }
  }
  return '';
}

function section(sec, ctx, extra = '') {
  const id = `${ctx.screen}-${slug(sec.name)}${extra ? `-${extra}` : ''}`;
  ctx.prefix = id;
  ctx.section = sec.name;
  ctx.anchors = anchors(sec, ctx.anchor);
  const frequent = sec.members.filter((m) => !m.rare);
  const rare = sec.members.filter((m) => m.rare);
  const more = rare.length
    ? `<details class="bp-more"><summary>More</summary><div class="bp-more-body">${rare.map((m) => member(m, ctx)).join('')}</div></details>`
    : '';
  const states = sec.states ? ` data-show-state="${esc(sec.states.join(' '))}"` : '';
  const cls = `bp-sec bp-${sec.role}${sec.place ? ` bp-at-${sec.place}` : ''}${extra ? ` bp-only-${extra}` : ''}`;
  return `<section class="${cls}" id="${esc(id)}" data-uh="${esc(`${ctx.anchor}.${slug(sec.name)}`)}" data-section="${esc(sec.name)}" aria-labelledby="${esc(id)}-tag"${states}>
      <p class="bp-tag" id="${esc(id)}-tag"><b>${esc(sec.name)}</b><span class="bp-job">${esc(sec.job)}</span></p>
      <div class="bp-members">${frequent.map((m) => member(m, ctx)).join('')}${more}</div>
    </section>`;
}

function screen(s) {
  const ctx = { screen: s.id, anchor: segment(s.id), titles: 0, fields: 0 };
  const of = (fn) => s.sections.filter(fn);
  const chrome = (place) => of((x) => x.role === 'chrome' && x.place === place);
  const side = chrome('side');
  const sideAt = (where) => side.filter((x) => (x.compactPlace || 'bottom') === where);
  const render = (list, extra) => list.map((x) => section(x, ctx, extra)).join('\n    ');
  const top = render(chrome('top')) + render(sideAt('top'), 'compact');
  const bottom = render(sideAt('bottom'), 'compact') + render(chrome('bottom'));
  const primary = render(of((x) => x.role === 'content' && x.pane !== 'secondary'));
  const secondary = render(of((x) => x.role === 'content' && x.pane === 'secondary'));
  const bar = (name, own, html) => html && (own.length ? `data-${name}` : `data-${name}="compact"`);
  const flags = [
    bar('top', chrome('top'), top), side.length && 'data-side',
    bar('bottom', chrome('bottom'), bottom), secondary && 'data-split',
  ].filter(Boolean).join(' ');
  return `<section data-screen="${esc(s.id)}" data-uh="${esc(ctx.anchor)}" data-title="${esc(s.title)}" class="bp-screen"${flags ? ' ' + flags : ''}>
  ${top ? `<div class="bp-top">\n    ${top}\n  </div>` : ''}
  <div class="bp-body">
    ${side.length ? `<div class="bp-side">\n    ${render(side)}\n    </div>` : ''}
    <div class="bp-main">
      <div class="bp-pane bp-primary">
    ${primary}
      </div>
      ${secondary ? `<div class="bp-pane bp-secondary">\n    ${secondary}\n      </div>` : ''}
    </div>
  </div>
  ${bottom ? `<div class="bp-bottom">\n    ${bottom}\n  </div>` : ''}
</section>`;
}

const CSS = `
  :host { color-scheme: light dark; }
  /* Neutral greys only: a blueprint shows structure and words, never the theme. */
  .bp-screen {
    --bp-bg: light-dark(#ffffff, #161616);
    --bp-chrome: light-dark(#e8e8e8, #262626);
    --bp-block: light-dark(#f3f3f3, #1f1f1f);
    --bp-line: light-dark(#8c8c8c, #767676);
    --bp-rule: light-dark(#d4d4d4, #3a3a3a);
    --bp-ink: light-dark(#1a1a1a, #ededed);
    --bp-muted: light-dark(#505050, #b4b4b4);
    --bp-on-em: light-dark(#ffffff, #141414);
    --bp-gutter: 16px;
    display: flex; flex-direction: column;
    background: var(--bp-bg); color: var(--bp-ink);
    font: 1rem/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }
  .bp-screen *:focus-visible { outline: 2px solid var(--bp-ink); outline-offset: 2px; }
  .bp-screen p, .bp-screen h1, .bp-screen h2, .bp-screen ul { margin: 0; }

  /* Areas: top and bottom chrome stick to the screen's edges; a side rail sits beside the
     content from 600px; a secondary pane sits beside the primary one from 840px. */
  .bp-top, .bp-bottom { position: sticky; z-index: 2; display: grid; }
  .bp-top { top: 0; padding-top: var(--uh-safe-top); background: var(--bp-chrome); }
  .bp-bottom { bottom: 0; padding-bottom: var(--uh-safe-bottom); background: var(--bp-chrome); }
  .bp-top > .bp-sec:first-child { padding-inline-start: max(var(--bp-gutter), var(--uh-window-controls-width)); }
  .bp-body { flex: 1 0 auto; display: flex; padding-inline: var(--uh-safe-left) var(--uh-safe-right); }
  .bp-screen:not([data-top]) .bp-body { padding-top: calc(var(--uh-safe-top) + var(--uh-window-controls-height)); }
  .bp-screen:not([data-bottom]) .bp-body { padding-bottom: var(--uh-safe-bottom); }
  .bp-side { display: none; flex: none; width: clamp(180px, 26cqw, 280px); background: var(--bp-chrome); }
  .bp-main { flex: 1; min-width: 0; display: grid; align-content: start; gap: var(--bp-gutter); padding: var(--bp-gutter); }
  .bp-pane { display: grid; align-content: start; gap: var(--bp-gutter); min-width: 0; }
  @container screen (width >= 600px) {
    .bp-side { display: grid; align-content: start; }
    .bp-screen .bp-only-compact, .bp-screen[data-top="compact"] .bp-top, .bp-screen[data-bottom="compact"] .bp-bottom { display: none; }
    .bp-screen[data-top="compact"] .bp-body { padding-top: calc(var(--uh-safe-top) + var(--uh-window-controls-height)); }
    .bp-screen[data-bottom="compact"] .bp-body { padding-bottom: var(--uh-safe-bottom); }
    .bp-main { --bp-gutter: 24px; }
  }
  @container screen (width >= 840px) {
    .bp-screen[data-split] .bp-main { grid-template-columns: minmax(0, 2fr) minmax(0, 3fr); }
    .bp-screen:not([data-split]) .bp-main { width: 100%; max-width: 60rem; margin-inline: auto; }
  }
  /* Short screens and 200% text: the bars scroll with the content, so they never cover most of it. */
  @container screen (height < 480px) { .bp-top, .bp-bottom { position: static; } }
  .uh-viewport[data-text-scale="2"] .bp-top, .uh-viewport[data-text-scale="2"] .bp-bottom { position: static; }

  /* Sections: a label naming the section and its job, then its members in frequency order.
     Chrome is a filled band; content is a dashed outline. */
  .bp-sec { display: grid; gap: 8px; min-width: 0; }
  .bp-chrome { padding: 8px var(--bp-gutter); }
  .bp-top > .bp-chrome + .bp-chrome, .bp-bottom > .bp-chrome + .bp-chrome { border-top: 1px solid var(--bp-rule); }
  .bp-side > .bp-chrome + .bp-chrome { border-top: 1px solid var(--bp-rule); }
  .bp-content { padding: 12px; border: 1.5px dashed var(--bp-line); border-radius: 8px; }
  .bp-tag { display: flex; flex-wrap: wrap; gap: 0 8px; font-size: 0.75rem; line-height: 1.3; color: var(--bp-muted); }
  .bp-tag b { font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--bp-ink); }
  .bp-members { display: grid; gap: 12px; justify-items: start; min-width: 0; }
  .bp-members > * { max-width: 100%; }
  .bp-chrome .bp-members { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
  .bp-chrome .bp-title { flex: 1 1 0; min-width: min(10rem, 100%); }
  .bp-side .bp-members { display: grid; justify-items: stretch; }

  /* Members: the words are real; the boxes only say what kind of thing each one is. */
  .bp-title { font-size: 1.375rem; line-height: 1.2; font-weight: 700; overflow-wrap: anywhere; }
  h2.bp-title { font-size: 1rem; }
  .bp-text { color: var(--bp-muted); max-width: 40rem; overflow-wrap: anywhere; }
  .bp-stat { display: grid; padding: 8px 12px; border-radius: 6px; background: var(--bp-block); text-align: start; }
  .bp-stat-value { font-size: 1.375rem; font-weight: 700; line-height: 1.2; }
  .bp-stat-label { font-size: 0.75rem; color: var(--bp-muted); }
  .bp-btn, .bp-tap, .bp-navitem, .bp-more > summary {
    font: inherit; color: inherit; cursor: pointer;
  }
  .bp-btn {
    min-height: 44px; min-width: 44px; padding: 8px 16px;
    border: 1.5px solid var(--bp-line); border-radius: 6px; background: var(--bp-bg);
  }
  .bp-chrome .bp-btn { background: transparent; }
  .bp-tap { border: 0; background: none; text-align: start; }
  .bp-field { display: grid; gap: 4px; width: min(100%, 28rem); }
  .bp-field label { font-size: 0.75rem; color: var(--bp-muted); }
  .bp-field input, .bp-field textarea {
    min-height: 44px; padding: 8px 12px; font: inherit; color: inherit;
    border: 1.5px solid var(--bp-line); border-radius: 6px; background: var(--bp-bg);
  }
  .bp-toggle { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 44px; width: 100%; }
  .bp-toggle input {
    appearance: none; flex: none; width: 44px; height: 26px; margin: 0; cursor: pointer;
    border: 1.5px solid var(--bp-line); border-radius: 13px;
    background: radial-gradient(circle at 12px 50%, var(--bp-line) 8px, transparent 8.5px) var(--bp-bg);
  }
  .bp-toggle input:checked { border-color: var(--bp-ink); background: radial-gradient(circle at calc(100% - 12px) 50%, var(--bp-on-em) 8px, transparent 8.5px) var(--bp-ink); }
  .bp-image {
    position: relative; display: grid; place-items: center; width: min(100%, 36rem); padding: 12px;
    border: 1.5px solid var(--bp-line); border-radius: 6px;
    background:
      linear-gradient(to top right, transparent calc(50% - 0.75px), var(--bp-rule) calc(50% - 0.75px), var(--bp-rule) calc(50% + 0.75px), transparent calc(50% + 0.75px)),
      linear-gradient(to bottom right, transparent calc(50% - 0.75px), var(--bp-rule) calc(50% - 0.75px), var(--bp-rule) calc(50% + 0.75px), transparent calc(50% + 0.75px)),
      var(--bp-block);
  }
  .bp-image-text { padding: 2px 8px; border-radius: 4px; background: var(--bp-block); font-size: 0.875rem; color: var(--bp-muted); text-align: center; }
  .bp-list { width: 100%; padding: 0; list-style: none; border-top: 1px solid var(--bp-rule); }
  .bp-list > li { border-bottom: 1px solid var(--bp-rule); }
  .bp-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-content: center; column-gap: 12px; width: 100%; min-height: 44px; padding: 10px 0; }
  .bp-row-text { overflow-wrap: anywhere; }
  .bp-row-meta { grid-column: 1; font-size: 0.875rem; color: var(--bp-muted); overflow-wrap: anywhere; }
  .bp-chev { grid-column: 2; grid-row: 1 / span 2; align-self: center; color: var(--bp-muted); }
  .bp-nav { display: flex; gap: 4px; width: 100%; }
  .bp-side .bp-nav { flex-direction: column; }
  .bp-navitem {
    flex: 1 1 0; min-width: 44px; min-height: 44px; padding: 6px 8px;
    border: 0; border-radius: 6px; background: none; font-size: 0.875rem; overflow-wrap: anywhere;
  }
  .bp-side .bp-navitem { flex: none; text-align: start; padding-inline: 12px; }
  /* The selected item is quiet (SEC-5): weight and a subtle fill, not an emphasis. */
  .bp-navitem[aria-current="page"] { font-weight: 700; background: color-mix(in srgb, var(--bp-ink) 10%, transparent); }
  .bp-more { width: 100%; }
  .bp-chrome .bp-more { position: relative; width: auto; margin-inline-start: auto; }
  .bp-chrome .bp-more-body {
    position: absolute; inset-inline-end: 0; top: 100%; z-index: 2; min-width: 12rem; padding: 8px;
    background: var(--bp-bg); border: 1px solid var(--bp-line); border-radius: 8px; justify-items: stretch;
  }
  .bp-more > summary { display: flex; align-items: center; gap: 4px; min-height: 44px; padding-inline: 4px; color: var(--bp-muted); list-style: none; }
  .bp-more > summary::-webkit-details-marker { display: none; }
  .bp-more > summary::after { content: "▾"; }
  .bp-more[open] > summary::after { content: "▴"; }
  .bp-more-body { display: grid; gap: 12px; justify-items: start; padding-top: 8px; }

  /* The one emphasis in a section: a filled control, or a heavy outline on anything else. */
  .bp-btn.bp-em, .bp-tap.bp-em { background: var(--bp-ink); color: var(--bp-on-em); border-color: var(--bp-ink); font-weight: 700; }
  .bp-em:not(.bp-btn):not(.bp-tap) { outline: 3px solid var(--bp-ink); outline-offset: 4px; border-radius: 4px; }
`;

/* Scroll padding follows the bars, so a focused control never hides under one (WCAG 2.4.11). */
const SCRIPT = `window.ultrahandSetup = function (canvas) {
  function pad() {
    canvas.$$('.bp-screen').forEach(function (s) {
      var top = s.querySelector('.bp-top'), bottom = s.querySelector('.bp-bottom');
      var sticky = function (el) { return el && getComputedStyle(el).position === 'sticky' ? el.offsetHeight + 8 : 0; };
      s.style.scrollPaddingTop = sticky(top) + 'px';
      s.style.scrollPaddingBottom = sticky(bottom) + 'px';
    });
  }
  canvas.onResize(pad);
  canvas.onNavigate(function () { requestAnimationFrame(pad); });
};`;

/* The screen.html for a blueprint. Throws with the list of problems when it has errors. */
export function greybox(bp, { file = 'blueprint' } = {}) {
  const { errors, warnings } = check(bp);
  if (errors.length) {
    const err = new Error(`blueprint problems in ${file}:\n  - ${errors.join('\n  - ')}`);
    err.problems = errors;
    throw err;
  }
  const html = `<!-- Greybox generated from ${esc(file.split(/[\\/]/).pop())} by shared/blueprint/greybox.mjs. Edit the blueprint, not this file. -->
<template id="uh-screen">
<style>${CSS}</style>
${bp.screens.map(screen).join('\n\n')}
</template>

<script>
${SCRIPT}
</script>
`;
  return { html, warnings, title: bp.title, states: bp.states };
}

export function readBlueprint(path) {
  let text;
  try {
    text = readFileSync(resolve(path), 'utf8');
  } catch (err) {
    throw new Error(`Cannot read blueprint ${path}: ${err.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`blueprint ${path} is not valid JSON: ${err.message}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const outAt = argv.indexOf('--out');
  const out = outAt >= 0 ? argv[outAt + 1] : null;
  const file = argv.filter((a, i) => outAt < 0 || (i !== outAt && i !== outAt + 1))[0];
  if (!file || argv.includes('-h') || argv.includes('--help') || (outAt >= 0 && !out)) {
    console.log('Usage: node greybox.mjs blueprint.json [--out screen.html]\nWrites the greybox screen to --out, or to stdout.');
    process.exit(file ? 0 : 1);
  }
  try {
    const r = greybox(readBlueprint(file), { file });
    for (const w of r.warnings) console.warn(`warning: ${w}`);
    if (out) {
      mkdirSync(dirname(resolve(out)), { recursive: true });
      writeFileSync(resolve(out), r.html);
      console.error(`Wrote ${resolve(out)}`);
    } else process.stdout.write(r.html);
  } catch (err) {
    console.error(`greybox: ${err.message}`);
    process.exit(1);
  }
}
