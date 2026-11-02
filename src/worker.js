/*
 * Station numixs : serveur Cloudflare Workers (offre gratuite).
 * - /events.json et /api/events : événements Eventbrite (copie de 10 minutes)
 * - /api/tickets : billets d'une personne, retrouvés par son e-mail d'inscription
 * - /api/push/* et tâche planifiée : notifications (nouvel événement, rappels)
 * - /api/network/* : annuaire des participants, sur volontariat
 * Le jeton Eventbrite (secret EVENTBRITE_TOKEN) ne quitte jamais le serveur.
 * Aucune adresse e-mail n'est conservée : seules des empreintes (SHA-256) servent à retrouver un profil.
 */

const EB = 'https://www.eventbriteapi.com/v3';
const TZ = 'Europe/Paris';
const PUSH_HOSTS = ['googleapis.com', 'mozilla.com', 'mozaws.net', 'apple.com', 'windows.com'];
const MAX_SUBS = 2000;
const attCache = new Map();
let ready = false;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname !== '/events.json' && !url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    try {
      await init(env);
      return await route(req, env, url);
    } catch (e) {
      console.error('Erreur', e && e.message);
      return json({ error: 'Une erreur est survenue. Réessayez dans un instant.' }, 500);
    }
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(init(env).then(() => cron(env)).catch((e) => console.error('Cron', e && e.message)));
  }
};

/* ---------- utilitaires ---------- */
function json(data, status) {
  return new Response(JSON.stringify(data), { status: status || 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
}
function fail(msg, status) { return json({ error: msg }, status || 400); }
async function body(req) {
  const ct = req.headers.get('content-type') || '';
  if (!ct.includes('application/json')) return null;
  const t = await req.text();
  if (t.length > 8000) return null;
  try { const j = JSON.parse(t); return j && typeof j === 'object' ? j : null; } catch (e) { return null; }
}
function cleanEmail(v) {
  const e = String(v || '').trim().toLowerCase();
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : null;
}
function cleanText(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max); }
async function sha(s) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const now = () => Date.now();
const fmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: TZ });
const when = (iso) => { const s = fmt.format(new Date(iso)); return s.charAt(0).toUpperCase() + s.slice(1); };

