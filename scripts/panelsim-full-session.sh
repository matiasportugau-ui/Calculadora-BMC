#!/usr/bin/env bash
# Sesión PANELSIM: planillas + correo + API + informe.
# Por defecto también: env:ensure, ml:verify (si API OK), project:compass, channels:automated (JSON + humanGate).
# Sesión corta (sin compass/canales/smoke prod ni env:ensure explícito al inicio): --quick
# Uso (desde raíz Calculadora-BMC):
#   npm run panelsim:session
#   npm run panelsim:session -- --quick
#   npm run panelsim:session -- --days 14
#   npm run panelsim:session -- --no-start-api
#   npm run panelsim:session -- --skip-email
#   npm run panelsim:session -- --skip-sheets
#   npm run panelsim:session -- --skip-channels|--skip-compass|--skip-ml-verify|--skip-env-ensure
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

NO_START_API=0
SKIP_EMAIL=0
SKIP_SHEETS=0
FULL_BOOTSTRAP=1
SKIP_CHANNELS=0
SKIP_COMPASS=0
SKIP_ML_VERIFY=0
SKIP_ENV_ENSURE=0
EMAIL_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-start-api) NO_START_API=1 ;;
    --skip-email) SKIP_EMAIL=1 ;;
    --skip-sheets) SKIP_SHEETS=1 ;;
    --quick) FULL_BOOTSTRAP=0 ;;
    --skip-channels) SKIP_CHANNELS=1 ;;
    --skip-compass) SKIP_COMPASS=1 ;;
    --skip-ml-verify) SKIP_ML_VERIFY=1 ;;
    --skip-env-ensure) SKIP_ENV_ENSURE=1 ;;
    *) EMAIL_ARGS+=("$1") ;;
  esac
  shift
done

REPORTS_DIR="$REPO_ROOT/docs/team/panelsim/reports"
mkdir -p "$REPORTS_DIR"
TS_UTC="$(date -u +"%Y-%m-%dT%H-%M-%SZ")"
TS_FILE="$(date -u +"%Y-%m-%dT%H-%M-%SZ")"
REPORT_FILE="$REPORTS_DIR/PANELSIM-SESSION-STATUS-${TS_FILE}.md"
API_BASE="${BMC_API_BASE:-http://127.0.0.1:3001}"
API_LOG="/tmp/panelsim-session-api-$$.log"

SHEETS_LOG="$(mktemp)"
EMAIL_LOG="$(mktemp)"
ENV_ENSURE_LOG=""
ML_CRM_LOG=""
ML_VERIFY_LOG=""
COMPASS_LOG=""
CHANNELS_LOG=""
trap 'rm -f "$SHEETS_LOG" "$EMAIL_LOG" "$ENV_ENSURE_LOG" "$ML_CRM_LOG" "$ML_VERIFY_LOG" "$COMPASS_LOG" "$CHANNELS_LOG"' EXIT

ENV_ENSURE_STATUS="omitido (--quick)"
ENV_ENSURE_EXIT=0
if [[ "$FULL_BOOTSTRAP" -eq 1 ]] && [[ "$SKIP_ENV_ENSURE" -eq 0 ]]; then
  ENV_ENSURE_LOG="$(mktemp)"
  set +e
  bash "$REPO_ROOT/scripts/ensure-env.sh" >"$ENV_ENSURE_LOG" 2>&1
  ENV_ENSURE_EXIT=$?
  set -e
  if [[ "$ENV_ENSURE_EXIT" -eq 0 ]]; then
    ENV_ENSURE_STATUS="ok"
  else
    ENV_ENSURE_STATUS="fallo (exit $ENV_ENSURE_EXIT)"
  fi
elif [[ "$SKIP_ENV_ENSURE" -ne 0 ]]; then
  ENV_ENSURE_STATUS="omitido (--skip-env-ensure)"
fi

