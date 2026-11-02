'use strict';
/*
 * Récupère les événements publics de l'organisation Eventbrite et met à jour site/events.json.
 * Aucune donnée personnelle : pas de liste d'inscrits. Node 18 ou plus récent, sans dépendance.
 *
 * Variables : EVENTBRITE_TOKEN (obligatoire), EVENTBRITE_ORG_ID (facultatif), OUT (facultatif).
 */
const fs = require('node:fs');
const path = require('node:path');

const TOKEN = process.env.EVENTBRITE_TOKEN || '';
const ORG_ID = process.env.EVENTBRITE_ORG_ID || '';
const API = process.env.EVENTBRITE_API_BASE || 'https://www.eventbriteapi.com/v3';
const OUT = process.env.OUT || path.join(__dirname, '..', 'site', 'events.json');

if (!TOKEN) {
  console.log('EVENTBRITE_TOKEN absent : le programme déjà publié est conservé.');
  process.exit(0);
}

async function get(p, params) {
  const url = new URL(API + p);
  for (const [k, v] of Object.entries(params || {})) url.searchParams.set(k, v);
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + TOKEN } });
  if (!r.ok) throw new Error('Eventbrite a répondu ' + r.status + ' sur ' + p);
  return r.json();
}
async function getAll(p, key, params) {
  const out = [];
  let cont = null;
  do {
    const j = await get(p, cont ? Object.assign({}, params, { continuation: cont }) : params);
    out.push(...(j[key] || []));
    cont = j.pagination && j.pagination.has_more_items ? j.pagination.continuation : null;
  } while (cont);
  return out;
}

(async () => {
  let orgId = ORG_ID;
  if (!orgId) {
    const j = await get('/users/me/organizations/');
    if (!j.organizations || !j.organizations[0]) throw new Error('Ce jeton ne donne accès à aucune organisation Eventbrite.');
    orgId = j.organizations[0].id;
  }
  const raw = await getAll('/organizations/' + orgId + '/events/', 'events', { status: 'live', expand: 'venue', order_by: 'start_asc', page_size: '50' });
  const now = Date.now();
  const events = raw.map((e) => ({
    id: String(e.id),
    title: (e.name && e.name.text) || 'Événement',
    description: String(e.summary || (e.description && e.description.text) || '').trim().slice(0, 600),
    start: e.start && e.start.utc,
    end: e.end && e.end.utc,
    url: e.url,
    venue: e.venue ? { name: e.venue.name || 'Station numixs', address: (e.venue.address && e.venue.address.localized_address_display) || '' } : null,
    isFree: e.is_free === true ? true : (e.is_free === false ? false : null)
  })).filter((e) => e.start && e.end && Date.parse(e.end) >= now)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));

  let previous = null;
  try { previous = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) { /* premier passage */ }
  const same = previous && JSON.stringify(previous.events) === JSON.stringify(events);
  if (same) { console.log('Aucun changement : ' + events.length + ' événements.'); return; }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ updatedAt: new Date().toISOString(), events }, null, 2) + '\n');
  console.log('Programme mis à jour : ' + events.length + ' événements.');
})().catch((e) => { console.error('Synchronisation impossible :', e.message); process.exit(1); });