/* ---------- base de données ---------- */
async function init(env) {
  if (ready) return;
  await env.DB.batch([
    env.DB.prepare('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL, t INTEGER NOT NULL)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS subs (endpoint TEXT PRIMARY KEY, created INTEGER NOT NULL)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS notifs (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, body TEXT NOT NULL, url TEXT, t INTEGER NOT NULL)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS outbox (id INTEGER PRIMARY KEY AUTOINCREMENT, notif_id INTEGER NOT NULL, endpoint TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS notified (k TEXT PRIMARY KEY, t INTEGER NOT NULL)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS profiles (event_id TEXT NOT NULL, h TEXT NOT NULL, name TEXT NOT NULL, org TEXT, looking TEXT, ev_end INTEGER NOT NULL, created INTEGER NOT NULL, PRIMARY KEY (event_id, h))'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS hits (bucket TEXT NOT NULL, ip TEXT NOT NULL, t INTEGER NOT NULL)')
  ]);
  ready = true;
}
async function kvGet(env, k) { const r = await env.DB.prepare('SELECT v, t FROM kv WHERE k = ?').bind(k).first(); return r ? { v: JSON.parse(r.v), t: r.t } : null; }
async function kvSet(env, k, v) { await env.DB.prepare('INSERT INTO kv (k, v, t) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, t = excluded.t').bind(k, JSON.stringify(v), now()).run(); }

async function limited(env, req, bucket, max, windowSec) {
  const ip = req.headers.get('CF-Connecting-IP') || 'inconnu';
  const since = now() - windowSec * 1000;
  const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM hits WHERE bucket = ? AND ip = ? AND t > ?').bind(bucket, ip, since).first();
  if (r && r.n >= max) return true;
  await env.DB.prepare('INSERT INTO hits (bucket, ip, t) VALUES (?, ?, ?)').bind(bucket, ip, now()).run();
  return false;
}

/* ---------- Eventbrite ---------- */
async function eb(env, path, params) {
  if (!env.EVENTBRITE_TOKEN) throw new Error('Jeton Eventbrite absent');
  const url = new URL(EB + path);
  for (const [k, v] of Object.entries(params || {})) url.searchParams.set(k, v);
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + env.EVENTBRITE_TOKEN } });
  if (!r.ok) { let d = ''; try { d = (await r.text()).slice(0, 300); } catch (e) {} throw new Error('Eventbrite ' + r.status + ' sur ' + path + ' ' + d); }
  return r.json();
}
async function ebAll(env, path, key, params, maxPages) {
  const out = [];
  let cont = null, pages = 0;
  do {
    const j = await eb(env, path, cont ? Object.assign({}, params, { continuation: cont }) : params);
    out.push(...(j[key] || []));
    cont = j.pagination && j.pagination.has_more_items ? j.pagination.continuation : null;
    pages++;
  } while (cont && pages < (maxPages || 5));
  return out;
}
async function orgIds(env) {
  if (env.EVENTBRITE_ORG_ID) return String(env.EVENTBRITE_ORG_ID).split(',').map((s) => s.trim()).filter(Boolean);
  const c = await kvGet(env, 'orgs');
  if (c && now() - c.t < 86400000) return c.v;
  const j = await eb(env, '/users/me/organizations/');
  const ids = (j.organizations || []).map((o) => String(o.id));
  await kvSet(env, 'orgs', ids);
  return ids;
}
async function getEvents(env, force) {
  const c = await kvGet(env, 'events');
  if (c && !force && now() - c.t < 600000) return c.v.events;
  try {
    let raw = [];
    for (const id of await orgIds(env)) raw = raw.concat(await ebAll(env, '/organizations/' + id + '/events/', 'events', { status: 'live,started', expand: 'venue', order_by: 'start_asc', page_size: '50' }, 3));
    const events = raw.map((e) => ({
      id: String(e.id),
      title: (e.name && e.name.text) || 'Événement',
      description: String(e.summary || (e.description && e.description.text) || '').trim().slice(0, 600),
      start: e.start && e.start.utc,
      end: e.end && e.end.utc,
      url: e.url,
      venue: e.venue ? { name: e.venue.name || 'Station numixs', address: (e.venue.address && e.venue.address.localized_address_display) || '' } : null,
      isFree: e.is_free === true ? true : (e.is_free === false ? false : null)
    })).filter((e) => e.start && e.end && Date.parse(e.end) >= now()).sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
    await kvSet(env, 'events', { events });
    return events;
  } catch (e) {
    if (c) return c.v.events; // en cas de panne, on garde la dernière copie
    throw e;
  }
}
async function attendees(env, eventId) {
  const hit = attCache.get(eventId);
  if (hit && now() - hit.t < 60000) return hit.list;
  const raw = await ebAll(env, '/events/' + eventId + '/attendees/', 'attendees', {}, 4);
  const list = raw.filter((a) => !a.cancelled && !a.refunded).map((a) => ({
    email: String((a.profile && a.profile.email) || '').trim().toLowerCase(),
    name: (a.profile && a.profile.name) || '',
    first: (a.profile && a.profile.first_name) || '',
    ticket: a.ticket_class_name || 'Billet',
    barcode: a.barcodes && a.barcodes[0] && a.barcodes[0].barcode || '',
    checkedIn: !!a.checked_in
  }));
  attCache.set(eventId, { t: now(), list });
  return list;
}

