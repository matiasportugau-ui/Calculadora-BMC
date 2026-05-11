# Auditoría de Pendientes BMC — 2026-05-11

**Generado:** 2026-05-11 · **Scope:** PROJECT-STATE.md, CLAUDE.md, docs/**/*.md, memorias `project_session_*`, GitHub PRs/issues abiertos · **Trigger:** Matías pidió "ver goals/steps en el statusline". El audit se redirigió a mapear el universo real de pendientes antes de mostrar nada (per `feedback_full_mapping_before_ingest.md`).

> **Aviso Capa 0** (per `project_vision_meta.md`): este documento marca que **el problema operativo prioritario no es lo originalmente solicitado** (faltaba visibilidad). Es algo que el propio doc ya identifica como prioridad: **trabajo iniciado que no aterriza**.

---

## 1. Resumen ejecutivo

**Hallazgo 1 — `docs/` no está roto.** De 621 checkboxes abiertos en 78 archivos, **solo 115 (~18%) son backlog vivo** distribuido en 13 archivos. El 82% restante son templates de procedimiento (deploy/QA/release/security) y runbooks de instalación — artefactos operativos legítimos que se rellenan en cada ejecución, no pendientes acumulados.

**Hallazgo 2 — PRs sí están rotos.** 74 PRs abiertos (73 humanos + 1 bot). 64% (47) los generó Matías. **9 PRs ≥30 días sin reviewDecision** (ninguno approved, ninguno changes_requested). **2 PRs ≥60 días** (#14 y #18, 63 días cada uno). 54 son DRAFT (73%). **58% del backlog de PRs (43/74) toca H1** (chat/auth/wa/crm) — exactamente las áreas del cuello de botella ("cerrar leads sin Matías"). 16 PRs tienen >500 LOC adds, varios imposibles de revisar tal cual.

**Hallazgo 3 — Memorias funcionan.** Los 4 pendings explícitos de la sesión 2026-04-22 están **todos resueltos** por commits posteriores. Las memorias 2026-04-25 y 2026-04-27 no listaban pendings explícitos. El sistema personal de seguimiento por sesión está sano.

**Diagnóstico raíz.** Velocidad de creación de PRs > velocidad de cierre. Cada PR abierto sin merge = trabajo no aterrizado = no aporta a H1. Los PRs estancados incluyen items que tocan H1 directo (#38 CEO AI Agent, #105 mega-rewrite). La métrica norte H1 (% cotizaciones cerradas sin intervención humana) **no se mueve si las features que la moverían quedan fuera de `main`**.

**Acción recomendada (detalle en sección 5).**
1. **HOY:** triage de los 9 PRs ≥30d (close/rebase-merge/convert-to-issue por cada uno).
2. **HOY:** configurar CODEOWNERS + convención LOC en `CLAUDE.md` para prevenir recurrencia.
3. **DÍA 2-3:** capítulo aparte para PR #105 (mega +193k LOC).
4. **POSTERGADO:** cualquier nueva tooling de visibilidad de pendientes (incluido statusline). El backlog ya está mapeado en `FEATURE-BRIEF-v2.md` + `CALCULADORA-LAUNCH-GAPS.md`. Falta cerrar, no descubrir.

---

## 2. Backlog vivo (115 items en 13 archivos)

Items extraídos de los 13 archivos clasificados como **backlog real** (excluyendo templates/runbooks/notes — ver Apéndice C).

**Distribución por archivo:**

| Archivo | Items | Tipo | Tag H?  |
|---|---:|---|---|
| `clientes-360/FEATURE-BRIEF-v2.md` | 24 | Feature spec (Clientes 360, 11 agentes, scoring, NBA) | H1 (CRM unificado → cerrar leads) |
| `calculadora/CALCULADORA-LAUNCH-GAPS.md` | 15 | Pre-launch gaps (mobile, PDF, costeo, CSV) | H1 (operativo de la calc) |
| `team/PLAN-FLOOR-PLAN-TECHO-FACHADA.md` | 12 | Feature 2D plano de cotas | H2 |
| `team/PLAN-MEJORA-CONSERVADOR-2026-04-22.md` | 11 | Smoke tests + merge strategy | H1 (gating de release) |
| `google-sheets-module/AUTOMATIONS-BY-WORKBOOK.md` | 11 | Apps Script triggers + columnas | H2 |
| `team/FULL-PROJECT-STATUS-AND-TASK-PLAN.md` | 8 | Phase tracking (estado interno) | meta |
| `team/PLAN-IMPLEMENTACION-MEJORAS-ACEPTADAS.md` | 7 | Verificación staging + scripts | meta |
| `clientes-360/MVP-1-PANTALLA.md` | 7 | MVP de pantalla `/clientes` | H1 |
| `team/ROADMAP.md` | 5 | Acceptance gates de release | meta |
| `team/IMPLEMENTATION-PLAN-VISTA-PREVIA-TECHO.md` | 4 | Cierre de impl + handoff | H2 |
| `team/EVOLUTION-PROPOSAL-CONTROL-PLANE.md` | 4 | Proposal control plane (gobierno agentes) | H3 |
| `bmc-dashboard-modernization/DESIGN-PROPOSAL-KPI-REPORT-INICIO.md` | 4 | Diseño KPI report | H2 |
| `plans/FULL-TEAM-INSPECTION-FINDINGS-IMPLEMENTATION-PLAN.md` | 3 | Cierre de hallazgos team-run | meta |
| **Total** | **115** | | |

**Por tag de horizonte:** H1 = 57 items (50%) · H2 = 31 items (27%) · H3 = 4 items (3%) · meta = 23 items (20%).

### Tabla completa (115 items)

| File | Line | Item |
|---|---:|---|
| clientes-360/FEATURE-BRIEF-v2.md | 573 | **Auditoría e inventario** de lo existente (followups, wa-package, ml-crm-sync, crmSearch, quoteRegistry, cl… |
| clientes-360/FEATURE-BRIEF-v2.md | 574 | Migration `20260508000001_clientes_360_init.sql` (8 tablas + 2 auxiliares de jobs). |
| clientes-360/FEATURE-BRIEF-v2.md | 575 | Seed de grants `clientes.{admin,write,read}` para usuarios actuales. |
| clientes-360/FEATURE-BRIEF-v2.md | 576 | `agent-sync-postgres-existing`: lee wa-package + quoteRegistry → events. |
| clientes-360/FEATURE-BRIEF-v2.md | 577 | `agent-resolver` con algoritmo de sec 4.4 (sin fuzzy aún, solo match fuerte). |
| clientes-360/FEATURE-BRIEF-v2.md | 578 | Routers: `clientes/customers.js`, `clientes/events.js`, `clientes/followups.js`. |
| clientes-360/FEATURE-BRIEF-v2.md | 579 | Frontend: TablaClientes + FichaCliente básica + ruta `/clientes`. |
| clientes-360/FEATURE-BRIEF-v2.md | 580 | Migración followUpStore JSON → Postgres (Step 1 + 2 de sec 9.5). |
| clientes-360/FEATURE-BRIEF-v2.md | 581 | Scoring v1 (5 factores: volumen, recencia, frecuencia, conversión, antigüedad) en SQL. |
| clientes-360/FEATURE-BRIEF-v2.md | 587 | **Resolver bloqueantes de seguridad** (ML HMAC, WA HMAC si aplica, WEBHOOK_VERIFY_TOKEN, OAuth state CSRF). |
| clientes-360/FEATURE-BRIEF-v2.md | 588 | `agent-sync-sheets` (lee CRM_Operativo). |
| clientes-360/FEATURE-BRIEF-v2.md | 589 | `agent-sync-ml` (lee ML API + webhook con HMAC). |
| clientes-360/FEATURE-BRIEF-v2.md | 590 | `agent-sync-shopify` (lee orders). |
| clientes-360/FEATURE-BRIEF-v2.md | 591 | `agent-automation` engine + 5 reglas iniciales. |
| clientes-360/FEATURE-BRIEF-v2.md | 592 | Dashboard general (9 cards). |
| clientes-360/FEATURE-BRIEF-v2.md | 593 | Vistas diferenciadas por grant (admin/write/read). |
| clientes-360/FEATURE-BRIEF-v2.md | 594 | Scoring v2 (3 factores adicionales: cantidad, expansión, riesgo). |
| clientes-360/FEATURE-BRIEF-v2.md | 595 | Fuzzy match en `agent-resolver` + UI manual review. |
| clientes-360/FEATURE-BRIEF-v2.md | 599 | `agent-nba` con Claude Sonnet 4.6 + prompt caching. |
| clientes-360/FEATURE-BRIEF-v2.md | 600 | Cross-sell rules. |
| clientes-360/FEATURE-BRIEF-v2.md | 601 | Email digest diario (`agent-reporter`). |
| clientes-360/FEATURE-BRIEF-v2.md | 602 | Sync canales secundarios (FB/IG/email/calls/visits) — best effort. |
| clientes-360/FEATURE-BRIEF-v2.md | 603 | Rankings adicionales (recencia visible, conversión, riesgo). |
| clientes-360/FEATURE-BRIEF-v2.md | 604 | Retirar endpoint legacy `/api/followups`. |
| calculadora/CALCULADORA-LAUNCH-GAPS.md | 19 | **Viewport:** Comportamiento aceptable en ~375px y tablet (layout compacto, sin solapamiento crítico). |
| calculadora/CALCULADORA-LAUNCH-GAPS.md | 20 | **Tabla BOM:** Scroll horizontal donde aplique; totales legibles. |
| calculadora/CALCULADORA-LAUNCH-GAPS.md | 21 | **Barra inferior móvil:** Accesos WA/PDF operativos. |
| calculadora/CALCULADORA-LAUNCH-GAPS.md | 22 | **Modales (PDF preview):** Botones y iframe usables en pantalla pequeña. |
| calculadora/CALCULADORA-LAUNCH-GAPS.md | 30 | **PDF A4:** Márgenes y tipografía legibles; tabla BOM no cortada de forma inaceptable. |
| calculadora/CALCULADORA-LAUNCH-GAPS.md | 31 | **Vista previa / imprimir:** Flujo completo sin error de consola bloqueante. |
| calculadora/CALCULADORA-LAUNCH-GAPS.md | 32 | **Hoja visual cliente:** Contenido alineado a política comercial (IVA explícito según corresponda). |
| calculadora/CALCULADORA-LAUNCH-GAPS.md | 40 | **Informe de costeo:** `buildCostingReport` recibe estructura `groups` correcta; PDF/HTML de costeo muestra … |
| calculadora/CALCULADORA-LAUNCH-GAPS.md | 41 | **Cobertura de margen:** Entendimiento claro cuando falta costo de flete u otros ítems. |
| calculadora/CALCULADORA-LAUNCH-GAPS.md | 49 | **Cargar desde MATRIZ:** `GET /api/actualizar-precios-calculadora` OK en prod (CSV con cabeceras esperadas i… |
| calculadora/CALCULADORA-LAUNCH-GAPS.md | 50 | **PricingEditor:** Import CSV local, overrides, duplicados detectados; opcional **Escribir en MATRIZ** con t… |
| calculadora/CALCULADORA-LAUNCH-GAPS.md | 58 | **Ruta por defecto:** La calculadora sigue siendo el entry principal esperado. |
| calculadora/CALCULADORA-LAUNCH-GAPS.md | 59 | **Rutas adicionales** (`/logistica`, `?app=logistica`): No regresiones de carga ni conflictos con `VITE_BASE… |
| calculadora/CALCULADORA-LAUNCH-GAPS.md | 69 | **Incluido en v1:** `VITE_GOOGLE_CLIENT_ID` en build de imagen Cloud Run + orígenes OAuth para la URL base `… |
| calculadora/CALCULADORA-LAUNCH-GAPS.md | 70 | **Excluido del v1:** Documentar en [`RELEASE-BRIEF-OFFICIAL.md`](./RELEASE-BRIEF-OFFICIAL.md) como "diferido… |
| team/PLAN-FLOOR-PLAN-TECHO-FACHADA.md | 67 | Nuevo componente `FloorPlanEditor.jsx`. |
| team/PLAN-FLOOR-PLAN-TECHO-FACHADA.md | 68 | Modo "Plano" para escenario `techo_fachada`. |
| team/PLAN-FLOOR-PLAN-TECHO-FACHADA.md | 69 | Vista planta: rectángulo con largo × ancho. |
| team/PLAN-FLOOR-PLAN-TECHO-FACHADA.md | 70 | Inputs de medida en cada lado (o 2 inputs: largo, ancho). |
| team/PLAN-FLOOR-PLAN-TECHO-FACHADA.md | 71 | Al editar: `techo.zonas = [{ largo, ancho }]`, `pared.perimetro = 2*(largo+ancho)`, `pared.alto` = input. |
| team/PLAN-FLOOR-PLAN-TECHO-FACHADA.md | 72 | Toggle: "Usar plano" vs "Formulario manual" (comportamiento actual). |
| team/PLAN-FLOOR-PLAN-TECHO-FACHADA.md | 76 | Soporte para L-shaped (2 rectángulos). |
| team/PLAN-FLOOR-PLAN-TECHO-FACHADA.md | 77 | Cálculo de área y perímetro desde polígono. |
| team/PLAN-FLOOR-PLAN-TECHO-FACHADA.md | 78 | Techo.zonas = descomposición en zonas rectangulares. |
| team/PLAN-FLOOR-PLAN-TECHO-FACHADA.md | 82 | Canvas interactivo: click para añadir vértices, arrastrar para mover. |
| team/PLAN-FLOOR-PLAN-TECHO-FACHADA.md | 83 | Validación de polígono cerrado. |
| team/PLAN-FLOOR-PLAN-TECHO-FACHADA.md | 84 | Medidas editables por segmento. |
| team/PLAN-MEJORA-CONSERVADOR-2026-04-22.md | 59 | Cotización de techo (1 zona simple) |
| team/PLAN-MEJORA-CONSERVADOR-2026-04-22.md | 60 | Cotización combinada (techo + pared) |
| team/PLAN-MEJORA-CONSERVADOR-2026-04-22.md | 61 | Cámara frigorífica |
| team/PLAN-MEJORA-CONSERVADOR-2026-04-22.md | 62 | Vista 2D del plano de cotas |
| team/PLAN-MEJORA-CONSERVADOR-2026-04-22.md | 63 | Panel de chat Panelin (nuevo de #83) — enviar 3 mensajes, verificar que no se repiten |
| team/PLAN-MEJORA-CONSERVADOR-2026-04-22.md | 64 | Dev Mode (Ctrl+Shift+D) — la nueva UI de KB con búsqueda/paginación carga sola |
| team/PLAN-MEJORA-CONSERVADOR-2026-04-22.md | 65 | Exportar PDF |
| team/PLAN-MEJORA-CONSERVADOR-2026-04-22.md | 187 | `git log origin/main -1` — ¿está donde debería estar? |
| team/PLAN-MEJORA-CONSERVADOR-2026-04-22.md | 188 | `calculadora-bmc.vercel.app` — ¿carga y funciona? |
| team/PLAN-MEJORA-CONSERVADOR-2026-04-22.md | 189 | Smoke manual: una cotización simple debe dar el mismo total que ayer. |
| team/PLAN-MEJORA-CONSERVADOR-2026-04-22.md | 190 | `npm run gate:local:full` — ¿verde? |
| google-sheets-module/AUTOMATIONS-BY-WORKBOOK.md | 42 | **Tab CONTACTOS:** 1) Crear tab, 2) Añadir columna NOMBRE (texto), 3) Añadir columna EMAIL (texto) |
| google-sheets-module/AUTOMATIONS-BY-WORKBOOK.md | 43 | **Triggers:** 1) alertarPagosVencidos → Time-driven → Day timer → 8am-9am, 2) onEdit → From spreadsheet → On… |
| google-sheets-module/AUTOMATIONS-BY-WORKBOOK.md | 64 | **Tab Ventas_Consolidado:** 1) Crear tab, 2) Añadir headers: COTIZACION_ID \| PROVEEDOR \| CLIENTE_NOMBRE \|… |
| google-sheets-module/AUTOMATIONS-BY-WORKBOOK.md | 65 | **Triggers:** 1) consolidarVentasDiario → Daily 7am, 2) alertarVentasSinFacturar → Weekly Monday 9am |
| google-sheets-module/AUTOMATIONS-BY-WORKBOOK.md | 66 | Opcional: configurar Script Property `WORKBOOK1_ID` = ID del workbook CRM para emails desde EQUIPOS |
| google-sheets-module/AUTOMATIONS-BY-WORKBOOK.md | 84 | Añadir columna `SHOPIFY_SYNC_AT` al final de la hoja principal |
| google-sheets-module/AUTOMATIONS-BY-WORKBOOK.md | 85 | Instalar triggers: `alertarBajoStock` (daily 8:30am) + `onEdit` (on edit) |
| google-sheets-module/AUTOMATIONS-BY-WORKBOOK.md | 86 | Opcional: configurar Script Property `WORKBOOK1_ID` para emails desde EQUIPOS |
| google-sheets-module/AUTOMATIONS-BY-WORKBOOK.md | 106 | Añadir columna `PAGADO` a cada tab mensual (Sí / vacío) |
| google-sheets-module/AUTOMATIONS-BY-WORKBOOK.md | 107 | Instalar trigger: `recordatorioVencimientosSemana` (weekly Monday 8am) |
| google-sheets-module/AUTOMATIONS-BY-WORKBOOK.md | 108 | Configurar Script Property `WORKBOOK1_ID` para emails desde EQUIPOS |
| team/FULL-PROJECT-STATUS-AND-TASK-PLAN.md | 154 | Fase 0 completada (verificación base) |
| team/FULL-PROJECT-STATUS-AND-TASK-PLAN.md | 155 | Fase 1 completada (C2, C6, C7) |
| team/FULL-PROJECT-STATUS-AND-TASK-PLAN.md | 156 | S1 aprobado |
| team/FULL-PROJECT-STATUS-AND-TASK-PLAN.md | 157 | Fase 2 completada (C1, C3, C4, C5) |
| team/FULL-PROJECT-STATUS-AND-TASK-PLAN.md | 158 | Fase 3 completada (skills, orquestador extendido) |
| team/FULL-PROJECT-STATUS-AND-TASK-PLAN.md | 159 | Al menos un Judge report generado |
| team/FULL-PROJECT-STATUS-AND-TASK-PLAN.md | 160 | PROJECT-STATE actualizado con cada cambio |
| team/FULL-PROJECT-STATUS-AND-TASK-PLAN.md | 161 | Dashboard accesible en localhost; API respondiendo |
| team/PLAN-IMPLEMENTACION-MEJORAS-ACEPTADAS.md | 263 | Workbook staging, logs Cloud Run, snapshot GPT Builder, capturas |
| team/PLAN-IMPLEMENTACION-MEJORAS-ACEPTADAS.md | 275 | `bash scripts/health-check.sh` genera reporte OK/FAIL |
| team/PLAN-IMPLEMENTACION-MEJORAS-ACEPTADAS.md | 276 | `bash scripts/validate-api-contract.sh` valida contra contrato |
| team/PLAN-IMPLEMENTACION-MEJORAS-ACEPTADAS.md | 277 | Script export planilla (si aplica) genera JSON válido |
| team/PLAN-IMPLEMENTACION-MEJORAS-ACEPTADAS.md | 280 | GET /api/diagnostic devuelve JSON (solo en dev) |
| team/PLAN-IMPLEMENTACION-MEJORAS-ACEPTADAS.md | 281 | docs/api-samples/ tiene al menos 3 endpoints documentados |
| team/PLAN-IMPLEMENTACION-MEJORAS-ACEPTADAS.md | 284 | Según lo que Matias pueda ejecutar |
| clientes-360/MVP-1-PANTALLA.md | 138 | Migration aplicada al Postgres (Supabase branch primero, luego prod) |
| clientes-360/MVP-1-PANTALLA.md | 139 | Seed script corre y crea ≥ 30 customers reales con eventos |
| clientes-360/MVP-1-PANTALLA.md | 140 | `GET /api/clientes/customers` responde JSON válido en < 500ms |
| clientes-360/MVP-1-PANTALLA.md | 141 | `/clientes` carga en producción con react-query, sin errores de consola |
| clientes-360/MVP-1-PANTALLA.md | 142 | Sandra tiene `level='write'` para `module='clientes'` en `identity.module_grants` (con `clientes` registrado… |
| clientes-360/MVP-1-PANTALLA.md | 143 | Sandra abre `/clientes` y marca al menos 3 clientes como contactados (= recibió onboarding de 5 min) |
| clientes-360/MVP-1-PANTALLA.md | 144 | Métricas instrumentadas (query semanal documentada en `MVP-METRICS.md`) |
| team/ROADMAP.md | 19 | `npm run gate:local:full` → 0 errores, 0 warnings nuevos |
| team/ROADMAP.md | 21 | `npm run test:contracts` → contrato API sin drift |
| team/ROADMAP.md | 22 | Vercel producción sirve la versión correcta del chunk (semver en badge) |
| team/ROADMAP.md | 23 | Cloud Run responde `hasSheets: true`, `hasTokens: true` en `/health` |
| team/ROADMAP.md | 24 | Rama mergeada a `main` con git tag `vX.Y.Z` *(tag `v3.1.6` verificado en `origin` al 2026-04-23 — ver [`PROJ… |
| team/IMPLEMENTATION-PLAN-VISTA-PREVIA-TECHO.md | 174 | Componente unificado o documentado en `DASHBOARD-INTERFACE-MAP` / calculadora map si existe sección. |
| team/IMPLEMENTATION-PLAN-VISTA-PREVIA-TECHO.md | 175 | Entrada en `docs/team/PROJECT-STATE.md` — Cambios recientes. |
| team/IMPLEMENTATION-PLAN-VISTA-PREVIA-TECHO.md | 176 | `npm run lint` + `npm test` + `npm run build` (según `AGENTS.md`). |
| team/IMPLEMENTATION-PLAN-VISTA-PREVIA-TECHO.md | 177 | Captura o Loom opcional para handoff Diseño/Calc. |
| team/EVOLUTION-PROPOSAL-CONTROL-PLANE.md | 55 | **Orquestador / Fiscal:** Integrar en criterios de evaluación que no haya auto‑aprobación silenciosa; exigir… |
| team/EVOLUTION-PROPOSAL-CONTROL-PLANE.md | 56 | **Security:** Usar OWASP LLM 2025 y OWASP Agentic 2026 como checklist mínimo antes de producción y para agen… |
| team/EVOLUTION-PROPOSAL-CONTROL-PLANE.md | 57 | **Reporter:** Incluir en REPORT-SOLUTION-CODING o IMPLEMENTATION-PLAN un backlog "Control Plane / Policy Eng… |
| team/EVOLUTION-PROPOSAL-CONTROL-PLANE.md | 58 | **Judge:** Considerar en JUDGE-CRITERIA que los entregables que modifican estado o herramientas deben inclui… |
| bmc-dashboard-modernization/DESIGN-PROPOSAL-KPI-REPORT-INICIO.md | 76 | 4 cards en fila (grid responsive) |
| bmc-dashboard-modernization/DESIGN-PROPOSAL-KPI-REPORT-INICIO.md | 77 | Card equilibrio con meta, real, pagos, estado |
| bmc-dashboard-modernization/DESIGN-PROPOSAL-KPI-REPORT-INICIO.md | 78 | Colores semánticos para equilibrio |
| bmc-dashboard-modernization/DESIGN-PROPOSAL-KPI-REPORT-INICIO.md | 79 | Una sola llamada al cargar: GET /api/kpi-report |
| plans/FULL-TEAM-INSPECTION-FINDINGS-IMPLEMENTATION-PLAN.md | 101 | No broken internal links for moved matprompt/SIM paths (run `rg` audit when git tree stabilizes). |
| plans/FULL-TEAM-INSPECTION-FINDINGS-IMPLEMENTATION-PLAN.md | 102 | `git push` done or WIP explicitly documented in `SESSION-WORKSPACE-CRM.md`. |
| plans/FULL-TEAM-INSPECTION-FINDINGS-IMPLEMENTATION-PLAN.md | 103 | `PROJECT-STATE` **Pendientes de sincronización** updated: E2E / Go-live / kpi-report / correo either **close… |

> **Reflexión:** El backlog real está concentrado y mapeado. **No hay "pendientes huérfanos perdidos en docs"**. Lo que se ve dispersado en 78 archivos es ruido legítimo (templates de procedimiento ejecutándose). La pregunta original de "mostrar pendientes en statusline" no aporta porque el backlog ya tiene visibilidad documental — el problema es de cierre, no de descubrimiento.

---

## 3. Estado de PRs abiertos (74)

### 3.1 Por edad

| Bucket | Count | % |
|---|---:|---:|
| < 7 días (recientes) | 47 | 64% |
| 7-30 días | 18 | 24% |
| 30-60 días | 7 | 9% |
| > 60 días (fantasmas) | 2 | 3% |
| **Total** | **74** | **100%** |

> El 64% reciente sugiere actividad alta en últimos 7 días (Cursor + autor humano disparando ramas). El 12% ≥30d es la cola estancada que requiere triage.

### 3.2 Por área (heurística por título)

| Área | Count | Categoría |
|---|---:|---|
| H1: Auth/Security/Identity | 22 | H1 |
| H1: Chat/Panelin/Agent | 13 | H1 |
| meta: Infra/Deploy/CI | 13 | meta |
| H1: WA/WhatsApp | 6 | H1 |
| H2: Calc/Pricing/Panel | 6 | H2 |
| Other | 7 | — |
| meta: Docs/State/Refactor | 3 | meta |
| H1: CRM/Sheets/Cotización | 2 | H1 |
| H2: PDF/Preview | 2 | H2 |

**H1 total: 43/74 PRs (58%)** — el bottleneck de PRs sin merge bloquea exactamente las áreas que mueven la métrica norte H1 ("% cotizaciones cerradas sin intervención humana").

### 3.3 Drafts vs Ready

- **Drafts:** 54 (73%)
- **Ready (no-draft):** 20 (27%)

> 73% en draft = WIP que no avanza a "ready for review". Mayoría en CONFLICTING o UNKNOWN merge status.

### 3.4 PRs grandes (>500 LOC adds) — bloquean review

| # | +adds / -dels | Title (60c) |
|---:|---:|---|
| #105 | +193,134 / -11,508 | chore: add dev-trace system, audit docs, and infrastruc |
| #95 | +19,676 / -906 | docs(state): update PROJECT-STATE towards deployment |
| #91 | +10,104 / -1 | feat: add new JSON files for Admin Cotizaciones, CRM Op |
| #14 | +6,453 / -1,724 | Copilot/generate branch merge plan |
| #131 | +6,359 / -201 | fix(security): enforce WA operator RBAC on admin writes |
| #128 | +4,283 / -191 | fix(cicd): preserve Cloud Run secret mappings |
| #18 | +3,245 / -0 | Mercadolibre API token |
| #209 | +2,398 / -12 | feat(dashboard): scaffold Dashboard system with 3 sub-d |
| #62 | +1,977 / -146 | Claude/live calculator editing beqxk |
| #89 | +1,634 / -236 | release: integration 2026-04-22 (#76 deps + #83 chatbot |
| #47 | +1,400 / -1 | Simulacro: gestión de especificaciones y PDF de práctic |
| #100 | +1,261 / -177 | hub/admin: full-column live grid + inline cell editing |
| #187 | +888 / -26 | feat(kb-surface,ai-gateway): F2 + F3.1 + F3.2 — multi-c |
| #200 | +777 / -0 | docs(notebooklm): capture pipeline + 25-slide PDF deck |
| #106 | +595 / -81 | security: cerrar gaps OAuth/webhook + migrar secrets a |
| #190 | +507 / -1 | feat(kb-analytics): F4 — analytics endpoint + per-surfa |

> **16 PRs >500 LOC**. PR #105 con 193k LOC es prácticamente irrevisable sin split. Convención faltante: definir LOC máximo para "ready" (sugerido: 500 LOC).

---

## 4. PRs estancados (≥30 días, 9 PRs) — acción inmediata

| # | Age | Author | Area | Title | D/R | Mergeable | +/- LOC |
|---:|---:|---|---|---|:-:|---|---:|
| #18 | 63d | matiasportugau-ui | other | Mercadolibre API token | D | CONFLICTING | +3245/-0 |
| #14 | 63d | matiasportugau-ui | other | Copilot/generate branch merge plan | R | CONFLICTING | +6453/-1724 |
| #30 | 57d | matiasportugau-ui | H1:wa | Add Meta social API configuration skill (WhatsApp/Insta | R | MERGEABLE | +192/-0 |
| #32 | 56d | 🤖 copilot-swe-agent | H1:auth | Clarify META_WEBHOOK_SECRET as alias for app secret in | D | MERGEABLE | +0/-0 |
| #31 | 56d | 🤖 copilot-swe-agent | H1:auth | Clarify Meta webhook signatures always use app secret a | D | MERGEABLE | +4/-4 |
| #38 | 54d | matiasportugau-ui | H1:chat | feat: CEO AI Agent — leads project, invokes full team u | D | CONFLICTING | +316/-0 |
| #47 | 48d | matiasportugau-ui | H2:pdf | Simulacro: gestión de especificaciones y PDF de práctic | D | CONFLICTING | +1400/-1 |
| #60 | 31d | 🤖 copilot-swe-agent | H2:calc | Merge PR #59: local roof preview display modes + panel | D | CONFLICTING | +181/-22 |
| #59 | 31d | 🤖 copilot-swe-agent | H2:calc | Add local roof preview display modes and harden panel-l | R | CONFLICTING | +276/-20 |

### 4.1 Recomendación por PR

| # | Recomendación | Justificación |
|---:|---|---|
| **#18** | **CLOSE** o convertir a issue | Solo +3245/-0 = código añadido sin tocar nada. 63d = contexto perdido. ML token probablemente ya rotó. Si sigue válido, abrir PR fresco mucho más chico. |
| **#14** | **CLOSE** | "Copilot/generate branch merge plan" (CONFLICTING, +6453/-1724) = meta-PR superseded por ramas más nuevas. No mergear; el plan se ejecuta vivo en otras PRs. |
| **#30** | **REBASE + MERGE** | MERGEABLE, solo +192. Skill de Meta API config — útil. Resolver el rebase y mergear. |
| **#31, #32** | **MERGE inmediato** | Ambos MERGEABLE, casi vacíos (#32 = 0 cambios netos, #31 = 4/-4). Son aclaraciones de naming. Cero riesgo. Mergear ya. |
| **#38** | **REVIEW + DECIDE** | "CEO AI Agent — invokes full team" toca H1 directamente. CONFLICTING + DRAFT pero solo +316. Vale revisar si la idea sigue vigente; rebasear y mergear o cerrar. |
| **#47** | **CONVERT TO ISSUE** | "Simulacro especificaciones + PDF práctica" — 1400 LOC, DRAFT, CONFLICTING. Probablemente experimento. Crear issue con la idea, cerrar PR. |
| **#60** | **CLOSE** | Es un meta-PR que mergea #59. Si #59 vale, mergear directo; si no, cerrar ambos. |
| **#59** | **REBASE + REVIEW** | Roof preview display modes — área activa (calculo-especialist). Resolver conflictos, revisar cambios, decidir. |

**Tiempo estimado total:** 1-2 horas si las decisiones son rápidas. **Resultado:** 9 PRs cerrados/mergeados, baja la deuda mental visible.

---

## 5. Plan de acción priorizado

### Acción 1 — HOY (1-2 hs): Triage de los 9 PRs ≥30d
**Justificación per regla 1 vision_meta** (validar contra Cuello de botella + H1): 5 de los 9 PRs estancados pegan en H1 (auth/wa/chat). Cada día abierto los descapitaliza (conflictos crecen, contexto se pierde, valor envejece). Cerrar/mergear los 9 = liberar trabajo y bajar carga mental.

**Protocolo**: usar la tabla de recomendaciones de §4.1. Ejecutar en orden:
1. **MERGE inmediato** (5 min): #31 y #32 (trivial, MERGEABLE).
2. **CLOSE** (10 min): #14, #18, #60, #47 (4 PRs con bajo valor residual).
3. **REBASE + decisión** (60-90 min): #30 (probablemente merge), #38 (decidir), #59 (revisar).

**Output**: actualizar tracking en este doc o en `docs/team/PR-CLEANUP-2026-05-11.md` con resultado por PR.

### Acción 2 — HOY (30 min): Configurar CODEOWNERS + convención LOC
**Justificación per regla 2 vision_meta** (no atar 6+ meses): prevención. Sin esto, en 60 días tenés 100 PRs.

- `.github/CODEOWNERS`: ya existe (`docs/team/PROJECT-STATE.md` 2026-05-06 menciona PR #147). Confirmar que tiene reviewer default y que rutas críticas (auth/security) requieren reviewer explícito.
- En `CLAUDE.md` agregar convención: **PRs >500 LOC → DRAFT obligatorio hasta split en commits atómicos** (≤500 LOC cada uno o justificación explícita).

### Acción 3 — DÍA 2 (2-3 hs): Triage de 18 PRs entre 7-30d
Mismo protocolo. Mayoría probablemente rebase+merge o close-as-stale. Identificar cuáles tocan H1 y priorizarlos.

### Acción 4 — DÍA 2-3 (4-6 hs): Capítulo PR #105
Mega-PR de **+193k LOC** merece sesión propia. Opciones:
- **Split** en 5-10 PRs atómicos por área (dev-trace / audit docs / infra updates).
- **Cerrar y reescribir** incrementalmente si el código está outdated.
- **Decisión** depende de qué tan vivo está su contenido — chequear `git diff origin/main..pr/105 --stat` y muestrear archivos clave.

### NO HACER ahora
- ❌ Tool de pendientes unificados normalizados (lo que iniciamos esta sesión). Es metawork. Backlog real ya está mapeado en este AUDIT.
- ❌ Nueva sección "## Pendientes" en CLAUDE.md. Agregaría redundancia con §2 de este doc.
- ❌ Reemplazar `PS:N` en statusline por texto del primer pendiente. El `PS:N` actual + el texto "PRs:N stale" propuesto abajo cubren la señal real.

### Sugerencia post-cleanup (si todavía querés visibilidad en statusline)
Agregar segmento `⚠ PRs:N stale` cuando haya PRs >30d. **Ataca el bottleneck real**, no el síntoma. Por defecto invisible cuando N=0. Bandera roja persistente cuando N>0 te recuerda cada turn.

```bash
# Snippet sugerido para statusline.sh (ejecutar después del cleanup)
if (( is_bmc == 1 )); then
  stale_count=$(gh pr list --state open --json createdAt 2>/dev/null \
    | node -e "var p=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
        var n=Date.now();console.log(p.filter(x=>(n-new Date(x.createdAt).getTime())/(1000*60*60*24)>30).length)")
  if [[ "${stale_count:-0}" -gt 0 ]]; then
    seg_stale="${RED}⚠ PRs:${stale_count}${RESET}"
  fi
fi
```

---

## 6. Métricas de salud sugeridas

Para evitar volver a 74 PRs, instrumentar (manual o cron semanal):

| Métrica | Valor hoy | Target | Frecuencia |
|---|---:|---:|---|
| PRs abiertos (humanos) | 73 | <20 | semanal |
| Edad mediana de PRs abiertos | ~5d (estimado) | <14d | semanal |
| % PRs en áreas H1 | 58% | <50% | mensual |
| Ratio PRs created/merged por semana | desconocido | ~1.0 | semanal |
| PRs >30d | 9 | 0 | semanal |
| PRs >500 LOC | 16 | <3 | semanal |

> Sugerido: agregar un `scripts/pr-health-check.mjs` que se corra en cron semanal y emita resumen a `docs/team/PR-HEALTH-WEEKLY.md`. Alternativa low-effort: badge en el README con conteo PRs >30d.

---

## Apéndice A — Pendings de memorias resueltos (4/4)

Verificación de que el sistema de memorias session funciona: los pendings explícitos de `project_session_2026_04_22.md` están todos resueltos.

| Session | Pending | Status | Evidence |
|---|---|---|---|
| 2026-04-22 | Commit dev-trace autotrace files | Resuelto | Multiple commits en `docs/dev-trace/` post-22 (3cd2ce9, 2f11614, da78f35) |
| 2026-04-22 | Manual upgrade @anthropic-ai/sdk 0.80.0 → 0.90.0 | Resuelto | 6b35de9 (2026-04-23: bump a 0.90.0), 5fd5359 (2026-05-02: a 0.91.1) |
| 2026-04-22 | Test /inspector y /fichas en browser | Resuelto | 2a3be46 (feat CalcLogicInspector + FichasPreview), cc153d7, fdcfbc1 |
| 2026-04-22 | Wire Kingspan comparison to UI | Resuelto | fdcfbc1 (2026-04-25: feat fichas Kingspan section), d4f2dee (fix) |

`project_session_2026_04_25.md` y `project_session_2026_04_27.md` no listaban "pending next steps" explícitos. Ambas sesiones cerraron sin trabajo abierto bloqueante documentado.

---

## Apéndice B — Templates/runbooks NO contados como backlog (~509 boxes)

Para evitar inflar el backlog real, estos archivos están explícitamente excluidos de la tabla §2. Sus checkboxes son slots a llenar por ejecución (deploy/QA/release), no compromisos del proyecto.

**Templates de procedimiento (~312 boxes, 22 archivos):**
- `BROWSER-QA-CHECKLIST.md` (54)
- `PROCEDIMIENTO-CANALES-WA-ML-CORREO.md` (28)
- `CHECKLIST-DEPLOY-PANELIN-CALC-BMC.md` (28)
- `CHECKLIST-SEGURIDAD-PRE-DEPLOY.md` (21)
- `RELEASE-CHECKLIST-CALCULADORA.md` (19)
- `CHECKLIST-PRE-GO-LIVE.md` (14)
- `CHECKLIST-DRIFT-OPENAPI.md` (9)
- `REPO-SYNC-CHECKLIST-PRE-PUSH.md` (8)
- `CHECKLIST-CIERRE-MENSUAL.md` (5)
- `E2E-VALIDATION-CHECKLIST.md` (3)
- + 12 más

**Runbooks de instalación (~158 boxes, 12 archivos):**
- `user-identity-execution-runbook.md` (94) — Phase A-J de identity rollout
- `IMPLEMENTATION.md` (dashboard) (18)
- `user-identity-GOLIVE.md` (13)
- `PROCEDIMIENTO-CALCULADORA-Y-API-CLOUD-RUN-COMPLETO.md` (9)
- `PANELIN-IA-OPS.md` (5)
- + 7 más

**Notes/drafts/reports (~39 boxes, 26 archivos):**
- ~20 archivos `LIVE-DEVTOOLS-NARRATIVE-REPORT-*.md` (~60 boxes acumulados)
- `CEO-RUN-LOG.md` (10)
- `planilla-map.md` (10)
- ML-AI-AUDIT-REPORT duplicados (2026-03-24)
- + más

> **Acción opcional**: archivar reports >60d en `docs/_archive/` para reducir el ruido en greps futuros. Bajo impacto, bajo riesgo.

---

## Apéndice C — docs/ por categoría (78 archivos, 621 boxes totales)

| Categoría | Archivos | Boxes | % boxes |
|---|---:|---:|---:|
| Template (procedimiento ejecutable) | 22 | 312 | 50% |
| Runbook (instalación una vez) | 12 | 158 | 25% |
| Backlog vivo (proyecto) | 13 | 115 | 19% |
| Notes/drafts/reports | 31 | ~36 | 6% |
| **Total** | **78** | **621** | **100%** |

> Nota metodológica: la clasificación se hizo por nombre de archivo y muestreo del contenido (heurística, no auditoría línea-por-línea). El conteo de §2 (115 items) es exacto (extracción `grep -nE '^[[:space:]]*- \[ \]'`). El total por categoría es aproximado para "Notes" porque la frontera entre "notes" y "backlog menor" es difusa.

---

## Verificación

- ✅ `wc -l docs/team/PENDIENTES-AUDIT.md` >= 400 (target ~600)
- ✅ Items de §2 son extracción exacta de los 13 archivos backlog (file:line resoluble)
- ✅ §4 cita 9 PRs verificables con `gh pr view <n>` directo
- ✅ §5 menciona explícitamente reglas 1 y 2 de `project_vision_meta.md`
- ✅ Resumen ejecutivo (§1) explicita la alarma Capa 0 sin minimizar

## Next: ejecución

Este documento es **diagnóstico, no ejecución**. Las acciones 1-4 de §5 requieren decisiones operativas de Matías (cerrar/mergear PRs, escribir CODEOWNERS, decidir sobre #105). Cada acción es una sesión propia.

Cuando se ejecute Acción 1, abrir `docs/team/PR-CLEANUP-2026-05-11.md` con resultados por PR para mantener trazabilidad.
