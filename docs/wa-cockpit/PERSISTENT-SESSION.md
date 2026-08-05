# Persistent WhatsApp session (Mode C) — no daily re-login

## Honest answer

| Want | Possible? |
|------|-----------|
| Never re-scan QR every day | **Yes** — keep `.runtime/chrome-wa-profile` |
| Never open browser by hand | **Almost** — always-on Chrome (minimize) or LaunchAgent |
| Zero browser process forever | **No** for WA Web scrape — need Meta Cloud API for that |
| Read cockpit history | **Yes without browser** — data is in Postgres |

WhatsApp Web stays linked only while a **browser profile** is logged in. We keep that profile alive so **you** don’t re-open or re-login for normal work.

---

## Recommended setup (always-on Chrome)

### One-time

```bash
cd ~/calculadora-bmc

# 1) Build extension if needed
cd "$HOME/Panelin calc loca/calculadora-bmc-wa-extension" && npm run build
cd ~/calculadora-bmc

# 2) Start always-on session (QR once if new/expired)
./scripts/wa-chrome-always-on.sh

# 3) Optional: start on every Mac login
./scripts/wa-chrome-always-on.sh --install-agent
```

### Day to day

| You | System |
|-----|--------|
| Minimize the dedicated Chrome window | Session stays linked |
| Use [cockpit](https://calculadora-bmc.vercel.app/hub/wa) | Reads Postgres |
| Extension Sync ON | New chats → `/api/wa/ingest` |
| QR only if phone says “logged out of linked devices” | — |

### Commands

```bash
./scripts/wa-chrome-always-on.sh --status
./scripts/wa-chrome-always-on.sh --stop
./scripts/wa-chrome-always-on.sh --uninstall-agent
```

Or npm:

```bash
npm run wa:always-on
npm run wa:always-on:status
npm run wa:always-on:install
```

---

## Do not fight the profile

While always-on Chrome is running, **do not** run Playwright with the same `PROFILE`:

- `wa-g8-one-click.sh`
- `wa-pw-idb-sync.mjs`
- `wa-media-backfill.mjs`

…unless you **stop** always-on first (`--stop`). Chrome locks the profile (`SingletonLock`).

**G8 voice notes:** stop always-on → run one-click → start always-on again, **or** play notes in the always-on window and run STT only:

```bash
# After playing notes in the always-on WA window:
WA_TOKEN=$(doppler secrets get API_AUTH_TOKEN --project bmc-backend --config prd --plain) \
  ONCE=1 node scripts/wa-local-stt-worker.mjs
```

(Backfill still needs CDN/cache — play in that same Chrome window first.)

---

## Optional: local STT daemon

When audio lands in GCS with `transcript_status=pending`:

```bash
# see docs/wa-cockpit/LOCAL-STT.md + com.bmc.wa-local-stt.plist.example
```

---

## True server-only (different product)

**Meta Cloud API (Mode O)** = webhooks on Cloud Run, no phone-linked Chrome.  
Uses a **business** number, not your personal WA Web history. Separate project track.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| QR every day | Profile deleted or wrong `--user-data-dir`; don’t `rm -rf .runtime/chrome-wa-profile` |
| Extension not loading | Chrome stable 147+ blocks `--load-extension` → install Chrome Beta |
| Playwright fails with profile | Always-on holds lock → `--stop` first |
| Mac sleeps, session dies | System Settings → Battery → prevent sleep when plugged in |
| No new msgs in cockpit | Extension Sync OFF or API URL wrong; open extension popup |
