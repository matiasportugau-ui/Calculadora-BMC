#!/usr/bin/env bash
# Lee un archivo de texto en voz alta (macOS `say -f`). Preferencia: voz **Mónica**.
# Pensado para respuestas largas del agente (evita límites de `npm run voice:say -- "..."`).
#
# Uso: bash scripts/voice-tts-file.sh /ruta/archivo.txt
#      npm run voice:tts-file -- /ruta/archivo.txt
set -euo pipefail

FILE="${1:-}"
if [[ -z "$FILE" || "$FILE" == "-h" || "$FILE" == "--help" ]]; then
  echo "Uso: bash scripts/voice-tts-file.sh <archivo.txt>" >&2
  exit 1
fi
if [[ ! -f "$FILE" ]]; then
  echo "voice-tts-file: no existe: $FILE" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

voice_installed() {
  local n="$1"
  say -v '?' 2>/dev/null | awk -v n="$n" '$1 == n {found=1} END{exit !found}'
}

if voice_installed 'Mónica'; then
  exec say -v 'Mónica' -f "$FILE"
fi

VO="$(say -v '?' 2>/dev/null | grep -iE 'spanish|[[:space:]](es_|es-419|es_ES|es_MX|es_AR|es_UY)' | head -1 | awk '{print $1}')"
if [[ -n "$VO" ]]; then
  exec say -v "$VO" -f "$FILE"
fi

echo "voice-tts-file: sin voz española; usando voz por defecto." >&2
exec say -f "$FILE"
