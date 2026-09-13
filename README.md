# FND OS : Phase 1

Jobs, expenses and money on your phone, laptop and iPad. Your data lives in a
Google Sheet you own. The app is just the screen.

## Files

    index.html              the shell. Loads everything in order.
    manifest.json           makes it installable to the home screen
    icon-192.png            app icons
    icon-512.png
    css/app.css             all styling, brand kit colours at the top
    js/config.js            EVERY knob you are likely to change
    js/store.js             the only file that talks to the outside world
    js/ui.js                formatting and shared interface pieces
    js/screen-home.js       today, month numbers, tax set-aside
    js/screen-jobs.js       job list, booking form, complete form
    js/screen-money.js      month summary, expense log, by-service
    js/screen-settings.js   connection, PIN, lists, exports
    js/app.js               boot, lock screen, routing
    apps-script/Code.gs     the backend. Goes in Apps Script, not here.
    SETUP-CHECKLIST.html    do this once, in order

## Where to change things

| I want to change                        | Open                    |
|-----------------------------------------|-------------------------|
| services and prices                     | js/config.js, or the Prices tab once live |
| add-ons, vendor rules, rebook windows   | js/config.js            |
| tax percentage, sadaqa, PIN, categories | Settings screen in the app |
| colours and spacing                     | css/app.css             |
| what a screen shows                     | the matching js/screen-*.js |
| what the server does                    | apps-script/Code.gs     |

Settings changes live on the device. config.js changes are permanent for
everyone. If both set the same thing, Settings wins.

## Running it

Open index.html through a web address, not by double clicking the file.
Locally: `python3 -m http.server` in this folder, then localhost:8000.
Published: GitHub Pages, per the setup checklist.

With no apiUrl set it runs in DEMO mode: fake jobs, nothing saved anywhere.
Safe to poke at.

## What Phase 1 does not do yet

Calendar sync, website booking, Google Ads figures, receipt photos,
automatic invoices and emails. Those are Phases 2 and 3, and they all hang
off this foundation.
