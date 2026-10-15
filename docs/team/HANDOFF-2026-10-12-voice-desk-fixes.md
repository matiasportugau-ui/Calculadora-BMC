# Handoff — 2026-10-12 · IAlfred Desk (voz): fixes A–E + test de regresión + rotación LLM

**Current branch**: `(no git)` — el proyecto es `~/bmc-sheet-quote-pipeline`, que **no es repo git**.
Cambios en disco con backups `.bak-*` y patches; NO hay commit/branch. (Ver "Backup/revert" abajo.)

**Objetivo**: tría de consultas del Enviar Desk (`:8787`) + observar/analizar la interacción de voz y
arreglar los bugs **A–E**, con **test de regresión**, y **mitigar la caída de proveedores LLM**.

## Status: DONE (deployado en el **desk local**; NO es prod Cloud Run)

### Fixes aplicados (todos live tras reiniciar el desk)
| # | Qué | Archivo |
|---|-----|---------|
| A | La UI abre la **fila objetivo** aunque el panel esté en otra pestaña + chip fallback | `scripts/voice-desk-bridge.js` |
| C | `desk_redactar_respuesta` **no pierde el monto** (fallback `quote` desde activa→historial→borrador + guarda anti-regresión) | `scripts/voice-agent.mjs` |
| C' | **bug del fix C**: `!extractMoney(text)` sobre un **array** (`![]` === `false`) → la guarda era **no-op**. Corregido a `.length === 0` | `scripts/voice-agent.mjs` |
| B | prompt 5b: «borrador ≠ guardado» (no decir "está en K") | `scripts/voice-agent.mjs` |
| D | `validatePayload` **exige la superficie** del escenario (evita el 400 crudo del calc) | `schema.mjs` |
| E | el dock **no bifurca la sesión** (no vacía `S.sessionId` cuando no hay sesión activa) | `scripts/voice-dock.js` |
| P | `BMC_VOICE_PROVIDER_ORDER` pasa a **allowlist EXCLUSIVA** (saca caídos de la rotación) | `scripts/voice-llm.mjs` |
| — | **Launcher local** con PATH/nvm + rotación de proveedores | `scripts/run-desk.sh` (nuevo) |

### Tests
- `npm run test:voice` → **52/52** (antes 50). `npm test` ✅.
- +2 tests: **D** (`validatePayload` por escenario) y **C** (regresión de monto). +1 assert: allowlist de proveedores.
- **El test de regresión C cazó un bug real** en mi propio fix (la guarda no-op). Ese es el valor del test.

### Evidencia del bug D (repro contra la calculadora real `:3001`)
`POST /calc/cotizar {"escenario":"solo_techo","lista":"venta"}` → `400 {"ok":false,"error":"Para 'solo_techo' se requiere techo.familia y techo.espesor."}`.
La validación local **no exigía la superficie** → el payload roto se mandaba al calc y el error crudo se escribía en la planilla (col L / `service.log`). Ahora se deriva a la **pregunta correctiva** (rama que ya existía).

### Deploy realizado
- Desk reiniciado con `bash scripts/run-desk.sh` → PID **86169** (PPID 1, nohup), `order=["xai","gemini"]`.
- Log vivo: `~/.ialfred/ops/desk-watch/desk-20261012-083213.log`.
- **Pendiente del operador: recargar el navegador con `Cmd+Shift+R`** (el dock E se sirve con `Cache-Control: no-cache`).

### Backup / revert (no-git)
- `scripts/voice-agent.mjs.bak-20261012-075158`, `scripts/voice-desk-bridge.js.bak-20261012-075158`, `scripts/enviar-desk.mjs.bak-20261012-075158`
- `schema.mjs.bak-20261012-0825`, `scripts/voice-dock.js.bak-20261012-0825`, `tests/voiceCopilot.test.mjs.bak-20261012-0825`
- `scripts/voice-llm.mjs.bak-20261012-0830`
- Patches: `voice-fixes-20261012-0825.patch` (schema/dock/agent/tests), `voice-llm-fixes-20261012-0832.patch`

## Blockers (HITL — credenciales / cuota del proveedor)
El log destapó que **los 4 proveedores LLM fallaban** (causa de "Perdón Matías, no pude conectar con el modelo").
Keys presentes en Doppler, el problema es auth/cuota del lado proveedor:

