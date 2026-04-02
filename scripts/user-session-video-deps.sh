#!/usr/bin/env bash
# Dependencies for Video-User-interactive-dev / session:video-extract / session:video-ingest.
#
# Usage:
#   bash scripts/user-session-video-deps.sh check    — exit 0 si OK, 1 si falta algo (solo mensaje)
#   bash scripts/user-session-video-deps.sh ensure   — igual que check; si falta ffmpeg intenta instalar (ver abajo)
#
# Env:
#   BMC_VIDEO_DEPS_SKIP_INSTALL=1 — no ejecutar brew; solo comprobar y fallar con instrucciones
#   CI=1 — Homebrew suele evitar prompts extra (útil en automatización)
#
set -euo pipefail

MODE="${1:-check}"

have_ffmpeg() {
  command -v ffmpeg >/dev/null 2>&1
}

have_node() {
  command -v node >/dev/null 2>&1
}

print_ok() {
  echo "video-deps: ffmpeg OK ($(command -v ffmpeg))"
  command -v ffprobe >/dev/null 2>&1 && echo "video-deps: ffprobe OK" || echo "video-deps: ffprobe no requerido (opcional)"
  have_node && echo "video-deps: node OK ($(node -v 2>/dev/null || true))"
}

install_ffmpeg_darwin_brew() {
  if [[ "${BMC_VIDEO_DEPS_SKIP_INSTALL:-}" == "1" ]]; then
    echo "video-deps: ffmpeg no encontrado. Instalá con: brew install ffmpeg" >&2
    return 1
  fi
  if ! command -v brew >/dev/null 2>&1; then
    echo "video-deps: ffmpeg no encontrado y Homebrew no está en PATH." >&2
    echo "video-deps: Instalá Homebrew desde https://brew.sh y luego: brew install ffmpeg" >&2
    return 1
  fi
  echo "video-deps: instalando ffmpeg con Homebrew (puede tardar)…" >&2
  HOMEBREW_NO_AUTO_UPDATE="${HOMEBREW_NO_AUTO_UPDATE:-1}" brew install ffmpeg
}

install_ffmpeg_linux_hint() {
  echo "video-deps: ffmpeg no encontrado en Linux." >&2
  echo "video-deps: Ejemplo (Debian/Ubuntu): sudo apt-get update && sudo apt-get install -y ffmpeg" >&2
  echo "video-deps: Este script no ejecuta sudo automáticamente." >&2
  return 1
}

ensure_ffmpeg() {
  if have_ffmpeg; then
    return 0
  fi
  case "$(uname -s)" in
    Darwin)
      install_ffmpeg_darwin_brew
      ;;
    Linux)
      if [[ "${BMC_VIDEO_DEPS_SKIP_INSTALL:-}" == "1" ]]; then
        install_ffmpeg_linux_hint
        return 1
      fi
      install_ffmpeg_linux_hint
      return 1
      ;;
    *)
      echo "video-deps: ffmpeg no encontrado. Instalá ffmpeg para tu OS e reintentá." >&2
      return 1
      ;;
  esac
  have_ffmpeg
}

run_check() {
  local ok=0
  if ! have_ffmpeg; then
    echo "video-deps: falta ffmpeg en PATH." >&2
    ok=1
  fi
  if ! have_node; then
    echo "video-deps: falta node en PATH (necesario para session:video-ingest / metadata.json)." >&2
    ok=1
  fi
  if (( ok == 0 )); then
    print_ok
    return 0
  fi
  echo "video-deps: ejecutá: npm run session:video-deps (modo ensure) o instalá manualmente." >&2
  return 1
}

run_ensure() {
  if ! have_node; then
    echo "video-deps: node no encontrado. Usá Node desde nvm/fnm o https://nodejs.org — npm run session:video-ingest requiere node." >&2
    return 1
  fi
  if have_ffmpeg; then
    print_ok
    return 0
  fi
  ensure_ffmpeg || return 1
  if ! have_ffmpeg; then
    echo "video-deps: ffmpeg sigue sin estar disponible tras el intento de instalación." >&2
    return 1
  fi
  print_ok
  return 0
}

case "$MODE" in
  check)
    run_check
    ;;
  ensure)
    run_ensure
    ;;
  *)
    echo "Usage: $0 check|ensure" >&2
    exit 1
    ;;
esac
