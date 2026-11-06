'use strict';
/* Onglets Billets, Réseau et Alertes. Ne s'affichent que si le serveur Cloudflare répond (api/ping). */
(function () {
  var LS = { email: 'numixs-email', tickets: 'numixs-billets' };
  var TZ = 'Europe/Paris', tab = 'agenda', xview = null, nav = null, busy = false;
  var fmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: TZ });

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function when(iso) { var s = fmt.format(new Date(iso)); return s.charAt(0).toUpperCase() + s.slice(1); }
  function $(id) { return document.getElementById(id); }
  function api(path, data) {
    var opt = data ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) } : { cache: 'no-store' };
    return fetch('api/' + path, opt).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Erreur'); return j; }); });
  }
  function savedTickets() { try { var t = JSON.parse(lsGet(LS.tickets) || 'null'); return t && Array.isArray(t.list) ? t : null; } catch (e) { return null; } }
  function upcoming(list) { return (list || []).filter(function (t) { return Date.parse(t.end) >= Date.now(); }); }
  function past(list) { return (list || []).filter(function (t) { return Date.parse(t.end) < Date.now(); }); }

  var css = document.createElement('style');
  css.textContent = [
    '.xnav{position:fixed;left:0;right:0;bottom:0;z-index:20;background:var(--board);display:flex;justify-content:center;padding-bottom:env(safe-area-inset-bottom,0)}',
    '.xnav div{display:flex;width:100%;max-width:480px}',
    '.xnav button{flex:1;min-height:56px;background:none;border:0;border-top:4px solid transparent;color:var(--board-muted);font-family:var(--font-display);font-size:18px;font-weight:600;letter-spacing:.06em;text-transform:uppercase}',
    '.xnav button[aria-current="page"]{color:var(--green);border-top-color:var(--green)}',
    '.has-xnav .app{padding-bottom:88px}',
    '.xv{padding:6px 16px 0}.xv h2{font-family:var(--font-display);font-size:38px;font-weight:700;margin:18px 0 2px;line-height:1.02}',
    '.xv label{display:block;font-weight:700;margin:14px 0 4px}.xv input[type=text],.xv input[type=email],.xv select,.xv textarea{width:100%;background:var(--surface);border:1px solid var(--line);padding:11px 12px;min-height:44px}',
    '.xv textarea{min-height:76px}.xv .consent{display:flex;gap:10px;align-items:flex-start;font-weight:400;margin:14px 0}.xv .consent input{margin-top:4px;width:22px;height:22px;flex:none}',
    '.xcard{border:1px solid var(--line);border-top:6px solid var(--green);padding:14px;margin:16px 0;background:var(--surface)}',
    '.xcard h3{font-family:var(--font-display);font-size:28px;line-height:1.05;margin:0 0 4px}',
    '.xcard canvas{display:block;width:100%;max-width:300px;margin:12px auto;image-rendering:pixelated;background:#fff}',
    '.xcode{text-align:center;font-family:var(--font-display);font-weight:700;letter-spacing:.12em;font-size:20px}',
    '.xmsg{padding:10px 12px;margin:12px 0;background:var(--green-25);color:var(--on-green)}.xmsg.err{background:var(--warn);color:#fff}',
    '.xperson{border-bottom:1px solid var(--line);padding:12px 0}.xperson b{font-family:var(--font-display);font-size:24px;display:block;line-height:1.05}',
    '.xv .btn+.btn{margin-top:10px}.xv .btn{width:100%}'
  ].join('');
  document.head.appendChild(css);

  function msg(text, err) { return '<p class="xmsg' + (err ? ' err' : '') + '" role="' + (err ? 'alert' : 'status') + '">' + esc(text) + '</p>'; }
  function emailForm(title, intro) {
    return '<h2>' + title + '</h2><p class="note">' + intro + '</p><label for="xe">Adresse e-mail utilisée pour l\'inscription</label><input id="xe" type="email" autocomplete="email" inputmode="email" placeholder="prenom.nom@exemple.fr"><button class="btn block" data-x="save-email" style="margin-top:12px">Continuer</button><div id="xm"></div>';
  }
  function setMsg(t, err) { var m = $('xm'); if (m) m.innerHTML = msg(t, err); }

  /* ----- Billets ----- */
  function renderTickets(list, note) {
    var ups = upcoming(list), h = '<h2>Mes billets</h2>';
    if (note) h += '<p class="note">' + esc(note) + '</p>';
    if (!ups.length) h += '<p class="empty">Aucun billet à venir pour cette adresse.<br>Vérifiez l\'adresse, ou inscrivez-vous à un événement depuis l\'agenda.</p>';
    ups.forEach(function (t, i) {
      h += '<article class="xcard"><h3>' + esc(t.title) + '</h3><div class="meta"><span>' + esc(when(t.start)) + '</span></div><div class="meta"><span>' + esc(t.place) + '</span></div>' +
        '<canvas data-qr="' + i + '" role="img" aria-label="QR code du billet de ' + esc(t.name) + '"></canvas><div class="xcode">' + esc(t.barcode) + '</div>' +
        '<p class="meta" style="justify-content:center">' + esc(t.name) + ' · ' + esc(t.ticket) + (t.checkedIn ? ' · <b>Déjà scanné</b>' : '') + '</p></article>';
    });
    var ps = past(list);
    if (ps.length) {
      h += '<h2 style="margin-top:28px">Événements passés</h2>';
      ps.forEach(function (t) { h += '<article class="xcard"><h3>' + esc(t.title) + '</h3><div class="meta"><span>' + esc(when(t.start)) + '</span></div><p class="meta">' + esc(t.ticket) + ' · Vous y étiez</p></article>'; });
    }
    h += '<button class="btn ghost" data-x="refresh">Actualiser</button><button class="btn ghost" data-x="forget">Oublier mon adresse sur ce téléphone</button><div id="xm"></div>';
    xview.innerHTML = h;
    [].forEach.call(xview.querySelectorAll('canvas[data-qr]'), function (c) { try { window.NumixsQR.draw(c, ups[+c.getAttribute('data-qr')].barcode, 6); } catch (e) { c.replaceWith(document.createTextNode('QR indisponible : présentez le code ci-dessous.')); } });
  }
  function welcome() {
    var t = 'Bienvenue à la Station numixs', b = 'Vos billets sont prêts. Retrouvez le programme et le réseau dans l\'application.';
    try {
      if (pushSupported() && Notification.permission === 'granted') return swReady().then(function (r) { return r.showNotification(t, { body: b, icon: 'icon-192.png', badge: 'icon-192.png', data: { url: './' } }); }).catch(function () {});
    } catch (e) {}
  }
  function loadTickets(force) {
    var email = lsGet(LS.email), cached = savedTickets();
    if (!email) { xview.innerHTML = emailForm('Mes billets', 'Retrouvez ici vos billets Eventbrite. Ils sont gardés sur ce téléphone pour s\'afficher même sans réseau.'); return; }
    if (cached && !force) renderTickets(cached.list, 'Dernière mise à jour : ' + when(cached.at) + '.');
    else xview.innerHTML = '<h2>Mes billets</h2><p class="empty">Recherche de vos billets…</p>';
    api('tickets', { email: email }).then(function (j) {
      lsSet(LS.tickets, JSON.stringify({ at: new Date().toISOString(), list: j.tickets }));
      if (tab === 'billets') renderTickets(j.tickets, 'Mis à jour à l\'instant.'); else if (tab === 'reseau') loadNetwork();
    }).catch(function (e) {
      if (tab === 'reseau') { xview.innerHTML = '<h2>Réseau</h2>' + msg(e.message, true) + '<button class="btn ghost" data-x="forget">Changer d\'adresse</button>'; return; }
      if (tab !== 'billets') return;
      if (cached) { renderTickets(cached.list, 'Hors connexion ou serveur occupé : billets enregistrés le ' + when(cached.at) + '.'); setMsg(e.message, true); }
      else xview.innerHTML = '<h2>Mes billets</h2>' + msg(e.message, true) + '<button class="btn ghost" data-x="refresh">Réessayer</button><button class="btn ghost" data-x="forget">Changer d\'adresse</button>';
    });
  }

  /* ----- Réseau ----- */
  function loadNetwork(eventId) {
    var email = lsGet(LS.email), cached = savedTickets();
    if (!email) { xview.innerHTML = emailForm('Réseau', 'L\'annuaire est réservé aux personnes inscrites à un événement. Indiquez votre adresse pour le vérifier.'); return; }
    var evs = upcoming(cached && cached.list).concat(past(cached && cached.list)), seen = {}; evs = evs.filter(function (t) { if (seen[t.eventId]) return false; seen[t.eventId] = 1; return true; });
    if (!evs.length) { xview.innerHTML = '<h2>Réseau</h2><p class="empty">Inscrivez-vous à un événement pour accéder à l\'annuaire de ses participants.</p><button class="btn ghost" data-x="refresh-net">Vérifier mes inscriptions</button>'; return; }
    var cur = eventId || evs[0].eventId;
    var sel = evs.length > 1 ? '<label for="xev">Événement</label><select id="xev">' + evs.map(function (t) { return '<option value="' + esc(t.eventId) + '"' + (t.eventId === cur ? ' selected' : '') + '>' + esc(t.title + ' · ' + when(t.start) + (Date.parse(t.end) < Date.now() ? ' (passé)' : '')) + '</option>'; }).join('') + '</select>' : '<p class="note">' + esc(evs[0].title + ' · ' + when(evs[0].start)) + '</p>';
    xview.innerHTML = '<h2>Réseau</h2>' + sel + '<p class="empty">Chargement…</p>';
    api('network/me', { email: email, eventId: cur }).then(function (me) {
      if (tab !== 'reseau') return;
      if (!me.joined) {
        xview.innerHTML = '<h2>Réseau</h2>' + sel + '<p>Rejoignez l\'annuaire pour voir qui sera là et être repéré par les autres participants.</p>' +
          '<label for="xn">Prénom ou nom affiché</label><input id="xn" type="text" autocomplete="name" maxlength="60" value="' + esc(me.suggestedName) + '"><label for="xo">Structure (facultatif)</label><input id="xo" type="text" autocomplete="organization" maxlength="80">' +
          '<label for="xl">Ce que vous cherchez ou proposez (facultatif)</label><textarea id="xl" maxlength="200"></textarea>' +
          '<label class="consent"><input id="xc" type="checkbox"><span>J\'accepte que ces informations soient visibles des autres inscrits à cet événement qui ont aussi rejoint l\'annuaire. Mon adresse e-mail n\'est jamais affichée. Mon profil reste consultable 12 mois après l\'événement, pour retrouver les personnes rencontrées, puis il est supprimé ; je peux le retirer à tout moment.</span></label>' +
          '<button class="btn block" data-x="join" data-ev="' + esc(cur) + '">Rejoindre l\'annuaire</button><div id="xm"></div>';
        return;
      }
      return api('network/list', { email: email, eventId: cur }).then(function (l) {
        if (tab !== 'reseau') return;
        var h = '<h2>Réseau</h2>' + sel + '<p class="note">Vous êtes dans l\'annuaire en tant que <b>' + esc(me.profile.name) + '</b>.</p>';
        h += l.people.length ? '<ul class="xlist">' + l.people.map(function (p) { return '<li class="xperson"><b>' + esc(p.name) + '</b>' + (p.org ? '<span class="meta">' + esc(p.org) + '</span>' : '') + (p.looking ? '<p style="margin:4px 0 0">' + esc(p.looking) + '</p>' : '') + '</li>'; }).join('') + '</ul>' : '<p class="empty">Personne d\'autre pour le moment. Les profils apparaîtront ici.</p>';
        h += '<button class="btn ghost" data-x="refresh-net" style="margin-top:16px">Actualiser</button><button class="btn ghost" data-x="leave" data-ev="' + esc(cur) + '">Retirer mon profil</button><div id="xm"></div>';
        xview.innerHTML = h;
      });
    }).catch(function (e) { if (tab === 'reseau') xview.innerHTML = '<h2>Réseau</h2>' + sel + msg(e.message, true) + '<button class="btn ghost" data-x="forget">Changer d\'adresse</button>'; });
  }

  /* ----- Alertes ----- */
  function b64ToBytes(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); var r = atob(s + '==='.slice((s.length + 3) % 4)), a = new Uint8Array(r.length); for (var i = 0; i < r.length; i++) a[i] = r.charCodeAt(i); return a; }
  function swReady() { return Promise.race([navigator.serviceWorker.ready, new Promise(function (_, no) { setTimeout(function () { no(new Error('Le service de notifications n\'est pas encore prêt. Rechargez la page et réessayez.')); }, 3000); })]); }
  function pushSupported() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
  function loadAlerts() {
    xview.innerHTML = '<h2>Alertes</h2><p class="empty">Chargement…</p>';
    var recent = api('notifications/recent').then(function (j) { return j.notifications || []; }).catch(function () { return []; });
    var state = !pushSupported() ? Promise.resolve('unsupported') : swReady().then(function (r) { return r.pushManager.getSubscription(); }).then(function (s) { return s && Notification.permission === 'granted' ? 'on' : (Notification.permission === 'denied' ? 'denied' : 'off'); }).catch(function () { return 'off'; });
    Promise.all([state, recent]).then(function (r) {
      if (tab !== 'alertes') return;
      var h = '<h2>Alertes</h2><p class="note">Recevez une notification pour chaque nouvel événement, la veille et moins d\'une heure avant.</p>';
      if (r[0] === 'unsupported') h += msg('Votre navigateur ne permet pas les notifications. Sur iPhone, installez d\'abord l\'application : touchez Partager, puis « Sur l\'écran d\'accueil », et rouvrez-la depuis son icône.');
      else if (r[0] === 'denied') h += msg('Les notifications sont bloquées pour ce site. Autorisez-les dans les réglages du téléphone ou du navigateur, puis revenez ici.', true);
      else if (r[0] === 'on') h += '<p class="xmsg">Notifications activées sur ce téléphone.</p><button class="btn ghost" data-x="push-off">Désactiver</button>';
      else h += '<button class="btn block" data-x="push-on">Activer les notifications</button>';
      h += '<div id="xm"></div><h2 style="font-size:28px;margin-top:28px">Dernières alertes</h2>';
      h += r[1].length ? '<ul class="xlist">' + r[1].map(function (n) { return '<li class="xperson"><b style="font-size:21px">' + esc(n.title) + '</b><span>' + esc(n.body) + '</span><div class="note">' + esc(when(new Date(n.t).toISOString())) + '</div></li>'; }).join('') + '</ul>' : '<p class="empty">Aucune alerte pour le moment.</p>';
      xview.innerHTML = h;
    });
  }
  function pushOn() {
    if (!pushSupported()) return;
    Notification.requestPermission().then(function (p) {
      if (p !== 'granted') { setMsg('Autorisation refusée.', true); return; }
      return Promise.all([swReady(), api('push/key')]).then(function (x) {
        return x[0].pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(x[1].key) });
      }).then(function (sub) { return api('push/subscribe', { endpoint: sub.endpoint }); }).then(loadAlerts);
    }).catch(function (e) { setMsg(e.message || 'Activation impossible.', true); });
  }
  function pushOff() {
    swReady().then(function (r) { return r.pushManager.getSubscription(); }).then(function (s) {
      if (!s) return; var ep = s.endpoint; return s.unsubscribe().then(function () { return api('push/unsubscribe', { endpoint: ep }); });
    }).then(loadAlerts).catch(function () { loadAlerts(); });
  }

  /* ----- navigation ----- */
  function show(t) {
    tab = t;
    var agenda = t === 'agenda';
    [$('view'), $('next')].forEach(function (el) { if (el) el.style.display = agenda ? '' : 'none'; });
    var hdr = document.querySelector('.brandband'); if (hdr) hdr.style.display = '';
    xview.hidden = agenda;
    [].forEach.call(nav.querySelectorAll('button'), function (b) { if (b.dataset.tab === t) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    if (agenda) { var n = $('next'); if (n && n.innerHTML) n.style.display = ''; return; }
    window.scrollTo(0, 0);
    if (t === 'billets') loadTickets(false); else if (t === 'reseau') { if (savedTickets()) loadNetwork(); else { loadTickets(false); } } else loadAlerts();
  }

  document.addEventListener('click', function (x) {
    var b = x.target.closest('[data-tab],[data-x]'); if (!b) return;
    if (b.dataset.tab) {
      show(b.dataset.tab);
      var tgt = b.dataset.tab === 'agenda' ? $('view') : xview;
      document.title = b.textContent + ' · Station numixs';
      if (tgt) { tgt.setAttribute('aria-label', b.textContent); tgt.focus({ preventScroll: true }); }
      return;
    }
    var a = b.dataset.x, email = lsGet(LS.email);
    if (a === 'save-email') {
      var v = ($('xe').value || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { setMsg('Adresse e-mail invalide.', true); return; }
      lsSet(LS.email, v); lsDel(LS.tickets); xview.innerHTML = '<p class="empty">Recherche de vos billets…</p>';
      api('tickets', { email: v, first: true }).then(function (j) { if (j.welcome) welcome(); lsSet(LS.tickets, JSON.stringify({ at: new Date().toISOString(), list: j.tickets })); if (tab === 'billets') renderTickets(j.tickets); else if (tab === 'reseau') loadNetwork(); })
        .catch(function (e) { lsDel(LS.email); xview.innerHTML = emailForm(tab === 'reseau' ? 'Réseau' : 'Mes billets', 'Retrouvez vos billets avec l\'adresse utilisée sur Eventbrite.'); setMsg(e.message, true); });
    } else if (a === 'refresh') loadTickets(true);
    else if (a === 'refresh-net') { api('tickets', { email: email }).then(function (j) { lsSet(LS.tickets, JSON.stringify({ at: new Date().toISOString(), list: j.tickets })); loadNetwork(); }).catch(function (e) { setMsg(e.message, true); }); }
    else if (a === 'forget') { lsDel(LS.email); lsDel(LS.tickets); show(tab); }
    else if (a === 'join') {
      if (!$('xc').checked) { setMsg('Cochez la case pour donner votre accord.', true); return; }
      api('network/join', { email: email, eventId: b.dataset.ev, name: $('xn').value, org: $('xo').value, looking: $('xl').value, consent: true }).then(function () { loadNetwork(b.dataset.ev); }).catch(function (e) { setMsg(e.message, true); });
    } else if (a === 'leave') api('network/leave', { email: email, eventId: b.dataset.ev }).then(function () { loadNetwork(b.dataset.ev); }).catch(function (e) { setMsg(e.message, true); });
    else if (a === 'push-on') pushOn(); else if (a === 'push-off') pushOff();
  });
  document.addEventListener('change', function (x) { if (x.target.id === 'xev') loadNetwork(x.target.value); });

  fetch('api/ping', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
    if (!j || !j.ok) return;
    xview = document.createElement('section'); xview.id = 'xview'; xview.className = 'xv'; xview.hidden = true; xview.setAttribute('role', 'main'); xview.tabIndex = -1;
    var main = $('view'); main.insertAdjacentElement('afterend', xview);
    nav = document.createElement('nav'); nav.className = 'xnav'; nav.setAttribute('aria-label', 'Navigation principale');
    nav.innerHTML = '<div><button data-tab="agenda" aria-current="page">Agenda</button><button data-tab="billets">Billets</button><button data-tab="reseau">Réseau</button><button data-tab="alertes">Alertes</button></div>';
    document.body.appendChild(nav); document.body.classList.add('has-xnav');
  }).catch(function () {});
})();