1. **`ANTHROPIC_API_KEY` inválida** → `401 invalid x-api-key`. **Quién: Matías/ops** → rotar en Doppler `bmc-backend/prd`.
2. **OpenAI sin crédito** → `429 no credits`. **Quién: Matías/ops** → cargar crédito.
3. **Gemini cuota agotada** → `429`; cooldown hasta ~17:24Z. Subir cuota o esperar.
4. **xai** timeouts intermitentes → **único usable hoy** (por eso la rotación quedó en `xai → gemini`).

Mitigación aplicada: `scripts/run-desk.sh` exporta `BMC_VOICE_PROVIDER_ORDER=xai,gemini` (anthropic/openai **excluidos**).
Cuando se reparen las keys: ampliar/borrar esa var y reiniciar con el launcher.

## Next prompt to resume exactly
```
Continue from here: IAlfred Desk voz (bmc-sheet-quote-pipeline).
1) Reparar credenciales: rotar ANTHROPIC_API_KEY (401) y cargar crédito OpenAI / cuota Gemini en Doppler
   bmc-backend/prd. Luego ampliar BMC_VOICE_PROVIDER_ORDER en scripts/run-desk.sh y reiniciar con `bash scripts/run-desk.sh`.
2) Probar EN VIVO la fila 77 (GARCIALUJAN99, ML, canalón IsoDec/Isopanel 100 · 9,30 m · USD 353,1):
   cotizar/redactar y confirmar que el monto NO se pierde (fix C) y que NO vuelve el 400 de solo_techo (fix D).
   Recargar el navegador con Cmd+Shift+R antes.
3) Pendiente de tría: bucket 1 listas-para-enviar (filas 41,30,35,42,43,29,45,46,154,153) — HITL.
```

## Key files touched
- `scripts/voice-agent.mjs` · `scripts/voice-desk-bridge.js` · `scripts/enviar-desk.mjs` · `schema.mjs`
- `scripts/voice-dock.js` · `scripts/voice-llm.mjs` · `scripts/run-desk.sh` (nuevo) · `tests/voiceCopilot.test.mjs`

## Current state reference
- See `docs/team/PROJECT-STATE.md` (workspace `calculadora-bmc`).

---

## Adenda 2026-10-12 — Chat upgrades IAlfred: panel de modelos + adjuntos + ventana móvil

**Status: DONE y live** en el desk local `:8787` (reiniciado 2× con `scripts/run-desk.sh`; log `~/.ialfred/ops/desk-watch/desk-20261012-091318.log`).

Pedido (dictado): *"volvamos a tener disponible… la configuración de panel en la interfaz de chat: subir archivos, elegir el modelo, luces verdes de habilitados/vivos, y mover la ventana del chat"* — **agente nuevo persistente en las 3 URLs, independiente de Panelin**.

Aclaración clave: el **agente IAlfred ya era persistente en las 3 apps** (mismo `voice-dock.js` servido por el desk, sesión/memoria en servidor `~/.ialfred/memory/voice-sessions`; se inyecta en Enviar Desk `:8787`, calculadora-bmc `:5173` vía `IAlfredVoiceDockLoader.jsx`, IAlfred Desk personal-agent `:5174` vía `IAlfredVoiceDock.jsx`). Esta tanda le agregó las 4 capacidades.

