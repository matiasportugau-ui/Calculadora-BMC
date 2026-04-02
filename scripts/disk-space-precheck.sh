#!/usr/bin/env bash
# Fail (or warn) when free space on the volume holding the working tree is below a threshold.
# Used by npm predev / prebuild so lack of space surfaces before Vite/build.
#
# Env:
#   BMC_DISK_PRECHECK_SKIP=1     — skip check (CI or emergency override)
#   BMC_DISK_MIN_FREE_MIB=1024   — minimum free MiB required (default 1024)
#   BMC_DISK_PRECHECK_MODE=fail|warn — fail exits 1; warn prints stderr and exits 0 (default fail)

set -euo pipefail

if [[ "${BMC_DISK_PRECHECK_SKIP:-}" == "1" ]]; then
  exit 0
fi

MODE="${BMC_DISK_PRECHECK_MODE:-fail}"
MIN_MIB="${BMC_DISK_MIN_FREE_MIB:-1024}"
if ! [[ "$MIN_MIB" =~ ^[0-9]+$ ]]; then
  MIN_MIB=1024
fi
MIN_KB=$((MIN_MIB * 1024))

# Volume for current directory (repo root when invoked via npm)
TARGET="${1:-.}"
if [[ ! -d "$TARGET" ]]; then
  TARGET="."
fi

# POSIX df: 1K blocks, -P predictable columns — field 4 = avail on macOS & GNU
avail_kb=$(df -Pk "$TARGET" 2>/dev/null | tail -1 | awk '{print $4}')
if [[ -z "$avail_kb" || ! "$avail_kb" =~ ^[0-9]+$ ]]; then
  echo "disk-precheck: no pudo leer df para $TARGET; omitiendo chequeo." >&2
  exit 0
fi

if (( avail_kb >= MIN_KB )); then
  exit 0
fi

avail_mib=$((avail_kb / 1024))
# Usar printf: los paréntesis en el texto rompen $(...) si se arma el mensaje con command substitution.
printf -v msg '%s\n' \
  "" \
  "=== BMC: poco espacio en disco ===" \
  "Libre en el volumen de este directorio: ~${avail_mib} MiB — mínimo configurado: ${MIN_MIB} MiB." \
  "" \
  "El desarrollo/build puede fallar (ENOSPC). En Cursor:" \
  "  1) Pegá este mensaje o decí: disco lleno, recovery." \
  "  2) El agente debe proponer grupos de limpieza (skill disk-space-recovery-resume)." \
  "  3) Solo después de tu aprobación explícita se ejecutan borrados/movidas." \
  "  4) Reintentá el comando que falló (p. ej. npm run dev)." \
  "" \
  "Variables: BMC_DISK_MIN_FREE_MIB, BMC_DISK_PRECHECK_SKIP=1, BMC_DISK_PRECHECK_MODE=warn" \
  "Doc: docs/team/orientation/DISK-SPACE-RECOVERY-AGENT.md" \
  ""

echo "$msg" >&2

if [[ "$MODE" == "warn" ]]; then
  exit 0
fi
exit 1
