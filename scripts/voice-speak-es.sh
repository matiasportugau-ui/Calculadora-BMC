#!/usr/bin/env bash
# Lee en voz alta en ESPAÑOL (macOS `say`).
# Si suena en inglés: Ajustes → Accessibility → Spoken Content → System Voice → Manage Voices → instalar Spanish.
#
# Uso: VOICE_ES=Monica npm run voice:say -- "Texto"
#      npm run voice:say -- "Texto"
#      pbpaste | bash scripts/voice-speak-es.sh
set -euo pipefail

TEXT="${*:-}"
if [[ -z "$TEXT" ]] && ! tty -s; then
  TEXT="$(cat)"
fi

if [[ -z "${TEXT// }" ]]; then
  echo "Uso: npm run voice:say -- \"Tu texto\"" >&2
  echo "     pbpaste | bash scripts/voice-speak-es.sh" >&2
  exit 1
fi

# Lista de voces instaladas: primer campo = nombre interno.
list_voices() {
  say -v '?' 2>/dev/null
}

voice_installed() {
  local n="$1"
  list_voices | awk -v n="$n" '$1 == n {found=1} END{exit !found}'
}

# 1) Override manual: VOICE_ES=Monica npm run voice:say -- "hola"
if [[ -n "${VOICE_ES:-}" ]]; then
  if voice_installed "$VOICE_ES"; then
    exec say -v "$VOICE_ES" "$TEXT"
  fi
  echo "voice-speak-es: VOICE_ES='$VOICE_ES' no está en la lista de voces; se ignora." >&2
fi

# 2) Primera voz con locale español (es_XX, Spanish, etc.).
pick_voice_from_list() {
  list_voices | grep -iE 'spanish|[[:space:]](es_|es-419|es_ES|es_MX|es_AR|es_UY|es_CO|es_CL)' | head -1 | awk '{print $1}'
}

VOICE="$(pick_voice_from_list || true)"

# 3) Nombres que suele traer macOS (España / Latinoamérica) si están descargados.
if [[ -z "$VOICE" ]]; then
  # macOS usa "Mónica" (con tilde), no "Monica".
  for try in Mónica Monica Jorge Paulina Diego Marta; do
    if voice_installed "$try"; then
      VOICE="$try"
      break
    fi
  done
fi

if [[ -n "$VOICE" ]]; then
  exec say -v "$VOICE" "$TEXT"
fi

echo "voice-speak-es: no hay voz en español instalada. En macOS: Ajustes del Sistema → Accesibilidad → Contenido hablado → Voz del sistema → Gestionar voces → descargar Spanish (p. ej. Monica o Jorge). Opcional: VOICE_ES=Monica npm run voice:say -- \"texto\"" >&2
# Último recurso: say sin -v (puede ser inglés).
exec say "$TEXT"