**Qué cambió (5 archivos, backups `*.bak-20261012-0848` + parche `voice-chat-upgrades-20261012-0935.patch`):**
- `voice-llm.mjs`: `providerCatalog(env)` → catálogo completo con luz por estado: `green` key+sin cooldown y **en allowlist**, `amber` cooldown (429/cuota; incluye clave `gemini-desk`), `gray` excluido por `BMC_VOICE_PROVIDER_ORDER` (tiene key pero no está habilitado), `red` sin key.
- `enviar-desk.mjs`: `/api/voice/health` agrega `models[]` + `activeProvider`; nuevos **`POST /api/voice/model`** (persiste `session.provider`, honorado por `provider || session.provider` del motor) y **`POST /api/voice/upload`** (base64, máx 10 MB, nombre saneado, 0600, `~/.ialfred/uploads/voice/<sesión>/`); `/api/voice/turn` reenvía `attachments`.
- `voice-agent.mjs`: `runTurn({... attachments})` + bloque **`ADJUNTOS DE MATÍAS EN ESTE TURNO`** en el system prompt (regla: no inventar contenido del archivo).
- `voice-dock.js`: sección **Modelo de IA** en ⚙︎ (Auto + proveedores con punto de color, modelo, nota cooldown/sin key/excluido/vivo), **dot en el header** (visible sin abrir ajustes), elección persistida en `localStorage` + enviada por turno; **📎 subir archivos** con chips y quitar; **arrastre del header** (pointer capture, límites de viewport, posición en localStorage, doble click = reset).
- `tests/voiceCopilot.test.mjs`: test del catálogo (key→verde, cooldown→ámbar incl. `gemini-desk`, sin key→rojo, allowlist→gris). **`npm run test:voice` 54/54**.
- **Voz en vivo (realtime S2S) — opción gated por modelo:** `providerCatalog` ahora expone `liveVoice` / `liveVoiceEngine` / `liveVoiceAvailable` (`REALTIME_ENGINES`: `xai`→Grok WS PCM, `openai`→OpenAI Realtime WebRTC; Gemini/Anthropic **no** tienen motor realtime). El panel "Modelo de IA" del dock muestra un chip **`🎧 voz en vivo`** sólo en los modelos que la soportan: verde si está disponible (xai hoy), atenuado si soporta pero está excluido/cooldown (`openai`, sin crédito). Es **surface only** — el loop realtime (mint + WebRTC/WS) queda como fase 2, a pedido.

**Verificado en vivo:** health → `xai`,`gemini` verde/habilitados; `anthropic`,`openai` gris (excluidos, aunque tengan key); `POST /api/voice/model` persiste; `POST /api/voice/upload` guarda con 0600; turno real con adjunto → Grok respondió *"Recibí prueba.txt en este turno"* (sesión `vs-20261012-a6405ec2` sobrevivió al reinicio → persistencia OK).

**Notas:** la UI del dock se refresca con `Cmd+Shift+R` (servido `Cache-Control: no-cache`); cambios de servidor requieren restart con `bash scripts/run-desk.sh`. Limpieza: revisar `~/.ialfred/uploads/voice/` (crecerá con adjuntos). Blockers LLM siguen igual (anthropic 401, openai 429 — ver runbook de keys).

---

## Adenda 2 — 2026-10-12 🎧 Voz en vivo REAL + 🤖 Modo agente (OpenCode: terminal + skills)

**Status: DONE y live** en el desk `:8787` (parche `voice-chat-upgrades-20261012-1000.patch`; backups `.bak-20261012-0848` siguen siendo el punto de revert).

### Track A — 🎧 Voz en vivo (realtime S2S Grok) + botón
Pedido: *"vivo real, y botón para poder tener la charla"*.
- `scripts/voice-realtime.js` **(nuevo)** — módulo vanilla del navegador: WebSocket `wss://api.x.ai/v1/realtime?model=grok-voice-latest` con subprotocolo `xai-client-secret.<token>`, mic por `scriptProcessor` → PCM16 @24 kHz (`input_audio_buffer.append`), `server_vad` (`session.update`), playback de `response.output_audio.delta` con barge-in. Puerto fiel de calculadora-bmc (`grokRealtimeTransport.js` + `useVoiceSession.js`).
- `enviar-desk.mjs`: `POST /api/voice/realtime` → mintea token efímero (`POST https://api.x.ai/v1/realtime/client_secrets` con `XAI_API_KEY`, `expires_after 300s`), devuelve `{wsUrl, token, model, voice:'eve', languageHint:'es', instructions}`; sirve `/voice-realtime.js` (VOICE_STATIC).
- `voice-dock.js`: botón **🎧** en la fila central → arranca/corta la llamada; **verde parpadeante** mientras está en vivo; barra de estado con transcripción en vivo (usuario/respuesta); gated por modelo (sólo si el modelo seleccionado `liveVoiceAvailable` — Grok hoy; si no, atenuado + toast).
- **Verificado en vivo:** mint real xAI `http=200` (token 114 chars), módulo servido, health ok. El audio hay que probarlo en el navegador (requiere permiso de micrófono → click del usuario; `Cmd+Shift+R`).

