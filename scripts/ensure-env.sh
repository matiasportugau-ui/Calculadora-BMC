#!/usr/bin/env bash
# Crea .env desde .env.example si aún no existe (no sobrescribe).
set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [[ -f .env ]]; then
  echo ".env ya existe — no se modifica."
  exit 0
fi

if [[ ! -f .env.example ]]; then
  echo "Falta .env.example en $REPO_ROOT" >&2
  exit 1
fi

cp .env.example .env
echo "Creado .env desde .env.example."
echo "Editá ML_CLIENT_ID, ML_CLIENT_SECRET y (con ngrok) ML_REDIRECT_URI_DEV."
