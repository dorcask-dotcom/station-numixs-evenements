'use strict';
/* Fonctions côté téléphone : Mon programme (favoris), partage, rappel dans le calendrier. */
(function () {
  var KEY = 'numixs-favoris', EVS = {}, favs = [], onlyFav = false, busy = false, obs = null;
  var TZ = 'Europe/Paris';
  var fmtLong = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: TZ });

  try { favs = JSON.parse(localStorage.getItem(KEY) || '[]'); if (!Array.isArray(favs)) favs = []; } catch (e) { favs = []; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(favs)); } catch (e) {} }
  function isFav(id) { return favs.indexOf(id) > -1; }
  function toggle(id) { var i = favs.indexOf(id); if (i > -1) favs.splice(i, 1); else favs.push(id); save(); }
  function $(id) { return document.getElementById(id); }

  var st = document.createElement('style');
  st.textContent = '.x-star{color:var(--fg);font-weight:700}.x-star::before{content:"\\2605\\00a0";content:"\\2605\\00a0" / ""}.chip[data-x-fav]{border-style:dashed}.chip[data-x-fav][aria-pressed="true"]{border-style:solid}';
  document.head.appendChild(st);

  function upcomingFavCount() {
    var now = Date.now();
    return favs.filter(function (id) { var e = EVS[id]; return e && Date.parse(e.end) >= now; }).length;
  }

  function decorateList() {
    var view = $('view'); if (!view) return;
    var rows = view.querySelectorAll('.row[data-open]');
    if (!rows.length) return;
    var chips = view.querySelector('.chips');
    if (!chips) {
      var s = view.querySelector('.search');
      if (s) { chips = document.createElement('div'); chips.className = 'chips'; chips.setAttribute('role', 'group'); s.insertAdjacentElement('afterend', chips); }
    }
    if (chips) {
      var fb = chips.querySelector('[data-x-fav]');
      if (!fb) { fb = document.createElement('button'); fb.className = 'chip'; fb.setAttribute('data-x-fav', ''); chips.appendChild(fb); }
      var n = upcomingFavCount();
      fb.textContent = '\u2605 Mon programme' + (n ? ' (' + n + ')' : '');
      fb.setAttribute('aria-pressed', String(onlyFav));
      if (onlyFav) [].forEach.call(chips.querySelectorAll('[data-filter]'), function (c) { c.setAttribute('aria-pressed', 'false'); });
    }
    var day = null, shown = 0, anyShown = 0;
    function closeDay() { if (day) day.hidden = !(shown > 0 || !onlyFav); }
    [].forEach.call(view.children, function (el) {
      if (el.classList.contains('day')) { closeDay(); day = el; shown = 0; return; }
      if (el.classList.contains('row')) {
        var id = el.getAttribute('data-open'), fav = isFav(id);
        var meta = el.querySelector('.meta'), star = el.querySelector('.x-star');
        if (fav && meta && !star) { star = document.createElement('span'); star.className = 'x-star'; star.textContent = 'Mon programme'; meta.insertBefore(star, meta.firstChild); }
        if (!fav && star) star.remove();
        el.hidden = onlyFav && !fav;
        if (!el.hidden) { shown++; anyShown++; }
      }
    });
    closeDay();
    var empty = view.querySelector('.x-empty');
    if (onlyFav && !anyShown) {
      if (!empty) { empty = document.createElement('p'); empty.className = 'empty x-empty'; empty.textContent = 'Aucun événement dans votre programme. Ouvrez un événement et touchez « Ajouter à mon programme ».'; view.appendChild(empty); }
    } else if (empty) empty.remove();
  }

  function decorateSheet() {
    var sheet = $('sheet'), body = $('sheetBody');
    if (!sheet || !body || sheet.hidden) return;
    var ics = body.querySelector('[data-ics]'); if (!ics) return;
    var id = ics.getAttribute('data-ics');
    ics.textContent = 'Ajouter à mon agenda avec rappel';
    var fav = body.querySelector('[data-x-togglefav]');
    if (!fav) {
      fav = document.createElement('button'); fav.className = 'btn ghost block'; fav.setAttribute('data-x-togglefav', id);
      var sh = document.createElement('button'); sh.className = 'btn ghost block'; sh.setAttribute('data-x-share', id); sh.textContent = 'Partager cet événement';
      ics.insertAdjacentElement('afterend', fav); fav.insertAdjacentElement('afterend', sh);
    }
    var on = isFav(id);
    fav.textContent = (on ? '\u2605 ' : '\u2606 ') + 'Dans mon programme';
    fav.setAttribute('aria-pressed', String(on));
  }

  function apply() {
    if (busy) return; busy = true;
    if (obs) obs.disconnect();
    try { decorateList(); decorateSheet(); } catch (e) { /* l'agenda reste utilisable sans ces ajouts */ }
    observe(); busy = false;
  }
  function observe() {
    if (obs) obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
  }

  function esc(v) { return String(v).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function z(d) { return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
  function place(e) { return e.venue ? [e.venue.name, e.venue.address].filter(Boolean).join(', ') : 'Station numixs, Sarcelles'; }
  function link(e) { return /^https:\/\//i.test(e.url || '') ? e.url : 'https://www.eventbrite.fr/o/station-numixs-120885195167'; }
  function icsFile(e) {
    var alarm = function (trigger, text) { return ['BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc(text), 'TRIGGER:' + trigger, 'END:VALARM']; };
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Station numixs//Evenements//FR', 'BEGIN:VEVENT', 'UID:' + e.id + '@station-numixs', 'DTSTAMP:' + z(new Date()),
      'DTSTART:' + z(new Date(e.start)), 'DTEND:' + z(new Date(e.end)), 'SUMMARY:' + esc(e.title), 'LOCATION:' + esc(place(e)), 'DESCRIPTION:' + esc('Inscription : ' + link(e))]
      .concat(alarm('-P1D', 'Demain : ' + e.title), alarm('-PT1H', 'Dans une heure : ' + e.title), ['END:VEVENT', 'END:VCALENDAR']).join('\r\n') + '\r\n';
  }
  function download(e) {
    var b = new Blob([icsFile(e)], { type: 'text/calendar;charset=utf-8' }), a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = 'numixs-' + e.id + '.ics'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
  }

  function flash(btn, msg) {
    var old = btn.textContent; btn.textContent = msg;
    setTimeout(function () { if (btn.isConnected && btn.textContent === msg) btn.textContent = old; }, 2500);
  }
  function share(e, btn) {
    var when = fmtLong.format(new Date(e.start));
    var text = e.title + ' · ' + when.charAt(0).toUpperCase() + when.slice(1) + ' · Station numixs, Sarcelles';
    var url = link(e);
    if (navigator.share) { navigator.share({ title: e.title, text: text, url: url }).catch(function () {}); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text + '\n' + url).then(function () { flash(btn, 'Lien copié'); }, function () { flash(btn, url); });
    } else flash(btn, url);
  }

  document.addEventListener('click', function (x) {
    var t = x.target.closest('[data-x-fav],[data-x-togglefav],[data-x-share],[data-ics],[data-filter]');
    if (!t) return;
    if (t.hasAttribute('data-filter')) { onlyFav = false; return; }
    if (t.hasAttribute('data-x-fav')) { onlyFav = !onlyFav; apply(); return; }
    if (t.hasAttribute('data-x-togglefav')) { toggle(t.getAttribute('data-x-togglefav')); apply(); return; }
    if (t.hasAttribute('data-x-share')) { var s = EVS[t.getAttribute('data-x-share')]; if (s) share(s, t); return; }
    if (t.hasAttribute('data-ics')) {
      var e = EVS[t.getAttribute('data-ics')];
      if (e) { x.stopImmediatePropagation(); x.preventDefault(); download(e); }
    }
  }, true);

  if (window.MutationObserver) obs = new MutationObserver(function () { apply(); });
  fetch('events.json').then(function (r) { return r.json(); }).then(function (j) {
    (j.events || []).forEach(function (e) { EVS[String(e.id)] = e; });
    apply();
  }).catch(function () {});
  apply();
})();
