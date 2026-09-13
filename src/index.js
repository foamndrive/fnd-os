/* ============================================================
   FND OS : src/index.js
   The Cloudflare Worker.

   Two jobs:
     1. Answer /api by passing the request to Apps Script.
     2. Serve every other address as a plain file: the app itself.

   Because the app and /api sit at the same address, a phone sees
   one website talking to itself, which is what iPhones allow.

   Your Apps Script address is NOT in this file. It is stored in
   Cloudflare as a variable called SCRIPT_URL, which is why the
   repository can stay public.
   ============================================================ */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api' || url.pathname === '/api/') {
      return request.method === 'POST' ? relay(request, env) : status(env);
    }

    /* anything else is a file: index.html, the css, the js, the icons */
    return env.ASSETS.fetch(request);
  }
};

/* ---------- pass the app's request through to Apps Script ---------- */
async function relay(request, env) {
  if (!env.SCRIPT_URL) {
    return json({
      ok: false,
      error: 'SCRIPT_URL is not set. Add it in Cloudflare, Settings, Variables, then deploy again.'
    }, 500);
  }

  try {
    const body = await request.text();

    const res = await fetch(env.SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body,
      redirect: 'follow'
    });

    const text = await res.text();

    /* Apps Script answers with JSON. Anything else means something is
       wrong upstream, so say so instead of handing the app a web page
       it cannot read. */
    if (text.trim().charAt(0) !== '{') {
      return json({
        ok: false,
        error: 'The backend replied with something unexpected. Check the Apps Script deployment is a Web app set to Anyone.'
      }, 502);
    }

    return new Response(text, {
      status: res.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });

  } catch (err) {
    return json({ ok: false, error: 'Relay could not reach the backend: ' + err.message }, 502);
  }
}

/* ---------- opening /api in a browser: a health check ---------- */
function status(env) {
  return json({
    ok: true,
    data: {
      relay: 'FND OS relay is running.',
      scriptUrlConfigured: !!env.SCRIPT_URL
    }
  });
}

function json(obj, code) {
  return new Response(JSON.stringify(obj), {
    status: code || 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}