SHEETS_STATUS="omitido"
SHEETS_EXIT=0
if [[ "$SKIP_SHEETS" -eq 0 ]]; then
  set +e
  bash "$REPO_ROOT/scripts/ensure-panelsim-sheets-env.sh" >"$SHEETS_LOG" 2>&1
  SHEETS_EXIT=$?
  set -e
  if [[ "$SHEETS_EXIT" -eq 0 ]]; then
    SHEETS_STATUS="ok"
  else
    SHEETS_STATUS="fallo (exit $SHEETS_EXIT)"
  fi
fi

EMAIL_STATUS="omitido"
EMAIL_REPO=""
STATUS_JSON=""
EMAIL_EXIT=0
if [[ "$SKIP_EMAIL" -eq 0 ]]; then
  set +e
  bash "$REPO_ROOT/scripts/panelsim-email-ready.sh" ${EMAIL_ARGS[@]+"${EMAIL_ARGS[@]}"} >"$EMAIL_LOG" 2>&1
  EMAIL_EXIT=$?
  set -e
  if [[ "$EMAIL_EXIT" -eq 0 ]]; then
    EMAIL_STATUS="ok"
  else
    EMAIL_STATUS="fallo (exit $EMAIL_EXIT)"
  fi
  EMAIL_REPO="$(bash "$REPO_ROOT/scripts/resolve-email-inbox-repo.sh" 2>/dev/null || true)"
  if [[ "$EMAIL_EXIT" -eq 0 && -n "$EMAIL_REPO" && -f "$EMAIL_REPO/data/reports/PANELSIM-STATUS.json" ]]; then
    STATUS_JSON="$EMAIL_REPO/data/reports/PANELSIM-STATUS.json"
  fi
fi

HEALTH_CODE="000"
ML_STATUS_BODY=""
CAPS_SNIP=""
API_NOTE="sin comprobar"

if command -v curl >/dev/null 2>&1; then
  # Con pipefail, curl puede devolver 7 (sin conexión) y fallar la sustitución bajo set -e; || true evita abortar.
  HEALTH_CODE="$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/health" 2>/dev/null | tr -d '\n')" || true
  if [[ -z "$HEALTH_CODE" ]]; then HEALTH_CODE="000"; fi
fi

if [[ "$HEALTH_CODE" == "200" ]]; then
  API_NOTE="ya estaba en marcha ($API_BASE/health → 200)"
  if command -v curl >/dev/null 2>&1; then
    ML_STATUS_BODY="$(curl -s "$API_BASE/auth/ml/status" 2>/dev/null | head -c 4000)" || true
    CAPS_SNIP="$(curl -s "$API_BASE/capabilities" 2>/dev/null | head -c 2500)" || true
  fi
elif [[ "$NO_START_API" -eq 0 ]] && command -v curl >/dev/null 2>&1; then
  echo ">>> Intentando levantar API en segundo plano (log: $API_LOG) …" >&2
  (
    cd "$REPO_ROOT"
    nohup node server/index.js >>"$API_LOG" 2>&1 &
    echo $! >"/tmp/panelsim-session-api.pid"
  )
  sleep 3
  HEALTH_CODE="$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/health" 2>/dev/null | tr -d '\n')" || true
  if [[ -z "$HEALTH_CODE" ]]; then HEALTH_CODE="000"; fi
  if [[ "$HEALTH_CODE" == "200" ]]; then
    API_NOTE="iniciada en background; PID en /tmp/panelsim-session-api.pid (log $API_LOG)"
    ML_STATUS_BODY="$(curl -s "$API_BASE/auth/ml/status" 2>/dev/null | head -c 4000)" || true
    CAPS_SNIP="$(curl -s "$API_BASE/capabilities" 2>/dev/null | head -c 2500)" || true
  else
    API_NOTE="no respondió tras intento de arranque (ejecutá manualmente: npm run start:api). Log: $API_LOG"
  fi
else
  API_NOTE="curl no disponible o --no-start-api / API offline"
fi

