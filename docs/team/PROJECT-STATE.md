# Project State — BMC/Panelin

**Última actualización:** 2026-03-17 (Full team run, sync, git push)

Fuente única de estado para que todos los agentes estén actualizados. Ver [PROJECT-TEAM-FULL-COVERAGE.md](./PROJECT-TEAM-FULL-COVERAGE.md) para el protocolo de sincronización.

**Evolución:** Roles, skills, áreas y variables no son estáticos; se ajustan tras modificaciones o crecimiento del dominio. Ver PROJECT-TEAM-FULL-COVERAGE §0.

---

## Cambios recientes

**Full team run 2026-03-17:** Orquestador ejecutó run completo 0→9 con full project sync y Repo Sync. Paso 0: PROJECT-STATE, PROMPT, BACKLOG leídos. Paso 0b: PARALLEL-SERIAL-PLAN-2026-03-17.md creado. Pasos 1–2: Plan & proposal confirmado; Mapping vigente. Pasos 3–3c: Dependencies, Contract (3/3 passed; kpi-report 404 en runtime — verificar mount), Networks. Pasos 4–5g: Design, Integrations, Reporter, Security, GPT, Fiscal, Billing, Audit, Calc ejecutados. Paso 5f: run_audit.sh; reporte .cursor/bmc-audit/latest-report-2026-03-17.md. Paso 6: Judge report actualizado. Paso 7: Repo Sync — repos no configurados; creado REPO-SYNC-SETUP.md. Paso 8–9: PROJECT-STATE actualizado; propagación §4. service-map: /api/kpi-report añadido. Git: stage, commit, push a origin main.

