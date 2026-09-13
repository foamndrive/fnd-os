/* ============================================================
   FND OS : config.js
   Everything you are likely to change lives in this one file.
   Nothing here should require touching any other file.
   ============================================================ */
window.FND = window.FND || {};

FND.config = {

  /* --- identity ------------------------------------------ */
  business: {
    name:  'Foam N Drive',
    short: 'FND',
    email: 'foamndrive@gmail.com',
    phone: '(647) 897-2397',
    site:  'foamndrive.ca'
  },

  /* --- backend ------------------------------------------
     Leave apiUrl empty to run in DEMO mode (fake data, nothing
     saved anywhere real). Paste your Apps Script web app URL
     here after SETUP step 6 to go live.                      */
  apiUrl: '',

  /* --- device lock ---------------------------------------
     pinLength: how many digits. lockAfterMinutes: idle time
     before the PIN is asked again. Set requirePin to false
     only while you are testing.                              */
  security: {
    requirePin: true,
    pinLength: 4,
    lockAfterMinutes: 10
  },

  /* --- money --------------------------------------------- */
  money: {
    currency: 'CAD',
    locale:   'en-CA',

    /* Income tax set-aside. Percentage of PROFIT (revenue minus
       expenses) you hold back. Get this number from your
       accountant, then change it here. 0.25 = 25%.           */
    taxSetAsidePercent: 0.25,

    /* HST. Canada-wide small supplier threshold is $30,000 of
       revenue over four consecutive quarters. Turn chargeHst on
       only once you are registered and have your number.     */
    hstRate: 0.13,
    hstThreshold: 30000,
    hstWarnAt: 25000,
    chargeHst: false,
    hstNumber: '',

    /* Sadaqa set aside per completed job. 0 turns it off.    */
    sadaqaPerJob: 5
  },

  /* --- dropdown lists ------------------------------------
     Add, remove or rename freely. Anything used by an old
     record still displays; it just stops being offered.      */
  lists: {
    expenseCategories: [
      'Equipment & Supplies',
      'Recurring',
      'Marketing',
      'Big Purchases',
      'Other'
    ],
    paymentMethods: [
      'Cash',
      'E-Transfer',
      'Card tap',
      'Business account',
      'Invoice'
    ],
    expensePaidWith: [
      'Business card',
      'Business account',
      'Cash',
      'Personal (to reimburse)'
    ],
    vehicleSizes: ['Coupe', 'Sedan & SUV', 'XL'],
    serviceAreas: ['Mississauga', 'Oakville', 'Milton', 'Burlington', 'Other GTA']
  },

  /* --- vendor rules -------------------------------------
     When a vendor name contains the key, suggest the category.
     Built from your own two years of expense history.        */
  vendorRules: {
    'amazon':     'Equipment & Supplies',
    'carzilla':   'Equipment & Supplies',
    'home depot': 'Equipment & Supplies',
    'homedepot':  'Equipment & Supplies',
    'ali express':'Equipment & Supplies',
    'aliexpress': 'Equipment & Supplies',
    'temu':       'Equipment & Supplies',
    'dollarama':  'Equipment & Supplies',
    'canadian tire':'Equipment & Supplies',
    'google ads': 'Marketing',
    'fb ads':     'Marketing',
    'meta':       'Marketing',
    'canva':      'Recurring',
    'skool':      'Recurring',
    'gas':        'Other',
    'petro':      'Other',
    'esso':       'Other',
    'shell':      'Other'
  },

  /* --- service catalogue --------------------------------
     Used by the job form. In LIVE mode this is replaced by the
     Prices tab of your sheet; this list is the demo fallback.
     price: a number, or an object keyed by vehicle size.     */
  services: [
    { name:'Maintenance Detail',   price:{ 'Coupe':69.99,  'Sedan & SUV':79.99,  'XL':89.99  }, hours:1.5 },
    { name:'Deep Clean Detail',    price:{ 'Coupe':159.99, 'Sedan & SUV':179.99, 'XL':199.99 }, hours:3   },
    { name:'Interior Only',        price:{ 'Coupe':99.99,  'Sedan & SUV':129.99, 'XL':149.99 }, hours:2.5 },
    { name:'1-Stage Gloss Enhancement',            price:399.99, hours:5 },
    { name:'2-Stage Mirror Finish',                price:699.99, hours:9 },
    { name:'3-Stage Showroom Finish',              price:1199.99, hours:14 },
    { name:'Daily Driver Ceramic (2 yr+)',         price:299.99, hours:4 },
    { name:'Long-Term Ceramic (5 yr+)',            price:699.99, hours:6 },
    { name:'Gloss Enhancement + Daily Driver Ceramic', price:499.99, hours:8 },
    { name:'Window Tint, full vehicle',            price:199.99, hours:3 },
    { name:'Marine / RV / Custom',                 price:0,      hours:0 }
  ],

  addons: [
    { name:'Engine bay detail',          price:49.99 },
    { name:'Headlight restoration',      price:149.99 },
    { name:'Wax application',            price:59.99 },
    { name:'Pet hair removal',           price:49.99 },
    { name:'Excessive soil surcharge',   price:40.00 }
  ],

  /* --- behaviour ----------------------------------------- */
  app: {
    /* How often the app re-reads from the sheet, in seconds.  */
    refreshSeconds: 120,
    /* Rebook reminder windows, in weeks, by service keyword.  */
    rebookWeeks: { 'Maintenance':4, 'Deep Clean':8, 'Interior':8, 'Ceramic':12, 'default':8 }
  }
};
