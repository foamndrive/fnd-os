/* ============================================================
   FND OS : ui.js
   Formatting and shared pieces of interface. No business rules
   in here, and no data access.
   ============================================================ */
window.FND = window.FND || {};

FND.ui = (function () {

  const cfg = () => FND.config;

  /* ---------- formatting ---------- */
  function money(n, decimals = 2) {
    const v = Number(n) || 0;
    return '$' + v.toLocaleString(cfg().money.locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }
  const money0 = n => money(n, 0);

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  }

  const todayISO = () => new Date().toISOString().slice(0, 10);

  function parseISO(iso) {
    if (!iso) return null;
    const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function dayLabel(iso) {
    const d = parseISO(iso); if (!d) return '';
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const diff = Math.round((d - t) / 86400000);
    if (diff === 0)  return 'Today';
    if (diff === 1)  return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    return d.toLocaleDateString(cfg().money.locale, { weekday:'short', month:'short', day:'numeric' });
  }

  function shortDate(iso) {
    const d = parseISO(iso); if (!d) return '';
    return d.toLocaleDateString(cfg().money.locale, { month:'short', day:'numeric' });
  }

  function time12(t) {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const ap = h >= 12 ? 'PM' : 'AM';
    return ((h % 12) || 12) + ':' + String(m || 0).padStart(2, '0') + ' ' + ap;
  }

  const monthKey = iso => String(iso || '').slice(0, 7);
  const thisMonth = () => todayISO().slice(0, 7);

  function monthName(key) {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(cfg().money.locale, { month:'long', year:'numeric' });
  }

  /* ---------- dom ---------- */
  const $ = id => document.getElementById(id);
  function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }

  /* ---------- building blocks ---------- */
  function panel(title, right, body) {
    return `<section class="panel">
      ${title ? `<div class="h2">${esc(title)}${right ? `<span>${right}</span>` : ''}</div>` : ''}
      ${body}</section>`;
  }

  function stat(value, label, accent) {
    return `<div class="stat ${accent ? 'pos' : ''}"><b>${value}</b><span>${esc(label)}</span></div>`;
  }

  function field(label, inner, hint) {
    return `<div class="field"><label>${esc(label)}</label>${inner}${hint ? `<p class="hint">${esc(hint)}</p>` : ''}</div>`;
  }

  function input(id, opts = {}) {
    const a = [`id="${id}"`, `class="ctl"`];
    if (opts.type)  a.push(`type="${opts.type}"`);
    if (opts.value != null) a.push(`value="${esc(opts.value)}"`);
    if (opts.placeholder) a.push(`placeholder="${esc(opts.placeholder)}"`);
    if (opts.inputmode) a.push(`inputmode="${opts.inputmode}"`);
    if (opts.step) a.push(`step="${opts.step}"`);
    return `<input ${a.join(' ')}>`;
  }

  function select(id, options, selected) {
    return `<select id="${id}" class="ctl">${options.map(o => {
      const v = typeof o === 'object' ? o.value : o;
      const l = typeof o === 'object' ? o.label : o;
      return `<option value="${esc(v)}" ${v === selected ? 'selected' : ''}>${esc(l)}</option>`;
    }).join('')}</select>`;
  }

  function chips(name, options, selected) {
    return `<div class="pick" data-pick="${name}">${options.map(o =>
      `<button type="button" class="${o === selected ? 'on' : ''}" data-val="${esc(o)}">${esc(o)}</button>`).join('')}</div>`;
  }

  /* ---------- sheet (modal) ---------- */
  let sheetCloser = null;
  function openSheet(html, onMount) {
    const scrim = $('scrim'), sheet = $('sheet');
    sheet.innerHTML = `<button class="x" data-close="1" aria-label="Close">&times;</button>${html}`;
    scrim.classList.add('open');
    document.body.classList.add('noscroll');
    if (onMount) onMount(sheet);
    sheetCloser = null;
  }
  function closeSheet() {
    $('scrim').classList.remove('open');
    document.body.classList.remove('noscroll');
    if (sheetCloser) { const f = sheetCloser; sheetCloser = null; f(); }
    // the screen underneath may be stale after a save, so refresh it
    if (window.FND && FND.app && FND.app.render) FND.app.render();
  }
  function onSheetClose(fn) { sheetCloser = fn; }

  /* ---------- toast ---------- */
  let toastTimer;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
  }

  /* ---------- confirm ---------- */
  function confirmAction(question, detail, confirmLabel, onYes) {
    openSheet(`<h3>${esc(question)}</h3><p class="sub">${esc(detail || '')}</p>
      <div class="btns"><button class="btn" data-close="1">Cancel</button>
      <button class="btn danger" id="confirmYes">${esc(confirmLabel || 'Delete')}</button></div>`,
      sheet => { sheet.querySelector('#confirmYes').onclick = () => { closeSheet(); onYes(); }; });
  }

  /* ---------- icons ---------- */
  const PATHS = {
    home:    '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    jobs:    '<path d="M9 4h6v3H9z"/><path d="M7 5.5H5.5v15h13v-15H17"/><path d="M8.5 12l2 2 4-4"/>',
    money:   '<rect x="3" y="6.5" width="18" height="11" rx="2"/><circle cx="12" cy="12" r="2.6"/>',
    settings:'<circle cx="12" cy="12" r="3.2"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8"/>',
    plus:    '<path d="M12 5v14M5 12h14"/>',
    check:   '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    camera:  '<path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.2"/>',
    lock:    '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    cloud:   '<path d="M7 18h10a4 4 0 0 0 0-8 6 6 0 0 0-11.6 1.6A3.5 3.5 0 0 0 6 18"/>'
  };
  function icon(name, stroke = 1.9) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${PATHS[name] || ''}</svg>`;
  }

  return { money, money0, esc, todayISO, parseISO, dayLabel, shortDate, time12,
           monthKey, thisMonth, monthName, $, el, panel, stat, field, input, select, chips,
           openSheet, closeSheet, onSheetClose, toast, confirmAction, icon };
})();