/* ---------- routes ---------- */
async function route(req, env, url) {
  const p = url.pathname, m = req.method;
  if (p === '/api/ping') return json({ ok: true });
  if (p === '/events.json' && m === 'GET') {
    const events = await getEvents(env).catch(() => null);
    if (!events) return fail('Programme indisponible', 503);
    return new Response(JSON.stringify({ updatedAt: new Date().toISOString(), events }), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=60' } });
  }
  if (p === '/api/events' && m === 'GET') return json({ events: await getEvents(env) });
  if (p === '/api/push/key' && m === 'GET') return json({ key: (await vapid(env)).pub });
  if (p === '/api/notifications/latest' && m === 'GET') {
    const n = await env.DB.prepare('SELECT title, body, url, t FROM notifs ORDER BY id DESC LIMIT 1').first();
    return json(n || { title: 'Station numixs', body: 'Ouvrez l\'application pour voir le programme.', url: './' });
  }
  if (p === '/api/notifications/recent' && m === 'GET') {
    const r = await env.DB.prepare('SELECT title, body, t FROM notifs ORDER BY id DESC LIMIT 10').all();
    return json({ notifications: r.results || [] });
  }
  if (m !== 'POST') return fail('Introuvable', 404);
  const b = await body(req);
  if (!b) return fail('Requête invalide');

  if (p === '/api/push/subscribe') return subscribe(req, env, b);
  if (p === '/api/push/unsubscribe') {
    if (typeof b.endpoint === 'string') { await env.DB.prepare('DELETE FROM subs WHERE endpoint = ?').bind(b.endpoint).run(); await env.DB.prepare('DELETE FROM outbox WHERE endpoint = ?').bind(b.endpoint).run(); }
    return json({ ok: true });
  }
  if (p === '/api/tickets') {
    const email = cleanEmail(b.email); if (!email) return fail('Adresse e-mail invalide.');
    if (await limited(env, req, 'tickets', 10, 600)) return fail('Trop d\'essais. Réessayez dans quelques minutes.', 429);
    return json({ tickets: await findTickets(env, email) });
  }
  if (p.startsWith('/api/network/')) return network(req, env, p, b);
  return fail('Introuvable', 404);
}

async function findTickets(env, email) {
  const events = (await getEvents(env)).slice(0, 12);
  const lists = await Promise.all(events.map(async (e) => ({ e, list: await attendees(env, e.id).catch(() => []) })));
  const out = [];
  for (const { e, list } of lists) for (const a of list) {
    if (a.email === email && a.barcode) out.push({ eventId: e.id, title: e.title, start: e.start, end: e.end, place: e.venue ? [e.venue.name, e.venue.address].filter(Boolean).join(', ') : 'Station numixs, Sarcelles', name: a.name, ticket: a.ticket, barcode: a.barcode, checkedIn: a.checkedIn });
  }
  return out;
}

/* ---------- réseau (sur volontariat) ---------- */
async function network(req, env, p, b) {
  const email = cleanEmail(b.email); if (!email) return fail('Adresse e-mail invalide.');
  const eventId = cleanText(b.eventId, 40); if (!/^\d+$/.test(eventId)) return fail('Événement invalide.');
  if (await limited(env, req, 'network', 30, 600)) return fail('Trop d\'essais. Réessayez dans quelques minutes.', 429);
  const h = await sha(email + '|' + eventId);
  if (p === '/api/network/leave') { await env.DB.prepare('DELETE FROM profiles WHERE event_id = ? AND h = ?').bind(eventId, h).run(); return json({ ok: true }); }
  const ev = (await getEvents(env)).find((e) => e.id === eventId);
  if (!ev) return fail('Cet événement n\'est plus au programme.', 404);
  const me = (await attendees(env, eventId)).find((a) => a.email === email);
  if (!me) return fail('Aucune inscription trouvée pour cette adresse sur cet événement.', 403);
  const mine = await env.DB.prepare('SELECT name, org, looking FROM profiles WHERE event_id = ? AND h = ?').bind(eventId, h).first();
  if (p === '/api/network/me') return json({ joined: !!mine, profile: mine || null, suggestedName: me.first || '' });
  if (p === '/api/network/join') {
    if (b.consent !== true) return fail('Votre accord est nécessaire pour apparaître dans l\'annuaire.');
    const name = cleanText(b.name || me.first, 60); if (!name) return fail('Indiquez un prénom ou un nom.');
    await env.DB.prepare('INSERT INTO profiles (event_id, h, name, org, looking, ev_end, created) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(event_id, h) DO UPDATE SET name = excluded.name, org = excluded.org, looking = excluded.looking')
      .bind(eventId, h, name, cleanText(b.org, 80), cleanText(b.looking, 200), Date.parse(ev.end), now()).run();
    return json({ ok: true });
  }
  if (p === '/api/network/list') {
    if (!mine) return json({ joined: false, people: [] });
    const r = await env.DB.prepare('SELECT name, org, looking FROM profiles WHERE event_id = ? AND h != ? ORDER BY created DESC LIMIT 200').bind(eventId, h).all();
    return json({ joined: true, people: r.results || [] });
  }
  return fail('Introuvable', 404);
}

/* ---------- notifications ---------- */
async function vapid(env) {
  const c = await kvGet(env, 'vapid');
  if (c) return c.v;
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const v = { priv: await crypto.subtle.exportKey('jwk', kp.privateKey), pub: b64u(await crypto.subtle.exportKey('raw', kp.publicKey)) };
  await kvSet(env, 'vapid', v);
  return v;
}
function allowedEndpoint(ep) {
  try { const u = new URL(ep); return u.protocol === 'https:' && ep.length < 1000 && PUSH_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith('.' + h)); } catch (e) { return false; }
}
async function subscribe(req, env, b) {
  const ep = b.endpoint;
  if (typeof ep !== 'string' || !allowedEndpoint(ep)) return fail('Abonnement invalide.');
  if (await limited(env, req, 'subscribe', 20, 600)) return fail('Trop d\'essais.', 429);
  const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM subs').first();
  if (n && n.n >= MAX_SUBS) return fail('Le nombre maximal d\'abonnés est atteint.', 503);
  await env.DB.prepare('INSERT INTO subs (endpoint, created) VALUES (?, ?) ON CONFLICT(endpoint) DO NOTHING').bind(ep, now()).run();
  return json({ ok: true });
}
const jwtCache = new Map();
async function vapidHeader(env, endpoint, origin) {
  const v = await vapid(env), aud = new URL(endpoint).origin, c = jwtCache.get(aud);
  if (c && c.exp - now() > 3600000) return c.h;
  const enc = (o) => b64u(new TextEncoder().encode(JSON.stringify(o)));
  const exp = Math.floor(now() / 1000) + 12 * 3600;
  const data = enc({ typ: 'JWT', alg: 'ES256' }) + '.' + enc({ aud, exp, sub: origin });
  const key = await crypto.subtle.importKey('jwk', v.priv, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(data));
  const h = 'vapid t=' + data + '.' + b64u(sig) + ', k=' + v.pub;
  jwtCache.set(aud, { h, exp: exp * 1000 });
  return h;
}
async function notify(env, title, body, url) {
  const r = await env.DB.prepare('INSERT INTO notifs (title, body, url, t) VALUES (?, ?, ?, ?)').bind(title, body, url || './', now()).run();
  const id = r.meta && r.meta.last_row_id;
  await env.DB.prepare('INSERT INTO outbox (notif_id, endpoint) SELECT ?, endpoint FROM subs').bind(id).run();
}
async function drain(env, max) {
  const rows = (await env.DB.prepare('SELECT id, endpoint, attempts FROM outbox ORDER BY id LIMIT ?').bind(max).all()).results || [];
  const origin = env.PUBLIC_ORIGIN || 'https://station-numixs.workers.dev';
  for (const row of rows) {
    let status = 0;
    try {
      const r = await fetch(row.endpoint, { method: 'POST', headers: { Authorization: await vapidHeader(env, row.endpoint, origin), TTL: '43200', Urgency: 'normal', 'Content-Length': '0' } });
      status = r.status;
    } catch (e) { status = 0; }
    if (status === 404 || status === 410) {
      await env.DB.prepare('DELETE FROM subs WHERE endpoint = ?').bind(row.endpoint).run();
      await env.DB.prepare('DELETE FROM outbox WHERE endpoint = ?').bind(row.endpoint).run();
    } else if ((status >= 200 && status < 300) || row.attempts >= 2) {
      await env.DB.prepare('DELETE FROM outbox WHERE id = ?').bind(row.id).run();
    } else {
      await env.DB.prepare('UPDATE outbox SET attempts = attempts + 1 WHERE id = ?').bind(row.id).run();
    }
  }
}
async function once(env, key) {
  const r = await env.DB.prepare('INSERT INTO notified (k, t) VALUES (?, ?) ON CONFLICT(k) DO NOTHING').bind(key, now()).run();
  return !!(r.meta && r.meta.changes);
}