MATRIZ_CODE="n/d"
if [[ "$HEALTH_CODE" == "200" ]] && command -v curl >/dev/null 2>&1; then
  MATRIZ_CODE="$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/api/actualizar-precios-calculadora" 2>/dev/null | tr -d '\n')" || true
  if [[ -z "$MATRIZ_CODE" ]]; then MATRIZ_CODE="000"; fi
fi

# ── ML → CRM sync ────────────────────────────────────────────────────────────
ML_CRM_LOG="$(mktemp)"
ML_CRM_STATUS="omitido (API no disponible)"
if [[ "$HEALTH_CODE" == "200" ]] && command -v node >/dev/null 2>&1; then
  set +e
  node "$REPO_ROOT/scripts/panelsim-ml-crm-sync.js" >"$ML_CRM_LOG" 2>&1
  ML_CRM_EXIT=$?
  set -e
  if [[ "$ML_CRM_EXIT" -eq 0 ]]; then
    ML_CRM_STATUS="ok"
  else
    ML_CRM_STATUS="fallo (exit $ML_CRM_EXIT)"
  fi
fi

# ── Bootstrap completo: ML OAuth verify, compass, canales (smoke prod + humanGate) ──
ML_VERIFY_STATUS="omitido (--quick)"
COMPASS_STATUS="omitido (--quick)"
CHANNELS_STATUS="omitido (--quick)"
if [[ "$FULL_BOOTSTRAP" -eq 1 ]]; then
  COMPASS_LOG="$(mktemp)"
  CHANNELS_LOG="$(mktemp)"
  if [[ "$HEALTH_CODE" == "200" ]] && [[ "$SKIP_ML_VERIFY" -eq 0 ]]; then
    ML_VERIFY_LOG="$(mktemp)"
    set +e
    export BMC_API_BASE="$API_BASE"
    bash "$REPO_ROOT/scripts/verify-ml-oauth.sh" >"$ML_VERIFY_LOG" 2>&1
    MV_EXIT=$?
    set -e
    if [[ "$MV_EXIT" -eq 0 ]]; then
      ML_VERIFY_STATUS="ok"
    else
      ML_VERIFY_STATUS="fallo (exit $MV_EXIT)"
    fi
  elif [[ "$SKIP_ML_VERIFY" -ne 0 ]]; then
    ML_VERIFY_STATUS="omitido (--skip-ml-verify)"
  elif [[ "$HEALTH_CODE" != "200" ]]; then
    ML_VERIFY_STATUS="omitido (API no disponible)"
  fi

  if [[ "$SKIP_COMPASS" -eq 0 ]] && command -v node >/dev/null 2>&1; then
    set +e
    node "$REPO_ROOT/scripts/project-compass.mjs" >"$COMPASS_LOG" 2>&1
    PC_EXIT=$?
    set -e
    if [[ "$PC_EXIT" -eq 0 ]]; then
      COMPASS_STATUS="ok"
    else
      COMPASS_STATUS="fallo (exit $PC_EXIT)"
    fi
  elif [[ "$SKIP_COMPASS" -ne 0 ]]; then
    COMPASS_STATUS="omitido (--skip-compass)"
  else
    COMPASS_STATUS="omitido (sin node)"
  fi

  if [[ "$SKIP_CHANNELS" -eq 0 ]] && command -v node >/dev/null 2>&1; then
    set +e
    node "$REPO_ROOT/scripts/channels-automated-pipeline.mjs" >"$CHANNELS_LOG" 2>&1
    CH_EXIT=$?
    set -e
    if [[ "$CH_EXIT" -eq 0 ]]; then
      CHANNELS_STATUS="ok"
    else
      CHANNELS_STATUS="fallo (exit $CH_EXIT)"
    fi
  elif [[ "$SKIP_CHANNELS" -ne 0 ]]; then
    CHANNELS_STATUS="omitido (--skip-channels)"
  else
    CHANNELS_STATUS="omitido (sin node)"
  fi
