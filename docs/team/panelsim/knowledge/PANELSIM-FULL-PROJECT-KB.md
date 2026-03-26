# PANELSIM — Knowledge base (full project index)

**Propósito:** Complementar [`AGENT-SIMULATOR-SIM.md`](../AGENT-SIMULATOR-SIM.md) con una **vista única** de dominios, roles, rutas de código, documentación canónica y superficies que PANELSIM puede usar. No sustituye los documentos enlazados; es el **mapa de navegación** para no perder alcance.

**Audiencia:** Cualquier chat en modo SIM / PANELSIM; revisores SIM-REV; MATPROMT al armar bundles “objetivo SIM”.

**Última revisión:** 2026-03-26 (diálogo + biblioteca técnica productos — `PANELSIM-DIALOGUE-AND-CRITERIA.md`, `biblioteca-tecnica-productos/README.md`, `AGENT-SIMULATOR-SIM.md` §0.2).

---

## 1. Relación con otros documentos

| Documento | Rol |
|-----------|-----|
| [`AGENT-SIMULATOR-SIM.md`](../AGENT-SIMULATOR-SIM.md) | **Canónico:** identidad PANELSIM, límites, matriz de conexiones, SIM-REV, invocaciones. |
| Este archivo (`PANELSIM-FULL-PROJECT-KB.md`) | **Índice exhaustivo** de áreas, equipo §2, API, scripts y hubs de docs. |
| [`SIM.md`](./SIM.md) | **Atajo:** punteros al canónico + este KB; sin duplicar §0. |
| [`PROJECT-TEAM-FULL-COVERAGE.md`](../../PROJECT-TEAM-FULL-COVERAGE.md) | Tabla canónica de roles §2, propagación §4, áreas §1. |
| [`PROJECT-STATE.md`](../../PROJECT-STATE.md) | Estado vivo, pendientes, cambios recientes. |
| [`SESSION-WORKSPACE-CRM.md`](../../SESSION-WORKSPACE-CRM.md) | Foco de sesión, auto-start §5. |
| [`PANELSIM-DIALOGUE-AND-CRITERIA.md`](./PANELSIM-DIALOGUE-AND-CRITERIA.md) | **Destilado GPT → repo:** tono, datos antes de cotizar, guardrails, mapeo a MATRIZ/API (no JSON GPT como precio). |
| [`../biblioteca-tecnica-productos/README.md`](../biblioteca-tecnica-productos/README.md) | **Índice** material técnico-comercial (flyers/fichas); ruta canónica a assets bajo `PDF Productos /`. |

**Orden de lectura sugerido (primer arranque):** `AGENT-SIMULATOR-SIM.md` §0–§2 → `SESSION-WORKSPACE-CRM.md` §5 → `PROJECT-STATE.md` → **este KB** (búsqueda por tema) → hub Sheets si hay que citar columnas/tabs.

---

## 2. Full team run (contexto para SIM)

**Invocación:** “Invoque full team” / “Equipo completo” — ver [`INVOQUE-FULL-TEAM.md`](../INVOQUE-FULL-TEAM.md) y orquestador `.cursor/agents/bmc-dashboard-team-orchestrator.md`.

**Orden resumido:** 0 (estado + prompt + backlog + §2.2 transversales) → **0a MATPROMT** (bundle por rol) → **0b** Parallel/Serial → 1–8 (roles §2) → **5h SIM-REV** (opcional si objetivo SIM) → 6 Judge → 7 Repo Sync → 8 actualizar `PROJECT-STATE` → 9 próximos prompts + backlog.

**Objetivo SIM:** En paso 0 declarar; MATPROMT incluye “Para SIM” y **Handoff a SIM**. Plantilla tema: [`matprompt/MATPROMT-RUN-THEME-SIM-2026-03-23.md`](../matprompt/MATPROMT-RUN-THEME-SIM-2026-03-23.md).

---

## 3. Dominios del producto (áreas §1)

