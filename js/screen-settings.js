/* ============================================================
   FND OS : screen-settings.js
   Everything you can change without opening a code file.
   ============================================================ */
window.FND = window.FND || {};
FND.screens = FND.screens || {};

FND.screens.settings = (function () {
  const U = () => FND.ui;
  const S = () => FND.store;

  function render() {
    const u = U(), s = S();
    const local = s.localSettings();
    const pct = Math.round(Number(s.setting('money.taxSetAsidePercent', 0.25)) * 100);
    const mode = s.mode;
    const modeText = { demo:'Demo mode. Nothing here is saved to your sheet.',
                       live:'Connected to your sheet.',
                       cached:'Showing the last copy that downloaded. Will catch up when you have signal.',
                       offline:'Cannot reach the sheet right now.' }[mode] || mode;

    return `
      <div class="head"><div class="hello">Settings</div><h1 class="h1">Your knobs, all in one place.</h1></div>

      ${u.panel('Connection', mode, `
        <p class="sub">${u.esc(modeText)}</p>
        ${s.lastError ? `<p class="sub" style="color:var(--pink);margin-top:6px">Last error: ${u.esc(s.lastError)}</p>` : ''}
        ${u.field('Access key', u.input('set_token', { value: s.getToken() ? '••••••••••••' : '', placeholder:'Paste your access key' }),
          'The only thing you need to paste. Treat it like a password: it is what stops a stranger writing to your books. Clear the box before pasting a new one.')}
        <details class="adv"><summary>Advanced: backend address</summary>
          ${u.field('Currently', u.input('set_api', { value: FND.config.apiUrl || '', placeholder:'/api' }),
            'Leave this as /api. It points at the relay that sits at the same address as this app.')}
        </details>
        <div class="btns">
          <button class="btn blue" id="saveConn">Save connection</button>
          <button class="btn" id="syncNow">Sync now</button>
        </div>
        ${S().outbox.count() ? `<p class="sub mt">${S().outbox.count()} change waiting to send.</p>` : ''}`)}

      ${u.panel('Lock', s.hasPin() ? 'PIN is set' : 'No PIN set', `
        <p class="sub">The PIN stops whoever picks up your phone from reading your books. It is stored as a scrambled fingerprint, never as the digits.</p>
        <div class="btns">
          <button class="btn pink" id="setPin">${s.hasPin() ? 'Change PIN' : 'Set a PIN'}</button>
          ${s.hasPin() ? `<button class="btn danger" id="clearPin">Remove PIN</button>` : ''}
        </div>`)}

      ${u.panel('Tax', pct + '% of profit', `
        ${u.field('Set-aside percentage', u.input('set_pct', { value: pct, inputmode:'numeric' }),
          'Income tax applies to profit, not revenue. Ask your accountant for the right percentage, then put it here. I am not an accountant.')}
        ${u.field('Sadaqa per completed job', u.input('set_sadaqa', { value: s.setting('money.sadaqaPerJob', 0), inputmode:'decimal' }))}
        <div class="btns"><button class="btn blue" id="saveTax">Save</button></div>`)}

      ${u.panel('Expense categories', null, `
        <div class="taglist" id="catList">${listOf('expenseCategories')}</div>
        <div class="addrow">${u.input('newCat', { placeholder:'New category' })}<button class="btn" data-addlist="expenseCategories">Add</button></div>
        <p class="sub mt">Removing a category stops it being offered on new expenses. Anything already logged under it keeps its label.</p>`)}

      ${u.panel('Payment methods', null, `
        <div class="taglist" id="payList">${listOf('paymentMethods')}</div>
        <div class="addrow">${u.input('newPay', { placeholder:'New method' })}<button class="btn" data-addlist="paymentMethods">Add</button></div>`)}

      ${u.panel('Your data', null, `
        <p class="sub">A copy of everything currently on this device, as a file you can open in Excel. Your sheet also keeps its own nightly backup once you are live.</p>
        <div class="btns">
          <button class="btn" id="expJobs">Export jobs (CSV)</button>
          <button class="btn" id="expExp">Export expenses (CSV)</button>
          <button class="btn danger" id="wipe">Clear this device</button>
        </div>`)}

      <p class="sub mt">Anything not listed here lives in <b>js/config.js</b>: services and prices, add-ons, vendor rules, rebook windows, the HST threshold.</p>`;
  }

  function listOf(key) {
    const u = U();
    const arr = S().setting('lists.' + key, []) || [];
    return arr.map(v => `<span class="tag">${u.esc(v)}<button data-dellist="${key}" data-val="${u.esc(v)}" aria-label="Remove">&times;</button></span>`).join('')
      || '<p class="sub">Empty.</p>';
  }

  /* ---------- list editing ---------- */
  function addTo(key, value) {
    if (!value) return;
    const cur = (S().setting('lists.' + key, []) || []).slice();
    if (cur.includes(value)) { U().toast('Already in the list'); return; }
    cur.push(value);
    const local = S().localSettings(); local['lists.' + key] = cur; S().saveLocalSettings(local);
    U().toast('Added');
  }
  function removeFrom(key, value) {
    const cur = (S().setting('lists.' + key, []) || []).filter(v => v !== value);
    const local = S().localSettings(); local['lists.' + key] = cur; S().saveLocalSettings(local);
  }

  /* ---------- PIN ---------- */
  function openPinSetup() {
    const u = U();
    const len = S().setting('security.pinLength', 4);
    u.openSheet(`<h3>Set a PIN</h3><p class="sub">${len} digits. If you forget it, clear this device in Settings and set it again; your data lives in the sheet, not here.</p>
      ${u.field('New PIN', u.input('p1', { type:'password', inputmode:'numeric' }))}
      ${u.field('Confirm PIN', u.input('p2', { type:'password', inputmode:'numeric' }))}
      <button class="btn pink wide" id="savePin">Save PIN</button>`,
      sheet => {
        sheet.querySelector('#savePin').onclick = async () => {
          const a = sheet.querySelector('#p1').value, b = sheet.querySelector('#p2').value;
          if (a.length !== len || !/^\d+$/.test(a)) { U().toast(`Needs to be ${len} digits`); return; }
          if (a !== b) { U().toast('The two do not match'); return; }
          await S().setPin(a);
          U().closeSheet(); U().toast('PIN set'); FND.app.render();
        };
      });
  }

  /* ---------- CSV export ---------- */
  function toCSV(rows, cols) {
    const line = vals => vals.map(v => {
      const s = String(v == null ? '' : v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',');
    return [line(cols)].concat(rows.map(r => line(cols.map(c => r[c])))).join('\n');
  }
  function download(name, text) {
    const blob = new Blob([text], { type:'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* ---------- events for this screen ---------- */
  function mount(root) {
    const u = U(), s = S();
    const on = (sel, fn) => { const e = root.querySelector(sel); if (e) e.onclick = fn; };

    on('#saveConn', () => {
      const url = root.querySelector('#set_api').value.trim();
      const tok = root.querySelector('#set_token').value.trim();
      if (url) FND.config.apiUrl = url;
      if (tok && !/^•+$/.test(tok)) s.setToken(tok);
      U().toast('Saved. Syncing.');
      s.load().then(() => FND.app.render());
    });
    on('#syncNow', () => s.load().then(r => { U().toast('Sync: ' + r.mode); FND.app.render(); }));
    on('#setPin', openPinSetup);
    on('#clearPin', () => U().confirmAction('Remove the PIN?', 'Anyone holding your unlocked phone can then open your books.', 'Remove', () => { s.clearPin(); FND.app.render(); }));
    on('#saveTax', () => {
      const local = s.localSettings();
      local['money.taxSetAsidePercent'] = (parseFloat(root.querySelector('#set_pct').value) || 0) / 100;
      local['money.sadaqaPerJob'] = parseFloat(root.querySelector('#set_sadaqa').value) || 0;
      s.saveLocalSettings(local);
      U().toast('Saved'); FND.app.render();
    });
    on('#expJobs', () => download('fnd-jobs.csv', toCSV(s.jobs,
      ['id','date','time','client','vehicle','service','size','addons','area','price','tip','payment','hours','km','status','notes'])));
    on('#expExp', () => download('fnd-expenses.csv', toCSV(s.expenses,
      ['id','date','vendor','description','category','amount','paidWith','receipt'])));
    on('#wipe', () => U().confirmAction('Clear this device?', 'Cached data, saved lists and queued changes are removed from this phone. Anything already sent to your sheet stays there.', 'Clear', () => {
      s.wipeDevice(); location.reload();
    }));

    root.addEventListener('click', e => {
      const add = e.target.closest('[data-addlist]');
      if (add) {
        const key = add.dataset.addlist;
        const box = root.querySelector(key === 'expenseCategories' ? '#newCat' : '#newPay');
        addTo(key, box.value.trim()); FND.app.render(); return;
      }
      const del = e.target.closest('[data-dellist]');
      if (del) { removeFrom(del.dataset.dellist, del.dataset.val); FND.app.render(); }
    });
  }

  return { render, mount, openPinSetup };
})();
