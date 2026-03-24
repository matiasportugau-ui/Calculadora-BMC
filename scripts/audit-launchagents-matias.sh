#!/usr/bin/env bash
# =============================================================================
# Audit LaunchAgents (macOS): plutil validity, schedule, paths, vendor/custom,
# persistence score, optional log tails. Outputs Markdown; use --json for JSON.
#
# Detecta: NUEVOS (no en lista conocida), REGENERADOS (archivamos y la app los recreó).
# Descripciones: scripts/launchagents-manifest.md
#
# Usage:
#   ./scripts/audit-launchagents-matias.sh
#   ./scripts/audit-launchagents-matias.sh --json
#   SCAN_ALL=1 ./scripts/audit-launchagents-matias.sh    # escanear todos los .plist del dir
#   PLIST_FILES="a.plist b.plist" ./scripts/audit-launchagents-matias.sh
#
# Default: 16 plists conocidos + SCAN_ALL detecta todos y marca new/regenerated.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_JSON=0
SCAN_ALL="${SCAN_ALL:-1}"  # 1 = escanear todos los .plist; detectar new/regenerated
for arg in "$@"; do
  [[ "$arg" == "--json" ]] && OUT_JSON=1
done

LAUNCH_AGENTS_DIR="${LAUNCH_AGENTS_DIR:-$HOME/Library/LaunchAgents}"
ARCHIVE_DIR="${ARCHIVE_DIR:-$HOME/Library/LaunchAgents-disabled}"

DEFAULT_PLISTS=(
  com.adobe.GC.Invoker-1.0.plist
  com.bittorrent.uTorrent.plist
  com.bmc.drive-cleanup.plist
  com.bmc.host-audit.plist
  com.dropbox.dropboxmacupdate.agent.plist
  com.dropbox.dropboxmacupdate.xpcservice.plist
  com.dropbox.DropboxUpdater.wake.plist
  com.epicgames.launcher.plist
  com.mercado.auto.plist
  com.openai.atlas.update-helper.plist
  com.tsbgaming.thesandboxlauncher.plist
  com.user.autopilot.monitor.plist
  com.valvesoftware.steamclean.plist
  com.vmc.lacanplus.daily.plist
  homebrew.mxcl.mongodb-community.plist
  homebrew.mxcl.postgresql@14.plist
  mega.mac.megaupdater.plist
)

if [[ -n "${PLIST_FILES:-}" ]]; then
  read -r -a PLISTS <<<"$PLIST_FILES"
