# Local STT (Whisper large-v3-turbo) — G8 free path

> Part of media richness G7/G8/G9. Spec: [`../team/features/WA-MEDIA-RICHNESS-SPEC.md`](../team/features/WA-MEDIA-RICHNESS-SPEC.md) · Operator: [`MEDIA-G7G8G9.md`](./MEDIA-G7G8G9.md).


Primary transcription for WA audio runs on the Mac, not paid OpenAI.

## Operator one-click (recommended)

Automates open WA Web → search chat → auto-play voice notes → CDN backfill → Whisper → scorecard.

```bash
cd ~/calculadora-bmc
./scripts/wa-g8-one-click.sh
```

**Your few clicks only:**

1. Scan QR if WhatsApp Web asks (first time / session expired).  
2. Click **Jose Luis** if search didn’t open the chat.  
3. Click **▶** on any voice notes that didn’t auto-play (you must **hear** them).  
4. Press **Enter** in the terminal (or wait ~90s).

The script pulls `API_AUTH_TOKEN` from Doppler (`bmc-backend/prd`) or `~/.bmc-secrets/wa-token`.

Optional env:

| Env | Default | Meaning |
|-----|---------|---------|
| `CHAT_QUERY` | `Jose Luis` | WA Web search text |
| `CHAT_ID` | `115500310863875@lid` | API filter for that chat |
| `WAIT_USER_SEC` | `90` | Manual play window |
| `WHISPER_MODEL` | `turbo` | Whisper model |
| `SKIP_BROWSER=1` | — | Backfill+STT only (no UI) |

Log: `.runtime/wa-g8-operator.log` · Cockpit: https://calculadora-bmc.vercel.app/hub/wa

## Prerequisites

```bash
# Python whisper (already used if `python3 -m whisper` works)
pip3 install -U openai-whisper
# model downloads on first run: turbo / large-v3 / medium
ffmpeg  # brew install ffmpeg
```

## One-shot

```bash
cd ~/calculadora-bmc
export WA_TOKEN="$(doppler secrets get API_AUTH_TOKEN --project bmc-backend --config prd --plain)"
export WA_API="https://panelin-calc-q74zutv7dq-uc.a.run.app"
export WHISPER_MODEL=turbo   # or medium if turbo OOM
export ONCE=1
node scripts/wa-local-stt-worker.mjs
```

## Continuous (LaunchAgent)

```bash
# Edit paths then:
cp docs/wa-cockpit/com.bmc.wa-local-stt.plist.example ~/Library/LaunchAgents/com.bmc.wa-local-stt.plist
# put token in ~/.bmc-secrets/wa-token (chmod 600) — do not commit
launchctl load ~/Library/LaunchAgents/com.bmc.wa-local-stt.plist
```

## Cloud fallback

Only if `WA_TRANSCRIPT_CLOUD=1` on Cloud Run **and** `OPENAI_API_KEY` is set. Default **OFF**.

| Env | Default | Meaning |
|-----|---------|---------|
| `WA_TRANSCRIPT_CLOUD` | unset/0 | When `1`, API starts `waTranscriptWorker` (OpenAI Whisper) as secondary path |
| `WA_TRANSCRIPT_DISABLED` | unset/0 | When `1`, cloud worker stays off even if `WA_TRANSCRIPT_CLOUD=1` |

Local worker is unaffected by these flags.

## Persistent session (no daily QR)

See [PERSISTENT-SESSION.md](./PERSISTENT-SESSION.md) — always-on Chrome + LaunchAgent.