### Track B — 🤖 Modo agente: IAlfred conectado a OpenCode (terminal + TODAS las skills)
Pedido: *"IAlfred conectado directamente a un modelo que tenga acceso a la terminal y a todas las skills que tienes tú y el equipo"*.
- Backend elegido por Matías: **OpenCode v2** (este harness). Seguridad: **HITL en destructivos**.
- `~/.ialfred/agent/opencode.jsonc` **(nuevo, fuera del repo)** — config aislada del agente: `model: opencode/big-pickle`, `skills: [~/bmc-ialfred-skills-pack/skills, ~/.claude/skills]` (TODAS las skills), `permission.bash` con `"*": "allow"` + **denylist** (rm -rf/-fr/-Rf, sudo, kill/pkill, launchctl, osascript, git push/reset --hard/clean -fd/branch -D, npm publish, vercel, gcloud, terraform, docker rm, psql, sqlite3, doppler secrets, curl|sh, chmod -R, chown, dd, mkfs, shutdown, etc.).
- `enviar-desk.mjs`: `POST /api/voice/agent` → spawn `opencode run --standalone --format json -m <model> <prompt>` con `OPENCODE_CONFIG` propio, cwd `$HOME`, timeout 240 s; parsea NDJSON → `{reply, tools[], ms}`. Ruta absoluta del binario (`~/.opencode/bin/opencode`) — **crítico**: `run-desk.sh` fija `PATH` sin `~/.opencode/bin` y `opencode` resolvía a otro bin.
- `voice-dock.js`: toggle **🤖** (persistido en localStorage) → los turnos del chat van a `/api/voice/agent` en vez del copilot; chips de tools (`«shell» ✓`), estado "trabajando", continuidad inyectando los últimos 8 turnos en el prompt.
- **Recetas duras descubiertas (validado con pruebas reales):**
  - `--standalone` OBLIGATORIO: el background service ignora `OPENCODE_CONFIG` y usa su config global (modelo deprecado `exo-free` → 410).
  - **NO** usar `--session <id custom>`: dispara el gate del free tier ("sólo desde dentro de OpenCode", 403). La continuidad se logra por contexto en el prompt (ya implementado).
  - Free tier `opencode/big-pickle` funciona con `--standalone` + `-m` explícito.
- **Verificado en vivo por el desk:** pedido simple → `ok` (4,4 s); `ls -la` vía bash → reply + chips `[{tool:shell, ok:true}]` (5,9 s); intento `rm -rf` → agente inspeccionó y **se negó**, `keep.txt` intacto (15 s) ✓.

### Para probar (usuario)
1. `Cmd+Shift+R` en las 3 apps → ver botones 🎧 y 🤖.
2. 🎧: elegir modelo Grok (verde) → click en 🎧 → hablar; ⏹ corta.
3. 🤖: click en 🤖 (azul) → escribir "listá los archivos de X" o "usa la skill ship para…" → respuesta con chips de tools.

### Blockers que quedan (sin cambios)
- Credenciales HITL: `ANTHROPIC_API_KEY` 401, OpenAI 429 sin crédito, Gemini cuota 429 (cooldown 360′).
- OpenAI realtime (WebRTC) existe en el motor pero sin crédito → hoy sólo Grok WS tiene voz en vivo utilizable.

---

## Adenda 3 — 2026-10-12 ⌨️ Terminal de OpenCode EN el dock (sesión persistente)

**Status: DONE y live** en el desk `:8787` (parche `voice-terminal-dock-20261012-1040.patch`; revert: copiar `scripts/*.bak-20261012-1040` encima).

Pedido: *"quiero que en el dock… tenga acceso a ejecutar una terminal con opencode donde pueda hacer todo tipo de modificaciones y ediciones utilizando skills de IAlfred y todo el equipo."*

El 🤖 de la Adenda 2 hacía **un** `opencode run` por mensaje (sin memoria de sesión). La Adenda 3 agrega una **terminal real**: un server OpenCode v2 propio, con **una sesión persistente** que recuerda el contexto entre turnos, todas las skills y la misma denylist; edita y corre cosas de verdad.

