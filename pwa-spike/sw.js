/* Ledger push spike — service worker (rebuild spike 4, 2026-10-22).
   A copy of the live Ledger sw.js push + notificationclick handlers, registered by this spike page
   with scope ./ (= /leasing-ledger/pwa-spike/), so it never controls the real app at /leasing-ledger/.
   It has NO fetch handler on purpose, same as the live one: it never caches or intercepts the page
   or its data, so it cannot serve a stale page. It shows the notification a VAPID-signed push
   carries (the payload is end-to-end encrypted to this device) and opens the spike page on a tap. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Ledger push spike', {
    body: d.body || '',
    tag: d.tag || 'ledger-push-spike',
    icon: 'icons/icon-192.png',
    data: { url: d.url || './' }
  }));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c.url.indexOf('/pwa-spike/') >= 0 && 'focus' in c) return c.focus();
    }
    return self.clients.openWindow(url);
  }));
});
