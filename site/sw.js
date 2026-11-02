'use strict';
var VERSION = 'numixs-v3';
var SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'extras.js', 'qr.js', 'cloud.js'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // Les réponses du serveur (billets, annuaire, alertes) ne sont jamais copiées par ce service.
  if (url.pathname.indexOf('/api/') > -1 || url.pathname.indexOf('/admin') === 0) return;
  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) { return hit || caches.match('index.html'); });
    })
  );
});

// Notification : le message est lu sur le serveur (la notification elle-même ne contient aucune donnée).
self.addEventListener('push', function (e) {
  e.waitUntil(
    fetch('api/notifications/latest', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (n) {
      return self.registration.showNotification(n.title || 'Station numixs', { body: n.body || '', icon: 'icon-192.png', badge: 'icon-192.png', data: { url: n.url || './' } });
    }).catch(function () {
      return self.registration.showNotification('Station numixs', { body: 'Ouvrez l\'application pour voir le programme.', icon: 'icon-192.png', data: { url: './' } });
    })
  );
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var target = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) if ('focus' in list[i]) return list[i].focus();
    return self.clients.openWindow(target);
  }));
});
