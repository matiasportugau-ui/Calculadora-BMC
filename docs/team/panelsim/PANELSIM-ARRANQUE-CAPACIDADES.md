# PANELSIM — Qué queda activo al “arrancar” y qué no (informe)

**Audiencia:** Matias y agentes en Cursor.  
**Fuentes canónicas:** [`AGENT-SIMULATOR-SIM.md`](./AGENT-SIMULATOR-SIM.md) §0.1 y §5.1, [`EMAIL-WORKSPACE-SETUP.md`](./EMAIL-WORKSPACE-SETUP.md), [`AGENTS.md`](../../AGENTS.md).

---

## 1. Aclaración importante: no hay arranque mágico

**Abrir Cursor**, **abrir el workspace** o **decir “PANELSIM” en el chat** **no** enciende por sí solo:

- la API Node (`:3001`),
- la calculadora Vite (`:5173`),
- IMAP / bandeja de correo,
- Google Sheets,
- OAuth de Mercado Libre,
- MCP, ni procesos en segundo plano.

PANELSIM es un **rol de uso del repo** + **comandos que vos o el agente ejecutan**. Lo “automático” es el **procedimiento documentado** (qué correr en qué orden), no un servicio residente.

---

## 2. Qué NO queda activo automáticamente (si no corrés nada)

| Capacidad | Por qué no está “siempre on” |
|-----------|-------------------------------|
| **API local** (`/api/*`, `/calc/*`, `/ml/*`, `/health`) | Requiere `npm run start:api` (u otro script que levante el servidor). |
| **Verificación MATRIZ / precios** (`GET /api/actualizar-precios-calculadora`) | Requiere API + credenciales Google + hojas compartidas con la service account. |
| **Sheets / credenciales** | Requiere `npm run panelsim:env` (y `.env` + `GOOGLE_APPLICATION_CREDENTIALS` válidos). |
| **Correo IMAP + reporte** | Requiere `npm run panelsim:email-ready` o `panelsim-update` en el repo de correo + `.env` de ese repo. |
| **Mercado Libre** (preguntas, respuestas) | Requiere API + OAuth (`/auth/ml/start` si no hay token). |
| **Shopify** | Flujo documentado aparte; no arranca solo. |
| **MCP** (`npm run mcp:panelin`) | Requiere API corriendo y configuración; proceso manual. |
| **Vite / UI calculadora** | Requiere `npm run dev` o `dev:full`. |
| **Datos “frescos” en disco** | Snapshots y `PANELSIM-ULTIMO-REPORTE.md` solo se actualizan cuando corrés sync de correo. |

---

## 3. Qué SÍ podés considerar “listo” sin servidores (solo archivos)

| Qué | Detalle |
|-----|--------|
| **Código y docs del repo** | Siempre disponibles para leer (skills, `PROJECT-STATE`, mappers, etc.). |
| **Último reporte de correo generado** | Solo si **ya** ejecutaste antes `panelsim-update` / `panelsim:email-ready`: entonces existen `data/reports/PANELSIM-ULTIMO-REPORTE.md` y snapshot en el repo de correo (rutas locales; carpeta `data/` suele estar en `.gitignore`). |
| **Variables en `.env` (Calculadora-BMC)** | Cargadas cuando **corren scripts** que las leen; Cursor no exporta tu `.env` al chat automáticamente. |

---

## 4. Proceso estándar al invocar PANELSIM (cuando vas a cotizar / MATRIZ / `/api/*`)

Según **§5.1** de [`AGENT-SIMULATOR-SIM.md`](./AGENT-SIMULATOR-SIM.md):

| Paso | Comando (raíz Calculadora-BMC) | Qué deja preparado |
|------|--------------------------------|---------------------|
| 1 | `npm run panelsim:env` | Chequeo de `.env`, service account, IDs `BMC_*` (incluye MATRIZ por default en config si no definís ID), recordatorio de compartir planillas en Drive. |
| 2 | `npm run start:api` | API escuchando (típ. **:3001**): rutas `/api/*`, `/calc/*`, ML proxy, etc., según lo montado en `server/`. |
| 3 | Lectura | `SESSION-WORKSPACE-CRM.md`, `PROJECT-STATE.md`; si aplica, informe Sheets y estado ML (§0.1). |

**Excepción:** sesión **solo correo IMAP** → no es obligatorio 1–2 para planillas; seguí la skill **panelsim-email-inbox** y `npm run panelsim:email-ready` (o equivalente en el repo de correo).

---

## 5. Capa “correo” (bandeja multi-cuenta)

| Acción | Comando típico | Qué queda activo / actualizado |
|--------|----------------|----------------------------------|
| Sync + reporte PANELSIM desde BMC | `npm run panelsim:email-ready` | IMAP fetch + clasificación + `PANELSIM-ULTIMO-REPORTE.md` + `PANELSIM-STATUS.json` + snapshot en repo hermano. |
| Ventana de días | `npm run panelsim:email-ready -- --days 7` | Igual, con override de días. |
| Solo regenerar MD desde snapshot | En repo correo: `npm run report` | Markdown nuevo; no baja IMAP otra vez. |

**No activa:** API de Calculadora-BMC, Sheets, ni ML.

---

## 6. Capa “frontend + API” (desarrollo local)

| Comando | Qué levanta |
|---------|-------------|
| `npm run start:api` | Solo API (Node). |
| `npm run dev` | Vite (calculadora), sin API salvo que la abras aparte. |
| `npm run dev:full` | API + Vite en paralelo (ver `package.json`). |

Hasta que no haya proceso escuchando, **no** hay URLs locales “activas”.

---

## 7. Capa Mercado Libre

| Requisito | Notas |
|-----------|--------|
| API arriba | `start:api` o equivalente. |
| OAuth | Si `GET /auth/ml/status` indica sin token → flujo `/auth/ml/start` (navegador / ngrok según doc ML). |

No se activa solo al abrir el IDE.

---

## 8. Resumen en una tabla: “¿queda activo sin hacer nada?”

| Componente | ¿Automático al abrir Cursor? |
|--------------|------------------------------|
| Lectura de docs en el repo | Sí (manual: abrís archivos). |
| API :3001 | **No** |
| Vite :5173 | **No** |
| Correo / IMAP / último reporte en disco | **No** (salvo que ya hayas corrido sync antes; los archivos siguen ahí). |
| `panelsim:env` | **No** |
| OAuth ML | **No** |
| MCP | **No** |

---

## 9. Sesión “lo más completa posible” (orden práctico)

**Un solo comando (recomendado):** `npm run panelsim:session` — encadena planillas (`panelsim:env`), correo (`panelsim:email-ready`), intento de API en background si no responde, y genera **`docs/team/panelsim/reports/PANELSIM-SESSION-STATUS-*.md`** con estado por área. Ver flags en `AGENTS.md` y `scripts/panelsim-full-session.sh`.

**Equivalente manual:**

1. `npm run panelsim:env` — planillas / MATRIZ / credenciales.  
2. `npm run start:api` — HTTP local.  
3. Si necesitás bandeja actualizada: `npm run panelsim:email-ready`.  
4. Si necesitás ML: verificar OAuth y usar rutas `/ml/*` con la API arriba.  
5. Si necesitás UI calculadora: `npm run dev` o `dev:full`.

Ajustá según el objetivo del chat (solo correo → `panelsim:session -- --skip-sheets` o solo paso 3 manual).

---

*Última revisión alineada a AGENT-SIMULATOR-SIM §5.1 y EMAIL-WORKSPACE-SETUP.*
