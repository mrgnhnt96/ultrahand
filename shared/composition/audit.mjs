// Composition audit: a steps script for shared/input/drive.mjs.
//
//   node shared/input/drive.mjs open page.html --size 1440x900
//   UH_SECTIONS='header,main' node shared/input/drive.mjs do shared/composition/audit.mjs --out shots
//
// For each section (UH_SECTIONS, comma-separated selectors; by default the page's top-level
// header, toolbar, nav, aside and main, inside a canvas screen too) it prints one JSON line
// of measures, and it saves a blurred screenshot for the squint test (blur-<w>x<h>.png).
// The numbers point at problems; judging them is the reviewer's job (see principles.md).
//
//   accentFills    elements filled with a saturated colour: the section's emphasis count
//   controlStyles  distinct looks among its controls (shape, fill, border, font, size)
//   lookClickable  static elements styled like controls (filled or outlined, rounded, padded)
//   typeSizes      distinct font sizes of visible text; fonts: distinct font families
//   rows           visual rows of controls, with each row's left and right edge
//   gaps           horizontal gaps between neighbouring controls in a row, in px
//   textOrder      the visible text in reading order, to spot a fact shown twice

const MEASURE = String.raw`(() => {
  const roots = [document];
  for (const el of document.querySelectorAll('*')) if (el.shadowRoot) roots.push(el.shadowRoot);
  const all = (sel) => roots.flatMap((r) => [...r.querySelectorAll(sel)]);
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05;
  };
  const CONTROL = 'button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], ' +
    '[role=switch], [role=checkbox], [role=radio], [role=menuitem], [role=slider], [role=combobox], [tabindex]:not([tabindex="-1"])';
  /* rgb()/rgba() use 0–255; color(srgb …), which color-mix() computes to, uses 0–1. */
  const rgb = (c) => {
    const v = (c.match(/[\d.]+/g) || []).map(Number);
    return /^color\(/.test(c) ? v.map((n, i) => (i < 3 ? n * 255 : n)) : v;
  };
  const alpha = (c) => { const v = rgb(c); return v.length > 3 ? v[3] : (v.length ? 1 : 0); };
  const sat = (c) => {
    const [r, g, b] = rgb(c).map((v) => v / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
    return max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
  };
  /* A tint counts: a 10% accent wash on a pill still reads as emphasis, or as a pressed button. */
  const filled = (cs) => alpha(cs.backgroundColor) > 0.08;
  const accent = (cs) => filled(cs) && sat(cs.backgroundColor) > 0.35;
  const name = (el) => (el.getAttribute('aria-label') || el.textContent || el.value || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 40);
  const sig = (el) => {
    const cs = getComputedStyle(el);
    const radius = parseFloat(cs.borderTopLeftRadius) >= el.getBoundingClientRect().height / 2 - 1 ? 'pill' : parseFloat(cs.borderTopLeftRadius) > 0 ? 'rounded' : 'square';
    const fill = accent(cs) ? 'accent' : filled(cs) ? 'filled' : 'none';
    const border = parseFloat(cs.borderTopWidth) > 0 && alpha(cs.borderTopColor) > 0.2 ? 'border' : 'noborder';
    return [radius, fill, border, cs.fontFamily.split(',')[0].trim(), Math.round(parseFloat(cs.fontSize))].join(' ');
  };
  const wanted = (window.__uhSections || '').split(',').map((s) => s.trim()).filter(Boolean);
  let sections = wanted.length ? wanted.flatMap((s) => all(s)) :
    all('header, [role=toolbar], nav, aside, main, [role=banner], [role=navigation], [role=main], [role=complementary]');
  sections = sections.filter((s) => visible(s) && !sections.some((o) => o !== s && o.contains(s)));
  return sections.map((sec) => {
    const inside = [sec, ...sec.querySelectorAll('*')];
    const controls = inside.filter((el) => el.matches(CONTROL) && visible(el) && !el.closest('[aria-hidden=true]'));
    const statics = inside.filter((el) => !el.matches(CONTROL) && !el.closest(CONTROL) && visible(el) && el.children.length === 0 && el.textContent.trim());
    const lookClickable = statics.filter((el) => {
      const cs = getComputedStyle(el);
      return (filled(cs) || parseFloat(cs.borderTopWidth) > 0) && parseFloat(cs.borderTopLeftRadius) > 2 && parseFloat(cs.paddingLeft) >= 4;
    }).map(name);
    const accentFills = inside.filter((el) => visible(el) && accent(getComputedStyle(el))).map(name);
    const styles = {};
    for (const c of controls) (styles[sig(c)] = styles[sig(c)] || []).push(name(c));
    const texts = inside.filter((el) => visible(el) && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
    const sizes = [...new Set(texts.map((el) => Math.round(parseFloat(getComputedStyle(el).fontSize))))].sort((a, b) => a - b);
    const fonts = [...new Set(texts.map((el) => getComputedStyle(el).fontFamily.split(',')[0].trim()))];
    const boxes = controls.map((el) => ({ el, r: el.getBoundingClientRect() })).sort((a, b) => a.r.top - b.r.top || a.r.left - b.r.left);
    const rows = [];
    for (const b of boxes) {
      const mid = b.r.top + b.r.height / 2;
      const row = rows.find((r) => Math.abs(r.mid - mid) < 12);
      if (row) row.items.push(b); else rows.push({ mid, items: [b] });
    }
    const rowInfo = rows.map((r) => {
      r.items.sort((a, b) => a.r.left - b.r.left);
      const gaps = [];
      for (let i = 1; i < r.items.length; i++) gaps.push(Math.round(r.items[i].r.left - r.items[i - 1].r.right));
      return { y: Math.round(r.mid), left: Math.round(r.items[0].r.left), right: Math.round(r.items[r.items.length - 1].r.right), controls: r.items.length, gaps };
    });
    const label = sec.getAttribute('aria-label') || sec.id || sec.className || sec.tagName.toLowerCase();
    const r = sec.getBoundingClientRect();
    return {
      section: String(label).slice(0, 40), box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
      controls: controls.length, accentFills, controlStyles: Object.entries(styles).map(([k, v]) => ({ style: k, count: v.length, e: v.slice(0, 4) })),
      lookClickable, typeSizes: sizes, fonts, rows: rowInfo,
      textOrder: texts.map((el) => el.textContent.trim().replace(/\s+/g, ' ')).filter((t, i, a) => t && a.indexOf(t) === i).slice(0, 60)
    };
  });
})()`;

export default async function (ui) {
  const sections = process.env.UH_SECTIONS || '';
  const { value } = await ui.eval(`window.__uhSections = ${JSON.stringify(sections)}; ${MEASURE}`);
  for (const s of value || []) console.log(JSON.stringify({ composition: s }));
  const { value: size } = await ui.eval('innerWidth + "x" + innerHeight');
  await ui.eval('document.documentElement.style.filter = "blur(6px)"; true');
  await ui.shot(`blur-${size}`);
  await ui.eval('document.documentElement.style.filter = ""; true');
}
