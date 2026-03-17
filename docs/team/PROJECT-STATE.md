# Project State — BMC/Panelin

**Última actualización:** 2026-03-18 (Full team run — Invoque full team run 5)

Fuente única de estado para que todos los agentes estén actualizados. Ver [PROJECT-TEAM-FULL-COVERAGE.md](./PROJECT-TEAM-FULL-COVERAGE.md) para el protocolo de sincronización.

**Evolución:** Roles, skills, áreas y variables no son estáticos; se ajustan tras modificaciones o crecimiento del dominio. Ver PROJECT-TEAM-FULL-COVERAGE §0.

---

## Cambios recientes

> Historial completo: [CAMBIOS-RECIENTES-ARCHIVE.md](./CAMBIOS-RECIENTES-ARCHIVE.md)

**CEO AI Agent creado 2026-03-17:** Skill, agent, rule y CEO-RUN-LOG añadidos. Objetivo: project working by end of week. Invoca full team run repetidamente hasta Tier 1 (MVP). Triggers: "CEO run", "CEO agent", "project working by end of week", "make it work". Ver `docs/team/CEO-RUN-LOG.md` y `.cursor/skills/ceo-ai-agent/SKILL.md`.

**Full team run 2026-03-18 run 5 (Invoque full team):** Paso 0: state, prompt, backlog leídos. Paso 0b: PARALLEL-SERIAL-PLAN-2026-03-18-run5.md. Pasos 1–8: estado vigente. Paso 9: sin entregables automatizables; pendientes 1, 3, 6, 7 (Matias). PROJECT-STATE y PROMPT actualizados.

**Full team run 2026-03-18 run 4 (Invoque full team):** Paso 0: state, prompt, backlog leídos. Paso 0b: PARALLEL-SERIAL-PLAN-2026-03-18-run4.md. Pasos 1–8: estado vigente. Paso 9: sin prompts automatizables; agenda 1, 3, 6, 7 pendiente (Matias). PROJECT-STATE y PROMPT actualizados.

**Full team run 2026-03-18 run 3 (Invoque full team):** Paso 0: state, prompt, backlog leídos. Paso 0b: PARALLEL-SERIAL-PLAN-2026-03-18-run3.md. Pasos 1–8: estado vigente; sin cambios de dominio. Paso 9: Agenda pendiente (1 tabs/triggers, 3 deploy, 6 npm --force, 7 Repo Sync opcional) requiere Matias manual o decisión; sin entregables automatizables en este run. PROJECT-STATE y PROMPT actualizados.

**Full team run 2026-03-16 (run7 — post-go-live agenda):** Orquestador ejecutó run completo 0→9. Paso 0b: PARALLEL-SERIAL-PLAN-2026-03-16-run7.md creado. Pasos 1–2: Mapping vigente; sin drift. Paso 3: service-map.md actualizado (fecha, PUSH routes). Paso 3b: Contract 4/4 PASS; kpi-report línea 1130 bmcDashboard.js — ruta montada en /api; 404 runtime = restart servidor. Pasos 3c–5g: Networks, Design, Integrations, Reporter (REPORT-SOLUTION-CODING-run7.md), Security (CORS pre-deploy), GPT/Cloud, Fiscal (incumplimiento Medio detectado/corregido), Billing, Audit (latest-report-run7.md + E2E checklist), Calc. Paso 6: Judge 18/19 formales (Sheets N/A); promedio 4.93/5; JUDGE-REPORT-RUN-2026-03-16-run7.md y HISTORICO actualizados. Paso 7: Repo Sync — bmc-dashboard-2.0 y bmc-development-team verificados y artefactos sincronizados. Paso 9: GUIA-RAPIDA-VENDEDORES.md creada; agenda siguiente run actualizada.

**Full team run 2026-03-18 run 2 (Invoque full team):** Paso 0: state, prompt, backlog leídos. Paso 0b: PARALLEL-SERIAL-PLAN-2026-03-18-run2.md. Pasos 1–8: estado vigente. Paso 9: Contract verificó en código que GET /api/kpi-report existe (bmcDashboard.js ~L1130, montado en /api en index.js); 404 en runtime = reiniciar servidor. Audit/Debug creó docs/team/E2E-VALIDATION-CHECKLIST.md (D1). npm audit fix ejecutado sin --force: no aplicó cambios (fix requiere --force, breaking). PROJECT-STATE y PROMPT actualizados.

