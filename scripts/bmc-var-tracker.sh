#!/usr/bin/env bash
# bmc-var-tracker.sh — escribe resumen de variables nuevas en /tmp/bmc-live/vars.txt
# Lo lee el status-right de tmux cada refresh.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="/tmp/bmc-live/vars.txt"
mkdir -p /tmp/bmc-live

while true; do
  # Líneas añadidas en src/ y server/ que declaran variables/constantes/env
  VARS=$(git -C "$ROOT" diff HEAD -- src/ server/ 2>/dev/null \
    | grep '^+' \
    | grep -v '^+++' \
    | grep -oE '(const|let|export const|ENV\.[A-Z_]+|process\.env\.[A-Z_]+)\s+[a-zA-Z_][a-zA-Z0-9_]*' \
    | awk '{print $NF}' \
    | sort -u \
    | head -4 \
    | tr '\n' ' ' \
    | sed 's/ $//')

  COUNT=$(git -C "$ROOT" diff HEAD -- src/ server/ 2>/dev/null \
    | grep '^+' | grep -v '^+++' \
    | grep -cE '(const|let|export const)\s+[a-zA-Z]' 2>/dev/null || echo 0)

  BRANCH=$(git -C "$ROOT" branch --show-current 2>/dev/null | cut -c1-20)

  if [[ -n "$VARS" ]]; then
    echo "#[fg=colour220]+${COUNT} #[fg=colour250]${VARS} #[fg=colour240]| #[fg=colour33]${BRANCH}" > "$OUT"
  else
    echo "#[fg=colour33]${BRANCH}" > "$OUT"
  fi

  sleep 10
done
