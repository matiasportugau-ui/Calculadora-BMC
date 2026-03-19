# Project State — BMC/Panelin

**Última actualización:** 2026-03-19 (Full team run 18)

Fuente única de estado para que todos los agentes estén actualizados. Ver [PROJECT-TEAM-FULL-COVERAGE.md](./PROJECT-TEAM-FULL-COVERAGE.md) para el protocolo de sincronización.

**Evolución:** Roles, skills, áreas y variables no son estáticos; se ajustan tras modificaciones o crecimiento del dominio. Ver PROJECT-TEAM-FULL-COVERAGE §0.

---

## Cambios recientes

> Historial completo: [CAMBIOS-RECIENTES-ARCHIVE.md](./CAMBIOS-RECIENTES-ARCHIVE.md)

**2026-03-19 (Full team run 18 — Invoque full team, deploy completado):** Orquestador ejecutó full team run 0→9. Paso 0: PROJECT-STATE, PROMPT, BACKLOG leídos. Paso 0b: PARALLEL-SERIAL-PLAN-2026-03-19-run18.md. Pasos 1–8: Mapping vigente; Dependencies/service-map actualizados con deploy flow, Cloud Run URL, Vercel; Contract 4/4 PASS (runtime); Reporter REPORT-SOLUTION-CODING-2026-03-19-run18.md; Judge JUDGE-REPORT-RUN-2026-03-19-run18.md (promedio 4.96/5); Repo Sync REPO-SYNC-REPORT-2026-03-19-run18.md. Paso 9: PROMPT "Próximos prompts" actualizado. Deploy completado: Cloud Run panelin-calc con /calculadora. Dockerfile fixes (easymidi --ignore-scripts), .dockerignore, cloudbuild.yaml, deploy script. Pendientes: tabs/triggers, E2E con URL Cloud Run, npm audit fix, billing cierre.

**2026-03-19 (Full team run 17 — Invoque full team, deploy calc):** Orquestador ejecutó full team run 0→9. Paso 0: PROJECT-STATE, PROMPT, BACKLOG leídos. Paso 0b: PARALLEL-SERIAL-PLAN-2026-03-19-run17.md. Pasos 1–8: Mapping vigente; Dependencies/service-map actualizados (run17); Contract 4/4 PASS (runtime); Reporter REPORT-SOLUTION-CODING-2026-03-19-run17.md (deploy options: Cloud Run, Vercel, Netuy); Judge JUDGE-REPORT-RUN-2026-03-19-run17.md (promedio 4.96/5); Repo Sync REPO-SYNC-REPORT-2026-03-19-run17.md. Paso 9: PROMPT "Próximos prompts" actualizado. Pendientes: deploy calc (Cloud Run/Vercel/Netuy), tabs/triggers, E2E, npm audit fix.

**2026-03-19 (Full team run 16 — Invoque full team):** Orquestador ejecutó full team run 0→9. Paso 0: PROJECT-STATE, PROMPT, BACKLOG, REPORT-STUDY-IMPROVEMENTS leídos. Paso 0b: PARALLEL-SERIAL-PLAN-2026-03-19-run16.md. Pasos 1–8: Mapping (DASHBOARD-INTERFACE-MAP con mejoras Calculadora); Dependencies/service-map actualizados (Calculadora MATRIZ flow, actualizar-precios-calculadora); Contract 4/4 PASS (runtime); Reporter REPORT-SOLUTION-CODING-2026-03-19-run16.md; Judge JUDGE-REPORT-RUN-2026-03-19-run16.md (promedio 4.95/5); Repo Sync REPO-SYNC-REPORT-2026-03-19-run16.md. Paso 9: PROMPT "Próximos prompts" actualizado. Pendientes sin cambio.