/* ---------- tâche planifiée (toutes les 30 minutes) ---------- */
async function cron(env) {
  let events = null;
  try { events = await getEvents(env, true); } catch (e) { console.error('Programme', e && e.message); }
  if (events) {
    const seen = await kvGet(env, 'seen');
    const ids = events.map((e) => e.id);
    if (seen) {
      const fresh = events.filter((e) => seen.v.indexOf(e.id) < 0);
      if (fresh.length === 1 || fresh.length === 2) for (const e of fresh) await notify(env, 'Nouvel événement', e.title + ' · ' + when(e.start));
      else if (fresh.length > 2) await notify(env, fresh.length + ' nouveaux événements', 'Découvrez le programme de la Station numixs.');
    }
    await kvSet(env, 'seen', ids);
    for (const e of events) {
      const delta = Date.parse(e.start) - now();
      if (delta > 23 * 3600000 && delta <= 24 * 3600000 && await once(env, 'd1:' + e.id)) await notify(env, 'Demain à la Station', e.title + ' · ' + when(e.start));
      if (delta > 0 && delta <= 3600000 && await once(env, 'h1:' + e.id)) await notify(env, 'Bientôt', e.title + ' commence dans moins d\'une heure.');
    }
  }
  await drain(env, 35);
  const t = now();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM profiles WHERE ev_end < ?').bind(t - 2 * 86400000),
    env.DB.prepare('DELETE FROM hits WHERE t < ?').bind(t - 3600000),
    env.DB.prepare('DELETE FROM notifs WHERE t < ?').bind(t - 60 * 86400000),
    env.DB.prepare('DELETE FROM notified WHERE t < ?').bind(t - 90 * 86400000)
  ]);
}
