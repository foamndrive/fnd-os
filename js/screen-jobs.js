/* ============================================================
   FND OS : screen-jobs.js
   The job list, the booking form, and the complete form.
   ============================================================ */
window.FND = window.FND || {};
FND.screens = FND.screens || {};

FND.screens.jobs = (function () {
  const U = () => FND.ui;
  const S = () => FND.store;

  let filter = 'upcoming';

  /* ---------- price lookup ---------- */
  /* lists go through the store so edits made in Settings win */
  const list = (k, fallback) => S().setting('lists.' + k, fallback) || fallback;
  const addonList = () => S().setting('addons', FND.config.addons) || FND.config.addons;

  function priceOf(serviceName, size, addonNames) {
    const svc = S().services.find(s => s.name === serviceName);
    let p = 0;
    if (svc) p = (typeof svc.price === 'object') ? (svc.price[size] || 0) : (svc.price || 0);
    (addonNames || []).forEach(n => {
      const a = addonList().find(x => x.name === n);
      if (a) p += a.price;
    });
    return Math.round(p * 100) / 100;
  }
  function needsSize(serviceName) {
    const svc = S().services.find(s => s.name === serviceName);
    return !!(svc && typeof svc.price === 'object');
  }

  /* ---------- list ---------- */
  function render() {
    const u = U(), s = S();
    const today = u.todayISO();
    let list;

    if (filter === 'upcoming') {
      list = s.jobs.filter(j => j.status !== 'done' && j.date >= today).sort((a,b) => (a.date+a.time).localeCompare(b.date+b.time));
    } else if (filter === 'unpaid') {
      list = s.jobs.filter(j => j.status === 'done' && (j.payment === 'Invoice' || !j.payment)).sort((a,b) => b.date.localeCompare(a.date));
    } else if (filter === 'overdue') {
      list = s.jobs.filter(j => j.status !== 'done' && j.date < today).sort((a,b) => b.date.localeCompare(a.date));
    } else {
      list = s.jobs.filter(j => j.status === 'done').sort((a,b) => b.date.localeCompare(a.date));
    }

    const counts = {
      upcoming: s.jobs.filter(j => j.status !== 'done' && j.date >= today).length,
      overdue:  s.jobs.filter(j => j.status !== 'done' && j.date <  today).length,
      done:     s.jobs.filter(j => j.status === 'done').length,
      unpaid:   s.jobs.filter(j => j.status === 'done' && (j.payment === 'Invoice' || !j.payment)).length
    };
    const tab = (k, label) => `<button class="${filter===k?'on':''}" data-filter="${k}">${label}${counts[k] ? ` <b>${counts[k]}</b>` : ''}</button>`;

    return `
      <div class="head"><div class="hello">Jobs</div><h1 class="h1">Every job, one list.</h1></div>
      <div class="filters">${tab('upcoming','Upcoming')}${tab('overdue','Not logged')}${tab('done','Done')}${tab('unpaid','Unpaid')}</div>
      ${list.length ? `<section class="panel list">${list.map(row).join('')}</section>`
                    : `<section class="panel"><p class="sub">Nothing in here.</p></section>`}
      <p class="sub mt">Each job keeps the price it was booked at. Changing your price list later never rewrites what already happened.</p>`;
  }

  function row(j) {
    const u = U();
    const done = j.status === 'done';
    const flag = !done ? (j.date < u.todayISO() ? '<span class="chip warn">Not logged</span>' : '<span class="chip next">Booked</span>')
      : (j.payment === 'Invoice' ? '<span class="chip warn">Invoiced</span>'
        : !j.payment ? '<span class="chip warn">No payment method</span>'
        : `<span class="chip done">${u.esc(j.payment)}</span>`);
    return `<div class="item" data-job="${j.id}">
      <div class="grow">
        <b>${u.esc(j.service)}${j.size ? ', ' + u.esc(j.size) : ''}</b>
        <span>${u.dayLabel(j.date)}${j.time ? ' ' + u.time12(j.time) : ''} &middot; ${u.esc(j.client)}${j.area ? ' &middot; ' + u.esc(j.area) : ''}</span>
      </div>
      ${flag}
      <div class="amt">${u.money(j.price)}</div>
      <div class="rowbtns">
        ${done ? `<button class="btn sm" data-edit="${j.id}">Edit</button>`
               : `<button class="btn pink sm" data-complete="${j.id}">Complete</button>`}
        <button class="btn sm danger" data-deljob="${j.id}">Delete</button>
      </div>
    </div>`;
  }

  /* ---------- booking form ---------- */
  const form = { service:'', size:'', addons:new Set(), date:'', time:'09:00' };

  function openBooking() {
    const u = U(), s = S(), cfg = FND.config;
    form.service = s.services[0].name;
    const sizes  = list('vehicleSizes', cfg.lists.vehicleSizes);
    form.size    = sizes[1] || sizes[0];
    form.addons  = new Set();
    form.date    = u.todayISO();
    form.time    = '09:00';

    u.openSheet(`
      <h3>New job</h3><p class="sub">Price comes from your price list. Override it if the job is custom.</p>
      <div class="grid2">
        ${u.field('Client', u.input('f_client', { placeholder:'Name' }))}
        ${u.field('Vehicle', u.input('f_vehicle', { placeholder:'2021 Honda CR-V' }))}
      </div>
      ${u.field('Service', u.select('f_service', s.services.map(x => x.name), form.service))}
      <div id="f_sizewrap">${u.field('Size', u.chips('size', sizes, form.size))}</div>
      ${u.field('Add-ons', u.chips('addons', addonList().map(a => a.name), null))}
      <div class="grid2">
        ${u.field('Date', u.input('f_date', { type:'date', value:form.date }))}
        ${u.field('Time', u.input('f_time', { type:'time', value:form.time }))}
      </div>
      <div class="grid2">
        ${u.field('Area', u.select('f_area', list('serviceAreas', cfg.lists.serviceAreas), list('serviceAreas', cfg.lists.serviceAreas)[0]))}
        ${u.field('Price', u.input('f_price', { inputmode:'decimal' }))}
      </div>
      ${u.field('Notes', u.input('f_notes', { placeholder:'Gate code, pet hair, power access' }))}
      <button class="btn pink wide" id="saveJob">Book it</button>
    `, sheet => {
      const priceEl = sheet.querySelector('#f_price');
      const sync = () => {
        const svc = sheet.querySelector('#f_service').value;
        form.service = svc;
        sheet.querySelector('#f_sizewrap').style.display = needsSize(svc) ? '' : 'none';
        priceEl.value = priceOf(svc, form.size, [...form.addons]).toFixed(2);
      };
      sheet.querySelector('#f_service').onchange = sync;
      sheet.addEventListener('click', e => {
        const b = e.target.closest('[data-val]'); if (!b) return;
        const group = b.closest('[data-pick]').dataset.pick;
        if (group === 'size') {
          form.size = b.dataset.val;
          b.parentElement.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
        } else {
          const v = b.dataset.val;
          form.addons.has(v) ? form.addons.delete(v) : form.addons.add(v);
          b.classList.toggle('on');
        }
        sync();
      });
      sheet.querySelector('#saveJob').onclick = () => {
        const g = id => sheet.querySelector('#' + id).value.trim();
        if (!g('f_client')) { U().toast('Client name is needed'); return; }
        S().addJob({
          date: g('f_date') || U().todayISO(),
          time: g('f_time'),
          client: g('f_client'),
          vehicle: g('f_vehicle'),
          service: form.service,
          size: needsSize(form.service) ? form.size : '',
          addons: [...form.addons].join(', '),
          area: g('f_area'),
          price: parseFloat(g('f_price')) || 0,
          notes: g('f_notes'),
          status: 'booked',
          payment: '', tip: 0
        });
        U().closeSheet();
        U().toast('Job booked');
      };
      sync();
    });
  }

  /* ---------- complete form ---------- */
  function openComplete(id) {
    const u = U(), s = S(), cfg = FND.config;
    const j = s.jobs.find(x => x.id === id); if (!j) return;
    const pays = list('paymentMethods', cfg.lists.paymentMethods);
    let pay = j.payment || pays[0];

    u.openSheet(`
      <h3>Complete job</h3>
      <p class="sub">${u.esc(j.service)}${j.size ? ', ' + u.esc(j.size) : ''}. ${u.esc(j.client)}.</p>
      ${u.field('Final price', u.input('c_price', { value:Number(j.price).toFixed(2), inputmode:'decimal' }))}
      ${u.field('Paid by', u.chips('pay', pays, pay), 'Buttons, not free text. This is what keeps your totals trustworthy.')}
      <div class="grid2">
        ${u.field('Tip', u.input('c_tip', { placeholder:'0.00', inputmode:'decimal' }))}
        ${u.field('Hours on site', u.input('c_hours', { value:j.hours || '', placeholder:'1.5', inputmode:'decimal' }))}
      </div>
      ${u.field('Kilometres driven', u.input('c_km', { value:j.km || '', placeholder:'12', inputmode:'numeric' }), 'Used for your vehicle deduction at tax time.')}
      <button class="btn pink wide" id="doComplete">Complete job</button>
    `, sheet => {
      sheet.addEventListener('click', e => {
        const b = e.target.closest('[data-val]'); if (!b) return;
        pay = b.dataset.val;
        b.parentElement.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      });
      sheet.querySelector('#doComplete').onclick = () => {
        const g = id2 => sheet.querySelector('#' + id2).value.trim();
        S().completeJob(id, {
          price: parseFloat(g('c_price')) || 0,
          payment: pay,
          tip: parseFloat(g('c_tip')) || 0,
          hours: parseFloat(g('c_hours')) || 0,
          km: parseFloat(g('c_km')) || 0
        });
        U().closeSheet();
        U().toast('Logged. Revenue updated.');
      };
    });
  }

  /* ---------- edit a completed job ---------- */
  function openEdit(id) {
    const u = U(), s = S(), cfg = FND.config;
    const j = s.jobs.find(x => x.id === id); if (!j) return;
    const pays = list('paymentMethods', cfg.lists.paymentMethods);
    let pay = j.payment || pays[0];
    u.openSheet(`
      <h3>Edit job</h3><p class="sub">${u.esc(j.client)}, ${u.dayLabel(j.date)}.</p>
      ${u.field('Price', u.input('e_price', { value:Number(j.price).toFixed(2), inputmode:'decimal' }))}
      ${u.field('Paid by', u.chips('pay', pays, pay))}
      ${u.field('Notes', u.input('e_notes', { value:j.notes || '' }))}
      <button class="btn pink wide" id="doEdit">Save changes</button>
    `, sheet => {
      sheet.addEventListener('click', e => {
        const b = e.target.closest('[data-val]'); if (!b) return;
        pay = b.dataset.val;
        b.parentElement.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      });
      sheet.querySelector('#doEdit').onclick = () => {
        S().updateJob(id, {
          price: parseFloat(sheet.querySelector('#e_price').value) || 0,
          payment: pay,
          notes: sheet.querySelector('#e_notes').value.trim()
        });
        U().closeSheet(); U().toast('Saved');
      };
    });
  }

  function setFilter(f) { filter = f; }

  return { render, openBooking, openComplete, openEdit, setFilter, priceOf };
})();
