/* ============================================================
   FND OS : functions/api.js
   A relay, and nothing else.

   The app used to call Apps Script directly. That is one website
   calling another, and iPhones block that. Now the app calls this
   file instead, which lives at the same address as the app, so the
   phone sees one site talking to itself. This file then calls Apps
   Script from Cloudflare's servers, where no phone is involved and
   nothing blocks anything.

   The Apps Script address is NOT written here. It is stored as an
   environment variable called SCRIPT_URL in the Cloudflare
   dashboard, so it stays out of your public repository.
   ============================================================ */

export async function onRequestPost(context) {
  const target = context.env.SCRIPT_URL;

  if (!target) {
    return json({ ok: false, error: 'SCRIPT_URL is not set. Add it in Cloudflare, Settings, Variables and secrets, then redeploy.' }, 500);
  }

  try {
    const body = await context.request.text();

    const res = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body,
      redirect: 'follow'
    });

    const text = await res.text();

    /* Apps Script answers with JSON. If it answers with anything else,
       something is wrong upstream, so say so plainly rather than
       handing the app a page of HTML it cannot read. */
    if (text.trim().charAt(0) !== '{') {
      return json({ ok: false, error: 'The backend replied with something unexpected. Check the Apps Script deployment is a Web app set to Anyone.' }, 502);
    }

    return new Response(text, {
      status: res.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });

  } catch (err) {
    return json({ ok: false, error: 'Relay could not reach the backend: ' + err.message }, 502);
  }
}

/* Opening /api in a browser should say something useful rather than
   throwing an error, so you can check the relay is alive. */
export async function onRequestGet(context) {
  return json({
    ok: true,
    data: {
      relay: 'FND OS relay is running.',
      scriptUrlConfigured: !!context.env.SCRIPT_URL
    }
  });
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}
