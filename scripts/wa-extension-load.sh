#!/usr/bin/env bash
# WA Cockpit — Cargador de la extensión Chrome con perfil dedicado.
#
# - Verifica que la extensión esté construida en ../calculadora-bmc-wa-extension/.output/chrome-mv3
# - Lanza Google Chrome con un perfil aislado en .runtime/chrome-wa-profile/
#   (no toca tu perfil personal). La sesión de WhatsApp Web y el token de la
#   extensión persisten entre runs.
# - Abre web.whatsapp.com (para login QR la primera vez) + /hub/wa del SPA.
#
# Uso:
#   npm run wa:ext:load            # build si falta + Chrome
#   npm run wa:ext:load -- --rebuild   # rebuild forzado
#   npm run wa:ext:load -- --no-wa     # sin abrir web.whatsapp.com
#   npm run wa:ext:load -- --watch     # arranca wxt dev en bg (HMR de la extensión)

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXT_REPO="$(cd "$REPO/.." && pwd)/calculadora-bmc-wa-extension"
EXT_BUILD="$EXT_REPO/.output/chrome-mv3"
PROFILE_DIR="$REPO/.runtime/chrome-wa-profile"
SPA_URL="${SPA_URL:-http://localhost:5173/hub/wa}"
WA_URL="https://web.whatsapp.com/"

REBUILD=false
OPEN_WA=true
WATCH=false

for arg in "$@"; do
  case "$arg" in
    --rebuild) REBUILD=true ;;
    --no-wa)   OPEN_WA=false ;;
    --watch)   WATCH=true ;;
    -h|--help)
      cat <<USAGE
Uso: $0 [--rebuild] [--no-wa] [--watch]

  --rebuild   Reconstruye la extensión antes de abrir Chrome.
  --no-wa     No abre https://web.whatsapp.com/ (solo el cockpit).
  --watch     Arranca 'wxt dev' en background (HMR del bundle de la extensión).

Variables de entorno opcionales:
  SPA_URL     URL del cockpit (default: http://localhost:5173/hub/wa)

Perfil Chrome dedicado:
  $PROFILE_DIR
  La sesión WhatsApp Web y la config de la extensión persisten ahí entre runs.
  Para empezar de cero: rm -rf "$PROFILE_DIR"
USAGE
      exit 0
      ;;
    *)
      echo "Unknown arg: $arg (use -h)"
      exit 1
      ;;
  esac
done

if [[ ! -d "$EXT_REPO" ]]; then
  echo "ERROR: extensión no encontrada en $EXT_REPO" >&2
  echo "  ¿Cloné el repo separado? git clone <url> $EXT_REPO" >&2
  exit 1
fi

# 1) Build si falta o se pidió rebuild
if [[ ! -f "$EXT_BUILD/manifest.json" || "$REBUILD" = "true" ]]; then
  echo "→ Construyendo extensión en $EXT_REPO..."
  if [[ ! -d "$EXT_REPO/node_modules" ]]; then
    ( cd "$EXT_REPO" && npm install --silent )
  fi
  ( cd "$EXT_REPO" && npm run build )
  echo "  ✓ build OK ($(du -sh "$EXT_BUILD" | cut -f1))"
fi

# 2) Watch (opcional) — corre wxt dev en bg para HMR del bundle
if [[ "$WATCH" = "true" ]]; then
  WATCH_LOG="$REPO/.runtime/wa-ext-watch.log"
  mkdir -p "$(dirname "$WATCH_LOG")"
  echo "→ Arrancando 'wxt dev' en bg ($WATCH_LOG)..."
  ( cd "$EXT_REPO" && nohup npm run dev > "$WATCH_LOG" 2>&1 & )
  sleep 2
fi

# 3) Localizar Chrome.
# IMPORTANTE: Chrome 147+ stable bloquea --load-extension (warning silencioso
# "--load-extension is not allowed in Google Chrome, ignoring."). Por eso
# preferimos Beta/Dev/Canary/Chromium/Brave/Edge donde la flag aún funciona,
# y dejamos Chrome stable solo como último fallback.
CHROME=""
CHROME_KIND=""
for entry in \
  "beta:/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta" \
  "dev:/Applications/Google Chrome Dev.app/Contents/MacOS/Google Chrome Dev" \
  "canary:/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary" \
  "chromium:/Applications/Chromium.app/Contents/MacOS/Chromium" \
  "brave:/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" \
  "edge:/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" \
  "stable:/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"; do
  kind="${entry%%:*}"
  path="${entry#*:}"
  if [[ -x "$path" ]]; then
    CHROME="$path"
    CHROME_KIND="$kind"
    break
  fi
done
if [[ -z "$CHROME" ]]; then
  echo "ERROR: ningún Chrome/Chromium/Brave/Edge encontrado en /Applications" >&2
  exit 1
fi
if [[ "$CHROME_KIND" = "stable" ]]; then
  echo "⚠️  Chrome stable detectado pero --load-extension está bloqueado en 147+." >&2
  echo "   La extensión NO se cargará automáticamente." >&2
  echo "   Instalá Chrome Beta:  brew install --cask google-chrome-beta" >&2
  echo "   (o cargala manual en chrome://extensions/ con Modo desarrollador ON.)" >&2
fi

mkdir -p "$PROFILE_DIR"

# 4) URLs a abrir (orden: cockpit primero para foco)
URLS=("$SPA_URL")
if [[ "$OPEN_WA" = "true" ]]; then
  URLS+=("$WA_URL")
fi

echo "→ Lanzando Chrome..."
echo "   Browser:   $CHROME"
echo "   Profile:   $PROFILE_DIR"
echo "   Extension: $EXT_BUILD"
echo "   URLs:      ${URLS[*]}"
echo

# Notas:
#  --user-data-dir aísla profile (no contamina tu Chrome principal)
#  --load-extension carga la unpacked
#  --no-first-run / --no-default-browser-check evitan diálogos cada vez
#  --disable-features=DialMediaRouteProvider reduce ruido de logs
"$CHROME" \
  --user-data-dir="$PROFILE_DIR" \
  --load-extension="$EXT_BUILD" \
  --no-first-run \
  --no-default-browser-check \
  --disable-features=DialMediaRouteProvider \
  "${URLS[@]}" \
  >/dev/null 2>&1 &

CHROME_PID=$!
echo "  ✓ Chrome PID $CHROME_PID"
echo
cat <<'NEXT'
Pasos en el browser que se acaba de abrir:

  1) Click en el icon "Extensiones" (puzzle, arriba a la derecha) → fijá "BMC WA Cockpit".
  2) Click en el icon de BMC WA Cockpit → completá:
       API base URL  : http://localhost:3001
       API token     : (el valor de API_AUTH_TOKEN en .env)
       Operator ID   : matias
     → Guardar → activar toggle "Sync ON".
  3) En la pestaña web.whatsapp.com, escaneá el QR (la primera vez nada más).
  4) En el popup → "Sync histórico" — vuelca tu IndexedDB al backend.
  5) Volvé a la pestaña /hub/wa: vas a ver todos tus chats reales.

La sesión WA Web y el token quedan en el perfil:
  ~/Panelin calc loca/Calculadora-BMC/.runtime/chrome-wa-profile/

Para limpiar y empezar de cero:
  rm -rf ".runtime/chrome-wa-profile"
NEXT
