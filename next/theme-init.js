/* Pre-paint theme (pkg7 E1): sets <html data-theme> from the device's saved choice before first paint, so a chosen theme never
   flashes the other one. External (not inline) because the CSP allows script-src 'self' only; the service worker precaches it
   and its bytes version the cache (scripts/sw-plugin.mjs). Never throws: on any error it does nothing and main.tsx applies
   the device theme. Same rules as src/lib/theme.ts (resolveTheme). */
(function () {
  try {
    var c = localStorage.getItem('ledger_next_theme_v1')
    var t = c === 'light' || c === 'dark' ? c : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    document.documentElement.dataset.theme = t
    if (c === 'light' || c === 'dark') {
      var m = document.querySelectorAll('meta[name="theme-color"]')
      for (var i = 0; i < m.length; i++) m[i].setAttribute('content', t === 'dark' ? '#14181a' : '#f8fbfc')
    }
  } catch (e) { /* private mode or no matchMedia: the app sets the device theme */ }
})()