elif [[ "$SCAN_ALL" == "1" ]]; then
  # Escanear todos: conocidos + nuevos en el dir
  PLISTS=("${DEFAULT_PLISTS[@]}")
  for f in "$LAUNCH_AGENTS_DIR"/*.plist; do
    [[ -f "$f" ]] || continue
    base=$(basename "$f")
    is_new=1
    for k in "${DEFAULT_PLISTS[@]}"; do [[ "$k" == "$base" ]] && { is_new=0; break; }; done
    [[ $is_new -eq 1 ]] && PLISTS+=("$base")
  done
else
  PLISTS=("${DEFAULT_PLISTS[@]}")
fi

is_known() {
  local b="$1"
  for k in "${DEFAULT_PLISTS[@]}"; do [[ "$k" == "$b" ]] && return 0; done
  return 1
}

in_archive() {
  [[ -f "$ARCHIVE_DIR/$1" ]]
}

get_description() {
  local label="$1"
  case "$label" in
    com.bmc.drive-cleanup) echo "Cada hora si espacio bajo; caches → Papelera" ;;
    com.bmc.host-audit) echo "Cada hora; disco + LaunchAgents → ~/.cache/bmc-audit-host" ;;
    com.mercado.auto) echo "RunAtLoad + cada 1h; npm run mercado-auto (venv)" ;;
    com.user.autopilot.monitor) echo "KeepAlive + 5min; ~/.autopilot/autopilot_daemon.sh" ;;
    com.vmc.lacanplus.daily) echo "09:00 diario; lacan_plus.py" ;;
    homebrew.mxcl.mongodb-community) echo "RunAtLoad; servidor MongoDB" ;;
    homebrew.mxcl.postgresql@14) echo "RunAtLoad+KeepAlive; PostgreSQL 14" ;;
    com.dropbox.*) echo "Updater Dropbox" ;;
    com.adobe.*) echo "Adobe Creative Cloud" ;;
    com.bittorrent.*) echo "uTorrent P2P" ;;
    com.epicgames.*) echo "Epic Games Launcher" ;;
    com.openai.*) echo "OpenAI Atlas updater" ;;
    com.tsbgaming.*) echo "The Sandbox launcher" ;;
    com.valvesoftware.*) echo "Steam limpieza" ;;
    mega.mac.*) echo "MEGA updater" ;;
    ""|"(empty dict)"|"(no Label key)") echo "—" ;;
    *) echo "custom o vendor" ;;
  esac
}

is_vendor_label() {
  local label="$1"
  case "$label" in
    com.apple.*|com.adobe.*|com.bittorrent.*|com.dropbox.*|com.epicgames.*|com.openai.*|com.tsbgaming.*|com.valvesoftware.*|mega.mac.*|homebrew.mxcl.*)
      echo vendor
      ;;
    *)
      echo custom
      ;;
  esac
}

plist_label() {
  local f="$1"
  /usr/libexec/PlistBuddy -c 'Print :Label' "$f" 2>/dev/null || echo ""
}

plist_bool() {
  local f="$1" key="$2"
  /usr/libexec/PlistBuddy -c "Print :$key" "$f" 2>/dev/null || echo ""
}

plist_is_empty_dict() {
  local f="$1"
  python3 - "$f" <<'PY'
import sys, plistlib
path = sys.argv[1]
try:
    with open(path, "rb") as fp:
        d = plistlib.load(fp)
except Exception:
    sys.exit(1)
sys.exit(0 if isinstance(d, dict) and len(d) == 0 else 1)
PY
}

extract_path_candidates() {
  local f="$1"
  python3 - "$f" <<'PY'
import sys, plistlib, re
path = sys.argv[1]
try:
    with open(path, "rb") as fp:
        data = plistlib.load(fp)
except Exception:
    sys.exit(0)
args = data.get("ProgramArguments") or []
out = []
for a in args:
    if not isinstance(a, str):
        continue
    s = a.strip()
    if s in ("-c", "-e") or (s.startswith("-") and len(s) <= 2):
        continue
    if s.startswith("/") and not s.endswith(".app"):
        out.append(s)
print("\n".join(out))
PY
}

persistence_score() {
  local f="$1"
  local score=0
  local rl ka si
  rl=$(plist_bool "$f" RunAtLoad)
  ka=$(plist_bool "$f" KeepAlive)
  si=$(/usr/libexec/PlistBuddy -c 'Print :StartInterval' "$f" 2>/dev/null || echo "")
  [[ "$rl" == "true" ]] && score=$((score + 2))
  [[ "$ka" == "true" ]] && score=$((score + 3))
  if [[ -n "$si" && "$si" =~ ^[0-9]+$ ]]; then
    (( si <= 600 )) && score=$((score + 2))
    (( si <= 3600 )) && score=$((score + 1))
  fi
  echo "$score"
}

recommendation() {
  local base="$1" label="$2" lint="$3" vendor="$4" empty="$5"
  if [[ "$empty" == "1" ]]; then
    echo "remove_or_ignore_empty_plist"
    return
  fi
  if [[ "$lint" != OK ]]; then
    echo "fix_xml_then_reload"
    return
  fi
  case "$label" in
    com.bmc.drive-cleanup)
      echo "keep_repo_managed_audit_script"
      ;;
    com.mercado.auto)
      echo "audit_venv_npm_reload_if_paths_change"
      ;;
    com.user.autopilot.monitor)
      echo "review_daemon_script_high_persistence"
      ;;
    com.vmc.lacanplus.daily)
      echo "review_python_smtp_secrets"
      ;;
    homebrew.mxcl.mongodb-community|homebrew.mxcl.postgresql@14)
      echo "unload_if_not_in_dev_stack"
      ;;
    com.dropbox.dropboxmacupdate.agent|com.dropbox.dropboxmacupdate.xpcservice)
      echo "remove_empty_residual"
      ;;
    "")
      echo "no_label_check_file"
      ;;
    *)
      if [[ "$vendor" == vendor ]]; then
        echo "disable_if_unused_vendor"
      else
        echo "audit_custom"
      fi
      ;;
  esac
}

JSON_FILE="$(mktemp -t auditjson.XXXXXX)"
trap 'rm -f "$JSON_FILE"' EXIT

run_one() {
  local base="$1"
  local f="$LAUNCH_AGENTS_DIR/$base"
  local lint="MISSING" label="" empty=0
  local vendor="custom"

  if [[ ! -f "$f" ]]; then
    lint="MISSING_FILE"
    echo "| \`$base\` | — | — | $lint | — | — | — | — | — | — |"
    python3 - "$JSON_FILE" "$base" <<'PY'
import json, sys
out = sys.argv[1]
row = {"file": sys.argv[2], "lint": "MISSING_FILE", "status": "missing", "description": ""}
open(out, "a").write(json.dumps(row) + "\n")
PY
    return
  fi

  if plutil -lint "$f" >/dev/null 2>/tmp/audit-plutil.err; then
    lint="OK"
  else
    lint="FAIL:$(head -1 /tmp/audit-plutil.err | tr '|' '/' )"
  fi

  if plist_is_empty_dict "$f"; then
    empty=1
    label="(empty dict)"
  else
    label=$(plist_label "$f")
    [[ -z "$label" ]] && label="(no Label key)"
  fi

  vendor=$(is_vendor_label "$label")

  local runat keep si paths_exist_summary pscore rec
  runat=$(plist_bool "$f" RunAtLoad)
  keep=$(plist_bool "$f" KeepAlive)
  si=$(/usr/libexec/PlistBuddy -c 'Print :StartInterval' "$f" 2>/dev/null || echo "—")

  paths_exist_summary=""
  while IFS= read -r pc; do
    [[ -z "$pc" ]] && continue
    if [[ -e "$pc" ]]; then
      paths_exist_summary+="✓ $(basename "$pc") "
    else
      paths_exist_summary+="✗ $pc "
    fi
  done < <(extract_path_candidates "$f")

  [[ -z "$paths_exist_summary" ]] && paths_exist_summary="—"

  pscore=$(persistence_score "$f")
  rec=$(recommendation "$base" "$label" "$lint" "$vendor" "$empty")

  local status="known" desc
  is_known "$base" || status="NEW"
  in_archive "$base" && status="REGENERATED"
  desc=$(get_description "$label")
  [[ "$status" == "NEW" ]] && ALERTS_NEW+=("$base")
  [[ "$status" == "REGENERATED" ]] && ALERTS_REGEN+=("$base")

  local loaded="—"
  if [[ -n "$label" && "$label" != "(empty dict)" && "$label" != "(no Label key)" ]]; then
    if launchctl list 2>/dev/null | awk '{print $3}' | grep -qxF "$label"; then
      loaded="yes"
    else
      loaded="no"
    fi
  fi

  echo "| \`$base\` | \`${label:-}\` | **$status** | $lint | $runat / $keep | ${si}s | $pscore | $loaded | $rec | $(echo "$desc" | tr '\n' ' ' | head -c 50) |"

  local sout
  sout=$(/usr/libexec/PlistBuddy -c 'Print :StandardOutPath' "$f" 2>/dev/null || true)
  if [[ -n "$sout" && -f "$sout" ]]; then
    echo ""
    echo "  _log tail $(basename "$sout"):_"
    tail -5 "$sout" 2>/dev/null | sed 's/^/    /' || true
  fi

  python3 - "$JSON_FILE" "$base" "$label" "$lint" "$runat" "$keep" "$si" "$pscore" "$loaded" "$rec" "$paths_exist_summary" "$status" "$desc" <<'PY'
import json, sys
out, base, label, lint, runat, keep, si, pscore, loaded, rec, paths, status, desc = sys.argv[1:14]
row = {
    "file": base,
    "label": label,
    "status": status,
    "description": desc,
    "lint": lint,
    "RunAtLoad": runat,
    "KeepAlive": keep,
    "StartInterval": si,
    "persistence_score": int(pscore) if pscore.isdigit() else pscore,
    "launchd_loaded": loaded,
    "recommendation": rec,
    "paths": paths,
}
open(out, "a").write(json.dumps(row, ensure_ascii=False) + "\n")
PY
}

{
  echo "# LaunchAgents audit"
  echo ""
  echo "- **Directory:** \`$LAUNCH_AGENTS_DIR\`"
  echo "- **Archive:** \`$ARCHIVE_DIR\` (regenerados = estaban archivados, app los recreó)"
  echo "- **Generated:** $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  echo "- **Manifest:** \`scripts/launchagents-manifest.md\`"
  echo ""
  echo "| Plist | Label | status | plutil | RunAtLoad/KeepAlive | StartInt | score | loaded | recommendation | desc |"
  echo "|-------|-------|--------|--------|---------------------|----------|-------|--------|----------------|------|"
}

: > "$JSON_FILE"
ALERTS_NEW=()
ALERTS_REGEN=()
for base in "${PLISTS[@]}"; do
  run_one "$base"
  echo ""
done

if [[ ${#ALERTS_NEW[@]} -gt 0 ]] || [[ ${#ALERTS_REGEN[@]} -gt 0 ]]; then
  echo ""
  echo "## Alertas"
  [[ ${#ALERTS_NEW[@]} -gt 0 ]] && echo "- **Nuevos** (no en lista conocida): ${ALERTS_NEW[*]}"
  [[ ${#ALERTS_REGEN[@]} -gt 0 ]] && echo "- **Regenerados** (archivamos, la app los recreó): ${ALERTS_REGEN[*]}"
  echo ""
fi

if [[ "$OUT_JSON" == 1 ]]; then
  echo ""
  echo '```json'
  python3 - "$JSON_FILE" <<'PY'
import json, sys
path = sys.argv[1]
rows = []
with open(path) as f:
    for line in f:
        line = line.strip()
        if line:
            rows.append(json.loads(line))
print(json.dumps(rows, indent=2, ensure_ascii=False))
PY
  echo '```'
fi

exit 0