| Área | Qué cubre | Artefactos clave (repo) |
|------|-----------|-------------------------|
| **Sheets / planillas** | CRM, cotizaciones, pagos, metas, auditoría | [`docs/google-sheets-module/README.md`](../../../google-sheets-module/README.md), `MAPPER-PRECISO-PLANILLAS-CODIGO.md`, `SYNC-FULL-TEAM-SHEETS-ACCESS-MAP.md`, `planilla-inventory.md` |
| **Dashboard UI** | Finanzas, operaciones, KPIs, entregas, ventas, stock | `docs/bmc-dashboard-modernization/DASHBOARD-INTERFACE-MAP.md`, `dashboard/` (HTML/JS/CSS en modernization) |
| **Calculadora** | Cotizador React, BOM, PDF, WhatsApp, presupuesto libre | `src/`, `server/routes/calc.js`, `GET /capabilities` |
| **Infraestructura** | Puertos, Cloud Run, Vercel, ngrok, Netuy | `server/index.js`, `PROJECT-STATE` §Infra, skills `networks-development-agent`, `bmc-dashboard-netuy-hosting` |
| **Integraciones** | Mercado Libre, Shopify, Drive | `server/index.js` (`/ml/*`, `/auth/ml/*`, `/webhooks/*`), `server/routes/shopify.js`; **voz y reglas ML:** [`ML-RESPUESTAS-KB-BMC.md`](./ML-RESPUESTAS-KB-BMC.md); **sistema entrenamiento + corpus:** [`ML-TRAINING-SYSTEM.md`](./ML-TRAINING-SYSTEM.md) |
| **GPT / Panelin** | OpenAPI, acciones GPT, drift con Cloud | `docs/openapi-calc.yaml` (y variantes en repo), skills `panelin-gpt-cloud-system`, `openai-gpt-builder-integration` |
| **Fiscal / billing / audit** | DGI, facturación, auditorías | skills `bmc-dgi-impositivo`, `billing-error-review`, `bmc-dashboard-audit-runner`, `cloudrun-diagnostics-reporter` |
| **Equipo / proceso** | Judge, Reporter, MATPROMT, Repo Sync | `docs/team/judge/`, `docs/team/reports/`, `IMPROVEMENT-BACKLOG-BY-AGENT.md` |
| **Correo / bandeja (repo aparte)** | Multi-cuenta IMAP, sync, clasificación, reportes | Skill **`.cursor/skills/panelsim-email-inbox/`**; repo `conexion-cuentas-email-agentes-bmc`; opcional `BMC_EMAIL_INBOX_REPO` en `.env` |
| **Comercial (diálogo) y biblioteca de producto** | Tono BMC, recolección de datos, material gráfico por proveedor/línea | [`PANELSIM-DIALOGUE-AND-CRITERIA.md`](./PANELSIM-DIALOGUE-AND-CRITERIA.md), [`../biblioteca-tecnica-productos/README.md`](../biblioteca-tecnica-productos/README.md). **Precios:** solo MATRIZ/API/calculadora, no desde PNG/JPG sin validación. |

---

## 4. Equipo §2 — qué aporta a PANELSIM (consumo vs escalado)

PANELSIM **consume** documentación y APIs que otros roles mantienen; **no** reemplaza implementación. Referencia completa: [`PROJECT-TEAM-FULL-COVERAGE.md`](../../PROJECT-TEAM-FULL-COVERAGE.md) §2.

| Rol | Lo que SIM usa típicamente | Escalar a otro rol si… |
|-----|---------------------------|-------------------------|
| **Mapping** | Inventario tabs/columnas, coherencia UI–planilla | Cambio estructural de sheet o drift mapper |
| **Design** | Estados loading/error, jerarquía dashboard | Rediseño de sección |
| **Sheets Structure** | — (Matias; skill reservada) | Tabs/validaciones nuevas |
| **Networks** | URLs prod, CORS, redirects OAuth | Cambio de host o certificados |
| **Dependencies** | `service-map`, grafo de servicios | Nuevo servicio o dependencia |
| **Integrations** | ML, Shopify, webhooks | Nueva integración o bug OAuth |
| **GPT/Cloud** | OpenAPI alineado a `/calc` | Drift GPT vs runtime |
| **Fiscal / Billing** | Reglas fiscales, revisión CSV facturación | Análisis impositivo o cierre |
| **Audit/Debug** | Informes de auditoría, logs | Incidente producción |
| **Reporter** | Planes e informes Solution/Coding | Priorización de roadmap |
| **Orchestrator / MATPROMT** | Orden de run, bundles | Coordinar full team |
| **Contract** | Contrato API vs `planilla-inventory` | Cambio de respuesta `/api` o `/calc` |
| **Calc** | Motor cotización, PDF, constantes | Lógica de precio o escenario |
| **Security** | `.env`, tokens, CORS | Hardening o leak |
| **Judge** | Calidad de proceso | Post–full team |
| **Parallel/Serial** | Plan paralelo/serie | Optimizar run |
| **Repo Sync** | Espejo dashboard/equipo | Sync a otros repos |
| **SIM** | Este KB + `AGENT-SIMULATOR-SIM.md` | — |
| **SIM-REV** | Backlog vs trabajo hecho | Post-bloque SIM |