**2026-03-19 (Vercel + Full team):** Calculadora desplegada en Vercel (calculadora-bmc.vercel.app) con últimas modificaciones; vercel.json con installCommand --ignore-scripts (easymidi); scripts/deploy-vercel.sh; VITE_API_URL apunta a Cloud Run para "Cargar desde MATRIZ". Full team run ejecutado. Repo sync pendiente de completar.

**2026-03-19 (Deploy calc + Repo Sync):** Calculadora integrada al servidor Express en /calculadora; Dockerfile.bmc-dashboard actualizado con build de calc (VITE_BASE=/calculadora/); script scripts/deploy-cloud-run.sh para deploy a Cloud Run vía Cloud Build. Repo Sync ejecutado: bmc-dashboard-2.0 y bmc-development-team actualizados. Para deploy: ejecutar `./scripts/deploy-cloud-run.sh` (requiere gcloud CLI).

**2026-03-19 (Calculadora UI — PanelinCalculadoraV3_backup):** Mejoras en la Calculadora de cotización: (1) Accesorios perimetrales seleccionables sobre la vista previa del techo (RoofBorderSelector integrado con zonas); (2) Columnas Costo, % Margen y Ganancia en la tabla de resultados; (3) Botón "Cargar desde MATRIZ" en Config para costo + venta; (4) Enter para avanzar en wizard (Siguiente); (5) Corrección display título dimensiones (padding); (6) Costo añadido a items de cálculo (pared, selladores, perfiles).

**2026-03-18 (Full team run run15 — Study improvements aplicadas):** Orquestador ejecutó full team run 0→9 + aplicación de mejoras del estudio. Paso 0: PROJECT-STATE, PROMPT, BACKLOG leídos. Paso 0b: PARALLEL-SERIAL-PLAN-2026-03-18-run15.md. Pasos 1–8: Mapping vigente; Dependencies/service-map con Apps Script; Contract validado en código (servidor no corriendo; 4/4 PASS en runs previos). Paso 9: Mejoras aplicadas — REPORT-STUDY-IMPROVEMENTS §1 (nota Pendientes_/Pagos_Pendientes), §6 (Shopify /webhooks/shopify ref), §8 (Panelin Evolution 3847); service-map Apps Script; §20 Fases ya presente; PROMPT con Study improvements como input; PROJECT-STATE actualizado. Judge: JUDGE-REPORT-RUN-2026-03-18-run15.md; promedio 4.94/5 (basado en run6). Repo Sync: artefactos listados para sincronizar.

**2026-03-18 (Full team run run6 — post integración Admin Cotizaciones):** Orquestador ejecutó full team run 0→9 tras la integración de "2.0 - Administrador de Cotizaciones" en BMC crm_automatizado. Paso 0: PROJECT-STATE, PROMPT leídos; IMPROVEMENT-BACKLOG-BY-AGENT no presente. Paso 0b: PARALLEL-SERIAL-PLAN-2026-03-18-run6.md. Pasos 1–2: Mapping vigente (planilla-inventory y INTEGRACION-ADMIN-COTIZACIONES reflejan Admin_Cotizaciones). Paso 3: dependencies.md y service-map.md actualizados con módulo Admin Cotizaciones y script. Paso 3b: Contract 4/4 PASS (runtime). Pasos 3c–5g: Networks, Design, Integrations, Reporter (REPORT-SOLUTION-CODING-2026-03-18-run6.md), Security, GPT/Cloud, Fiscal, Billing, Audit, Calc — estado vigente. Paso 6: JUDGE-REPORT-RUN-2026-03-18-run6.md; promedio 4.94/5; JUDGE-REPORT-HISTORICO actualizado. Paso 7: REPO-SYNC-REPORT-2026-03-18-run6.md. Paso 8–9: PROJECT-STATE y PROMPT "Próximos prompts" actualizados. Sin cambios de código.

