# Inventario: BMC_SYSTEM_GUIDE (backup) vs Calculadora-BMC actual

**Propósito:** Contraste entre la guía archivada `BMC_SYSTEM_GUIDE.md` (backup octubre 2025, repo `master-knowledge-analysis`) y el estado verificado del repo **Calculadora-BMC** a abril 2026. Sirve para evitar confusiones de stack, rutas y datos.

**Fuente backup (local del operador):**  
`~/Documents/GitHub/master-knowledge-analysis/backups/backup_20251025_031420/sistema_cotizaciones/BMC_SYSTEM_GUIDE.md`

**No** se reproducen en este documento IDs de planillas, claves API ni claves privadas que aparezcan en el backup.

---

## 1. Tabla de diferencias (alto nivel)

| Dimensión | Guía backup (oct-2025) | Calculadora-BMC actual (verificado) |
|-----------|------------------------|-------------------------------------|
| App web / dev | Next.js, `npm run dev`, `localhost:3000` | **Vite** (`npm run dev`, típico **5173**) + **Express** (`server/index.js`, típico **3001**) — ver `package.json` |
| API base | Rutas bajo `/api/...` en app Next implícita | **Express** monta `/calc`, `/api/*`, `/auth/ml/*`, `/ml/*`, `/webhooks/*`, `/health`, etc. — ver `server/index.js` |
| Persistencia cotizaciones / CRM | **MongoDB Atlas** (colecciones `quotes`, `sessions`, `context`, `products`, `analytics`) | **Google Sheets** como fuente principal del dashboard Finanzas/Operaciones (`server/routes/bmcDashboard.js`). **PostgreSQL** (`pg` en dependencias) para módulo transportista, no como store principal de cotizaciones del backup |
| MongoDB en este repo | Asumido en la guía | **No** hay dependencia `mongodb` / `mongoose` ni variables `MONGODB_URI` en el árbol típico del proyecto (búsqueda en código) |
| Google / Sheets | `GOOGLE_SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` en `.env` | **`GOOGLE_APPLICATION_CREDENTIALS`** → JSON de service account; IDs tipo `BMC_SHEET_ID`, `WOLFB_*`, `BMC_MATRIZ_SHEET_ID`, etc. — ver `.env.example` |
| Sincronización / snapshots Sheets | `GET/POST /api/sheets/sync` con acciones `add_quote`, `move_to_enviados` | Lectura/escritura vía **router bmcDashboard** (`/api/cotizaciones`, `/api/marcar-entregado`, …) según [ENDPOINTS.md](./ENDPOINTS.md). Snapshots locales para agentes: **`npm run sheets:sync`** → [scripts/accessible-base-sync.js](../../scripts/accessible-base-sync.js) → `.accessible-base/*.json` (el script menciona un `POST /api/accessible-base/sync` como disparador posible; **no** aparece montado en `server/` en una búsqueda rápida — tratar como intención / doc del script) |
| Chat / IA | `POST /api/chat` con cuerpo `{ message, sessionId, userPhone }` | **`POST /api/agent/chat`** — SSE, Panelin, estado de calculadora — ver cabecera de [server/routes/agentChat.js](../../server/routes/agentChat.js) |
| WhatsApp | Webhook `POST /api/whatsapp/webhook` (ejemplo en guía) | **`POST /webhooks/whatsapp`** (body raw para firma) en `server/index.js` + utilidades outbound |
| Mercado Libre / Shopify | No detallados en la guía | Rutas dedicadas en `server/index.js` y routers (`mercadoLibreClient`, `shopify`) — ver [service-map.md](./service-map.md) |
| Dashboard UI | Pestañas genéricas (Cotizaciones, Context, Live Chat, Analytics, Settings) | Dashboard **Finanzas/Operaciones** servido desde API (`/finanzas`, puerto 3849 en flujo `sheets-api-server` documentado en service-map) + mapas [DASHBOARD-INTERFACE-MAP.md](./DASHBOARD-INTERFACE-MAP.md) |
| Despliegue | Vercel (guía) | **Vercel** (frontend calculadora) + **Cloud Run** (`panelin-calc`) documentado en service-map y scripts de deploy |

---

## 2. Mapeo conceptual útil del backup (qué reutilizar como idea)

Estas partes del backup pueden seguir siendo **especificación de negocio** o glosario, aunque la implementación haya cambiado:

- **Catálogo de productos** (Isodec, Isoroof, Isopanel, chapas, etc.) — alinear con `constants` / MATRIZ en la calculadora actual.
- **Servicios** (instalación, flete, accesorios) — siguen siendo conceptos válidos en cotización.
- **Zonas de flete** (`ZONAS_FLETE` en la guía) — referencia de reglas; la implementación numérica vive hoy en código/planilla, no en Mongo del backup.
- **Modelo `ParsedQuote` / parsing IA** — útil como checklist de campos a extraer de consultas; el pipeline real hoy pasa por calculadora + agente (`agentChat`, validadores de quote).

Tratar como **obsoleto respecto de este repo** la descripción de **Mongo como fuente de cotizaciones**, los endpoints exactos `/api/sheets/sync` y `/api/chat`, y el arranque único en puerto 3000.

---

## 3. Seguridad y higiene documental

- El backup puede contener **identificadores de planillas u otros secretos en texto plano**. No copiarlos a repos públicos ni a issues.
- Para operar: usar **`.env.example`** y variables actuales del proyecto; rotar credenciales si alguna clave apareció en documentación antigua compartida.

---

## 4. Conclusión

- El **BMC_SYSTEM_GUIDE.md del backup** describe un **sistema distinto** (Next + Mongo + contrato de API antiguo) respecto de **Calculadora-BMC** actual (Vite + Express + Sheets + ML/Shopify/WhatsApp).
- La **fuente de verdad** operativa es este repositorio, [ENDPOINTS.md](./ENDPOINTS.md), [service-map.md](./service-map.md), [`docs/team/PROJECT-STATE.md`](../team/PROJECT-STATE.md) y checklists del dashboard (p. ej. [GO-LIVE-DASHBOARD-CHECKLIST.md](./GO-LIVE-DASHBOARD-CHECKLIST.md)).
- Usar el backup solo como **historia / ideas de producto**, cruzando siempre con el código y la planilla vigentes.

---

**Última actualización:** 2026-04-23 (inventario inicial automatizado + revisión de `package.json`, `ENDPOINTS.md`, `server/index.js`, `server/routes/bmcDashboard.js`, `server/routes/agentChat.js`).
