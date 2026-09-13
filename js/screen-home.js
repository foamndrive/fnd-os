/* ============================================================
   FND OS : screen-home.js
   What do I do right now, and where am I this month.
   ============================================================ */
window.FND = window.FND || {};

FND.screens = FND.screens || {};

FND.screens.home = (function () {
  const U = () => FND.ui;
  const S = () => FND.store;

  /* ---------- month maths (shared with the Money screen) ---------- */
  function monthTotals(mKey) {
    const u = U(), s = S();
    const jobs = s.jobs.filter(j => u.monthKey(j.date) === mKey && j.status === 'done');
    const exps = s.expenses.filter(e => u.monthKey(e.date) === mKey);
    const revenue  = jobs.reduce((t, j) => t + (Number(j.price) || 0) + (Number(j.tip) || 0), 0);
    const expenses = exps.reduce((t, e) => t + (Number(e.amount) || 0), 0);
    return { jobs, exps, revenue, expenses, profit: revenue - expenses, count: jobs.length };
  }

  /* ---------- rolling four quarters, for the HST threshold ---------- */
  function rolling12Revenue() {
    const u = U(), cut = new Date(); cut.setFullYear(cut.getFullYear() - 1);
    return S().jobs
      .filter(j => j.status === 'done' && u.parseISO(j.date) >= cut)
      .reduce((t, j) => t + (Number(j.price) || 0), 0);
  }

  function render() {
    const u = U(), s = S();
    const today = u.todayISO();
    const mKey  = u.thisMonth();
    const m     = monthTotals(mKey);

    const todays = s.jobs.filter(j => j.date === today)
      .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    const left = todays.filter(j => j.status !== 'done');
    const next = left[0];

    const headline = todays.length === 0
      ? 'Nothing booked today.'
      : left.length === 0
        ? 'Day is done. Everything is logged.'
        : `${left.length} job${left.length > 1 ? 's' : ''} left today.${next ? ` Next: ${u.esc(next.area || next.client)} at ${u.time12(next.time)}.` : ''}`;

    /* set-aside */
    const pct      = Number(s.setting('money.taxSetAsidePercent', 0.25));
    const ytdKey   = today.slice(0, 4);
    const ytdJobs  = s.jobs.filter(j => j.status === 'done' && String(j.date).startsWith(ytdKey));
    const ytdRev   = ytdJobs.reduce((t, j) => t + (Number(j.price) || 0) + (Number(j.tip) || 0), 0);
    const ytdExp   = s.expenses.filter(e => String(e.date).startsWith(ytdKey)).reduce((t, e) => t + (Number(e.amount) || 0), 0);
    const ytdProfit = ytdRev - ytdExp;
    const setAside = Math.max(0, ytdProfit * pct);
    const sadaqa   = Number(s.setting('money.sadaqaPerJob', 0)) * ytdJobs.length;

    const roll = rolling12Revenue();
    const thr  = Number(s.setting('money.hstThreshold', 30000));
    const warn = Number(s.setting('money.hstWarnAt', 25000));
    const rollPct = Math.min(100, roll / thr * 100);

    /* needs you */
    const needs = [];
    const unpaid = s.jobs.filter(j => j.status === 'done' && j.payment === 'Invoice');
    if (unpaid.length) needs.push({ warn:true, text:`${unpaid.length} completed job${unpaid.length>1?'s':''} marked Invoice and not yet paid`, sub:u.money(unpaid.reduce((t,j)=>t+(Number(j.price)||0),0)) + ' outstanding', go:'jobs' });
    const noPay = s.jobs.filter(j => j.status === 'done' && !j.payment);
    if (noPay.length) needs.push({ warn:true, text:`${noPay.length} completed job${noPay.length>1?'s':''} missing a payment method`, sub:'Totals by payment type will be wrong until this is filled', go:'jobs' });
    if (roll >= warn) needs.push({ warn:roll>=thr, text:`Rolling 12-month revenue is ${u.money0(roll)}`, sub:`HST registration threshold is ${u.money0(thr)}. Talk to your accountant before you cross it.`, go:'money' });
    if (!m.exps.length) needs.push({ warn:false, text:'No expenses logged this month yet', sub:'Log them as you buy, not at month end', go:'money' });
    if (S().outbox.count()) needs.push({ warn:false, text:`${S().outbox.count()} change waiting to sync`, sub:'Will send by itself when you have signal', go:'home' });

    return `
      <div class="head">
        <div class="hello">${new Date().toLocaleDateString(FND.config.money.locale, { weekday:'long', month:'long', day:'numeric' })}</div>
        <h1 class="h1">${headline}</h1>
      </div>

      <div class="cols">
        <div>
          ${u.panel('Today', `${todays.length} job${todays.length===1?'':'s'}`,
            todays.length
              ? `<div class="tl">${todays.map(jobRow).join('')}</div>`
              : `<p class="sub">Nothing booked. Tap the + to add a job.</p>`)}

          ${u.panel(u.monthName(mKey), 'updates when you complete a job', `
            <div class="stats">
              ${u.stat(u.money0(m.revenue), 'Revenue', true)}
              ${u.stat(u.money0(m.expenses), 'Expenses')}
              ${u.stat(u.money0(m.profit), 'Profit')}
              ${u.stat(m.count, 'Jobs done')}
            </div>`)}
        </div>

        <div>
          ${u.panel('Needs you', needs.length ? `${needs.length}` : '', needs.length
            ? needs.map(n => `<div class="todo"><i class="dot ${n.warn ? 'warn' : ''}"></i>
                 <p>${u.esc(n.text)}<em>${u.esc(n.sub)}</em></p>
                 <button class="btn" data-go="${n.go}">Open</button></div>`).join('')
            : `<p class="sub">Nothing needs you. Good.</p>`)}

          ${u.panel('Tax set-aside', String(Math.round(pct * 100)) + '% of profit', `
            <div class="stats two">
              ${u.stat(u.money0(setAside), 'Hold back for tax', true)}
              ${u.stat(u.money0(ytdProfit), 'Profit ' + ytdKey)}
            </div>
            <p class="sub mt">Income tax is on profit, not on what lands in your account. Change the percentage in Settings once your accountant gives you the right one.</p>
            ${sadaqa ? `<div class="minirow"><span>Sadaqa, ${ytdJobs.length} jobs</span><b>${u.money0(sadaqa)}</b></div>` : ''}
            <div class="thr">
              <div class="thr-top"><span>Rolling 12-month revenue</span><b>${u.money0(roll)} / ${u.money0(thr)}</b></div>
              <div class="bar"><i style="width:${rollPct}%" class="${roll >= warn ? 'hot' : ''}"></i></div>
              <p class="sub sm">HST registration becomes required above the threshold. This is a tracker, not tax advice.</p>
            </div>`)}
        </div>
      </div>`;
  }

  function jobRow(j) {
    const u = U();
    const done = j.status === 'done';
    return `<div class="job ${done ? 'isdone' : ''}">
      <div class="t">${u.time12(j.time) || '&mdash;'}</div>
      <div class="jbody">
        <div class="line">
          <div><div class="svc">${u.esc(j.service)}${j.size ? ', ' + u.esc(j.size) : ''}</div>
          <div class="meta">${u.esc(j.client)}${j.vehicle ? ', ' + u.esc(j.vehicle) : ''}${j.area ? ', ' + u.esc(j.area) : ''}</div></div>
          <div class="price">${u.money(j.price)}</div>
        </div>
        <div class="line wrap">
          ${done ? `<span class="chip done">Done${j.payment ? ', ' + u.esc(j.payment) : ''}</span>`
                 : `<span class="chip next">Booked</span>
                    <button class="btn pink sm" data-complete="${j.id}">Complete</button>`}
        </div>
      </div>
    </div>`;
  }

  return { render, monthTotals, rolling12Revenue };
})();
