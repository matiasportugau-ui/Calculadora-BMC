# Project State — BMC/Panelin

**Última actualización:** 2026-03-16 (Full team run — Go-live & Hardening, 19/19 Judge scores)

Fuente única de estado para que todos los agentes estén actualizados. Ver [PROJECT-TEAM-FULL-COVERAGE.md](./PROJECT-TEAM-FULL-COVERAGE.md) para el protocolo de sincronización.

**Evolución:** Roles, skills, áreas y variables no son estáticos; se ajustan tras modificaciones o crecimiento del dominio. Ver PROJECT-TEAM-FULL-COVERAGE §0.

---

## Cambios recientes

> Historial completo: [CAMBIOS-RECIENTES-ARCHIVE.md](./CAMBIOS-RECIENTES-ARCHIVE.md)

**Full team run 2026-03-16 (Go-live & Hardening):** Orquestador ejecutó run completo 0→9 con agenda activa (7 ítems). Paso 0: PROJECT-STATE, PROMPT, BACKLOG leídos. Paso 0b: PARALLEL-SERIAL-PLAN-2026-03-16-run2.md creado. Pasos 1–2: Mapping vigente; planilla-inventory y DASHBOARD-INTERFACE-MAP consistentes. Pasos 3–3c: Dependencies vigentes; Contract 4/4 (kpi-report 404 en runtime — requiere restart servidor); Networks vigente. Pasos 4–5g: Design, Integrations, Reporter, Security, GPT, Fiscal, Billing, Audit, Calc — todos ejecutados. Paso 5f: npm audit: 7 vulns (5 low esbuild/teeny-request, 2 moderate esbuild/vite). Paso 6: Judge evaluó 19/19 agentes formalmente por primera vez (promedio 4.78/5); JUDGE-REPORT-RUN-2026-03-16-run6.md y JUDGE-REPORT-HISTORICO actualizados. Paso 7: Repo Sync — repos no configurados en .env; skip documentado. Paso 8: PROJECT-STATE actualizado. Paso 9: IMPLEMENTATION-PLAN-POST-GO-LIVE.md generado (fases A–E: tabs manuales, triggers, kpi-report verify, npm audit, deploy, guía vendedores, E2E, Repo Sync).

**Full team run 2026-03-17:** Orquestador ejecutó run completo 0→9 con full project sync y Repo Sync. Paso 0: PROJECT-STATE, PROMPT, BACKLOG leídos. Paso 0b: PARALLEL-SERIAL-PLAN-2026-03-17.md creado. Pasos 1–2: Plan & proposal confirmado; Mapping vigente. Pasos 3–3c: Dependencies, Contract (3/3 passed; kpi-report 404 en runtime — verificar mount), Networks. Pasos 4–5g: Design, Integrations, Reporter, Security, GPT, Fiscal, Billing, Audit, Calc ejecutados. Paso 5f: run_audit.sh; reporte .cursor/bmc-audit/latest-report-2026-03-17.md. Paso 6: Judge report actualizado. Paso 7: Repo Sync — repos no configurados; creado REPO-SYNC-SETUP.md. Paso 8–9: PROJECT-STATE actualizado; propagación §4. service-map: /api/kpi-report añadido. Git: stage, commit, push a origin main.

**KPI Report (inicio) 2026-03-16:** Full team run para implementación. Nuevo endpoint GET /api/kpi-report que agrega kpi-financiero, stock-kpi, proximas-entregas, metas-ventas, ventas en un payload único: totalPendiente, estaSemana, proximaSemana, entregasEstaSemana, bajoStock, objetivoMensual, realAcumulado, equilibrio. Bloque UI "KPI Report — Inicio" en dashboard (#inicio): 4 cards + card equilibrio (meta vs real). Artefactos: MAPPING-KPI-REPORT-VALIDATION.md, DESIGN-PROPOSAL-KPI-REPORT-INICIO.md, REPORT-SOLUTION-CODING.md, IMPLEMENTATION-PLAN-SOLUTION-CODING.md. planilla-inventory y DASHBOARD-INTERFACE-MAP actualizados.

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
- [ ] **npm audit fix:** 7 vulns (5 low teeny-request, 2 moderate esbuild/vite). `npm audit fix` resuelve low; `npm audit fix --force` actualiza vite@8 (breaking). Evaluar con Matias.
- [ ] **kpi-report runtime:** Verificar que /api/kpi-report retorna 200 (o 503) tras restart servidor. Si 404 persiste, verificar mount en server/index.js.
- [ ] **Guía vendedores:** Crear docs/GUIA-RAPIDA-VENDEDORES.md post-deploy.
- [ ] **Deploy producción:** Cloud Run o VPS Netuy. Ver IMPLEMENTATION-PLAN-POST-GO-LIVE.md §Fase B.

---

## Cómo usar este archivo

- **Antes de trabajar:** Leer "Cambios recientes" y "Pendientes".
- **Después de un cambio:** Añadir fila en "Cambios recientes"; si afecta a otros, añadir en "Pendientes" o escribir Log for [Agent].
- **Sync completo:** Ejecutar "Sync project state" o full team run.

**Supervisión:** El Fiscal (bmc-dgi-impositivo) fiscaliza que el equipo cumpla este protocolo según el ranking de criticidad en [fiscal/FISCAL-PROTOCOL-STATE-RANKING.md](./fiscal/FISCAL-PROTOCOL-STATE-RANKING.md). Controla que no sucedan incumplimientos; si ocurren, comunica a los involucrados para que no pase de nuevo.
