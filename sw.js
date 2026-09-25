/* Leasing Ledger service worker — account-manager phone alerts only (2026-09-25).
   Registered from the page ONLY when a signed-in user taps "Turn on here" in Alerts; nothing
   registers it at boot. It has NO fetch handler on purpose: it never caches or intercepts the
   page or its data, so it cannot serve a stale Ledger. It shows the notification the am-notify
   edge function pushes (the payload is end-to-end encrypted to this device) and opens the Ledger
   when the notification is tapped. Kept by hand in this repo: extract.mjs only writes index.html. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Leasing Ledger', {
    body: d.body || '',
    tag: d.tag || 'leasing-ledger',
    data: { url: d.url || './#today' }
  }));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || './#today';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c.url.indexOf('/leasing-ledger/') >= 0 && 'focus' in c) return c.focus();
    }
    return self.clients.openWindow(url);
  }));
});
