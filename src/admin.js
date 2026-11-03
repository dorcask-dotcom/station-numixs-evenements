/*
 * Espace administrateur : page /admin et API /api/admin/*.
 * Protégé par Cloudflare Access : chaque requête doit porter le jeton signé par Access,
 * vérifié ici (signature, expiration, application). Sans réglage Access, tout est refusé.
 */
let certs = null;
const b64d = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

async function verified(req, env) {
  const team = String(env.ACCESS_TEAM_DOMAIN || '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const aud = String(env.ACCESS_AUD || '').trim();
  const tok = req.headers.get('Cf-Access-Jwt-Assertion');
  if (!team || !aud || !tok) return null;
  const parts = tok.split('.');
  if (parts.length !== 3) return null;
  try {
    const head = JSON.parse(new TextDecoder().decode(b64d(parts[0])));
    const pay = JSON.parse(new TextDecoder().decode(b64d(parts[1])));
    if (head.alg !== 'RS256') return null;
    if (!certs || Date.now() - certs.t > 3600000 || !certs.keys.some((k) => k.kid === head.kid)) {
      const r = await fetch('https://' + team + '/cdn-cgi/access/certs');
      if (!r.ok) return null;
      certs = { t: Date.now(), keys: (await r.json()).keys || [] };
    }
    const jwk = certs.keys.find((k) => k.kid === head.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64d(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
    if (!ok) return null;
    const auds = Array.isArray(pay.aud) ? pay.aud : [pay.aud];
    if (!auds.includes(aud) || pay.iss !== 'https://' + team || !pay.exp || pay.exp * 1000 < Date.now()) return null;
    return pay.email || 'admin';
  } catch (e) { return null; }
}

const PAGE_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
};

export async function adminRoute(req, env, url, H) {
  const who = await verified(req, env);
  if (!who) {
    if (url.pathname.startsWith('/api/')) return H.json({ error: 'Accès refusé.' }, 403);
    return new Response('Accès refusé. Cet espace est protégé par Cloudflare Access.', { status: 403, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
  }
  const p = url.pathname;
  if (!p.startsWith('/api/')) return req.method === 'GET' ? new Response(PAGE, { headers: PAGE_HEADERS }) : H.json({ error: 'Introuvable' }, 404);
  const m = req.method, db = env.DB;
  if (m === 'GET' && p === '/api/admin/stats') {
    const events = await H.getEvents(env).catch(() => []);
    const kv = await db.prepare("SELECT t FROM kv WHERE k = 'events'").first();
    const one = async (sql) => { const r = await db.prepare(sql).first(); return r ? r.n : 0; };
    const notifs = (await db.prepare('SELECT title, body, t FROM notifs ORDER BY id DESC LIMIT 10').all()).results || [];
    return H.json({ subscribers: await one('SELECT COUNT(*) AS n FROM subs'), pending: await one('SELECT COUNT(*) AS n FROM outbox'), profiles: await one('SELECT COUNT(*) AS n FROM profiles'), events: events.length, eventsAt: kv ? kv.t : null, eventList: events.concat(await H.getPast(env).catch(() => [])).map((e) => ({ id: e.id, title: e.title, start: e.start })), notifs });
  }
  if (m === 'GET' && p === '/api/admin/profiles') {
    const id = String(url.searchParams.get('eventId') || '');
    if (!/^\d+$/.test(id)) return H.fail('Événement invalide.');
    const r = await db.prepare('SELECT h, name, org, looking FROM profiles WHERE event_id = ? ORDER BY created DESC LIMIT 300').bind(id).all();
    return H.json({ profiles: r.results || [] });
  }
  if (m === 'GET' && p === '/api/admin/scheduled') {
    const r = await db.prepare('SELECT id, title, body, at FROM scheduled ORDER BY at').all();
    return H.json({ scheduled: r.results || [] });
  }
  if (m !== 'POST') return H.fail('Introuvable', 404);
  const b = await H.body(req);
  if (!b) return H.fail('Requête invalide');
  if (p === '/api/admin/refresh') { await H.getEvents(env, true); return H.json({ ok: true }); }
  if (p === '/api/admin/notify') {
    const title = String(b.title || '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').trim().slice(0, 80);
    const body = String(b.body || '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').trim().slice(0, 200);
    if (!title || !body) return H.fail('Titre et message sont obligatoires.');
    const before = await db.prepare('SELECT COUNT(*) AS n FROM subs').first();
    await H.notify(env, title, body, './');
    await H.drain(env, 25);
    const left = await db.prepare('SELECT COUNT(*) AS n FROM outbox').first();
    console.log('Notification envoyée par ' + who);
    return H.json({ ok: true, sent: Math.max(0, (before ? before.n : 0) - (left ? left.n : 0)), pending: left ? left.n : 0 });
  }
  if (p === '/api/admin/schedule') {
    const title = String(b.title || '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').trim().slice(0, 80);
    const body = String(b.body || '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').trim().slice(0, 200);
    const at = Number(b.at);
    if (!title || !body) return H.fail('Titre et message sont obligatoires.');
    if (!Number.isFinite(at) || at < Date.now() + 60000 || at > Date.now() + 365 * 86400000) return H.fail('Choisissez une date et une heure à venir.');
    const n = await db.prepare('SELECT COUNT(*) AS n FROM scheduled').first();
    if (n && n.n >= 50) return H.fail('Trop d\'envois programmés.');
    await db.prepare('INSERT INTO scheduled (title, body, at) VALUES (?, ?, ?)').bind(title, body, Math.round(at)).run();
    console.log('Envoi programmé par ' + who);
    return H.json({ ok: true });
  }
  if (p === '/api/admin/schedule/delete') {
    const id = Number(b.id);
    if (!Number.isInteger(id)) return H.fail('Envoi invalide.');
    await db.prepare('DELETE FROM scheduled WHERE id = ?').bind(id).run();
    return H.json({ ok: true });
  }
  if (p === '/api/admin/profiles/delete') {
    const id = String(b.eventId || ''), h = String(b.h || '');
    if (!/^\d+$/.test(id) || !/^[0-9a-f]{64}$/.test(h)) return H.fail('Profil invalide.');
    await db.prepare('DELETE FROM profiles WHERE event_id = ? AND h = ?').bind(id, h).run();
    console.log('Profil retiré par ' + who);
    return H.json({ ok: true });
  }
  if (p === '/api/admin/tickets') {
    const email = H.cleanEmail(b.email);
    if (!email) return H.fail('Adresse e-mail invalide.');
    const list = await H.findTickets(env, email);
    return H.json({ tickets: list.map((t) => ({ title: t.title, start: t.start, ticket: t.ticket, name: t.name, checkedIn: t.checkedIn })) });
  }
  return H.fail('Introuvable', 404);
}

const PAGE = "<!doctype html>\n<html lang=\"fr\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"robots\" content=\"noindex\">\n<title>Station numixs · Administration</title>\n<style>\n:root{--g:#D6D837;--d:#3E3E3D;--b:#0064EC;--bg:#262625;--card:#323231;--fg:#F4F4EC;--mut:#B8B8AE}\n*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:17px/1.45 Carlito,Calibri,system-ui,sans-serif}\nheader{background:var(--g);color:var(--d);padding:20px 16px}header h1{margin:0;font:700 36px/1 \"Saira Extra Condensed\",\"Arial Narrow\",sans-serif}header p{margin:6px 0 0;letter-spacing:.12em}\nmain{max-width:860px;margin:0 auto;padding:16px}section{background:var(--card);border-radius:4px;padding:16px;margin:0 0 16px}\nh2{margin:0 0 12px;font:700 28px/1 \"Saira Extra Condensed\",\"Arial Narrow\",sans-serif}\n.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.stat{background:var(--bg);padding:12px;border-left:4px solid var(--g)}.stat b{display:block;font-size:30px}\nlabel{display:block;margin:12px 0 4px;color:var(--mut)}input,textarea,select{width:100%;padding:10px;border:1px solid #666;border-radius:3px;background:var(--bg);color:var(--fg);font:inherit}\ntextarea{min-height:80px}button{margin-top:12px;padding:10px 16px;border:0;border-radius:3px;background:var(--g);color:var(--d);font-weight:700;font-size:17px;font-family:inherit;cursor:pointer}button.ghost{background:transparent;color:var(--fg);border:1px solid #888}button.danger{background:#E5484D;color:#fff}\n.msg{margin-top:10px;color:var(--g)}.err{color:#FF8A8A}.row{display:flex;justify-content:space-between;gap:10px;padding:10px 0;border-top:1px solid #444;align-items:flex-start}.row small{color:var(--mut);display:block}\n.hint{color:var(--mut);font-size:15px}\n</style></head><body>\n<header><h1>Station numixs</h1><p>ADMINISTRATION</p></header>\n<main>\n<section><h2>Chiffres</h2><div id=\"stats\" class=\"stats\"></div><div id=\"statsmsg\" class=\"msg\"></div><button class=\"ghost\" id=\"refresh\">Actualiser et relire Eventbrite</button></section>\n<section><h2>Envoyer une notification</h2><p class=\"hint\">Reçue par tous les abonnés aux alertes. Les notifications ne contiennent aucune donnée personnelle. Un envoi programmé part dans la demi-heure qui suit l’heure choisie.</p>\n<label for=\"nt\">Titre (80 caractères max)</label><input id=\"nt\" maxlength=\"80\"><label for=\"nb\">Message (200 caractères max)</label><textarea id=\"nb\" maxlength=\"200\"></textarea><label for=\"nw\">Programmer l’envoi (facultatif : laissez vide pour envoyer tout de suite)</label><input id=\"nw\" type=\"datetime-local\"><button id=\"send\">Envoyer</button><div id=\"sendmsg\" class=\"msg\"></div><div id=\"sched\"></div></section>\n<section><h2>Annuaire</h2><label for=\"ev\">Événement</label><select id=\"ev\"></select><div id=\"people\"></div></section>\n<section><h2>Retrouver un billet</h2><label for=\"te\">Adresse e-mail du participant</label><input id=\"te\" type=\"email\" autocomplete=\"off\"><button id=\"find\">Chercher</button><div id=\"tickets\"></div></section>\n<section><h2>Dernières notifications</h2><div id=\"notifs\"></div></section>\n</main>\n<script>\n(function(){\nvar $=function(i){return document.getElementById(i)};\nfunction api(p,b){return fetch('/api/admin/'+p,b===undefined?{cache:'no-store'}:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)}).then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.error||'Erreur');return j})})}\nfunction el(t,txt,cls){var e=document.createElement(t);if(txt!=null)e.textContent=txt;if(cls)e.className=cls;return e}\nfunction say(id,m,bad){var e=$(id);e.textContent=m;e.className='msg'+(bad?' err':'')}\nfunction fmt(t){return new Date(t).toLocaleString('fr-FR',{timeZone:'Europe/Paris',dateStyle:'medium',timeStyle:'short'})}\nvar events=[];\nfunction stats(){api('stats').then(function(s){\n var box=$('stats');box.textContent='';\n [['Abonnés aux alertes',s.subscribers],['Envois en attente',s.pending],['Profils d’annuaire',s.profiles],['Événements à venir',s.events]].forEach(function(x){var d=el('div',null,'stat');d.appendChild(el('b',x[1]));d.appendChild(el('span',x[0]));box.appendChild(d)});\n say('statsmsg','Programme relu '+(s.eventsAt?fmt(s.eventsAt):'jamais')+'.');\n events=s.eventList;var sel=$('ev'),cur=sel.value;sel.textContent='';events.forEach(function(e){var o=el('option',e.title+' · '+fmt(e.start));o.value=e.id;sel.appendChild(o)});if(cur)sel.value=cur;\n var n=$('notifs');n.textContent='';(s.notifs.length?s.notifs:[]).forEach(function(x){var r=el('div',null,'row'),d=el('div');d.appendChild(el('b',x.title));d.appendChild(el('span',x.body));d.appendChild(el('small',fmt(x.t)));r.appendChild(d);n.appendChild(r)});if(!s.notifs.length)n.appendChild(el('p','Aucune notification.','hint'));\n people()}).catch(function(e){say('statsmsg',e.message,true)})}\nfunction people(){var id=$('ev').value,box=$('people');box.textContent='';if(!id){box.appendChild(el('p','Aucun événement.','hint'));return}\n api('profiles?eventId='+encodeURIComponent(id)).then(function(j){\n  if(!j.profiles.length)box.appendChild(el('p','Aucun profil pour cet événement.','hint'));\n  j.profiles.forEach(function(p){var r=el('div',null,'row'),d=el('div');d.appendChild(el('b',p.name));if(p.org)d.appendChild(el('small',p.org));if(p.looking)d.appendChild(el('span',p.looking));r.appendChild(d);\n   var b=el('button','Retirer','danger');b.onclick=function(){if(!confirm('Retirer ce profil de l’annuaire ?'))return;api('profiles/delete',{eventId:id,h:p.h}).then(function(){stats()}).catch(function(e){alert(e.message)})};r.appendChild(b);box.appendChild(r)})\n }).catch(function(e){box.appendChild(el('p',e.message,'err'))})}\n$('ev').onchange=people;\n$('refresh').onclick=function(){say('statsmsg','Relecture en cours…');api('refresh',{}).then(stats).catch(function(e){say('statsmsg',e.message,true)})};\n$('send').onclick=function(){var t=$('nt').value.trim(),b=$('nb').value.trim();if(!t||!b){say('sendmsg','Titre et message sont obligatoires.',true);return}\n var w=$('nw').value;if(w){var at=new Date(w).getTime();if(!(at>Date.now())){say('sendmsg','Choisissez une date à venir.',true);return}if(!confirm('Programmer cette notification pour tous les abonnés le '+fmt(at)+' ?'))return;$('send').disabled=true;api('schedule',{title:t,body:b,at:at}).then(function(){say('sendmsg','Envoi programmé le '+fmt(at)+'.');$('nt').value='';$('nb').value='';$('nw').value='';sched()}).catch(function(e){say('sendmsg',e.message,true)}).then(function(){$('send').disabled=false});return}\n if(!confirm('Envoyer cette notification à tous les abonnés ?'))return;$('send').disabled=true;\n api('notify',{title:t,body:b}).then(function(j){say('sendmsg','Envoyée à '+j.sent+' abonné(s). Restant à envoyer : '+j.pending+' (envoi automatique toutes les 30 minutes).');$('nt').value='';$('nb').value='';stats()}).catch(function(e){say('sendmsg',e.message,true)}).then(function(){$('send').disabled=false})};\n$('find').onclick=function(){var e=$('te').value.trim(),box=$('tickets');box.textContent='';if(!e)return;\n api('tickets',{email:e}).then(function(j){if(!j.tickets.length)box.appendChild(el('p','Aucun billet trouvé pour cette adresse.','hint'));\n  j.tickets.forEach(function(t){var r=el('div',null,'row'),d=el('div');d.appendChild(el('b',t.title));d.appendChild(el('small',fmt(t.start)+' · '+t.ticket));d.appendChild(el('span',t.name+(t.checkedIn?' · déjà scanné':'')));r.appendChild(d);box.appendChild(r)})}).catch(function(x){box.appendChild(el('p',x.message,'err'))})};\nfunction sched(){api('scheduled').then(function(j){var box=$('sched');box.textContent='';if(!j.scheduled.length)return;box.appendChild(el('h3','Envois programmés'));j.scheduled.forEach(function(x){var r=el('div',null,'row'),d=el('div');d.appendChild(el('b',x.title));d.appendChild(el('span',x.body));d.appendChild(el('small',fmt(x.at)));r.appendChild(d);var c=el('button','Annuler','danger');c.onclick=function(){api('schedule/delete',{id:x.id}).then(sched).catch(function(e){alert(e.message)})};r.appendChild(c);box.appendChild(r)})}).catch(function(){})}\nsched();stats();\n})();\n</script></body></html>\n";
