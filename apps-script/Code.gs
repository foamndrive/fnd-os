/* ============================================================
   FND OS : Code.gs
   The backend. Lives in Google Apps Script, bound to your sheet.
   Every request must carry the access key or it is refused.

   Setup, in order:
     1. Run setupSheet()  once. It builds the tabs.
     2. Run makeAccessKey() once. Copy the key it prints.
     3. Deploy > New deployment > Web app
          Execute as: Me
          Who has access: Anyone
        Copy the /exec URL into js/config.js.
     4. Run installBackup() once, for nightly snapshots.

   "Anyone" is required for the app to reach it from a browser.
   The access key is what actually protects it, so treat that key
   like a password: never put it in a public file or a screenshot.
   ============================================================ */

var TABS = {
  jobs:     'Jobs',
  expenses: 'Expenses',
  clients:  'Clients',
  prices:   'Prices',
  settings: 'Settings',
  log:      'Log'
};

var COLS = {
  jobs:     ['id','date','time','client','vehicle','service','size','addons','area','price','tip',
             'payment','hours','km','status','notes','invoiceNo','calendarEventId','createdAt','updatedAt'],
  expenses: ['id','date','vendor','description','category','amount','paidWith','receipt','createdAt'],
  clients:  ['id','name','phone','email','address','monthlyInvoice','notes'],
  prices:   ['category','service','size','price','hours','active'],
  settings: ['key','value','notes']
};

/* ============================================================
   1. ONE-TIME SETUP
   ============================================================ */
function setupSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(COLS).forEach(function (k) {
    var name = TABS[k];
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, COLS[k].length).setValues([COLS[k]]);
      sh.getRange(1, 1, 1, COLS[k].length)
        .setFontWeight('bold').setBackground('#212529').setFontColor('#E7ECEF');
      sh.setFrozenRows(1);
    }
  });
  if (!ss.getSheetByName(TABS.log)) {
    var lg = ss.insertSheet(TABS.log);
    lg.getRange(1, 1, 1, 4).setValues([['when', 'action', 'detail', 'ok']]);
    lg.setFrozenRows(1);
  }
  return 'Tabs ready: ' + Object.keys(TABS).map(function (k) { return TABS[k]; }).join(', ');
}

function makeAccessKey() {
  var key = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 12);
  PropertiesService.getScriptProperties().setProperty('ACCESS_KEY', key);
  Logger.log('ACCESS KEY (copy this into the app, then never share it):\n' + key);
  return key;
}

function installBackup() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'nightlyBackup') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('nightlyBackup').timeBased().atHour(3).everyDays(1).create();
  return 'Nightly backup installed for ~3am.';
}

/* ============================================================
   2. REQUEST HANDLING
   ============================================================ */
function doPost(e) {
  var req;
  try { req = JSON.parse(e.postData.contents); }
  catch (err) { return reply(false, null, 'Bad request'); }

  if (!authorised(req.token)) {
    log('auth', 'refused', false);
    return reply(false, null, 'Not authorised');
  }

  var handlers = {
    bootstrap:     bootstrap,
    addJob:        addJob,
    updateJob:     updateJob,
    completeJob:   completeJob,
    deleteJob:     deleteJob,
    addExpense:    addExpense,
    deleteExpense: deleteExpense,
    ping:          function () { return { pong: true, at: new Date().toISOString() }; }
  };

  var fn = handlers[req.action];
  if (!fn) return reply(false, null, 'Unknown action: ' + req.action);

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var data = fn(req.payload || {});
    log(req.action, JSON.stringify(req.payload || {}).slice(0, 300), true);
    return reply(true, data);
  } catch (err) {
    log(req.action, String(err), false);
    return reply(false, null, String(err));
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

function doGet() {
  return ContentService.createTextOutput('FND OS backend is running. Use the app.')
    .setMimeType(ContentService.MimeType.TEXT);
}

function authorised(token) {
  var key = PropertiesService.getScriptProperties().getProperty('ACCESS_KEY');
  if (!key) return false;
  if (!token || token.length !== key.length) return false;
  var diff = 0;
  for (var i = 0; i < key.length; i++) diff |= key.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}

function reply(ok, data, error) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: ok, data: data || null, error: error || null }))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ============================================================
   3. SHEET HELPERS
   ============================================================ */
