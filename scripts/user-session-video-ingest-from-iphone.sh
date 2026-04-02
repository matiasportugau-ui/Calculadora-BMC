#!/usr/bin/env bash
# One-shot: take a video from iPhone (AirDrop → Downloads, Files, etc.), place it under
# docs/team/ux-feedback/sessions/<date>-iphone-<slug>/, run ffmpeg extract, write metadata.json
# and a short prompt file for Cursor.
#
# Usage (from repo root):
#   npm run session:video-ingest -- ~/Downloads/IMG_1234.MOV
#   bash scripts/user-session-video-ingest-from-iphone.sh ~/Movies/session.mov "http://localhost:5173"
#
# Arg 2 optional: base_url for metadata.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
bash "$SCRIPT_DIR/user-session-video-deps.sh" ensure || exit 1

ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SRC="${1:?Usage: $0 <path-to-video-from-iphone> [base_url]}"
BASE_URL="${2:-}"

if [[ ! -f "$SRC" ]]; then
  echo "error: file not found: $SRC" >&2
  exit 1
fi

DATE_PREFIX="$(date +%Y-%m-%d)"
BASENAME="$(basename "$SRC")"
STEM="${BASENAME%.*}"
# slug: safe short id
SLUG="$(echo "$STEM" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9._-]/-/g' | cut -c1-48)"
DEST="$ROOT/docs/team/ux-feedback/sessions/${DATE_PREFIX}-iphone-${SLUG}"
mkdir -p "$DEST"

cp -f "$SRC" "$DEST/$BASENAME"
echo "Copied to: $DEST/$BASENAME"

bash "$ROOT/scripts/user-session-video-extract.sh" "$DEST/$BASENAME" "$DEST/extracted"

ISO="$(date -Iseconds 2>/dev/null || date -u +"%Y-%m-%dT%H:%M:%SZ")"
export REPO_ROOT="$ROOT"
export INGEST_DEST="$DEST"
export INGEST_ISO="$ISO"
export INGEST_BASE_URL="$BASE_URL"

node <<'NODE'
const fs = require("fs");
const path = require("path");
const root = process.env.REPO_ROOT;
const dest = process.env.INGEST_DEST;
const iso = process.env.INGEST_ISO;
const baseUrl = process.env.INGEST_BASE_URL || "";
const templatePath = path.join(root, "docs", "team", "ux-feedback", "TEMPLATE-SESSION-VIDEO-METADATA.json");
const template = JSON.parse(fs.readFileSync(templatePath, "utf8"));
template.date_iso = iso;
template.recording_device = "iPhone (vídeo compartido / ingest)";
if (!template.target_device) template.target_device = "tablet u otra pantalla filmada";
if (baseUrl) template.base_url = baseUrl;
template.notes = `${template.notes || ""} ingest automático; revisar app_version y env.`.trim();
fs.writeFileSync(path.join(dest, "metadata.json"), JSON.stringify(template, null, 2) + "\n");
NODE

PROMPT_FILE="$DEST/CURSOR-CHAT-PROMPT.txt"
cat > "$PROMPT_FILE" <<EOF
1) Abrí este chat en Cursor y adjuntá:
   - Vídeo: ${DEST}/${BASENAME}
   - (opcional) audio ya extraído: ${DEST}/extracted/audio.wav
   - metadata: ${DEST}/metadata.json

2) Escribí una línea como:
   "Video-User-interactive-dev. Vídeo: ${DEST}/${BASENAME}. Analizá por completo lo evaluado; generá VIDEO-USER-INTERACTIVE-DEV-REPORT y VIDEO-USER-INTERACTIVE-DEV-ANALYSIS (misma sesión). base_url: ${BASE_URL:-<completar>}"

3) Si el modelo no acepta vídeo pesado: adjuntá extracted/audio.wav (toda la narración) + frames de extracted/frames/ (por defecto 1 JPG cada 5 s, baja calidad pero legible) + metadata.json.
EOF

echo ""
echo "Listo. Próximo paso:"
echo "  cat \"$PROMPT_FILE\""
echo ""
