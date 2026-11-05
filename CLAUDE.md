# HUB — project guide for Claude

Personal "HUB" web app for two people (Tom = Tomáš, owner; Sabina = girlfriend). Czech UI. No build step, no framework: static files on GitHub Pages + Firebase + GitHub Actions. The repo is PUBLIC: never put secrets, tokens or e-mail addresses into any file.

## Working rules (important)
- Talk to the user in **Czech, informal (tykání)**. Greeting vocative: Tomáši / Sabino.
- Do only what the user asked. If he is just weighing options, answer and ask; do not build.
- Keep replies short. After changing files, list exactly which files to upload (GitHub web UI: Add file > Upload files into repo root; workflows go to `.github/workflows/`).
- **Every change**: add a new line at the TOP of `CHANGES` in `version.js` (version `1.N` is computed from the count). Always deliver the updated `version.js` with the changed files.
- Verify with `node --check` (extract inline `<script type="module">` to a temp .mjs). Do not claim things were tested live if they were not.
- The user does not give Claude direct GitHub/Firebase access (maybe later). Never ask for passwords/keys in chat.

## Stack and ids
- Firebase project `hubnebik` (Auth e-mail/password, Firestore, Cloud Messaging web push). GitHub: owner `Nebiik`, repo `hub`, branch `main`, Pages from root.
- Firestore rules: `spaces/main/**` only for the two allowed e-mails; `users/{uid}/**` only for that uid.
- Weather: Open-Meteo (no key), Brno 49.1951, 16.6068, 30 min cache in localStorage.
- Secrets (GitHub Actions): `FIREBASE_SERVICE_ACCOUNT`, `GCAL_ICS_URL`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `MAIL_TO`. Fine-grained GitHub token (Actions: write) for instant shop pushes is stored in Firestore `spaces/main/meta/ghtoken` (`{t}`); another one lives in cron-job.org.

## Files
- `index.html` home: greeting, date + day type chip (work day / weekend / holiday), weather carousel, tiles (Kalendář, Úkoly, Nákup, Finance, Křížovka, Seriály), footer: version/changelog, backup download, notification settings.
- `kalendar.html`, `ukoly.html`, `nakup.html`, `finance.html` (private), `krizovka.html`, `serialy.html`: one module per page, inline `<script type="module">`, import from `common.js`.
- `common.js`: Firebase init + login overlay + helpers. Exports: `sync/put/del` (shared `spaces/main/<col>`), `psync/pput/pdel` (private `users/<uid>/<col>`), `ymd, dn, occ, hols, msg, dump, me, whoami, ghDispatch, pushOn/pushOff/pushIsOn, VAPID, app, logout`. `put/pput` call `setDoc` WITHOUT merge and strip `id` from the object: when editing, preserve all existing fields.
- `names.js` (`nameDay(m,d)` Czech name days), `krizovky.js` (`KRIZ`), `version.js`, `style.css` (tokens `--bg --card --tx --mut --br --ac --hl --red`, dark mode via prefers-color-scheme + `data-theme` override, animations disabled for reduced motion), `sw.js` (no caching; push + notificationclick), `manifest.webmanifest`, icons, `package.json` (`{"type":"module"}` so Node can import `names.js`).
- Server side (Node 20, firebase-admin 12): `sync.mjs` (Google Calendar iCal -> events), `notify.mjs` (morning mail+push, evening push, name-day push), `shop.mjs` (shop change push). Workflows: `sync.yml`, `notify.yml`, `shop.yml`.

## Data model
Shared `spaces/main/`:
- `events`: `date YYYY-MM-DD, time "", title, type meet|bday|nday|other, by Tom|Sabina, col red|orange|yellow|green|blue|purple|pink|grey|"", rep ""|d|w|m|y, until, end (multi-day), rem ""|d0|d1 (push morning of / evening before), src "gcal"`. bday/nday repeat yearly implicitly. Ids: manual = timestamp+rand; imported/synced = `"i"+hash(UID)` (same hash in browser and Node, keep identical).
- `tasks`: `title, due, done`. `shop`: `title, done` (id starts with 13-digit timestamp, used for ordering). `series`: `title, plat, day ("0".."6" = JS getDay, "x" whole season at once, "?" irregular), st w|p|d, note, ep`.
- `meta`: `gcal` (last sync stats), `ghtoken`, `notify_<name>` sentinels `{date}` (m_push, m_mail, e_push, n_push).
Private `users/<uid>/`: `fin/<YYYY-MM-DD>` `{c crypto, s stocks, dc, ds legacy deposits}`; `findep` `{date, amt (negative = withdrawal), to c|s}`; `xw/p<N>` crossword progress `{g, ok}`; `tokens/<hash>` `{token, purpose}`; `settings/notif` `{who Tom|Sabina, shop, cal, fin, nday}`.

## Behaviours worth knowing
- `occ(e, day)` (recurrence + multi-day) exists in `common.js` AND `notify.mjs`: keep both in sync.
- Calendar sync is one-way Google -> HUB: `sync.mjs` merges only date/time/title/rep/until/end/src, keeps user fields (by, col, rem, type), deletes docs with `src:"gcal"` that vanished (guard: refuses mass delete).
- Finance: return is Modified Dietz, deposits separate from values, data private per user. Czech public holidays are computed incl. Easter.
- Crossword: Scandinavian arrow-word 7x8. `g` rows: letters, `#` = clue cell, `·` = empty; `c` = `[row, col, "r"|"d", text]` (word starts right of / below the clue cell); `t` = tajenka cells in order; `p` = tajenka phrase. Typing a base letter autocorrects diacritics. Puzzles were generated offline (python, ~300-word bank, not in repo); today's = `dn(today) % KRIZ.length`.
- Notifications: `notify.mjs` windows (Prague time): morning 07-12, evening 20-23, name day 09:30-12; one send per day per sentinel; manual dispatch modes `morning|evening|nameday` are forced (ignore window and sentinel), `auto|nameday-auto` behave like scheduled. Reliable triggering comes from **cron-job.org** (POST workflow_dispatch to `notify.yml`, bodies `{"ref":"main","inputs":{"mode":"auto"}}` at 7:05 and 20:05, `nameday-auto` at 9:35); GitHub's own cron in the workflow is only a backup.
- Shop push: `nakup.html` batches changes for 15 s, then `ghDispatch("shop.yml")`; the script sends to every token except the actor's uid, respecting `settings.shop`.

## Pitfalls
- GitHub scheduled workflows are delayed or skipped (hours): do not rely on exact times; use windows and sentinels.
- Do not name a workflow env var `UID` (bash readonly); `shop.yml` uses `ACTOR`.
- iOS web push only works from the Home Screen app, iOS 16.4+, data-only messages, permission requested from a user tap.
- `keepalive` on the GitHub dispatch fetch broke it on iOS: do not add it.
- After a CSS/JS upload the PWA may show old files: close the app fully or use a private window.
- Never display or log tokens; the VAPID public key in `common.js` is public by design.
