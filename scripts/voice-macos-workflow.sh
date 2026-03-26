#!/usr/bin/env bash
# Configuración asistida de voz en macOS (cualquier app: Cursor, Terminal, navegador).
# No instala software de terceros: usa Dictación y "Voz" del sistema.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

open_pane() {
  local label="$1"
  shift
  for cmd in "$@"; do
    if eval "$cmd" 2>/dev/null; then
      echo "  → Abierto: $label"
      return 0
    fi
  done
  echo "  (No se pudo abrir automáticamente: $label — ábrelo a mano desde Ajustes del Sistema.)"
  return 1
}

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "  Voz en macOS — guía rápida (UI del sistema puede seguir en inglés)"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "1) ENTRADA (hablas → texto en el campo activo)"
echo "   • Ajustes del Sistema → Keyboard → Dictation → ON"
echo "   • Idioma de dictado: Spanish (Uruguay o el que prefieras)."
echo "   • Atajo: fn fn (o el que definas)."
echo ""
echo "2) SALIDA (leer respuestas en voz alta)"
echo "   • Ajustes → Accessibility → Spoken Content → Speak selection (ON)."
echo "   • O usa: npm run voice:say -- \"Pega aquí el texto\""
echo ""
echo "3) CURSOR / IA — respuestas en español, términos técnicos en inglés"
echo "   • Copia el bloque de abajo a: Cursor → Settings → Rules for AI (User),"
echo "     así aplica en todos los proyectos."
echo ""
echo "────────── Copiar desde la siguiente línea ──────────"
cat <<'RULEBLOCK'
When the user prefers Spanish (or writes in Spanish), reply in Spanish. Keep in English: code, file paths, identifiers, CLI commands, and common technical terms where switching language hurts clarity (e.g. deploy, PR, API, OAuth, lint). Do not translate brand or product names.
RULEBLOCK
echo "────────── Fin del bloque ──────────"
echo ""
echo "Abriendo paneles útiles (si macOS lo permite)…"
echo ""

open_pane "Teclado / Dictación" \
  "open /System/Library/PreferencePanes/Keyboard.prefPane" \
  "open 'x-apple.systempreferences:com.apple.Keyboard-Settings.extension'" \
  "open -b com.apple.systempreferences"

open_pane "Accesibilidad (Spoken Content)" \
  "open /System/Library/PreferencePanes/UniversalAccessPref.prefPane" \
  "open 'x-apple.systempreferences:com.apple.Accessibility-Settings.extension'" \
  "open -a 'System Settings'"

echo ""
echo "Voces en español disponibles (primeras líneas con 'es' o Spanish):"
say -v '?' 2>/dev/null | grep -iE 'spanish|es-|españ|latina|mexico|argentina|uruguay' | head -15 || echo "  (Ejecuta en Terminal: say -v '?' | less)"
echo ""
echo "Listo. Prueba: selecciona texto en el navegador y usa Speak Selection,"
echo "o en Cursor activa Dictation y dicta en el chat."
echo ""