function sheet(key) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TABS[key]);
  if (!sh) throw new Error('Missing tab: ' + TABS[key] + '. Run setupSheet() once.');
  return sh;
}

function readTab(key) {
  var sh = sheet(key);
  if (sh.getLastRow() < 2) return [];
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  return rows.filter(function (r) { return String(r[0]).trim() !== ''; }).map(function (r) {
    var o = {};
    head.forEach(function (h, i) { if (h) o[h] = normalise(h, r[i]); });
    return o;
  });
}

function normalise(header, value) {
  if (value instanceof Date) {
    if (header === 'time') return Utilities.formatDate(value, tz(), 'HH:mm');
    return Utilities.formatDate(value, tz(), 'yyyy-MM-dd');
  }
  return value;
}

function tz() { return SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone() || 'America/Toronto'; }

function appendRow(key, obj) {
  var sh = sheet(key);
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  sh.appendRow(head.map(function (h) { return obj[h] !== undefined ? obj[h] : ''; }));
  return obj;
}

function findRowById(key, id) {
  var sh = sheet(key);
  if (sh.getLastRow() < 2) return -1;
  var ids = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return -1;
}

function patchRow(key, id, patch) {
  var sh = sheet(key);
  var row = findRowById(key, id);
  if (row < 0) throw new Error('Not found: ' + id);
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  head.forEach(function (h, i) {
    if (patch[h] !== undefined) sh.getRange(row, i + 1).setValue(patch[h]);
  });
  if (head.indexOf('updatedAt') > -1) sh.getRange(row, head.indexOf('updatedAt') + 1).setValue(new Date());
  return { id: id };
}

function removeRow(key, id) {
  var row = findRowById(key, id);
  if (row < 0) return { id: id, removed: false };
  sheet(key).deleteRow(row);
  return { id: id, removed: true };
}

function log(action, detail, ok) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(TABS.log);
    if (sh) sh.appendRow([new Date(), action, detail, ok]);
  } catch (e) {}
}

/* ============================================================
   4. ACTIONS
   ============================================================ */
function bootstrap() {
  return {
    jobs:     readTab('jobs'),
    expenses: readTab('expenses'),
    clients:  readTab('clients'),
    services: servicesFromPrices(),
    settings: settingsMap()
  };
}

function servicesFromPrices() {
  var rows = readTab('prices').filter(function (r) { return String(r.active).toLowerCase() !== 'no'; });
  if (!rows.length) return null;   // app falls back to config.js
  var out = {};
  rows.forEach(function (r) {
    var name = r.service;
    if (!out[name]) out[name] = { name: name, price: null, hours: Number(r.hours) || 0, _sizes: {} };
    if (r.size) out[name]._sizes[r.size] = Number(r.price) || 0;
    else out[name].price = Number(r.price) || 0;
  });
  return Object.keys(out).map(function (k) {
    var s = out[k];
    if (Object.keys(s._sizes).length) s.price = s._sizes;
    delete s._sizes;
    return s;
  });
}

function settingsMap() {
  var o = {};
  readTab('settings').forEach(function (r) { if (r.key) o[r.key] = r.value; });
  return o;
}

function addJob(p) {
  p.createdAt = new Date();
  p.updatedAt = new Date();
  return appendRow('jobs', p);
}

function updateJob(p)   { return patchRow('jobs', p.id, p.patch || {}); }
function completeJob(p) { return patchRow('jobs', p.id, p.patch || {}); }
function deleteJob(p)   { return removeRow('jobs', p.id); }

function addExpense(p) {
  p.createdAt = new Date();
  return appendRow('expenses', p);
}
function deleteExpense(p) { return removeRow('expenses', p.id); }

/* ============================================================
   5. NIGHTLY BACKUP
   Keeps 30 dated copies in a Drive folder, deletes older ones.
   ============================================================ */
function nightlyBackup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var folderName = 'FND Backups';
  var it = DriveApp.getFoldersByName(folderName);
  var folder = it.hasNext() ? it.next() : DriveApp.createFolder(folderName);

  var stamp = Utilities.formatDate(new Date(), tz(), 'yyyy-MM-dd');
  DriveApp.getFileById(ss.getId()).makeCopy('FND ' + stamp, folder);

  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  var files = folder.getFiles();
  while (files.hasNext()) {
    var f = files.next();
    if (f.getDateCreated() < cutoff) f.setTrashed(true);
  }
  log('backup', stamp, true);
}