---

## 5. Skills en `.cursor/skills/` (inventario orientativo)

Los nombres coinciden con la columna Skill en §2 cuando aplica. Paths relativos al repo: `.cursor/skills/<nombre>/SKILL.md`.

**Uso para PANELSIM:** No hace falta leer todos; sí saber que existen **panelsim-email-inbox** (correo multi-cuenta IMAP; repo hermano), **actualizar-precios-calculadora**, **bmc-calculadora-specialist**, **google-sheets-mapping-agent**, **bmc-planilla-dashboard-mapper**, **bmc-api-contract-validator**, **shopify-integration-v4**, **bmc-dashboard-one-click-setup**, **super-agente-bmc-dashboard**, **bmc-project-team-sync**, **matprompt**, **panelin-gpt-cloud-system**, **networks-development-agent**, **bmc-dgi-impositivo**, **billing-error-review**, etc.

**Regla:** Si el usuario pide una capacidad nombrada en un skill, abrir ese `SKILL.md` y seguirlo.

---

## 6. Estructura del repositorio (alto nivel)

| Ruta | Contenido |
|------|-----------|
| `server/` | `index.js` (Express), `routes/calc.js`, `routes/bmcDashboard.js`, `routes/shopify.js`, `config.js`, manifests |
| `src/` | Calculadora React (Vite), componentes, `constants`, utilidades |
| `tests/validation.js` | Tests unitarios sin servidor |
| `scripts/` | Validación contratos, MCP, utilidades deploy/Sheets |
| `docs/` | Hub equipo, google-sheets-module, bmc-dashboard-modernization, openapi, team/reports |
| `.cursor/agents/` | Orquestador, sim-reviewer, etc. |
| `.cursor/skills/` | Skills por rol |

---

## 7. Superficie HTTP del servidor (base típica `http://localhost:3001`)

PANELSIM opera con API levantada (`npm run start:api`). Resumen:

| Prefijo / ruta | Uso |
|----------------|-----|
| `GET /capabilities` | Manifiesto para agentes (calc + dashboard + punteros) |
| `GET /health` | `ok`, tokens ML, credenciales Sheets |
| `GET /auth/ml/start`, `GET /auth/ml/callback`, `GET /auth/ml/status` | OAuth Mercado Libre |
| `GET /ml/users/me`, `GET /ml/users/:id` | Perfil vendedor / nickname comprador |
| `GET /ml/questions`, `GET /ml/questions/:id`, `POST /ml/questions/:id/answer` | Preguntas/respuestas ML (**modo aprobación** antes de POST). Guía de estilo y checklist: [`ML-RESPUESTAS-KB-BMC.md`](./ML-RESPUESTAS-KB-BMC.md) |
| `GET /ml/items/:id`, `PATCH /ml/items/:id`, `POST /ml/items/:id/description` | Ítem ML — detalle, actualizar, descripción (fallback PUT automático si ya existe) |
| `GET /ml/listings` | Publicaciones del vendedor (`?status=active\|inactive`, `?limit`, `?offset`) |
| `GET /ml/orders`, `GET /ml/orders/:id` | Órdenes ML |
| `POST /webhooks/ml`, `GET /webhooks/ml/events` | Webhooks ML (dev/diagnóstico) |
| `/calc/*` | Cotización, PDF, `gpt-entry-point`, catálogo — ver `server/routes/calc.js` |
| `/api/*` | Dashboard BMC — ver `server/routes/bmcDashboard.js` |
| Shopify | Montaje vía `createShopifyRouter` — rutas bajo convención del módulo (webhooks, API interna) |
| `/finanzas` | Estáticos del dashboard modernization |
| `/calculadora` | SPA si existe `dist/` (build) |

