# Recorrido — Time Tracker: widget desprendible + casi-automático + AI wired

> Dossier de investigación + decisión + estado de implementación.
> Origen: pedido de Matias (08/06/2026). Plan aprobado y en ejecución sobre la
> branch `claude/traktime-jornada-gaps-pdf-et3mzy` (extiende PR #328).

## Por qué

El módulo **TraKtiMe** (`src/components/traktime/`, `server/routes/traktime.js`,
Postgres `tk_*`) funciona pero el seguimiento es **manual** (abrir pestaña →
elegir proyecto → start/stop). Tres saltos pedidos:

1. **Ventana desprendible/flotante** — mini-timer que se "despega" de la app y
   persiste en el escritorio (always-on-top), ocultable dentro del módulo.
2. **Seguimiento casi automático** — mínima fricción; la AI sugiere/autocompleta.
3. **AI cableada (wired)** — el agente **observa** el contexto y **acciona**
   todas las variables hablándole, igual o mejor que con los dashboards.

## Decisiones (con Matias)

| Eje | Decisión | Nota |
|---|---|---|
| Ventana | **Document Picture-in-Picture ahora**, Tauri después | PiP = always-on-top browser-native (Chromium); Tauri = escritorio real |
| Tracking | **"Casi-automático" asistido por AI** | Sin daemon que espíe el SO por defecto |
| Control AI | **MCP** | Actuación = MCP propio (`/api/traktime/*`); ActivityWatch = opt-in OFF |

**Tensión Q3↔Q4 reconciliada:** ActivityWatch MCP necesita un daemon de SO
(que Q3 declinó) y además **solo observa** — no puede accionar timers/entries
(eso vive en Postgres, solo se toca por `/api/traktime/*`). Por eso: la
**actuación** es un surface MCP propio; **ActivityWatch** queda opt-in y apagado
por defecto para quien quiera conciencia temporal del SO.

## Panorama OSS (qué mirar / tomar prestado)

- **ActivityWatch** (MPL-2.0, daemon + REST API; watchers ventana/AFK): motor de
  tracking pasivo más reutilizable; ya hay **MCP servers**
  (`8bitgentleman/activitywatch-mcp-server`, `Auriora/activitywatch-mcp`).
  Opción **opt-in** (privacidad de empleado → OFF por defecto).
- **Tockler** (Electron+React): referencia de watcher de ventana/idle.
- **Solidtime** (Laravel+Vue), **Super Productivity** (Angular): referencias UX SPA/PWA.
- **Timetagger / TimeTracker(DRYTRIX):** auto-tagging + timesheet asistido por LLM.
- **Ventana flotante:** **Document PiP API** (`documentPictureInPicture.requestWindow()`)
  = always-on-top, Chromium-only, se cierra al unload. **Tauri v2** = always-on-top
  nativo + tray + global shortcut, ~10MB (≪ Electron). `window.open` = multi-navegador
  pero **no** always-on-top.
- **No adoptar (stale):** ARBTT, Traggo.

## Lo que ya existía en el repo (reutilizado)

- **Detach pattern:** chat Panelin con `window.open` + flag URL — replicado en el
  fallback del timer (`?tkDetached=1`). La ventana hereda sesión vía cookie httpOnly.
- **Agente AI:** `agentTools.js` (`AGENT_TOOLS` + `executeTool`), `agentChat.js`
  (loop `tool_use` SSE + `/api/agent/exec-tool` + `tools-manifest`),
  `calcLoopbackClient.js` (patrón loopback). Auth `requireUser()` (`identityAuth.js`).

## Estado de implementación

- **Fase 0 — Dossier:** este documento. ✅
- **Fase 1 — Actuación AI:** ✅
  - `server/lib/traktimeLoopbackClient.js` (loopback con JWT del usuario).
  - 9 tools `traktime_*` en `agentTools.js` (timer current/start/stop, list/create
    entry, day/month/billable report, suggest_entry). Writes con confirmación;
    reads en `TOOLS_REQUIRING_AUTH`. `callerAuthToken` threadeado desde chat + exec-tool.
  - Test: `tests/traktime-agent-tools.test.js` (25 asserts).
- **Fase 2 — Widget desprendible (Document PiP):** ✅ prototipo
  - `src/components/traktime/Timer/FloatingTimer.jsx` (timer compacto autónomo).
  - `Timer/detach.js` (`openFloatingTimer`: Document PiP → fallback popup `?tkDetached=1`).
  - Botón "⤢ Desprender" en `Timer.jsx`; sync entre ventanas vía
    `shared/timerChannel.js` (BroadcastChannel); `TraKtiMeModule.jsx` detecta el flag.
- **Fase 3 — ActivityWatch opt-in (observación SO):** ✅ spike (OFF por defecto)
  - Config `traktimeAwEnabled` (default false) + `traktimeAwBaseUrl`.
  - `server/lib/activityWatchClient.js` (REST a `aw-server`; `getTodaySummary`
    agrega ventanas por app, día UY-local).
  - `server/routes/activity.js` (`/api/activity/status|today|buckets`, gateado por
    el flag → 404 `aw_disabled` cuando OFF; `requireUser`), montado en `index.js`.
  - Tool `traktime_activity_today` (degrada con mensaje de cómo habilitar si OFF).
  - Doc: `docs/team/traktime/ACTIVITYWATCH-OPTIN.md`. Test `tests/traktime-activity.test.js` (13 asserts).
- **Fase 4 — Tauri (escritorio):** ✅ scaffold (sin compilar acá). Wrapper Tauri v2
  en `src-tauri/` (ventana always-on-top sobre `?tkDetached=1` + system tray +
  hotkey global `Cmd/Ctrl+Shift+T`). Scripts `npm run tauri:dev|build|icon` (vía
  npx, sin nuevas deps). Doc: `docs/team/traktime/TAURI-DESKTOP-SPIKE.md`.

## Cómo se controla por AI (resumen)

El agente acciona TraKtiMe **como el usuario**: las tools reenvían el JWT del
usuario (`opts.callerAuthToken` en el chat, o `input.user_jwt` vía MCP). Sin
identidad → error claro (`traktime_requires_user_identity`), nunca un 401 silencioso.
Quedan disponibles en el chat SSE y en `/api/agent/exec-tool` + `tools-manifest`.

## Próximos pasos

1. Validar la UX del widget PiP en Chrome (manual) y el fallback popup en otros navegadores.
2. Spike Fase 3 (ActivityWatch opt-in) si Matias quiere conciencia de SO.
3. Decidir Fase 4 (Tauri) según necesidad de always-on-top fuera del navegador.