**2026-03-18 (Integración Admin Cotizaciones):** Integración del contenido de "2.0 - Administrador de Cotizaciones" (1Ie0KCpgWhrGaAKGAS1giLo7xpqblOUOIHEg1QbOQuu0) en BMC crm_automatizado. Nueva tab Admin_Cotizaciones en destino; script `scripts/integrate-admin-cotizaciones.js` (`npm run integrate-admin-cotizaciones`); doc `docs/google-sheets-module/INTEGRACION-ADMIN-COTIZACIONES.md`. Planilla-inventory actualizado.

**2026-03-18 (Planilla principal dashboard):** Documentada la planilla que integra/genera la info para el dashboard: BMC crm_automatizado (1N-4kyT...); service account `bmc-dashboard-sheets@chatbot-bmc-live.iam.gserviceaccount.com` con acceso. Nuevo doc docs/google-sheets-module/PLANILLA-PRINCIPAL-DASHBOARD.md; planilla-inventory actualizado con enlace y cuenta.

**2026-03-18 (Full team analysis run — study evaluation):** Se ejecutó un run de análisis completo (19 roles) para evaluar el estudio externo "Análisis Integral y Modernización de la Arquitectura de Gestión Comercial". Sin implementación: no se realizaron cambios de código, config, Sheets ni triggers. Entregable: docs/team/reports/REPORT-STUDY-IMPROVEMENTS-2026-03-18.md (mejoras priorizadas por área, con rationale).

**2026-03-16 (Full team run + apply study improvements):** Orquestador ejecutando run 0→9. **Aplicado:** REPORT-STUDY-IMPROVEMENTS corregido (Shopify referencia, Pendientes_/Pagos_Pendientes, Panelin Evolution); sección 20 Fases de implementación añadida; service-map Apps Script como nodo; PROMPT-FOR-EQUIPO-COMPLETO incluye REPORT-STUDY-IMPROVEMENTS como input. Pendientes sin cambio.

**Full team run 2026-03-17 run 6 (Invoque full team):** Paso 0: state, prompt, backlog leídos. Paso 0b: PARALLEL-SERIAL-PLAN-2026-03-17-run6.md. Pasos 1–8: Mapping vigente; Dependencies/service-map fecha 2026-03-17; Contract 4/4 PASS (código); Reporter REPORT-SOLUTION-CODING-run6; Judge JUDGE-REPORT-RUN-2026-03-17-run8 (promedio 4.94/5); Repo Sync REPO-SYNC-REPORT. Paso 9: PROMPT y BACKLOG actualizados; sin prompts automatizables; pendientes 1, 3, 6, 7 (Matias).

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

- **Producción:** Cloud Run (panelin-calc) — deploy completado. URL: `gcloud run services describe panelin-calc --region=us-central1 --format='value(status.url)'`. Calculadora: `<URL>/calculadora`; Dashboard: `<URL>/finanzas`; API: `<URL>/calc`. Alternativas: Vercel, VPS Netuy.
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
- [x] **Deploy producción:** Cloud Run panelin-calc — deploy completado. Ver service-map.md §5 Deploy flow.
- [ ] **E2E validation:** Ejecutar checklist docs/team/E2E-VALIDATION-CHECKLIST.md con URL Cloud Run (post-deploy). Creado 2026-03-18.

---

## Cómo usar este archivo

- **Antes de trabajar:** Leer "Cambios recientes" y "Pendientes".
- **Después de un cambio:** Añadir fila en "Cambios recientes"; si afecta a otros, añadir en "Pendientes" o escribir Log for [Agent].
- **Sync completo:** Ejecutar "Sync project state" o full team run.

**Supervisión:** El Fiscal (bmc-dgi-impositivo) fiscaliza que el equipo cumpla este protocolo según el ranking de criticidad en [fiscal/FISCAL-PROTOCOL-STATE-RANKING.md](./fiscal/FISCAL-PROTOCOL-STATE-RANKING.md). Controla que no sucedan incumplimientos; si ocurren, comunica a los involucrados para que no pase de nuevo.