**KPI Report (inicio) 2026-03-16:** Full team run para implementación. Nuevo endpoint GET /api/kpi-report que agrega kpi-financiero, stock-kpi, proximas-entregas, metas-ventas, ventas en un payload único: totalPendiente, estaSemana, proximaSemana, entregasEstaSemana, bajoStock, objetivoMensual, realAcumulado, equilibrio. Bloque UI "KPI Report — Inicio" en dashboard (#inicio): 4 cards + card equilibrio (meta vs real). Artefactos: MAPPING-KPI-REPORT-VALIDATION.md, DESIGN-PROPOSAL-KPI-REPORT-INICIO.md, REPORT-SOLUTION-CODING.md, IMPLEMENTATION-PLAN-SOLUTION-CODING.md. planilla-inventory y DASHBOARD-INTERFACE-MAP actualizados.

**Phase 2 PUSH + Phase 3 Notifications 2026-03-16:** 7 nuevas rutas PUSH implementadas en `server/routes/bmcDashboard.js`: `POST /api/cotizaciones`, `PATCH /api/cotizaciones/:id`, `POST /api/pagos`, `PATCH /api/pagos/:id`, `POST /api/ventas`, `PATCH /api/stock/:codigo`, `GET /api/stock/history`. Helpers: `handleCreateCotizacion`, `handleUpdateCotizacion`, `handleCreatePago`, `handleUpdatePago`, `handleCreateVenta`, `handleUpdateStock`, `appendAuditLog`, `colIndexToLetter`. Todos usan SCOPE_WRITE + AUDIT_LOG. 4 nuevos Apps Script: `PagosPendientes.gs` (Workbook 2), `VentasConsolidar.gs` (Workbook 3), `StockAlertas.gs` (Workbook 4), `CalendarioRecordatorio.gs` (Workbook 5). `sendWeeklyAlarmDigest()` añadida a Code.gs (Workbook 1) — cross-workbook via PropertiesService IDs. Dashboard: notification bell 🔔 + drawer lateral en `index.html`; `buildNotifications()` + `renderNotifications()` en `app.js`; estilos `.notif-bell/.notif-badge/.notif-drawer` en `styles.css`. Docs: `planilla-inventory.md` (7 nuevas rutas, nuevas columnas), `AUTOMATIONS-BY-WORKBOOK.md` (4 scripts + trigger checklist global). Pendiente manual: crear CONTACTOS tab (Workbook 2), Ventas_Consolidado tab (Workbook 3), añadir SHOPIFY_SYNC_AT (Workbook 4), añadir PAGADO (Workbook 5), configurar triggers.

**Full team run 2026-03-16 (Phase 1 GET — Ventas multi-tab + Calendario ?month=):** Orquestador ejecutó run completo 0→8 con contexto post Full Sheets Audit. Paso 0: PROJECT-STATE, FULL-SHEETS-AUDIT-REPORT, STRATEGIC-REVIEW-FULL-SYSTEM-SYNC leídos; pendientes resueltos. Paso 2 (Mapping): MAPPING-VALIDATION-AUDIT-VS-INVENTORY validado; gaps confirmados (Ventas 22 tabs, Calendario 45 tabs, Pagos tab name). Paso 5 (Reporter): handoff Solution/Coding ejecutado → **Phase 1 implementada:** `getAllVentasData()` itera las 23 tabs de Ventas en paralelo (`Promise.allSettled`), mapea con PROVEEDOR=tab name; `/api/ventas` soporta `?proveedor=` (filtro) y `?tab=` (tab específica); nuevo endpoint `/api/ventas/tabs`; `/api/calendario-vencimientos` soporta `?month=2026-03` → lee tab "MARZO 2026" (MESES_ES map); planilla-inventory actualizada (tab Pendientes_ corregida, nuevos endpoints documentados). Paso 8: PROJECT-STATE actualizado.

**Full team run 2026-03-16 (post Full Sheets Audit):** Orquestador ejecutó run completo 0→8. Paso 0: PROJECT-STATE, FULL-SHEETS-AUDIT-REPORT, STRATEGIC-REVIEW-FULL-SYSTEM-SYNC leídos. Paso 1–2: Plan & proposal confirmado; **Mapping:** validación audit vs planilla-inventory y DASHBOARD-INTERFACE-MAP → `MAPPING-VALIDATION-AUDIT-VS-INVENTORY.md` (gaps: Ventas 22 tabs no iteradas, Calendario 45 tabs, Stock 6 tabs; Pagos tab Pendientes_). Paso 3: Dependencies actualizado con Phase 1–2. Paso 3b: Contract validation 3/3 passed. Paso 4–5: **Reporter:** handoff Solution/Coding con Phase 1–2 de STRATEGIC-REVIEW → `REPORT-SOLUTION-CODING.md`, `IMPLEMENTATION-PLAN-SOLUTION-CODING.md` (S1-P1…S7-P2, C1-P1…C7-P2). Paso 8: PROJECT-STATE actualizado con resumen audit y próximos pasos.

**Full Sheets Audit 2026-03-16:** Ejecutado mapeo completo tab-by-tab, column-by-column de los 5 workbooks (83 tabs). Creados: `scripts/map-all-sheets-audit.js`, `FULL-SHEETS-AUDIT-RAW.json`, `FULL-SHEETS-AUDIT-REPORT.md`, `STRATEGIC-REVIEW-FULL-SYSTEM-SYNC.md`. Revisión estratégica: propuesta de Sheets como base de datos central, fases GET/PUSH, schema canónico, roadmap de implementación para sincronía total (Dashboard, Calculadora, Shopify, GPT).

**Sheets actualizados 2026-03-16:** Usuario actualizó 4 workbooks. 2.0 - Ventas tiene nuevo ID: `1KFNKWLQmBHj_v8BZJDzLklUtUPbNssbYEsWcmc0KPQA` (reemplaza `1IMZr_qEyVi8eIlNc_Nk64eY63LHUlAue`). Config actualizado: .env, planilla-inventory.md, SHEETS-MAPPING-5-WORKBOOKS.md, .env.example. Bug mapper ventas corregido (COSTO/ganancia shorthand). /api/ventas ahora retorna datos reales del nuevo sheet. Pagos, Stock, Calendario sin cambios de ID.

**Full team run 2026-03-16 (Sheets sync):** Orquestador ejecutó run completo 0→8. Paso 0: PROJECT-STATE, PROMPT, BACKLOG leídos; pendiente Go-live. Paso 0b: PARALLEL-SERIAL-PLAN-2026-03-16.md creado. Pasos 1–2: Plan & proposal confirmado; Mapping vigente (planilla-inventory, SHEETS-MAPPING, DASHBOARD-INTERFACE-MAP con Ventas ID nuevo). Pasos 3–3c: Dependencies actualizado (Ventas 2.0 API activa); Contract validation 3/3 passed; Networks vigente. Pasos 4–5g: Design, Integrations, Reporter, Security, GPT/Cloud, Fiscal, Billing, Audit, Calc ejecutados. Paso 5f: run_audit.sh ejecutado; reporte .cursor/bmc-audit/latest-report-2026-03-16.md. Paso 6: Judge vigente. Paso 7: Repo Sync omitido (repos no configurados). Paso 8: PROJECT-STATE actualizado.

**Do it all 2026-03-16:** Configuración completa ejecutada. .env actualizado con BMC_PAGOS_SHEET_ID, BMC_CALENDARIO_SHEET_ID, BMC_VENTAS_SHEET_ID, BMC_STOCK_SHEET_ID. Go-live automation ejecutado (setup check ✓, contract 3/3 ✓, verify-tabs con tabs faltantes). Audit run_audit.sh ejecutado; reporte en .cursor/bmc-audit/latest-report-2026-03-16.md. Endpoints verificados: /api/stock-ecommerce y /api/stock-kpi OK (Stock E-Commerce: 196 productos, 182 bajo stock, valor inventario USD 299219). /api/ventas devuelve fallback (workbook 2.0 Ventas: "not supported for this document" — posible .xlsx convertido; API retorna data vacía para no romper dashboard). PROJECT-STATE actualizado.

**Sheets mapping 5 workbooks 2026-03-16:** Implementado plan completo. Creados: `docs/google-sheets-module/SHEETS-MAPPING-5-WORKBOOKS.md` (mapa detallado 5 sheets), `AUTOMATIONS-BY-WORKBOOK.md` (scripts Apps Script por workbook). Actualizados: `planilla-inventory.md` (5 workbooks), `DASHBOARD-INTERFACE-MAP.md` (Ventas 2.0, Stock E-Commerce). API: nuevas rutas `/api/ventas`, `/api/stock-ecommerce`, `/api/stock-kpi`; mappers `mapVentas2026ToCanonical`, `mapStockEcommerceToCanonical`. Config: `BMC_VENTAS_SHEET_ID`, `BMC_STOCK_SHEET_ID`. Dashboard: secciones Ventas 2.0 (tabla + filtro proveedor) y Stock E-Commerce (KPIs + tabla + export CSV). Degrada limpio si no configurados.

**Go-live automatización 2026-03-16:** Creados scripts y prompt para Atlas Browser. Automático: `scripts/go-live-automation.sh` (setup, contract, verify-tabs, ngrok opcional); `scripts/verify-sheets-tabs.js` (verifica tabs vía Sheets API); `scripts/get-service-account-email.js`. Manual (Atlas Browser): `docs/ATLAS-BROWSER-PROMPT-GO-LIVE.md` — compartir workbook, Apps Script (Code.gs, DialogEntregas, runInitialSetup, triggers). npm run go-live, npm run verify-tabs.

**Next steps run 2026-03-16:** run_dashboard_setup.sh --check-only ✓; Contract validation 3/3 passed (kpi 503 skip); run_audit.sh ejecutado; latest-report-2026-03-16.md generado. GO-LIVE-DASHBOARD-CHECKLIST actualizado: 1.1–1.3, 4.1, 4.3–4.4, 7.1 verificados. API en 3001, /health hasSheets: true.

**Full team run 2026-03-16 (go):** Ciclo de mejoras — 7 agentes restantes desarrollados. Creados: `knowledge/Contract.md`, `Calc.md`, `Security.md`, `Judge.md`, `ParallelSerial.md`, `RepoSync.md`, `SheetsStructure.md`. SKILLs actualizados. **Todos los 19 agentes desarrollados.** Solo mantenimiento (actualizar knowledge cuando cambie el dominio).

**Full team run 2026-03-16 (continuación):** Ciclo de mejoras — 6 agentes más desarrollados. Creados: `knowledge/Networks.md`, `Integrations.md`, `GPTCloud.md`, `Fiscal.md`, `Billing.md`, `AuditDebug.md`. SKILLs actualizados: networks-development-agent, shopify-integration-v4, panelin-gpt-cloud-system, bmc-dgi-impositivo, billing-error-review, bmc-dashboard-audit-runner. IMPROVEMENT-BACKLOG: 11 agentes desarrollados. Próximos: Contract, Calc, Security, Judge, Parallel/Serial, Repo Sync, Sheets Structure.

**Full team run 2026-03-16 (Equipo Completo — 19 miembros):** Run completo 0→9. Paso 0: PROJECT-STATE leído; pendiente Go-live (credenciales, Apps Script). Paso 0b: PARALLEL-SERIAL-PLAN-2026-03-16.md creado. Pasos 1–2: Plan & proposal confirmado; Mapping vigente. Pasos 3–3c: Dependencies, Contract (3/3 passed), Networks vigentes. Pasos 4–5g: Design, Integrations, Reporter, Security, GPT/Cloud, Fiscal, Billing, Audit, Calc ejecutados. Paso 5f: run_audit.sh ejecutado; reporte .cursor/bmc-audit/latest-report-2026-03-16.md. Paso 6: Judge report vigente. Paso 7: Repo Sync omitido (repos no configurados). Paso 8–9: PROJECT-STATE actualizado; knowledge Design, Dependencies, Reporter, Orchestrator creados; SKILL refs; backlog actualizado.

**Full team run 2026-03-16 (Full Team Run / bmc-project-team-sync):** Ciclo de mejoras (paso 9) ejecutado. Creados: `docs/team/knowledge/Design.md`, `Dependencies.md`, `Reporter.md`, `Orchestrator.md`. SKILLs actualizados con referencia a knowledge: bmc-dashboard-design-best-practices, bmc-dependencies-service-mapper, bmc-implementation-plan-reporter; agent bmc-dashboard-team-orchestrator. IMPROVEMENT-BACKLOG-BY-AGENT actualizado: Mapping, Design, Dependencies, Reporter, Orchestrator marcados desarrollados. PROMPT-FOR-EQUIPO-COMPLETO: "Próximos prompts" actualizado para siguiente run (Networks, Integrations, GPT/Cloud, Fiscal, Billing, Audit/Debug).

**Full team run 2026-03-16:** Orquestador ejecutó run completo: Mapping, Dependencies, Contract (validate-api-contracts 3/3 passed), Design (UX Opción A vigente), Security (sin sensibles en repo), Reporter, Audit Runner, Debug Reviewer, Judge. Creados: GO-LIVE-DASHBOARD-CHECKLIST.md, JUDGE-REPORT-RUN-2026-03-16.md, DEBUG-REPORT.md, handoff.json. JUDGE-REPORT-HISTORICO actualizado con primer run. API iniciada; contract validation OK. Objetivo: dashboard fully operational para vendedores y administradivos BMC.

**Full team run 2026-03-16 (17:11):** Segundo run del día. API iniciada, contract validation 3/3, audit ejecutado (run_audit.sh), handoff.json actualizado. Judge report ampliado. Repo Sync omitido (BMC_DASHBOARD_2_REPO no configurado). Proceso revisado: 0→1→2→3→3b→4→5→5b→5f→6.

**Resumen ejecutivo — Full team run 2025-03-15:** Se ejecutó el full team run del BMC Dashboard según bmc-dashboard-team-orchestrator. Plan y proposal confirmados; mapping (planilla-inventory, DASHBOARD-INTERFACE-MAP, cross-reference) revisado y vigente. Se crearon dependencies.md y service-map.md con grafo de dependencias e inventario de servicios. Dashboard Designer produjo DESIGN-PROPOSAL-TIME-SAVING con Opción A (incremental: loading, filtros, sticky headers, feedback). Implementation Plan & Reporter generó REPORT-SOLUTION-CODING e IMPLEMENTATION-PLAN-SOLUTION-CODING con tareas para Solution y Coding. Handoffs claros: Solution aprueba UX → Coding implementa C1–C5; Coding entrega → Solution valida en browser.

**Full Project Status 2025-03-15:** Se creó FULL-PROJECT-STATUS-AND-TASK-PLAN.md con: (1) estado operativo vs pendiente; (2) plan task-by-task por fases (0–4); (3) evaluación del equipo. Fases: 0–verificación base; 1–quick wins (C2,C6,C7); 2–UX tras S1; 3–hardening skills/orquestador; 4–Ventas/Invoque futuro. Mejoras equipo: Judge sin runs, Contract/Security no integrados, skills sin PROJECT-STATE.

**Fase 0 y 1 ejecutadas 2025-03-15:** T0.1–T0.4 verificados (stack OK, /health con hasSheets). C2 y C6 ya implementados. C7: creado PUERTOS-3849-VS-3001.md en bmc-dashboard-modernization; enlazado en README.

**Paso 2 ejecutado 2025-03-15:** UX Opción A implementada: C1 loading skeleton (skeleton-pulse en tablas y trend), C3 filtros "Esta semana"|"Vencidos"|"Todos" en Breakdown, C4 sticky header en tablas Entregas y Breakdown, C5 toast ya existía. DESIGN-PROPOSAL checklist actualizado.

**Paso 3 ejecutado 2025-03-15:** Skills actualizados con PROJECT-STATE y propagación (google-sheets-mapping-agent, bmc-dashboard-design-best-practices, bmc-dependencies-service-mapper, bmc-implementation-plan-reporter, bmc-dgi-impositivo, billing-error-review, bmc-dashboard-debug-reviewer, bmc-dashboard-audit-runner, networks-development-agent, shopify-integration-v4, panelin-gpt-cloud-system). Orquestador extendido: Contract Validator (3b) antes de Design, Security Review (5b) antes de Reporter; runs especiales (Audit, Sync, GPT) documentados.

| Fecha | Área | Cambio | Afecta a | Estado |
|-------|------|--------|----------|--------|
| 2025-03-15 | Team | **Equipo organizado** en docs/team/ según decisión del equipo | Todos | Implementado |
| 2025-03-15 | Team | **Parallel/Serial Agent:** Nuevo rol bmc-parallel-serial-agent — evalúa según desempeños; sabe qué ejecutar en paralelo vs serie; prevé mejor combinación de agentes según scores y contexto | Orquestador, Judge | Implementado |
| 2025-03-15 | Team | **Capacidades:** Todos pueden adquirir habilidad nueva (si necesaria y aprobada, o pedida); pueden clonarse (Mapping, Mapping+1, Mapping+2…) para paralelizar | Todos | Vigente |
| 2025-03-15 | Team | **Evolución:** Roles y skills no son estáticos; surgen nuevos al interactuar; variables se ajustan tras modificaciones o crecimiento del dominio (PROJECT-TEAM-FULL-COVERAGE §0) | Todos | Vigente |
| 2025-03-15 | Team | **Fiscal:** Ranking de criticidad (FISCAL-PROTOCOL-STATE-RANKING); controla incumplimientos; si ocurren, comunica a involucrados para que no pase de nuevo | Orquestador, todos | Implementado |
| 2025-03-15 | Team | **Juez (Judge):** Nuevo rol bmc-team-judge — evalúa forma de trabajo, ranqueo por agente, reporte por run y promedio histórico; criterios individuales en JUDGE-CRITERIA-POR-AGENTE.md | Orquestador, todos | Implementado |
| 2025-03-15 | Team | **Regla Equipo Completo:** Todos los miembros de PROJECT-TEAM-FULL-COVERAGE §2 se adjuntan siempre al llamado; skills nuevos se añaden a §2 | Orquestador, Sync | Vigente |
| 2025-03-15 | Team | **Plan equipo vigente:** PLAN-EQUIPO-3-PASOS-SIGUIENTES.md — Paso 1 (C2,C6,C7), Paso 2 (S1+C1-C5), Paso 3 (hardening) | Todos | Vigente |
| 2025-03-15 | Team | **Meta-evaluación equipo:** EQUIPO-META-EVALUACION.md — overlaps, gaps, mejoras orquestación, skills a configurar, nuevos roles sugeridos | Orquestador, todos | Implementado |
| 2025-03-15 | Team | **Full team run ejecutado:** Plan & proposal confirmado; Planilla/Dashboard mapping revisado; dependencies.md y service-map.md creados; DESIGN-PROPOSAL-TIME-SAVING (Opción A); REPORT-SOLUTION-CODING e IMPLEMENTATION-PLAN-SOLUTION-CODING | Solution, Coding, Design | Implementado |
| 2025-03-15 | Team | Fiscal: nuevo rol oversight & efficiency (fiscaliza operaciones, analiza alternativas, reporta al Orquestador) | Orquestador, todos | Implementado |
| 2025-03-15 | Team | Nuevos miembros: Contrato, Calc, Seguridad | Mapa, Vista, Integra | Implementado |
| 2025-03-15 | Mapping | First task ejecutado: planilla-inventory, DASHBOARD-INTERFACE-MAP, cross-reference | Design, Dependencies | Implementado |
| 2025-03-15 | Docs | Creación PROJECT-STATE.md y PROJECT-TEAM-FULL-COVERAGE | Todos | Inicial |
| 2025-03-15 | Team | AI Interactive Team + Networks agent integrado | Mapping, Design, Networks | Implementado |
| 2025-03-15 | Dashboard | Fase 0–1 ejecutadas: stack verificado; C2/C6 ya existían; C7 doc PUERTOS-3849-VS-3001.md | Coding, Setup | Implementado |
| 2025-03-15 | Team | Paso 3: 11 skills con PROJECT-STATE/propagación; orquestador con Contract (3b), Security (5b), runs especiales | Orquestador, todos | Implementado |
| 2025-03-15 | Dashboard | Paso 2 UX Opción A: C1 skeleton, C3 filtros Breakdown, C4 sticky headers, C5 toast | Design, Coding | Implementado |
| 2026-03-16 | Team | Full team run 17:11: API, contract 3/3, audit, handoff, Judge, PROJECT-STATE | Todos | Implementado |
| 2026-03-16 | Team | Ciclo mejoras: knowledge Design, Dependencies, Reporter, Orchestrator; SKILL ref KB; 5 agentes desarrollados | Todos | Implementado |
| 2026-03-16 | Team | Ciclo mejoras (continuación): Networks, Integrations, GPT/Cloud, Fiscal, Billing, Audit/Debug; 11 agentes desarrollados | Todos | Implementado |
| 2026-03-16 | Team | Ciclo mejoras (go): Contract, Calc, Security, Judge, Parallel/Serial, Repo Sync, Sheets Structure; **19/19 agentes desarrollados** | Todos | Implementado |

---

## Estado por área

### Sheets / Planillas

- **Workbooks:** 5 (multi-workbook). Principal: `1N-4kyT_uSPSVnu5tMIc6VzFIaga8FHDDEDGcclafRWg`. Ver `docs/google-sheets-module/SHEETS-MAPPING-5-WORKBOOKS.md` y `planilla-inventory.md`.
- **Schema activo:** CRM_Operativo
- **Tabs:** Ver `docs/google-sheets-module/planilla-inventory.md` (active_now, conditional)
- **Artefactos:** `planilla-inventory.md` (live), `planilla-map.md` (diff vs blueprint), `FULL-SHEETS-AUDIT-REPORT.md`, `FULL-SHEETS-AUDIT-RAW.json`, `STRATEGIC-REVIEW-FULL-SYSTEM-SYNC.md`, `MAPPING-VALIDATION-AUDIT-VS-INVENTORY.md`

### Dashboard

- **Puertos:** 3001 (canónico), 3849 (standalone), 5173 (Calculadora)
- **URL principal:** http://localhost:3001/finanzas
- **Secciones:** Resumen financiero, Trend, Breakdown, Calendario, Entregas, Metas, Audit, Ventas 2.0 (tabla + filtro proveedor), Stock E-Commerce (KPIs + tabla + export CSV), Invoque (placeholder)
- **Artefactos:** `DASHBOARD-INTERFACE-MAP.md`, `DASHBOARD-VISUAL-MAP.md`, `MAPA-VISUAL-ESTRUCTURA-POR-ESTACION.md`, `PUERTOS-3849-VS-3001.md`

### Infraestructura

- **Producción:** Cloud Run (panelin-calc), posible VPS Netuy
- **ngrok:** puerto 4040 para OAuth
- **Artefactos:** `HOSTING-EN-MI-SERVIDOR.md`, `.env`

### Repos (Repo Sync)

- **bmc-dashboard-2.0:** No configurado. Ver `docs/team/REPO-SYNC-SETUP.md`.
- **bmc-development-team:** No configurado. Ver `docs/team/REPO-SYNC-SETUP.md`.
- **Config:** Añadir `BMC_DASHBOARD_2_REPO` y `BMC_DEVELOPMENT_TEAM_REPO` en `.env` o documentar en esta sección.

### Integraciones

- **Activas:** Google Sheets, Google Drive, MercadoLibre (OAuth), Shopify
- **Cloud Run calc:** `docs/openapi-calc.yaml`

---

## Plan vigente (equipo completo)

**Plan:** [plans/PLAN-EQUIPO-3-PASOS-SIGUIENTES.md](./plans/PLAN-EQUIPO-3-PASOS-SIGUIENTES.md)

| Paso | Contenido | Dependencias |
|------|-----------|--------------|
| **1** | C2, C6, C7 (quick wins) | Ninguna |
| **2** | S1 + C1, C3, C4, C5 (UX Opción A) | S1 aprobado |
| **3** | Skills PROJECT-STATE, orquestador extendido, referencias overlaps | Ninguna |

Todos los agentes deben consultar este plan al iniciar tareas. Al finalizar cada paso, actualizar Cambios recientes.

---

## Pendientes de sincronización

- [x] **KPI Report (inicio):** Implementado 2026-03-16. GET /api/kpi-report + bloque UI en #inicio.
- [x] **Paso 1:** C2, C6, C7 (quick wins) — completado (C2/C6 ya existían; C7 doc creada)
- [x] **Fase 0:** Verificación stack (T0.1–T0.4) — completado
- [x] **Paso 2:** C1–C5 (UX Opción A) — completado
- [x] **Paso 3:** Skills PROJECT-STATE, orquestador extendido — completado
- [ ] **Go-live:** Completar GO-LIVE-DASHBOARD-CHECKLIST — credenciales y stack local ✓; pendiente: 1.4 (compartir workbook), 2.x (tabs), 3.x (Apps Script), 5.x (deploy), 6.x (verificación E2E)
- [x] **Guía usuarios:** docs/GUIA-RAPIDA-DASHBOARD-BMC.md existe
- [x] **Phase 1 (GET):** Iteración 23 tabs Ventas (getAllVentasData, Promise.allSettled); GET /api/ventas?proveedor=; GET /api/ventas?tab=; GET /api/ventas/tabs; GET /api/calendario-vencimientos?month=2026-03 → tab "MARZO 2026". Pendiente: GET /api/stock/history (EXISTENCIAS_Y_PEDIDOS, Egresos)
- [x] **Phase 2 (PUSH):** Implementado 2026-03-16. POST /api/cotizaciones, PATCH /api/cotizaciones/:id, POST /api/pagos, PATCH /api/pagos/:id, POST /api/ventas, PATCH /api/stock/:codigo; append AUDIT_LOG. Pendiente manual: crear tabs CONTACTOS, Ventas_Consolidado, SHOPIFY_SYNC_AT, PAGADO; configurar triggers.
- [x] **Planilla-inventory:** Tab Pagos corregida (Pendientes_); nuevos endpoints documentados. Pendiente: documentar columna MONTO autoritativa (D/E) en Pagos
- [ ] **Repo Sync:** Configurar BMC_DASHBOARD_2_REPO y BMC_DEVELOPMENT_TEAM_REPO en .env o PROJECT-STATE. Ver docs/team/REPO-SYNC-SETUP.md.

---

## Cómo usar este archivo

- **Antes de trabajar:** Leer "Cambios recientes" y "Pendientes".
- **Después de un cambio:** Añadir fila en "Cambios recientes"; si afecta a otros, añadir en "Pendientes" o escribir Log for [Agent].
- **Sync completo:** Ejecutar "Sync project state" o full team run.

**Supervisión:** El Fiscal (bmc-dgi-impositivo) fiscaliza que el equipo cumpla este protocolo según el ranking de criticidad en [fiscal/FISCAL-PROTOCOL-STATE-RANKING.md](./fiscal/FISCAL-PROTOCOL-STATE-RANKING.md). Controla que no sucedan incumplimientos; si ocurren, comunica a los involucrados para que no pase de nuevo.