**OAuth Mercado Libre (configuración completa):** [docs/ML-OAUTH-SETUP.md](../../../ML-OAUTH-SETUP.md) — checklist portal, `.env`, localhost/ngrok, Cloud Run, GCS, troubleshooting. Verificación: `npm run ml:verify` (con API arriba).

**ML→CRM sync (preguntas pendientes):** `node scripts/panelsim-ml-crm-sync.js` (o incluido en `npm run panelsim:session`). Inserta preguntas UNANSWERED en primeras filas vacías de CRM_Operativo; genera respuesta sugerida en col AF; escribe **AG–AK** con defaults del cockpit; compara precio ML vs Matriz (threshold=0): si difiere → Estado="Pendiente revisión precio", sin respuesta automática.

**CRM cockpit (columnas AG–AK):** arquitectura operador — link presupuesto, aprobación envío, bloqueo auto. Documento canónico: [`CRM-OPERATIVO-COCKPIT.md`](../CRM-OPERATIVO-COCKPIT.md); constantes: `server/lib/crmOperativoLayout.js`. **API (con `API_AUTH_TOKEN`):** `GET /api/crm/cockpit/row/:row`, `POST /api/crm/cockpit/quote-link`, `approval`, `mark-sent`, `send-approved` — ver tabla en el doc cockpit.

**Reglas de respuesta ML (canónicas):**
1. Verificar publicación donde llegó la pregunta (techo vs fachada vs accesorio).
2. Revisar historial del usuario en el ítem.
3. Obtener precio siempre desde `/ml/items/:id` — nunca inventar.
4. Si precio ML ≠ Matriz (cualquier diferencia) → marcar revisión manual, no responder en modo automático.
5. Respuesta condicional si faltan datos: dar info orientativa condicionada, pedir los datos faltantes.
6. Cierre siempre: **"Saludos BMC URUGUAY!"**
7. Prohibiciones: no datos de contacto, no links externos, no otras plataformas, no precios distintos al publicado.

**Semántica de error (Sheets):** `503` = Sheets no disponible; `200` + datos vacíos = sin filas; ver `AGENTS.md` raíz.

---

## 8. Comandos npm relevantes

| Comando | Cuándo |
|---------|--------|
| `npm run panelsim:session` | **Sesión PANELSIM completa:** planillas + correo + API (intenta levantar si no responde) + **ML→CRM sync** (preguntas pendientes → CRM_Operativo con respuesta sugerida col AF + verificación precio Matriz). Genera `docs/team/panelsim/reports/PANELSIM-SESSION-STATUS-*.md`. |
| `npm run panelsim:env` | **PANELSIM — entorno planillas:** verifica `.env`, `GOOGLE_APPLICATION_CREDENTIALS`, IDs `BMC_*` (incl. MATRIZ por default), correo service account para compartir workbooks en Drive; prueba opcional `GET /api/actualizar-precios-calculadora` si la API ya corre |
| `npm run env:ensure` | Crea `.env` desde `.env.example` solo si no existe |
| `npm run start:api` | API en puerto configurado (típ. 3001) |
| `npm run dev` | Vite calculadora (puerto Vite) |
| `npm run dev:full` / `dev:full-stack` | API + front según script |
| `npm test` | Validación sin servidor |
| `npm run test:contracts` | Contratos API (**requiere** API arriba) |
| `npm run lint` | Tras tocar `src/` |
| `npm run mcp:panelin` | MCP hacia API (`BMC_API_BASE` opcional) |
| `npm run team:hub` | Sirve `docs` p. ej. puerto 4710 — `WORKSPACE-CRM-HUB.html` |
| `npm run pre-deploy` | Checklist pre-deploy |
| `npm run ml:verify` | Chequeo `/health` + `/auth/ml/start?mode=json` (API arriba; ver [ML-OAUTH-SETUP.md](../../../ML-OAUTH-SETUP.md)) |
| `npm run ml:cloud-run` | Sincronizar vars ML / OAuth a Cloud Run ([ML-OAUTH-SETUP.md](../../../ML-OAUTH-SETUP.md) §6–8) |
| `npm run smoke:prod` | Smoke contra API desplegada (`BMC_API_BASE` / `SMOKE_BASE_URL`); ver `scripts/smoke-prod-api.mjs`. Sesión “seria” en prod antes de asumir despliegue sano. |

