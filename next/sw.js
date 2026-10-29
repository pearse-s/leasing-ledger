/* Ledger (next) service worker: the app SHELL only. Template: sw-plugin.mjs fills the three double-underscore tokens below at build.
   It precaches index.html + the entry chunks, serves hashed /assets/ files cache-first, and falls back to the cached shell
   when a page navigation fails (weak signal). It NEVER touches anything else: no other origin (Supabase, tiles), no
   /functions/v1/, no auth, no non-GET, no manifest or icons: those requests are not handled here, so they go straight to
   the network. No push, no notifications. A new worker waits until the page asks it to take over (the "New version" bar). */
var PREFIX = 'ledger-next-shell-';
var CACHE = PREFIX + '7ef363f767';
var BASE = '/leasing-ledger/next/';
var SHELL = [
  "/leasing-ledger/next/",
  "/leasing-ledger/next/assets/adapters-xbhsuXMQ.js",
  "/leasing-ledger/next/assets/client-BvklFQFV.js",
  "/leasing-ledger/next/assets/createLucideIcon-D501yjzk.js",
  "/leasing-ledger/next/assets/fraunces-latin-wght-normal-ukD16Tqj.woff2",
  "/leasing-ledger/next/assets/geist-mono-latin-wght-normal-XN7g48iV.woff2",
  "/leasing-ledger/next/assets/hashParam-Vu0PHkjq.js",
  "/leasing-ledger/next/assets/identity-YMv0rgq4.js",
  "/leasing-ledger/next/assets/index-B8Igip55.js",
  "/leasing-ledger/next/assets/index-BW-Kh_8P.css",
  "/leasing-ledger/next/assets/jsx-runtime-DApVmHJR.js",
  "/leasing-ledger/next/assets/patch-DBCwBv1g.js",
  "/leasing-ledger/next/assets/preload-helper-BgGd1xQk.js",
  "/leasing-ledger/next/assets/query-BZxt791f.js",
  "/leasing-ledger/next/assets/react-dom-sir4vwKI.js",
  "/leasing-ledger/next/assets/rolldown-runtime-BWaJ3C7D.js",
  "/leasing-ledger/next/assets/schibsted-grotesk-latin-400-normal-DPhJBilQ.woff2",
  "/leasing-ledger/next/assets/schibsted-grotesk-latin-500-normal-rf9C4Thp.woff2",
  "/leasing-ledger/next/assets/schibsted-grotesk-latin-600-normal-Czv9Obfv.woff2",
  "/leasing-ledger/next/assets/scope-CSz6ncjm.js"
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
  } else if (path.indexOf(BASE + 'assets/') === 0) {
    e.respondWith(caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        if (res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
        return res;
      });
    }));
  }
});
