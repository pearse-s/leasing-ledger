/* Ledger (next) service worker: the app SHELL only. Template: sw-plugin.mjs fills the three double-underscore tokens below at build.
   It precaches index.html + the entry chunks, serves hashed /assets/ files cache-first, and falls back to the cached shell
   when a page navigation fails (weak signal). It NEVER touches anything else: no other origin (Supabase, tiles), no
   /functions/v1/, no auth, no non-GET, no manifest or icons (theme-init.js, the pre-paint theme script, is the one unhashed
   shell file it serves): those requests are not handled here, so they go straight to
   the network. A new worker waits until the page asks it to take over (the "New version" bar).
   Push (p23): shows the notification the P-AL2 sender's payload carries ({title, body, url, tag}, end-to-end encrypted
   to this device), and a tap focuses an open app tab (moving it to the payload's url) or opens one. The url is kept
   inside the app: a relative one ('#/alerts') resolves against BASE; any other url keeps only a '#/<route>' hash. */
var PREFIX = 'ledger-next-shell-';
var CACHE = PREFIX + '2cfb85bb0e';
var BASE = '/leasing-ledger/next/';
var SHELL = [
  "/leasing-ledger/next/",
  "/leasing-ledger/next/assets/QueryClientProvider-BQ3du4Ix.js",
  "/leasing-ledger/next/assets/adapters-zxqPRiLQ.js",
  "/leasing-ledger/next/assets/client-CUPE5OeR.js",
  "/leasing-ledger/next/assets/createLucideIcon-D501yjzk.js",
  "/leasing-ledger/next/assets/entryMark-D2eIz8Bd.js",
  "/leasing-ledger/next/assets/fraunces-display-500-C6_ug22j.woff2",
  "/leasing-ledger/next/assets/fraunces-latin-wght-normal-ukD16Tqj.woff2",
  "/leasing-ledger/next/assets/geist-mono-latin-wght-normal-XN7g48iV.woff2",
  "/leasing-ledger/next/assets/grants-poEHMQQY.js",
  "/leasing-ledger/next/assets/hashParam-B3gHJEBo.js",
  "/leasing-ledger/next/assets/identity-BqxF2K2B.js",
  "/leasing-ledger/next/assets/index-CfaDQKyW.js",
  "/leasing-ledger/next/assets/index-PKvWDlj4.css",
  "/leasing-ledger/next/assets/jsx-runtime-DApVmHJR.js",
  "/leasing-ledger/next/assets/mutation-C6HrxYyd.js",
  "/leasing-ledger/next/assets/patch-CS-5Lbw1.js",
  "/leasing-ledger/next/assets/persistLink-D1lCK6tE.js",
  "/leasing-ledger/next/assets/preload-helper-BgGd1xQk.js",
  "/leasing-ledger/next/assets/rolldown-runtime-BWaJ3C7D.js",
  "/leasing-ledger/next/assets/schibsted-grotesk-latin-400-normal-DPhJBilQ.woff2",
  "/leasing-ledger/next/assets/schibsted-grotesk-latin-500-normal-rf9C4Thp.woff2",
  "/leasing-ledger/next/assets/scope-CCd4C9AM.js",
  "/leasing-ledger/next/assets/screenShape-Da0TQ1F4.js",
  "/leasing-ledger/next/assets/screens-Db4EZSfx.js",
  "/leasing-ledger/next/assets/store-DatPGCM4.js",
  "/leasing-ledger/next/assets/tabs-QDDbKvHm.js",
  "/leasing-ledger/next/assets/useQuery-QmPNuDDG.js",
  "/leasing-ledger/next/theme-init.js"
];

self.addEventListener('install', function (e) {
  // cache: 'reload' skips the HTTP cache, so install never stores a max-age-stale index.html beside new chunks
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL.map(function (u) { return new Request(u, { cache: 'reload' }); })); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf(PREFIX) === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

/* Where a notification tap goes: always a page of the app. */
function appUrl(u) {
  var home = new URL(BASE, self.location.origin).href;
  var hash = '';
  try {
    var x = new URL(typeof u === 'string' ? u : '', home);
    if (x.origin === self.location.origin && x.pathname === new URL(home).pathname) return x.href;
    hash = x.hash;
  } catch (err) { hash = ''; }
  return home + (/^#\/[\w-]+/.test(hash) ? hash : '');
}

self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : '' }; }
  if (!d || typeof d !== 'object') d = {};
  e.waitUntil(self.registration.showNotification(typeof d.title === 'string' && d.title ? d.title : 'Leasing Ledger', {
    body: typeof d.body === 'string' ? d.body : '',
    tag: typeof d.tag === 'string' && d.tag ? d.tag : 'ledger',
    icon: BASE + 'icons/icon-192.png',
    data: { url: appUrl(d.url) }
  }));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = appUrl(e.notification.data && e.notification.data.url);
  var home = new URL(BASE, self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c.url.indexOf(home) === 0 && 'focus' in c) {
        return c.focus().then(function (w) {
          var t = w || c;
          // navigate() refuses a tab this worker does not control; the focused tab is still the right place
          return t.url !== url && 'navigate' in t ? t.navigate(url).catch(function () { return t; }) : t;
        });
      }
    }
    return self.clients.openWindow(url);
  }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  var path = url.pathname;
  if (path.indexOf(BASE) !== 0) return;
  if (path.indexOf('/functions/v1/') >= 0 || path.indexOf('/auth/') >= 0) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(function () { return caches.match(BASE, { ignoreSearch: true }); }));
  } else if (path === BASE + 'theme-init.js') {
    // the pre-paint theme script is a shell file with an unhashed name: cache-first from this version's cache (the version
    // carries its bytes), so first paint never waits on the network for it
    e.respondWith(caches.match(req).then(function (hit) { return hit || fetch(req); }));
  } else if (path.indexOf(BASE + 'assets/') === 0) {
    e.respondWith(caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        if (res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
        return res;
      });
    }));
  }
});