---

## 9. Documentación y hubs (no duplicar contenido)

| Necesidad | Dónde |
|-----------|--------|
| Variables 1:1 planilla ↔ código | `docs/google-sheets-module/VARIABLES-Y-MAPEO-UNO-A-UNO.md` |
| Mapa de accesos por consumidor (dashboard, API, GPT…) | `SYNC-FULL-TEAM-SHEETS-ACCESS-MAP.md` |
| UI dashboard por sección | `DASHBOARD-INTERFACE-MAP.md` |
| Capacidades agente / contrato | `GET /capabilities`, `docs/api/`, `scripts/validate-api-contracts.js` |
| Changelog producto | `docs/CHANGELOG.md` (si aplica) |
| Invocación equipo | `INVOQUE-FULL-TEAM.md`, `PROMPT-FOR-EQUIPO-COMPLETO.md` |
| OAuth / ML (`/auth/ml/*`, `/ml/*`) | [`docs/ML-OAUTH-SETUP.md`](../../../ML-OAUTH-SETUP.md), `npm run ml:verify`, `npm run ml:cloud-run` |
| Diálogo + criterios comerciales (PANELSIM) | [`PANELSIM-DIALOGUE-AND-CRITERIA.md`](./PANELSIM-DIALOGUE-AND-CRITERIA.md) |
| Biblioteca técnica de productos (índice) | [`../biblioteca-tecnica-productos/README.md`](../biblioteca-tecnica-productos/README.md) |

---

## 10. Entornos y URLs (referencia; verificar en `PROJECT-STATE`)

- **Cloud Run:** servicio `panelin-calc` — URL en estado del proyecto; rutas `/calculadora`, `/finanzas`, `/calc`, `/api` según deploy.
- **Vercel:** calculadora pública — `https://calculadora-bmc.vercel.app` (hub CRM enlaza copia para Simple Browser).
- **ngrok:** OAuth / callbacks — puerto 4040 típico para inspección.

PANELSIM debe **no hardcodear** sheet IDs ni secretos; todo desde `config` / `.env`.

---

## 11. Salidas y reportes que SIM puede generar

| Artefacto | Cuándo |
|-----------|--------|
| `docs/team/panelsim/reports/PANELSIM-SHEETS-SITUATION-YYYY-MM-DD.md` | Tras probar `/api/*` con credenciales |
| `docs/team/panelsim/reports/SIM-REV-REVIEW-YYYY-MM-DD.md` | Rol SIM-REV |
| Actualización `SESSION-WORKSPACE-CRM.md` / `PROJECT-STATE.md` | Tras pasos significativos (protocolo equipo) |
| Repo correo (opcional): `conexion-cuentas-email-agentes-bmc` — `npm run panelsim-update` → `data/reports/PANELSIM-ULTIMO-REPORTE.md` | Ver [`SIM.md`](./SIM.md) |

---

## 12. Mantenimiento de este KB

Actualizar este archivo cuando:

- Cambie la tabla §2 en `PROJECT-TEAM-FULL-COVERAGE.md` (nuevo rol o skill promovido).
- Se añadan prefijos HTTP importantes en `server/index.js` o routers.
- El hub Sheets o el mapa dashboard cambien de nombre/ruta canónica.
- Producción cambie de URL o patrón de deploy de forma estable.

**Owner lógico:** mismo protocolo que `PROJECT-STATE` (entrada en Cambios recientes al editar).

---

## 13. Referencias rápidas

- Raíz agentes: [`docs/AGENTS.md`](../../../AGENTS.md), [`docs/team/AGENTS.md`](../../AGENTS.md)
- Hub visual: [`WORKSPACE-CRM-HUB.html`](../../WORKSPACE-CRM-HUB.html)
- Revisor Cursor: `.cursor/agents/sim-reviewer-agent.md`
- OpenAPI calc: `docs/openapi-calc.yaml`
