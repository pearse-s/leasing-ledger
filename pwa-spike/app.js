/* Ledger push spike — page logic (rebuild spike 4, 2026-10-22). Plain script, no build step.
   The VAPID public key below is not a secret (every subscribing browser is handed it); the
   coordinator replaces the placeholder with the live VAPID_PUBLIC_KEY before publishing. */
(function () {
  'use strict';
  var VAPID_PUBLIC_KEY = 'BFuLWV6Fcu7sGbLNyJq4cwBcIR_Dsny1o5jUWcfd6Li2pc7m8HjXuHGBs7_Cb9GL0O8CCPrBP48Wg7N6_8a-0uk';
  var MARK_KEY = 'll-pwa-spike-markers';

  function el(id) { return document.getElementById(id); }
  function row(dl, k, v, cls) {
    var dt = document.createElement('dt'); dt.textContent = k;
    var dd = document.createElement('dd'); dd.textContent = v; if (cls) dd.className = cls;
    dl.appendChild(dt); dl.appendChild(dd);
  }
  function b64uToBytes(s) {
    var t = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
    t += '==='.slice((t.length + 3) % 4);
    var bin = atob(t), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  var standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  var ua = navigator.userAgent;
  var iosMatch = ua.match(/OS (\d+)_(\d+)(?:_\d+)? like Mac OS X/);
  var isIOS = !!iosMatch || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  var iosVer = iosMatch ? (iosMatch[1] + '.' + iosMatch[2]) : (isIOS ? 'iPadOS (desktop UA)' : '');
  var keyReady = /^[A-Za-z0-9_-]{80,}$/.test(VAPID_PUBLIC_KEY);
  var hasSW = 'serviceWorker' in navigator, hasPush = 'PushManager' in window, hasNote = 'Notification' in window;

  // ---- 1 · environment -------------------------------------------------------------------
  function paintEnv() {
    var dl = el('env'); dl.textContent = '';
    row(dl, 'Mode', standalone ? 'Installed app (standalone)' : 'Browser tab', standalone ? 'ok' : '');
    row(dl, 'iOS', isIOS ? iosVer : 'not iOS');
    row(dl, 'Service worker', hasSW ? 'yes' : 'no', hasSW ? 'ok' : 'bad');
    row(dl, 'PushManager', hasPush ? 'yes' : 'no', hasPush ? 'ok' : 'bad');
    row(dl, 'Notification', hasNote ? Notification.permission : 'no', hasNote && Notification.permission === 'granted' ? 'ok' : '');
    row(dl, 'VAPID key', keyReady ? 'set (' + VAPID_PUBLIC_KEY.slice(0, 8) + '…)' : 'placeholder — not published yet', keyReady ? 'ok' : 'bad');
    row(dl, 'Scope', new URL('./', location.href).pathname);
    var hint = '';
    if (isIOS && !standalone) hint = 'On iPhone, push only exists in the installed app: Share → Add to Home Screen, then open it from the Home Screen.';
    else if (isIOS && iosMatch && Number(iosMatch[1]) < 16) hint = 'iOS 16.4 or later is needed for Web Push.';
    el('install-hint').textContent = hint;
  }

  // ---- 2 · push --------------------------------------------------------------------------
  var pushMsg = el('push-msg');
  function showSub(sub) {
    if (!sub) { el('sub-box').hidden = true; return; }
    var json = JSON.stringify(sub.toJSON ? sub.toJSON() : sub, null, 2);
    el('sub-json').textContent = json;
    el('sub-box').hidden = false;
    var box = el('qr');
    try {
      var qr = qrcode(0, 'L');
      qr.addData(JSON.stringify(sub.toJSON ? sub.toJSON() : sub));
      qr.make();
      box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true });
      box.style.display = 'block';
    } catch (e) {
      box.style.display = 'none';
      console.warn('QR too large for this subscription; use Copy instead', e);
    }
  }
  function registration() {
    return navigator.serviceWorker.register('sw.js', { scope: './' }).then(function () { return navigator.serviceWorker.ready; });
  }
  function enablePush() {
    if (!keyReady) { pushMsg.textContent = 'The VAPID key placeholder has not been replaced yet.'; return; }
    if (!(hasSW && hasPush && hasNote)) { pushMsg.textContent = isIOS ? 'Open the installed app from the Home Screen first.' : 'This browser can’t do Web Push.'; return; }
    pushMsg.textContent = 'Asking for permission…';
    // requestPermission runs first, straight from the tap: iOS refuses a prompt that is not on a user gesture.
    Notification.requestPermission().then(function (perm) {
      paintEnv();
      if (perm !== 'granted') throw new Error('Permission ' + perm);
      pushMsg.textContent = 'Registering the service worker…';
      return registration();
    }).then(function (reg) {
      return reg.pushManager.getSubscription().then(function (s) {
        return s || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToBytes(VAPID_PUBLIC_KEY) });
      });
    }).then(function (sub) {
      pushMsg.textContent = 'Subscribed. Copy the JSON (or screenshot the QR) and send it to the coordinator.';
      showSub(sub);
    }).catch(function (e) {
      pushMsg.textContent = 'Failed: ' + (e && e.message ? e.message : e);
    });
  }
  function localTest() {
    if (!(hasSW && hasNote)) { pushMsg.textContent = 'Notifications are not available here.'; return; }
    Notification.requestPermission().then(function (perm) {
      if (perm !== 'granted') throw new Error('Permission ' + perm);
      return registration();
    }).then(function (reg) {
      return reg.showNotification('Ledger push spike', { body: 'Local test — shown by this device, no push service involved.', tag: 'ledger-push-spike-local', icon: 'icons/icon-192.png' });
    }).then(function () { pushMsg.textContent = 'Local notification shown.'; })
      .catch(function (e) { pushMsg.textContent = 'Failed: ' + (e && e.message ? e.message : e); });
  }
  function unsubscribe() {
    if (!hasSW) return;
    navigator.serviceWorker.getRegistration('./').then(function (reg) {
      return reg && reg.pushManager ? reg.pushManager.getSubscription() : null;
    }).then(function (s) { return s ? s.unsubscribe() : false; })
      .then(function (done) { pushMsg.textContent = done ? 'Unsubscribed on this device.' : 'No subscription on this device.'; showSub(null); })
      .catch(function (e) { pushMsg.textContent = 'Failed: ' + (e && e.message ? e.message : e); });
  }
  function copySub() {
    var t = el('sub-json').textContent;
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject(new Error('no clipboard')))
      .then(function () { pushMsg.textContent = 'Copied.'; })
      .catch(function () {
        var r = document.createRange(); r.selectNodeContents(el('sub-json'));
        var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
        pushMsg.textContent = 'Selected — use the system Copy.';
      });
  }
  function restoreSub() {
    if (!(hasSW && hasPush)) return;
    navigator.serviceWorker.getRegistration('./').then(function (reg) {
      return reg && reg.pushManager ? reg.pushManager.getSubscription() : null;
    }).then(function (s) { if (s) { pushMsg.textContent = 'Already subscribed on this device.'; showSub(s); } })
      .catch(function (e) { console.warn('getSubscription failed', e); });
  }

  // ---- 3 · storage -----------------------------------------------------------------------
  // Each context writes its own marker. If the installed app can read the "Browser tab" marker,
  // storage is shared with Safari; on iOS it is expected NOT to be (the Home Screen app gets its own).
  function readMarks() {
    try { return JSON.parse(localStorage.getItem(MARK_KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function paintStore(note) {
    var dl = el('store'); dl.textContent = '';
    var m = readMarks();
    row(dl, 'Browser-tab marker', m.browser || 'not visible here', m.browser ? 'ok' : '');
    row(dl, 'Installed-app marker', m.installed || 'not visible here', m.installed ? 'ok' : '');
    var verdict = '';
    if (standalone) verdict = m.browser ? 'SHARED: this installed app sees the Safari tab’s storage.' : 'SEPARATE (or no marker written in the tab yet): this installed app does not see the Safari tab’s storage.';
    else verdict = m.installed ? 'SHARED: this tab sees the installed app’s storage.' : 'Write a marker here, then open the installed app and check.';
    el('store-msg').textContent = note || verdict;
  }
  function writeMark() {
    var m = readMarks();
    m[standalone ? 'installed' : 'browser'] = new Date().toISOString();
    try { localStorage.setItem(MARK_KEY, JSON.stringify(m)); paintStore(); }
    catch (e) { paintStore('localStorage write failed: ' + e.message); }
  }
  function clearMarks() {
    try { localStorage.removeItem(MARK_KEY); } catch (e) { /* storage blocked: nothing to clear */ }
    paintStore();
  }

  el('btn-enable').addEventListener('click', enablePush);
  el('btn-local').addEventListener('click', localTest);
  el('btn-unsub').addEventListener('click', unsubscribe);
  el('btn-copy').addEventListener('click', copySub);
  el('btn-mark').addEventListener('click', writeMark);
  el('btn-clear').addEventListener('click', clearMarks);

  paintEnv();
  paintStore();
  restoreSub();
  // Registering on load is harmless here (no fetch handler) and lets the smoke test prove the
  // worker installs under the sub-path scope. Push permission is still only asked on a tap.
  if (hasSW) registration().then(function (reg) { window.__spikeSW = reg.scope; })
    .catch(function (e) { console.error('service worker registration failed', e); });
})();
