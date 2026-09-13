/* ============================================================
   FND OS : screen-money.js
   Month summary, category breakdown, and the expense log.
   ============================================================ */
window.FND = window.FND || {};
FND.screens = FND.screens || {};

FND.screens.money = (function () {
  const U = () => FND.ui;
  const S = () => FND.store;

  let viewMonth = null;   // null means current month
  let tab = 'summary';

  const activeMonth = () => viewMonth || U().thisMonth();

  function monthsAvailable() {
    const u = U();
    const keys = new Set([u.thisMonth()]);
    S().jobs.forEach(j => keys.add(u.monthKey(j.date)));
    S().expenses.forEach(e => keys.add(u.monthKey(e.date)));
    return [...keys].filter(Boolean).sort().reverse();
  }

  function render() {
    const u = U(), s = S(), mKey = activeMonth();
    const m = FND.screens.home.monthTotals(mKey);

    const picker = `<select id="monthPick" class="ctl slim">${monthsAvailable()
      .map(k => `<option value="${k}" ${k === mKey ? 'selected' : ''}>${u.monthName(k)}</option>`).join('')}</select>`;

    const tabs = `<div class="filters">
      <button class="${tab==='summary'?'on':''}" data-mtab="summary">Summary</button>
      <button class="${tab==='expenses'?'on':''}" data-mtab="expenses">Expenses</button>
      <button class="${tab==='byservice'?'on':''}" data-mtab="byservice">By service</button>
    </div>`;

    return `<div class="head"><div class="hello">Money</div><h1 class="h1">Where the month actually stands.</h1></div>
      <div class="monthbar">${picker}</div>
      ${tabs}
      ${tab === 'summary' ? summary(m, mKey) : tab === 'expenses' ? expenses(m) : byService(m)}`;
  }

  /* ---------- summary ---------- */
  function summary(m, mKey) {
    const u = U(), s = S();

    const byCat = {};
    m.exps.forEach(e => { byCat[e.category || 'Other'] = (byCat[e.category || 'Other'] || 0) + (Number(e.amount) || 0); });
    const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    const maxCat = cats.length ? cats[0][1] : 1;

    const byPay = {};
    m.jobs.forEach(j => { const k = j.payment || 'Not set'; byPay[k] = (byPay[k] || 0) + (Number(j.price) || 0); });
    const pays = Object.entries(byPay).sort((a, b) => b[1] - a[1]);

    const hours = m.jobs.reduce((t, j) => t + (Number(j.hours) || 0), 0);
    const km    = m.jobs.reduce((t, j) => t + (Number(j.km) || 0), 0);
    const perHr = hours ? m.revenue / hours : 0;
    const avg   = m.count ? m.revenue / m.count : 0;
    const pct   = Number(s.setting('money.taxSetAsidePercent', 0.25));

    return `
      ${u.panel(null, null, `<div class="stats">
        ${u.stat(u.money0(m.revenue), 'Revenue', true)}
        ${u.stat(u.money0(m.expenses), 'Expenses')}
        ${u.stat(u.money0(m.profit), 'Profit')}
        ${u.stat(m.count, 'Jobs')}
      </div>`)}

      ${u.panel('Per job', null, `<div class="stats">
        ${u.stat(u.money0(avg), 'Average ticket')}
        ${u.stat(hours ? u.money0(perHr) : '&mdash;', 'Revenue per hour')}
        ${u.stat(hours.toFixed(1), 'Hours on site')}
        ${u.stat(Math.round(km), 'Kilometres')}
      </div>
      <p class="sub mt">Revenue per hour is the number that tells you which services are worth chasing. It only works if you fill in hours when you complete a job.</p>`)}

      ${u.panel('Set aside from this month', String(Math.round(pct*100)) + '% of profit', `
        <div class="minirow big"><span>Hold back for tax</span><b>${u.money(Math.max(0, m.profit * pct))}</b></div>
        <p class="sub">Based on this month's profit only. The Home screen shows the year to date figure, which is the one that matters at filing time.</p>`)}

      ${u.panel('Expenses by category', u.money0(m.expenses), cats.length
        ? cats.map(([c, v]) => `<div class="barrow">
            <div class="minirow"><span>${u.esc(c)}</span><b>${u.money(v)}</b></div>
            <div class="bar"><i style="width:${(v / maxCat * 100).toFixed(1)}%"></i></div></div>`).join('')
        : `<p class="sub">Nothing logged this month.</p>`)}

      ${u.panel('How you got paid', null, pays.length
        ? pays.map(([p, v]) => `<div class="minirow"><span>${u.esc(p)}</span><b>${u.money(v)}</b></div>`).join('')
        : `<p class="sub">No completed jobs this month.</p>`)}`;
  }

  /* ---------- expenses ---------- */
  function expenses(m) {
    const u = U();
    const list = [...m.exps].sort((a, b) => b.date.localeCompare(a.date));
    return `${u.panel('Expense log', u.money0(m.expenses), `
      <div class="btns mb"><button class="btn pink" data-act="addExpense">Add expense</button></div>
      ${list.length ? `<div class="list">${list.map(e => `
        <div class="item">
          <div class="grow"><b>${u.esc(e.vendor || 'Expense')}</b>
          <span>${u.shortDate(e.date)} &middot; ${u.esc(e.description || '')}${e.paidWith ? ' &middot; ' + u.esc(e.paidWith) : ''}</span></div>
          <span class="chip cat">${u.esc(e.category || 'Other')}</span>
          <div class="amt">${u.money(e.amount)}</div>
          <div class="rowbtns"><button class="btn sm danger" data-delexp="${e.id}">Delete</button></div>
        </div>`).join('')}</div>`
        : `<p class="sub">Nothing logged this month.</p>`}`)}
      <p class="sub mt">Log a card purchase the day you tap the card, not when the statement arrives. The date of purchase is the date that belongs in your books.</p>`;
  }

  /* ---------- by service ---------- */
  function byService(m) {
    const u = U();
    const agg = {};
    m.jobs.forEach(j => {
      const k = j.service || 'Other';
      agg[k] = agg[k] || { n:0, rev:0, hrs:0 };
      agg[k].n++; agg[k].rev += Number(j.price) || 0; agg[k].hrs += Number(j.hours) || 0;
    });
    const rows = Object.entries(agg).sort((a, b) => b[1].rev - a[1].rev);
    return u.panel('By service', u.monthName(activeMonth()), rows.length
      ? `<table class="tbl"><tr><th>Service</th><th class="r">Jobs</th><th class="r">Revenue</th><th class="r">Per hour</th></tr>
         ${rows.map(([k, v]) => `<tr><td>${u.esc(k)}</td><td class="r">${v.n}</td>
           <td class="r">${u.money0(v.rev)}</td>
           <td class="r">${v.hrs ? u.money0(v.rev / v.hrs) : '&mdash;'}</td></tr>`).join('')}</table>`
      : `<p class="sub">No completed jobs this month.</p>`);
  }

  /* ---------- expense form ---------- */
  function openExpense() {
    const u = U(), cfg = FND.config;
    const cats  = S().setting('lists.expenseCategories', cfg.lists.expenseCategories) || cfg.lists.expenseCategories;
    const paids = S().setting('lists.expensePaidWith',  cfg.lists.expensePaidWith)  || cfg.lists.expensePaidWith;
    let cat  = cats[0];
    let paid = paids[0];

    u.openSheet(`
      <h3>Add expense</h3><p class="sub">Do this at the counter. Four fields and a photo.</p>
      <div class="grid2">
        ${u.field('Amount', u.input('x_amount', { placeholder:'0.00', inputmode:'decimal' }))}
        ${u.field('Date', u.input('x_date', { type:'date', value:u.todayISO() }))}
      </div>
      ${u.field('Vendor', u.input('x_vendor', { placeholder:'Carzilla' }), 'Type the vendor and the category guesses itself.')}
      ${u.field('Category', u.chips('cat', cats, cat))}
      ${u.field('Paid with', u.chips('paid', paids, paid))}
      ${u.field('What was it', u.input('x_desc', { placeholder:'Polishing pads' }))}
      <button class="snap" id="x_snap">${u.icon('camera')} Attach the receipt photo</button>
      <button class="btn pink wide" id="saveExp">Save expense</button>
    `, sheet => {
      sheet.querySelector('#x_vendor').addEventListener('input', e => {
        const v = e.target.value.toLowerCase();
        const hit = Object.keys(FND.config.vendorRules).find(k => v.includes(k));
        if (!hit) return;
        cat = FND.config.vendorRules[hit];
        sheet.querySelectorAll('[data-pick="cat"] button').forEach(b => b.classList.toggle('on', b.dataset.val === cat));
      });
      sheet.addEventListener('click', e => {
        const b = e.target.closest('[data-val]'); if (!b) return;
        const group = b.closest('[data-pick]').dataset.pick;
        if (group === 'cat') cat = b.dataset.val; else paid = b.dataset.val;
        b.parentElement.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      });
      sheet.querySelector('#x_snap').onclick = () => {
        U().toast('Receipt capture arrives in Phase 2, with Drive filing');
      };
      sheet.querySelector('#saveExp').onclick = () => {
        const g = id => sheet.querySelector('#' + id).value.trim();
        const amt = parseFloat(g('x_amount'));
        if (!amt) { U().toast('Amount is needed'); return; }
        S().addExpense({
          date: g('x_date') || U().todayISO(),
          amount: amt,
          vendor: g('x_vendor'),
          description: g('x_desc'),
          category: cat,
          paidWith: paid,
          receipt: ''
        });
        U().closeSheet(); U().toast('Expense logged');
      };
    });
  }

  function setMonth(k) { viewMonth = k; }
  function setTab(t) { tab = t; }

  return { render, openExpense, setMonth, setTab };
})();
