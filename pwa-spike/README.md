# Ledger push spike (rebuild spike 4, 2026-10-22)

**Question:** can the rebuilt Ledger be an installable PWA on iPhone that receives Web Push, served
from the GitHub Pages sub-path `/leasing-ledger/`? This folder is a self-contained test page that
answers it on Pearse's phone. It touches nothing live: its own manifest, its own service worker
scoped to `/leasing-ledger/pwa-spike/`, no API calls, no sign-in.

| File | What |
|---|---|
| `index.html` | the page (CSP: own files only, `connect-src 'self'`) |
| `app.js` | install/push/storage logic; holds the `__VAPID_PUBLIC_KEY__` placeholder |
| `sw.js` | copy of the live `sw.js` push + notificationclick handlers; **no fetch handler** (same reason as live) |
| `manifest.webmanifest` | `id` = `start_url` = `scope` = `/leasing-ledger/pwa-spike/`, `display: standalone` |
| `icons/` | 192, 512 (manifest) + 180 `apple-touch-icon.png` |
| `qrcode.js` | vendored `qrcode-generator` 1.4.4 by Kazuhiko Arase, MIT (licence header kept) |

Tools (repo `tools/`): `push-send-test.mjs` sends one push (Node WebCrypto port of `am-notify`, no
npm deps); `pwa-spike-smoke.py` serves this folder at the sub-path in headless Chromium and checks
manifest + icons 200, SW active at the right scope, QR, 0 console errors.

## Coordinator: publish