fi

{
  echo "# PANELSIM — Estado de sesión (full run)"
  echo ""
  echo "**Generado (UTC):** ${TS_UTC}"
  echo "**Repo Calculadora-BMC:** \`$REPO_ROOT\`"
  echo ""
  echo "## Resumen ejecutivo"
  echo ""
  echo "| Área | Estado |"
  echo "|------|--------|"
  echo "| \`.env\` (env:ensure si falta) | $ENV_ENSURE_STATUS |"
  echo "| Planillas / Google (ensure-panelsim-sheets-env) | $SHEETS_STATUS |"
  echo "| Correo IMAP + reporte (panelsim-email-ready) | $EMAIL_STATUS |"
  echo "| API local ($API_BASE) | HTTP health: **$HEALTH_CODE** — $API_NOTE |"
  echo "| MATRIZ vía API | GET /api/actualizar-precios-calculadora → **$MATRIZ_CODE** |"
  echo "| ML → CRM sync (preguntas pendientes) | $ML_CRM_STATUS |"
  echo "| ML OAuth verify (\`ml:verify\` / verify-ml-oauth) | $ML_VERIFY_STATUS |"
  echo "| Programa + compass (\`project:compass\`) | $COMPASS_STATUS |"
  echo "| Canales + smoke prod + humanGate (\`channels:automated\`) | $CHANNELS_STATUS |"
  echo "| UI Vite (:5173) | No se arranca en este script; usá \`npm run dev\` o \`npm run dev:full\` si necesitás la calculadora en navegador. |"
  echo ""
  echo "## 0. Crear \`.env\` si falta (\`npm run env:ensure\`)"
  echo ""
  if [[ -n "$ENV_ENSURE_LOG" && -f "$ENV_ENSURE_LOG" ]]; then
    echo '```text'
    cat "$ENV_ENSURE_LOG"
    echo '```'
  else
    echo "_${ENV_ENSURE_STATUS}._"
  fi
  echo ""
  echo "## 1. Planillas y credenciales"
  echo ""
  if [[ "$SKIP_SHEETS" -ne 0 ]]; then
    echo "_Omitido (--skip-sheets)._"
  else
    echo '```text'
    sed 's/^/    /' "$SHEETS_LOG" | sed 's/^    $//'
    echo '```'
  fi
  echo ""
  echo "## 2. Correo"
  echo ""
  if [[ "$SKIP_EMAIL" -ne 0 ]]; then
    echo "_Omitido (--skip-email)._"
  else
    echo '```text'
    sed 's/^/    /' "$EMAIL_LOG" | tail -n 80
    echo '```'
    if [[ -n "$STATUS_JSON" && -f "$STATUS_JSON" ]]; then
      echo ""
      echo "Archivo **PANELSIM-STATUS.json** (extracto):"
      echo ""
      echo '```json'
      node -e "
const fs=require('fs');
const p=process.argv[1];
const j=JSON.parse(fs.readFileSync(p,'utf8'));
const pick = {
  generatedAt: j.generatedAt,
  fetchedAt: j.fetchedAt,
  daysBack: j.daysBack,
  count: j.count,
  byCategory: j.byCategory,
  byAccount: j.byAccount,
  syncHealth: j.syncHealth,
  reportPath: j.reportPath,
  snapshotPath: j.snapshotPath,
};
console.log(JSON.stringify(pick, null, 2));
" "$STATUS_JSON" 2>/dev/null || echo "(no se pudo parsear JSON)"
      echo '```'
    fi
  fi
  echo ""
  echo "## 3. API y Mercado Libre"
  echo ""
  echo "- **Health:** \`$HEALTH_CODE\`"
  echo "- **GET /auth/ml/status** (extracto):"
  echo ""
  echo '```json'
  if [[ -n "$ML_STATUS_BODY" ]]; then
    echo "$ML_STATUS_BODY"
  else
    echo "(vacío o API no disponible)"
  fi
  echo '```'
  echo ""
  echo "- **GET /capabilities** (primeros caracteres):"
  echo ""
  echo '```'
  if [[ -n "$CAPS_SNIP" ]]; then
    echo "$CAPS_SNIP"
  else
    echo "(vacío o API no disponible)"
  fi
  echo '```'
  echo ""
  echo "## 4. ML → CRM sync"
  echo ""
  echo '```text'
  if [[ -s "$ML_CRM_LOG" ]]; then
    cat "$ML_CRM_LOG"
  else
    echo "(sin salida)"
  fi
  echo '```'
  echo ""
  echo "## 5. Bootstrap automático (Mercado Libre + programa + canales)"
  echo ""
  echo "Modo **completo** (default): \`ml:verify\` (\`scripts/verify-ml-oauth.sh\` con \`BMC_API_BASE=$API_BASE\`), \`project:compass\`, \`channels:automated\` (incluye smoke a prod). Modo **--quick**: omitido."
  echo ""
  echo "### 5.1 ML OAuth verify"
  echo ""
  if [[ -n "${ML_VERIFY_LOG:-}" && -s "$ML_VERIFY_LOG" ]] && [[ "$FULL_BOOTSTRAP" -eq 1 ]]; then
    echo '```text'
    cat "$ML_VERIFY_LOG"
    echo '```'
  else
    echo "_${ML_VERIFY_STATUS}._"
  fi
  echo ""
  echo "### 5.2 project:compass (últimas ~120 líneas)"
  echo ""
  if [[ -n "$COMPASS_LOG" && -f "$COMPASS_LOG" ]] && [[ "$FULL_BOOTSTRAP" -eq 1 ]]; then
    echo '```text'
    tail -n 120 "$COMPASS_LOG"
    echo '```'
  else
    echo "_${COMPASS_STATUS}._"
  fi
  echo ""
  echo "### 5.3 channels:automated (JSON completo)"
  echo ""
  if [[ -n "$CHANNELS_LOG" && -f "$CHANNELS_LOG" ]] && [[ "$FULL_BOOTSTRAP" -eq 1 ]]; then
    echo '```json'
    cat "$CHANNELS_LOG"
    echo '```'
  else
    echo "_${CHANNELS_STATUS}._"
  fi
  echo ""
  echo "## 6. Próximos pasos sugeridos"
  echo ""
  echo "- **Calculadora en el navegador:** \`npm run dev\` (puerto 5173 típico) o \`npm run dev:full\` (API+Vite si preferís un solo comando y no usás el API ya levantado)."
  echo "- **OAuth ML:** si \`/auth/ml/status\` indica sin token, abrí \`/auth/ml/start\` según \`docs/ML-OAUTH-SETUP.md\`."
  echo "- **Canales humanos (cm-0/1/2):** ver \`humanGate\` en el JSON de §5.3 y \`docs/team/HUMAN-GATES-ONE-BY-ONE.md\`."
  echo "- **Sesión más rápida:** \`npm run panelsim:session -- --quick\` (sin compass, sin smoke prod, sin env:ensure al inicio)."
  echo "- **Detener API** iniciada por este script: \`kill \$(cat /tmp/panelsim-session-api.pid)\` (solo si se creó PID en esta corrida)."
  echo ""
} >"$REPORT_FILE"

echo ""
echo ">>> Informe de sesión escrito en:"
echo "    $REPORT_FILE"
echo ""

# Código de salida: 0 si ningún paso obligatorio falló (o fue omitido); 1 si falló planillas o correo cuando no se omitieron.
EXIT_CODE=0
if [[ "$SKIP_SHEETS" -eq 0 && "$SHEETS_EXIT" -ne 0 ]]; then EXIT_CODE=1; fi
if [[ "$SKIP_EMAIL" -eq 0 && "$EMAIL_EXIT" -ne 0 ]]; then EXIT_CODE=1; fi
exit "$EXIT_CODE"
