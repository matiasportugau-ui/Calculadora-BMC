# Local STT (Whisper large-v3-turbo) — G8 free path

Primary transcription for WA audio runs on the Mac, not paid OpenAI.

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