1. **Pick the key pair.** The page's public key and the sender's private key must be the same pair.
   - **Route B (recommended): a spike-only pair.**
     `node tools/push-send-test.mjs --gen-keys C:/Users/pears/.claude/spike4-vapid.json`
     writes the pair outside the repo and prints `VAPID_PUBLIC_KEY=…`. Apple does not care which
     VAPID key signs, so this proves iOS push from the sub-path exactly as well, and it never needs the
     live private key.
   - **Route A: the live pair.** The public key is the `vapid_key` field of `GET /me/alerts`
     (`index.ts:3443`; visible in the network tab while Pearse is signed in on the live page). The
     **private** key, however, cannot be read back: Supabase's Management API lists secrets as
     digests, not values (expected; not probed here: the worker's sandbox refused a secrets-list call),
     and `am-setup-secrets.mjs` never stored it elsewhere. So Route A only works by sending through
     `am-notify` (insert the spike subscription into `am_push_subs` for Pearse's email, then
     `POST /me/push-test`), which is a live DB write: Pearse's call.
2. Replace `__VAPID_PUBLIC_KEY__` in `app.js` with that public key (it is public by design).
3. Copy this folder verbatim to the Pages repo as `pwa-spike/` (the README can stay or go), commit,
   push. The live `index.html` and `sw.js` are not touched. URL:
   `https://pearse-s.github.io/leasing-ledger/pwa-spike/`.

## Pearse: on the iPhone (iOS 16.4+)

1. Open the URL **in Safari**. Section 3: tap **Write marker here** (records the tab's marker).
2. Share → **Add to Home Screen** → Add. Open **Push spike** from the Home Screen.
3. Section 1 should say *Installed app (standalone)* and PushManager *yes*.
4. Section 3: read the verdict line (SHARED vs SEPARATE), then tap **Write marker here**.
5. Section 2: tap **Enable push** → Allow. Optionally **Local test notification** (proves the
   notification path with no push service).
6. Tap **Copy** and send the JSON to the coordinator (or screenshot the QR code).
7. Lock the phone and wait for the coordinator's test notification; tap it: the spike app should open.

## Coordinator: send

Save Pearse's JSON to a file outside the repo, then (Route B):

```
node tools/push-send-test.mjs --keys C:/Users/pears/.claude/spike4-vapid.json C:/Users/pears/.claude/spike4-sub.json "Ledger" "Push from the Pages sub-path works"
```

(or set `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` in the environment and drop
`--keys`). It prints `HTTP <status>`: **201** = Apple accepted it; 403 = key pair does not match the
page's public key; 404/410 = subscription gone (re-subscribe); 400 = malformed. Afterwards delete
both files and, on the phone, tap **Unsubscribe** and delete the Home Screen icon.

## Results (fill in after the run)

| Check | Result |
|---|---|
| iOS version / device | |
| Installed from Safari, standalone mode | |
| PushManager in Safari tab / installed app | expected no / yes |
| Permission prompt on tap | |
| Subscription endpoint host | expected `web.push.apple.com` |
| Sender HTTP status | |
| Notification shown on lock screen; tap opens app | |
| Storage: tab marker visible in installed app | expected **not** visible (separate) |

## Cut-over notes (what the real app must handle)

**`/me/push` upserts by endpoint, not by user** (`index.ts:3459-3495`: `upsert(…, { onConflict:
"endpoint" })`). One row per push endpoint; a user can hold many. A second device or a second
service-worker registration produces a **new endpoint, so a second row is appended** for the same
email, not a replacement. `am-notify` sends to every active row of that email (`disabled_at is
null`), and only disables a row when the push service answers 404/410. So an abandoned registration
keeps receiving (or double-delivering) until it is unsubscribed or the push service drops it.

**Scope and registrations.**
- A subscription belongs to one SW registration (scope + storage partition). The spike SW at
  `/leasing-ledger/pwa-spike/` and the live `sw.js` at `/leasing-ledger/` coexist; the narrower
  scope wins for pages under it, so the spike never claims the real app and vice versa.
- Keep **one** `sw.js` at `/leasing-ledger/` with scope `/leasing-ledger/` for the old page and the
  rebuilt app (including the side-by-side `/leasing-ledger/next/`). Then moving `/next/` to the root
  at cut-over changes no registration, and existing browser subscriptions survive. Do not give
  `/next/` its own SW scope: that would mint a second endpoint per device.
- Changing the VAPID key invalidates every subscription (subscribe with a new
  `applicationServerKey` fails until the old one is unsubscribed). Do not rotate at cut-over.

**iOS specifics.**
- Push exists only in a Home Screen web app (iOS/iPadOS 16.4+), added from the share sheet; the
  page needs a manifest with `display: standalone` (the live page has none today, so iOS push is
  impossible there now).
- The Home Screen app has **its own storage container**, separate from Safari: its own
  localStorage (so its own supabase-js session: **the installed app needs its own sign-in**, which
  the 30-day remembered device covers), and its own SW registration, so it **always subscribes
  fresh** on first run and appends its own `am_push_subs` row. A subscription made in the Safari tab
  (desktop/Android only) is not inherited. The spike's section 3 confirms the storage half.
- `Notification.requestPermission()` only from a user tap (the spike calls it first in the click).
- No silent push: every push must show a notification (`userVisibleOnly: true`), or Safari may
  revoke the subscription.
- Badges: `navigator.setAppBadge(n)` works in installed apps (16.4+), after notification permission.
- Deleting the Home Screen icon deletes the subscription; the old row lingers until a 404/410.

**Android Chrome / desktop Chrome, Edge, Firefox.** Push works in a normal tab (no install needed),
endpoint on `fcm.googleapis.com` / `updates.push.services.mozilla.com` / `*.notify.windows.com`.
On Android an installed PWA shares the browser's storage and SW registration, so installing does
not need a second sign-in or a new subscription. Chrome also shows an install prompt
(`beforeinstallprompt`); iOS never does, so the rebuilt app needs an "Add to Home Screen" hint for
iPhone users who are not yet standalone.

**What the cut-over must do.**
1. Add the real manifest (`id` = `start_url` = `scope` = `/leasing-ledger/`, `display: standalone`,
   icons 192/512 + apple-touch-icon) and keep `sw.js` push-only at `/leasing-ledger/`.
2. On first run of the installed app, prompt sign-in (separate storage on iOS), then offer
   "Turn on alerts" on a tap and `POST /me/push` the new subscription.
3. Treat stale rows: keep the last-posted endpoint in localStorage; when a later subscribe returns a
   different one, `POST /me/push {action:"unsubscribe"}` the old endpoint first. Optionally let
   `am-notify` disable rows unused for N days.
