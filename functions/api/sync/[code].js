// Cloudflare Pages Function — cross-device sync for Sunday Command.
// Stores/retrieves the app's whole config (leagues, pinned games, parlays) in
// Workers KV, keyed by a personal "sync code" the user picks. No accounts,
// no login — whoever knows the code can read/write that one slot.
// KV binding required in the Pages project settings: SYNC_KV.

function sanitizeCode(raw) {
  const code = String(raw || "").trim().toLowerCase();
  if (!/^[a-z0-9_-]{3,40}$/.test(code)) return null;
  return code;
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

export async function onRequestGet({ params, env }) {
  const code = sanitizeCode(params.code);
  if (!code) return json({ ok: false, error: "bad code" }, 400);
  if (!env.SYNC_KV) return json({ ok: false, error: "sync storage not configured" }, 500);

  const raw = await env.SYNC_KV.get("sync:" + code);
  if (!raw) return json({ ok: true, data: null, updatedAt: 0 });

  let parsed = null;
  try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
  return json({ ok: true, data: parsed ? parsed.data : null, updatedAt: parsed ? (parsed.updatedAt || 0) : 0 });
}

export async function onRequestPost({ params, env, request }) {
  const code = sanitizeCode(params.code);
  if (!code) return json({ ok: false, error: "bad code" }, 400);
  if (!env.SYNC_KV) return json({ ok: false, error: "sync storage not configured" }, 500);

  const text = await request.text();
  if (text.length > 300000) return json({ ok: false, error: "config too large" }, 413);

  let body;
  try { body = JSON.parse(text); } catch (e) { return json({ ok: false, error: "bad json" }, 400); }

  const updatedAt = Date.now();
  await env.SYNC_KV.put("sync:" + code, JSON.stringify({ data: body, updatedAt }));
  return json({ ok: true, updatedAt });
}