### Cómo quedó
- **Desk** (`enviar-desk.mjs`): gestor del server + 3 rutas.
  - Levanta `opencode serve --port 4098` (config del agente, aislada) **bajo demanda**, parsea el `server password` del log y usa **Basic auth** `opencode:<pw>`. Reusa el serve entre reinicios del desk vía `~/.ialfred/agent/oc-proc.json` (pid+puerto+password, 0600) → si sigue vivo y responde, no lo re-mata.
  - Sesión: `~/.ialfred/agent/oc-session.json` (0600) guarda el `sessionId`; se crea con `POST /api/session {model:{id:"big-pickle",providerID:"opencode"}}`.
  - `POST /api/voice/terminal` `{text}` → `POST /api/session/{id}/prompt {text}` + **poll** `GET /api/session/{id}/message` hasta `type:"idle"` → `{ok, reply, tools[], ms, sessionId}`. Tools parseadas del part `{type:"tool", name, state:{status,input}}` → chip `{tool, ok, status, brief}` (ej. `shell · completed · "echo hola"`).
  - `POST /api/voice/terminal/reset` → sesión nueva (contexto limpio).
  - `GET /api/voice/terminal/url` → `http://opencode:<pw>@127.0.0.1:4098/app` (**web UI de OpenCode** = terminal completo). Guard: `voiceOriginAllowed` (sólo orígenes locales; un `Origin` ajeno → **403**) porque expone credenciales.
  - Al salir del desk mata sólo el serve que él levantó (no el reutilizado).
- **Dock** (`voice-dock.js`): 4º mini **⌨️** → vista `terminal` (monoespaciada, `$` en los turnos), barra con **↗ web** (abre el terminal completo) y **⟲ nueva** (reset). En vista terminal, el input manda a `/api/voice/terminal`; el 💬/⚙︎ no interfieren. Turnos marcados `term:true`.

### Verificado en vivo (por el desk, no simulado)
- Serve v2 `2.0.26` levantado en 4098; `/api/info` ok con Basic; `capabilities.persistentPty:true`.
- Turno simple: `"Respondé sólo con la palabra: listo"` → `ok` **3,5 s**.
- **Memoria de sesión:** "Recordá el código 7717" → "¿Cuál es el código?" → **`7717`** ✓ (y **sobrevivió al reinicio del desk**: el serve se reutilizó por pid/password).
- **Edición real:** "Creá `/tmp/ialfred-terminal-test.txt` con `hola-terminal-ialfred`" → archivo **creado en disco** + al leerlo desde la sesión devolvió su contenido ✓.
- **Tool chips:** correr `echo hola-desde-bash` → `tools=[(shell, True, completed, "echo hola-desde-bash")]` ✓.
- **Reset:** nueva sesión distinta; al preguntar el código → `no-lo-se` ✓ (contexto limpio).
- Guard de origin (403) y permisos `0600` de los archivos de estado ✓. Tests `npm run test:voice` **54/54**; `node --check` OK en ambos archivos.

### Fix (rev 10:55) — falso timeout + serialización
Al probarlo en vivo se detectó que turnos con **muchos pasos de herramientas** (p. ej. contar skills → 20 mensajes: 17 assistant) quedaban **fuera de la ventana** de `GET /message?limit=10`: el prompt no aparecía → el desk seguía esperando hasta el timeout de 240 s y devolvía **"la terminal tardó más de 240s"** aunque el turno ya había terminado.
- **Fin de turno robusto:** ya no se busca el prompt; se espera un **`type:"idle"` con `time.created` mayor que el del prompt** y se recolectan sólo los assistant de ese turno (`limit=60`). La respuesta es el **último** mensaje con texto (respuesta final limpia, sin la narración intermedia).
- **Serialización:** `withOcTurnLock` encadena los turnos (una sola sesión compartida por las 3 apps) → dos clientes no se pisan ni se mezclan las respuestas (aplicado también al `reset`).
- **Verificado:** el mismo pedido "contá skills" → **5,5 s** (antes: timeout); dos pedidos en paralelo → `AAA`/`BBB` limpios, serializados en el log.

### Para probar (usuario)
1. `Cmd+Shift+R` en las 3 apps.
2. Click en **⌨️** → escribir p. ej. *"creá el archivo ~/notas-hoy.md con un resumen de mis pendientes y mostrámelo"* o *"usá la skill nxt y decime el top-3"*.
3. **↗ web** abre el terminal OpenCode completo (editor + todo) en otra pestaña.
4. **⟲ nueva** limpia el contexto si la sesión se ensució.

### Notas / límites
- El serve de OpenCode sigue vivo aunque se cierre el desk (por diseño: se reutiliza). Si molesta, `pkill -f 'opencode serve --port 4098'` y borrar `~/.ialfred/agent/oc-proc.json`.
- Puerto configurable con `BMC_AGENT_SRV_PORT` (default 4098; si está ocupado, prueba 4099–4103).
- La denylist del agente sigue vigente (HITL en destructivos); la terminal no la esquiva.

