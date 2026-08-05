#!/usr/bin/env bash
# G8 one-click operator — few clicks, max automation.
#
# What YOU do:
#   1. Run this script
#   2. If QR appears → scan once
#   3. If chat didn't open → click "Jose Luis"
#   4. If voice notes didn't auto-play → click ▶ on a few (hear audio)
#   5. Press Enter in the terminal when done (or wait ~90s)
#
# What the script does:
#   token · open WA Web · search chat · auto-play · CDN backfill · Whisper STT · scorecard
#
# Usage:
#   ./scripts/wa-g8-one-click.sh
#   CHAT_QUERY="Jose Luis" WAIT_USER_SEC=120 ./scripts/wa-g8-one-click.sh
#   SKIP_BROWSER=1 ./scripts/wa-g8-one-click.sh   # only if media already playable in cache
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
mkdir -p .runtime

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  BMC WA G8 — voice notes → Spanish transcript (auto)   ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ── Token ────────────────────────────────────────────────────
if [[ -z "${WA_TOKEN:-}" ]]; then
  if command -v doppler >/dev/null 2>&1; then
    echo "→ Doppler API_AUTH_TOKEN (bmc-backend/prd)…"
    WA_TOKEN="$(doppler secrets get API_AUTH_TOKEN --project bmc-backend --config prd --plain 2>/dev/null || true)"
  fi
fi
if [[ -z "${WA_TOKEN:-}" && -f "$HOME/.bmc-secrets/wa-token" ]]; then
  WA_TOKEN="$(tr -d '\n\r' < "$HOME/.bmc-secrets/wa-token")"
  echo "→ token from ~/.bmc-secrets/wa-token"
fi
if [[ -z "${WA_TOKEN:-}" ]]; then
  echo "ERROR: set WA_TOKEN or login Doppler / create ~/.bmc-secrets/wa-token"
  exit 1
fi
export WA_TOKEN
export WA_API="${WA_API:-https://panelin-calc-q74zutv7dq-uc.a.run.app}"
export PROFILE="${PROFILE:-$ROOT/.runtime/chrome-wa-profile}"
export CHAT_QUERY="${CHAT_QUERY:-Jose Luis}"
export CHAT_ID="${CHAT_ID:-115500310863875@lid}"
export WHISPER_MODEL="${WHISPER_MODEL:-turbo}"
export WAIT_USER_SEC="${WAIT_USER_SEC:-90}"
export AUTO_PLAY_MAX="${AUTO_PLAY_MAX:-8}"

# ── Preflight ────────────────────────────────────────────────
echo "→ API:     $WA_API"
echo "→ Chat:    $CHAT_QUERY  ($CHAT_ID)"
echo "→ Profile: $PROFILE"
echo "→ Whisper: $WHISPER_MODEL"
echo ""

if ! command -v node >/dev/null; then
  echo "ERROR: node required"; exit 1
fi
if ! command -v ffmpeg >/dev/null; then
  echo "WARN: ffmpeg not found — brew install ffmpeg (STT may fail)"
fi
if ! python3 -m whisper --help >/dev/null 2>&1; then
  echo "WARN: python3 -m whisper missing — pip3 install -U openai-whisper"
fi
# health
code="$(curl -sS -o /dev/null -w '%{http_code}' "$WA_API/health" || true)"
if [[ "$code" != "200" ]]; then
  echo "WARN: API health HTTP $code — continue anyway"
else
  echo "→ API health OK"
fi
# media route present?
mcode="$(curl -sS -o /dev/null -w '%{http_code}' -X POST -H "Authorization: Bearer $WA_TOKEN" \
  -H "Content-Type: application/json" -d '{"msg_id":"x","chat_id":"y","bytes_base64":"YQ=="}' \
  "$WA_API/api/wa/media" || true)"
if [[ "$mcode" == "404" ]]; then
  echo "ERROR: /api/wa/media not on this API revision (404). Ship media routes first."
  exit 1
fi
echo "→ media route reachable (HTTP $mcode)"
echo ""

# ── Open cockpit for later ───────────────────────────────────
COCKPIT="https://calculadora-bmc.vercel.app/hub/wa"
if command -v open >/dev/null; then
  open "$COCKPIT" 2>/dev/null || true
fi

echo "You only need to:"
echo "  • Scan QR if shown"
echo "  • Click the chat if search misses"
echo "  • Click ▶ on notes that didn't auto-play (hear them)"
echo "  • Press Enter in this terminal when finished (or wait ${WAIT_USER_SEC}s)"
echo ""
echo "Starting in 2s…"
sleep 2

# ── Run operator ─────────────────────────────────────────────
set +e
node "$ROOT/scripts/wa-g8-operator.mjs" 2>&1 | tee -a "$ROOT/.runtime/wa-g8-operator.log"
rc=${PIPESTATUS[0]}
set -e

echo ""
if [[ $rc -eq 0 ]]; then
  echo "✅ G8 operator finished — check scorecard above + $COCKPIT"
elif [[ $rc -eq 2 ]]; then
  echo "⚠️  No audio media yet. Play notes until you hear sound, then re-run:"
  echo "    ./scripts/wa-g8-one-click.sh"
else
  echo "❌ Operator failed (exit $rc). Log: .runtime/wa-g8-operator.log"
fi
exit "$rc"
