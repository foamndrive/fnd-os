/* ============================================================
   FND OS : app.js
   Boot, lock screen, routing, and the global click handler.
   Screens return HTML. This file decides what is on screen.
   ============================================================ */
window.FND = window.FND || {};

FND.app = (function () {
  const U = () => FND.ui;
  const S = () => FND.store;

  const NAV = [
    ['home',     'Home'],
    ['jobs',     'Jobs'],
    ['money',    'Money'],
    ['settings', 'Settings']
  ];

  let current = 'home';
  let lastActive = Date.now();
  let unlocked = false;

  /* ---------- render ---------- */
  function renderNav() {
    const u = U();
    const item = ([k, label]) =>
      `<button class="nav ${current === k ? 'on' : ''}" data-go="${k}">${u.icon(k)}<span class="lbl">${label}</span></button>`;
    u.$('rail').innerHTML =
      `<div class="mark">F<span class="n">N</span>D</div>` +
      NAV.map(item).join('') +
      `<div class="spacer"></div>` +
      `<div class="modebadge ${S().mode}">${S().mode === 'live' ? 'Live' : S().mode === 'demo' ? 'Demo' : 'Offline'}</div>` +
      `<button class="newbtn" data-act="new">${u.icon('plus', 2.4)}<span class="lbl">New</span></button>`;
    u.$('tabbar').innerHTML = NAV.map(item).join('');
  }

  function render() {
    const u = U();
    renderNav();
    const main = u.$('main');
    main.innerHTML = FND.screens[current].render();
    if (FND.screens[current].mount) FND.screens[current].mount(main);
    main.scrollTop = 0;
  }

  function go(k) { current = k; render(); }

  /* ---------- lock ---------- */
  function showLock(message) {
    const u = U();
    u.$('lock').classList.add('open');
    u.$('lockMsg').textContent = message || 'Enter your PIN';
    u.$('pinInput').value = '';
    setTimeout(() => u.$('pinInput').focus(), 80);
  }
  function hideLock() { U().$('lock').classList.remove('open'); unlocked = true; lastActive = Date.now(); }

  async function tryUnlock() {
    const u = U();
    const pin = u.$('pinInput').value;
    if (await S().checkPin(pin)) { hideLock(); render(); }
    else { u.$('lockMsg').textContent = 'Wrong PIN'; u.$('pinInput').value = ''; }
  }

  function checkIdle() {
    if (!S().hasPin() || !S().setting('security.requirePin', true)) return;
    const mins = Number(S().setting('security.lockAfterMinutes', 10));
    if (unlocked && Date.now() - lastActive > mins * 60000) { unlocked = false; showLock('Locked. Enter your PIN.'); }
  }

  /* ---------- global events ---------- */
  function wire() {
    document.addEventListener('click', e => {
      lastActive = Date.now();
      const b = e.target.closest('button');
      if (!b) return;
      const d = b.dataset;

      if (d.go)       { U().closeSheet(); go(d.go); return; }
      if (d.close)    { U().closeSheet(); return; }

      if (d.act === 'new')        { openNewMenu(); return; }
      if (d.act === 'addJob')     { U().closeSheet(); FND.screens.jobs.openBooking(); return; }
      if (d.act === 'addExpense') { U().closeSheet(); FND.screens.money.openExpense(); return; }

      if (d.complete) { FND.screens.jobs.openComplete(d.complete); return; }
      if (d.edit)     { FND.screens.jobs.openEdit(d.edit); return; }
      if (d.deljob)   {
        const j = S().jobs.find(x => x.id === d.deljob);
        U().confirmAction('Delete this job?', j ? `${j.service}, ${j.client}. This cannot be undone from here.` : '', 'Delete',
          () => { S().deleteJob(d.deljob); render(); U().toast('Deleted'); });
        return;
      }
      if (d.delexp)   {
        U().confirmAction('Delete this expense?', 'This cannot be undone from here.', 'Delete',
          () => { S().deleteExpense(d.delexp); render(); U().toast('Deleted'); });
        return;
      }
      if (d.filter)   { FND.screens.jobs.setFilter(d.filter); render(); return; }
      if (d.mtab)     { FND.screens.money.setTab(d.mtab); render(); return; }
      if (b.id === 'unlockBtn') { tryUnlock(); return; }
    });

    document.addEventListener('change', e => {
      if (e.target.id === 'monthPick') { FND.screens.money.setMonth(e.target.value); render(); }
    });

    document.addEventListener('keydown', e => {
      lastActive = Date.now();
      if (e.key === 'Escape') U().closeSheet();
      if (e.key === 'Enter' && document.activeElement && document.activeElement.id === 'pinInput') tryUnlock();
    });
    document.addEventListener('touchstart', () => { lastActive = Date.now(); }, { passive:true });

    U().$('scrim').addEventListener('click', e => { if (e.target.id === 'scrim') U().closeSheet(); });

    document.addEventListener('visibilitychange', () => { if (!document.hidden) { checkIdle(); S().flush(); } });
    setInterval(checkIdle, 20000);
    setInterval(() => { if (S().isLive() && !document.hidden) S().load().then(render); },
      Math.max(30, Number(FND.config.app.refreshSeconds)) * 1000);
  }

  function openNewMenu() {
    const u = U();
    u.openSheet(`<h3>New</h3><p class="sub">The two things you do most.</p>
      <div class="tiles">
        <button class="tile" data-act="addJob">${u.icon('jobs')}<b>Job</b><small>Book it or log one you just did</small></button>
        <button class="tile" data-act="addExpense">${u.icon('camera')}<b>Expense</b><small>Log it at the counter</small></button>
      </div>`);
  }

  /* ---------- boot ---------- */
  async function boot() {
    wire();
    S().onChange(() => { if (!document.getElementById('scrim').classList.contains('open')) render(); else renderNav(); });

    const needPin = S().setting('security.requirePin', true) && S().hasPin();
    if (needPin) showLock(); else unlocked = true;

    const res = await S().load();
    render();

    if (res.mode === 'demo') {
      U().toast('Demo mode. Connect your sheet in Settings to go live.');
    } else if (res.mode === 'offline') {
      U().toast('Cannot reach the sheet. Working from this device.');
    }

    if (!S().hasPin() && S().setting('security.requirePin', true)) {
      setTimeout(() => U().toast('No PIN set yet. Settings, Lock.'), 3200);
    }
  }

  return { boot, render, go };
})();

document.addEventListener('DOMContentLoaded', FND.app.boot);
