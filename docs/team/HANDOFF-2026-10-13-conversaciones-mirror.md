# HANDFOFF 2026-10-13 — Historial de conversaciones completo + fuente secundaria (Drive)

**Rama:** (bmc-sheet-quote-pipeline NO es repo git → backups + patch)
**Repo afectado:** ~/bmc-sheet-quote-pipeline/scripts
**Alcance:** capturar las 4 superficies de conversación en un log unificado, siempre, y espejarlo a Google Drive (fuente secundaria que sobrevive al Mac).

## Qué se construyó (pedido: "all chat logs conversations always, secundary source")
1. **Log unificado por día** `~/.ialfred/conversations/conversations-YYYY-MM-DD.jsonl` (0600, append-only) —
   registra con un solo esquema las 4 superficies que antes NO se guardaban todas:
   - `chat` (`/api/voice/turn`) — ya estaba en voice-memory L0, ahora también acá (una sola vista)
   - `agent` (`/api/voice/agent`) — ANTES: efímero, solo console.log. AHORA: registrado.
   - `terminal` (`/api/voice/terminal`) — ANTES: solo storage de OpenCode. AHORA: registrado (con sessionId de OpenCode).
   - `realtime` 🎧 (NUEVA ruta `POST /api/voice/log`) — ANTES: el transcript hablado se descartaba en el browser.
     AHORA: `voice-realtime.js` acumula deltas y postea tramos `user`/`assistant` al desk (`logUrl` + `rtSessionId` en la respuesta de `/api/voice/realtime`).
2. **Fuente secundaria = Google Drive** (OAuth IAlfred, scope drive.file):
   - `scripts/conversations-drive-sync.mjs` — idempotente (size+mtime), lock anti-concurrencia, estado en `~/.ialfred/conversations/.drive-sync.json`.
   - Sube: log unificado → carpeta **"IAlfred Conversaciones"** (My Drive), + backfill `L0-voice-turns/` y `auditorias/`.
   - launchd `com.ialfred.conversations-drive-sync` (StartInterval 900 + RunAtLoad), wrapper `scripts/conversations-drive-sync.sh`, log en `~/.ialfred/ops/desk-watch/conversations-drive-sync.log`.
3. **CORS**: `/api/voice/log` hereda ACAO `*` del desk; POST desde origins :5173/:5174 OK (preflight OPTIONS 204). Origin ajeno → 403.

## Verificación hecha (todo OK)
- 4 superficies → log unificado: `chat/uno`, `realtime/dale…`, `agent/dos`, `terminal/tres` + POSTs de voz.
- Sync: 30 archivos subidos a Drive (`1SO3izyHDbJM3_wkSoqY_KysaN5OeWQnG`), segunda corrida = 0 subidos/30 sin cambios (idempotente).
- launchd: `launchctl list` OK, corrida vía wrapper OK. CORS/OPTIONS/403 verificados con curl.
- `npm run test:voice` NO se corrió (no se tocó voice-memory/voice-agent). `node --check` desk + realtime OK.
- Backups/parche: `scripts/enviar-desk.mjs.bak-20261013-0418`, `scripts/voice-realtime.js.bak-20261013-0418`, `conversations-log-drive-20261013-0418.patch` (337 líneas) — verificado REVERSE (→bak) y FORWARD (→current).

## Detalles técnicos que importan
- **El desk estaba en CRLF** → normalizado a LF (contenido idéntico, `node --check` OK). Backups viejos siguen CRLF; `diff --strip-trailing-cr` si comparan.
- **Cambio intermedio de otro agente** (mint de keys Grok/xAI en `/api/voice/realtime`) quedó incluído en el "before" reconstruído (NO es parte de este parche).
- La voz realtime se registra SOLO con el desk arriba (el browser postea los transcripts). Si el desk está caído no hay historial de esa llamada (mismo límite que el chat).
- Privacidad: los chats tienen PII → la carpeta Drive es privada de Matías (decidido por el usuario); NO va a `bmc-brain`.

## Revert
```bash
cd ~/bmc-sheet-quote-pipeline
patch -p0 -R --batch < conversations-log-drive-20261013-0418.patch
# o restaurar backups:
cp scripts/enviar-desk.mjs.bak-20261013-0418 scripts/enviar-desk.mjs
cp scripts/voice-realtime.js.bak-20261013-0418 scripts/voice-realtime.js
launchctl bootout gui/$(id -u)/com.ialfred.conversations-drive-sync  # + borrar plist y scripts nuevos
```

## Pendientes del contexto previo (no de esta feature)
- **Browser test del ⌨️ terminal** sigue pendiente del usuario (desk :8787 vivo; :5173/:5174 apagados).
- Keys: hoy solo Grok realtime funciona (límites de Anthropic/OpenAI/Gemini).
- Open loops: GCP billing 98 (`panelin-calc` 503), DAC 97/96 (Cardelino #1013/#1010/#1009, NO reimprimir etiquetas), Shopify orders scope 91, galpón promo revert 90 (due 2026-10-16).

## Rutas clave
- Desk: `~/bmc-sheet-quote-pipeline/scripts/enviar-desk.mjs` (routes y `logConversation`)
- Browser voz: `~/bmc-sheet-quote-pipeline/scripts/voice-realtime.js` (`logSegment`, `asstBuf`, `logCfg`)
- Sync: `~/bmc-sheet-quote-pipeline/scripts/conversations-drive-sync.mjs` + `.sh`
- Plist: `~/Library/LaunchAgents/com.ialfred.conversations-drive-sync.plist`
- Log unificado: `~/.ialfred/conversations/` (README.md dentro)
- Drive: "IAlfred Conversaciones" — https://drive.google.com/drive/folders/1SO3izyHDbJM3_wkSoqY_KysaN5OeWQnG