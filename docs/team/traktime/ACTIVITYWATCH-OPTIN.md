# TraKtiMe × ActivityWatch — observación de SO opt-in (Fase 3)

> **Estado:** spike, **OFF por defecto**. Nada se instala ni se recolecta sin
> que el operador lo habilite explícitamente. Decisión del recorrido
> (`RECORRIDO-TIME-TRACKER.md`): tracking casi-automático sin daemon por
> defecto; ActivityWatch como opción opt-in para quien quiera conciencia
> temporal del SO.

## Qué hace

Cuando está habilitado, expone la actividad de **ActivityWatch** (apps/ventanas
por tiempo) para que el agente pueda responder *"¿en qué trabajé hoy?"* y
**proponer** entradas de TraKtiMe (el usuario confirma antes de escribir).

## Por qué es opt-in y OFF por defecto

- **Privacidad:** ActivityWatch registra la ventana/título activos del SO. Es
  dato sensible de empleado → nunca por defecto, siempre con consentimiento.
- **Topología:** `aw-server` es un **daemon local** en la máquina del operador
  (`:5600`). El proxy del backend solo lo alcanza si la API está **co-ubicada**
  con ese daemon (dev / self-host en la máquina del operador). En **Cloud Run**
  no aplica → queda deshabilitado.

## Cómo habilitarlo (local / self-host)

1. Instalar y correr **ActivityWatch** (https://activitywatch.net) en la máquina
   del operador. Verificar `http://localhost:5600`.
2. Correr la API en esa misma máquina con:
   ```bash
   TRAKTIME_AW_ENABLED=1 TRAKTIME_AW_BASE_URL=http://localhost:5600 npm run start:api
   ```
3. Verificar: `GET /api/activity/status` → `{ ok:true, enabled:true }`.
   `GET /api/activity/today` → resumen por app del día (UY-local).

Con el flag **OFF** (default), todas las rutas `/api/activity/*` (salvo
`status`) devuelven **404 `aw_disabled`** y el agente informa cómo habilitarlo.

## Superficie

- **Config** (`server/config.js`): `traktimeAwEnabled` (default false),
  `traktimeAwBaseUrl` (default `http://localhost:5600`).
- **Cliente** (`server/lib/activityWatchClient.js`): `getBuckets`,
  `getEvents`, `getTodaySummary({tz})` (agrega ventanas por app, día UY-local).
- **Rutas** (`server/routes/activity.js`, montadas en `index.js`):
  `GET /api/activity/status` · `GET /api/activity/today` · `GET /api/activity/buckets`.
  Auth `requireUser()`; `today`/`buckets` gateadas por el flag.
- **Agente:** tool `traktime_activity_today` (en `TOOLS_REQUIRING_AUTH`) — vía
  loopback con el JWT del usuario; si está OFF, devuelve un mensaje con cómo
  habilitar.

## Alternativa cliente-side (sin tocar nuestro backend)

Para no co-ubicar nada, el operador puede conectar un **ActivityWatch MCP
server** (p. ej. `8bitgentleman/activitywatch-mcp-server`) directamente a su
cliente Claude/agente local. Esa vía da conciencia temporal del SO sin pasar
por la API de BMC. Nuestra tool `traktime_activity_today` cubre el caso
co-ubicado; el MCP externo cubre el caso 100% local.

## Pendiente / futuro

- **Fase 4 (Tauri):** un wrapper de escritorio podría embeber el watcher y el
  always-on-top, evitando depender de un daemon separado.
- Auto-categorización de ventanas → proyecto/tarea (hoy el agente propone; la
  categorización fina queda para iterar).
