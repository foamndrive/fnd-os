/* ============================================================
   FND OS : store.js
   The only file that talks to the outside world.
   Screens never fetch. They ask the store, the store decides
   whether the answer comes from the sheet, the cache, or demo
   data, and queues anything that cannot be sent right now.
   ============================================================ */
window.FND = window.FND || {};

FND.store = (function () {

  const K = {
    token:   'fnd_token',
    cache:   'fnd_cache_v1',
    outbox:  'fnd_outbox_v1',
    pin:     'fnd_pin_v1',
    settings:'fnd_local_settings_v1'
  };

  let data = { jobs: [], expenses: [], clients: [], services: null, meta: {} };
  let lastError = '';
  let listeners = [];

  /* ---------- tiny helpers ---------- */
  const ls = {
    get(k, fallback) { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch (e) { return fallback; } },
    set(k, v)        { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k)           { try { localStorage.removeItem(k); } catch (e) {} }
  };
  const uid = p => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const isLive = () => !!(FND.config.apiUrl && getToken());

  function getToken() { return ls.get(K.token, ''); }
  function setToken(t) { ls.set(K.token, t); }

  function onChange(fn) { listeners.push(fn); }
  function emit() { listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } }); }

  /* ---------- network ----------
     POST uses text/plain on purpose: it keeps the browser from
     sending a CORS preflight, which Apps Script cannot answer. */
  async function call(action, payload) {
    /* iOS caches the redirect Apps Script sends back, and the address it
       redirects to carries a one-time token. Once cached, every later call
       goes to a dead address. A changing parameter keeps the cache from
       ever matching. Apps Script ignores parameters it does not know. */
    const base = FND.config.apiUrl;
    const url = base + (base.indexOf('?') > -1 ? '&' : '?') + 'cb=' + Date.now() + Math.random().toString(36).slice(2, 6);
    const body = JSON.stringify({ action, token: getToken(), payload: payload || {} });
    const res = await fetch(url, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body
    });
    if (!res.ok) throw new Error('Server returned ' + res.status);
    const out = await res.json();
    if (!out.ok) throw new Error(out.error || 'Request failed');
    return out.data;
  }

  /* ---------- outbox ----------
     Anything that changes data goes here first, so a dead zone
     at a marina never costs you an entry.                      */
  const outbox = {
    all()      { return ls.get(K.outbox, []); },
    add(item)  { const q = outbox.all(); q.push(item); ls.set(K.outbox, q); },
    drop(id)   { ls.set(K.outbox, outbox.all().filter(i => i.id !== id)); },
    count()    { return outbox.all().length; }
  };

  async function flush() {
    if (!isLive() || !navigator.onLine) return;
    for (const item of outbox.all()) {
      try { await call(item.action, item.payload); outbox.drop(item.id); }
      catch (e) { console.warn('Outbox held:', e.message); break; }
    }
    emit();
  }

  /* ---------- demo data ---------- */
  function demoData() {
    const d = (offset) => { const x = new Date(); x.setDate(x.getDate() + offset); return x.toISOString().slice(0, 10); };
    return {
      jobs: [
        { id:'J-1', date:d(0),  client:'Jake Morrison',  vehicle:'2019 Mazda 3',       service:'Maintenance Detail', size:'Sedan & SUV', area:'Milton',     price:79.99,  time:'08:30', status:'done',   payment:'Cash',       tip:0, hours:1.5, km:14 },
        { id:'J-2', date:d(0),  client:'Omar Haddad',    vehicle:'2021 Honda CR-V',    service:'Deep Clean Detail',  size:'Sedan & SUV', area:'Oakville',   price:179.99, time:'10:30', status:'booked', payment:'',           tip:0, hours:3,   km:22 },
        { id:'J-3', date:d(0),  client:'Sara Lindqvist', vehicle:'2022 Ford Expedition',service:'Maintenance Detail',size:'XL',          area:'Burlington', price:139.98, time:'15:00', status:'booked', payment:'',           tip:0, hours:2,   km:31 },
        { id:'J-4', date:d(1),  client:'Priya Shah',     vehicle:'2023 Audi S3',       service:'Gloss Enhancement + Daily Driver Ceramic', size:'', area:'Mississauga', price:499.99, time:'09:00', status:'booked', payment:'', tip:0, hours:8, km:9 },
        { id:'J-5', date:d(-2), client:'Hassan Karimi',  vehicle:'2020 Toyota Sienna', service:'Deep Clean Detail',  size:'XL',          area:'Mississauga',price:199.99, time:'10:00', status:'done',   payment:'Cash',       tip:20, hours:3.5, km:11 },
        { id:'J-6', date:d(-4), client:'Mark Beaulieu',  vehicle:'2018 BMW 340i',      service:'1-Stage Gloss Enhancement', size:'',     area:'Oakville',   price:399.99, time:'09:00', status:'done',   payment:'Card tap',   tip:0, hours:5,   km:19 },
        { id:'J-7', date:d(-6), client:'Daniel Reyes',   vehicle:'2017 Civic Si',      service:'Maintenance Detail', size:'Coupe',       area:'Milton',     price:69.99,  time:'09:00', status:'done',   payment:'E-Transfer', tip:10, hours:1.5, km:16 }
      ],
      expenses: [
        { id:'E-1', date:d(-3), category:'Equipment & Supplies', vendor:'Carzilla',   description:'Polishing pads',     amount:63.27, paidWith:'Business card',    receipt:'' },
        { id:'E-2', date:d(-5), category:'Marketing',            vendor:'Google Ads', description:'Daily spend',        amount:48.00, paidWith:'Business card',    receipt:'' },
        { id:'E-3', date:d(-9), category:'Recurring',            vendor:'Canva',      description:'Subscription',       amount:16.95, paidWith:'Business account', receipt:'' },
        { id:'E-4', date:d(-11),category:'Equipment & Supplies', vendor:'Amazon',     description:'Microfibre towels',  amount:42.18, paidWith:'Business card',    receipt:'' }
      ],
      clients: [
        { id:'C-1', name:'Priya Shah',     phone:'', email:'', monthlyInvoice:false },
        { id:'C-2', name:'Attree Properties Corp.', phone:'', email:'', monthlyInvoice:true }
      ],
      services: null,
      meta: { mode:'demo' }
    };
  }

  /* ---------- load ---------- */
  async function load() {
    if (!isLive()) { data = demoData(); emit(); return { mode:'demo' }; }

    const cached = ls.get(K.cache, null);
    if (cached) { data = cached; emit(); }

    try {
      lastError = '';
      const fresh = await call('bootstrap');
      data = Object.assign({ jobs:[], expenses:[], clients:[], services:null }, fresh, { meta:{ mode:'live', fetchedAt:Date.now() } });
      ls.set(K.cache, data);
      emit();
      await flush();
      return { mode:'live' };
    } catch (e) {
      lastError = (e.name ? e.name + ': ' : '') + e.message;
      emit();
      return { mode: cached ? 'cached' : 'offline', error: lastError };
    }
  }

  /* ---------- writes ----------
     Every write updates the screen immediately, then queues the
     server call. The app never waits on the network.           */
  function queue(action, payload) {
    /* Demo mode changes stay on the device only. Nothing to send. */
    if (isLive()) outbox.add({ id: uid('q'), action, payload, at: Date.now() });
    ls.set(K.cache, data);
    emit();
    flush();
  }

  function addJob(job) {
    job.id = job.id || uid('J');
    job.status = job.status || 'booked';
    data.jobs.push(job);
    queue('addJob', job);
    return job;
  }

  function completeJob(id, patch) {
    const j = data.jobs.find(x => x.id === id);
    if (!j) return null;
    Object.assign(j, patch, { status:'done' });
    queue('completeJob', { id, patch: Object.assign({}, patch, { status:'done' }) });
    return j;
  }

  function updateJob(id, patch) {
    const j = data.jobs.find(x => x.id === id);
    if (!j) return null;
    Object.assign(j, patch);
    queue('updateJob', { id, patch });
    return j;
  }

  function deleteJob(id) {
    data.jobs = data.jobs.filter(x => x.id !== id);
    queue('deleteJob', { id });
  }

  function addExpense(exp) {
    exp.id = exp.id || uid('E');
    data.expenses.push(exp);
    queue('addExpense', exp);
    return exp;
  }

  function deleteExpense(id) {
    data.expenses = data.expenses.filter(x => x.id !== id);
    queue('deleteExpense', { id });
  }

  /* ---------- local settings ----------
     Overrides on top of config.js that you can change from the
     Settings screen without editing any file.                  */
  function localSettings() { return ls.get(K.settings, {}); }
  function saveLocalSettings(obj) { ls.set(K.settings, obj); emit(); }
  function setting(path, fallback) {
    const local = localSettings();
    if (path in local) return local[path];
    const parts = path.split('.');
    let cur = FND.config;
    for (const p of parts) { if (cur == null) return fallback; cur = cur[p]; }
    return cur === undefined ? fallback : cur;
  }

  /* ---------- PIN ----------
     Stored as a hash with a random salt, never the digits.     */
  async function hash(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  async function setPin(pin) {
    const salt = uid('s');
    ls.set(K.pin, { salt, hash: await hash(salt + pin) });
  }
  function hasPin() { return !!ls.get(K.pin, null); }
  async function checkPin(pin) {
    const rec = ls.get(K.pin, null);
    if (!rec) return false;
    return (await hash(rec.salt + pin)) === rec.hash;
  }
  function clearPin() { ls.del(K.pin); }

  /* ---------- reset ---------- */
  function wipeDevice() {
    [K.cache, K.outbox, K.settings].forEach(ls.del);
  }

  window.addEventListener('online', flush);

  return {
    get jobs()     { return data.jobs; },
    get expenses() { return data.expenses; },
    get clients()  { return data.clients; },
    get services() { return data.services || FND.config.services; },
    get mode()     { return data.meta.mode || 'demo'; },
    isLive, getToken, setToken,
    get lastError() { return lastError; },
    load, onChange, flush, outbox,
    addJob, completeJob, updateJob, deleteJob,
    addExpense, deleteExpense,
    localSettings, saveLocalSettings, setting,
    setPin, hasPin, checkPin, clearPin,
    wipeDevice
  };
})();