**Full team run 2026-03-18 (Invoque full team):** Orquestador ejecutó run 0→9. Paso 0: PROJECT-STATE, PROMPT-FOR-EQUIPO-COMPLETO, IMPROVEMENT-BACKLOG leídos (19/19 agentes desarrollados). Paso 0b: PARALLEL-SERIAL-PLAN-2026-03-18.md. Pasos 1–8: Estado vigente (Mapping, Dependencies, Contract, Networks, Design, Integrations, Reporter, Security, GPT, Fiscal, Billing, Audit, Calc, Judge, Repo Sync). Paso 9: Reporter creó docs/GUIA-RAPIDA-VENDEDORES.md (C1 post-go-live); PROMPT y PROJECT-STATE actualizados. Pendientes restantes: tabs/triggers manual (Matias), kpi-report runtime verify, deploy, E2E, npm audit fix.

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

- **bmc-dashboard-2.0:** https://github.com/matiasportugau-ui/bmc-dashboard-2.0.git
- **bmc-development-team:** https://github.com/matiasportugau-ui/bmc-development-team.git
- **Config:** En `.env` ✓
- **Guía:** `docs/team/REPO-SYNC-SETUP.md`

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
- [ ] **Go-live:** Completar GO-LIVE-DASHBOARD-CHECKLIST — credenciales y stack local ✓; pendiente: 1.4 (compartir workbook con service account), 2.x (tabs manuales), 3.x (Apps Script triggers), 5.x (deploy Cloud Run / VPS Netuy), 6.x (verificación E2E). Ver IMPLEMENTATION-PLAN-POST-GO-LIVE.md.
- [x] **Guía usuarios:** docs/GUIA-RAPIDA-DASHBOARD-BMC.md existe
- [x] **Phase 1 (GET):** Iteración 23 tabs Ventas (getAllVentasData, Promise.allSettled); GET /api/ventas?proveedor=; GET /api/ventas?tab=; GET /api/ventas/tabs; GET /api/calendario-vencimientos?month=2026-03 → tab "MARZO 2026". Pendiente: GET /api/stock/history (EXISTENCIAS_Y_PEDIDOS, Egresos)
- [x] **Phase 2 (PUSH):** Implementado 2026-03-16. POST /api/cotizaciones, PATCH /api/cotizaciones/:id, POST /api/pagos, PATCH /api/pagos/:id, POST /api/ventas, PATCH /api/stock/:codigo; append AUDIT_LOG. Pendiente manual: crear tabs CONTACTOS, Ventas_Consolidado, SHOPIFY_SYNC_AT, PAGADO; configurar triggers.
- [x] **Planilla-inventory:** Tab Pagos corregida (Pendientes_); nuevos endpoints documentados. Pendiente: documentar columna MONTO autoritativa (D/E) en Pagos
- [x] **Repo Sync:** BMC_DASHBOARD_2_REPO y BMC_DEVELOPMENT_TEAM_REPO configurados en .env ✓
- [ ] **npm audit fix:** 7 vulns (5 low @tootallnate/once/teeny-request, 2 moderate esbuild/vite). `npm audit fix` sin --force no aplicó cambios (fix solo con --force, breaking). Evaluar con Matias si ejecutar `npm audit fix --force` (vite@8, @google-cloud/storage downgrade).
- [ ] **kpi-report runtime:** Verificar que /api/kpi-report retorna 200 (o 503) tras restart servidor. Ruta verificada en código 2026-03-18: existe en bmcDashboard.js, montada en /api (index.js); 404 = reiniciar servidor.
- [x] **Guía vendedores:** docs/GUIA-RAPIDA-VENDEDORES.md creada 2026-03-18 (Reporter, paso 9).
- [ ] **Deploy producción:** Cloud Run o VPS Netuy. Ver IMPLEMENTATION-PLAN-POST-GO-LIVE.md §Fase B.
- [ ] **E2E validation:** Ejecutar checklist docs/team/E2E-VALIDATION-CHECKLIST.md (D1) antes de go-live público. Creado 2026-03-18.

---

## Cómo usar este archivo

- **Antes de trabajar:** Leer "Cambios recientes" y "Pendientes".
- **Después de un cambio:** Añadir fila en "Cambios recientes"; si afecta a otros, añadir en "Pendientes" o escribir Log for [Agent].
- **Sync completo:** Ejecutar "Sync project state" o full team run.

**Supervisión:** El Fiscal (bmc-dgi-impositivo) fiscaliza que el equipo cumpla este protocolo según el ranking de criticidad en [fiscal/FISCAL-PROTOCOL-STATE-RANKING.md](./fiscal/FISCAL-PROTOCOL-STATE-RANKING.md). Controla que no sucedan incumplimientos; si ocurren, comunica a los involucrados para que no pase de nuevo.
