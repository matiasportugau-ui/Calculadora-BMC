# Plan de implementación — Mejoras aceptadas por agente

**Origen:** Propuestas de los 19 agentes en [PROPUESTAS-MEJORAS-POR-AGENTE-2026-03-19.md](./PROPUESTAS-MEJORAS-POR-AGENTE-2026-03-19.md). Todas aceptadas.

**Propósito:** Plan ordenado para implementar las mejoras, agrupadas por fase, con dependencias, ownership y criterios de aceptación.

---

## Resumen ejecutivo

| Fase | Contenido | Esfuerzo | Dependencias |
|------|-----------|----------|--------------|
| **1** | Documentación, checklists, plantillas (bajo esfuerzo) | 1–2 días | Ninguna |
| **2** | Scripts y automatización (health check, contract validation) | 1–2 días | Fase 1 |
| **3** | Endpoint diagnóstico, muestras API, convenciones | 1 día | Fase 1 |
| **4** | Manual / Matias (workbook staging, logs, OAuth) | Variable | — |

---

## Fase 1 — Documentación y checklists (bajo esfuerzo)

**Objetivo:** Crear todos los documentos, checklists y plantillas que los agentes pidieron. Sin código nuevo.

### 1.1 Mapping

| # | Entregable | Ubicación | Owner |
|---|------------|-----------|-------|
| 1 | Decision log de cambios estructurales | `docs/google-sheets-module/DECISION-LOG-ESTRUCTURA.md` | Mapping |
| 2 | Convención: notificación cuando cambia planilla | Añadir a PROJECT-STATE "Cómo usar" | Orchestrator |

### 1.2 Design

| # | Entregable | Ubicación | Owner |
|---|------------|-----------|-------|
| 1 | Restricciones de negocio documentadas | `docs/bmc-dashboard-modernization/RESTRICCIONES-NEGOCIO.md` | Design |
| 2 | Design system básico | `docs/bmc-dashboard-modernization/DESIGN-SYSTEM.md` | Design |
| 3 | Descripción visual por sección (si no hay screenshots) | `docs/bmc-dashboard-modernization/ESTADO-VISUAL-SECCIONES.md` | Design |

### 1.3 Sheets Structure

| # | Entregable | Ubicación | Owner |
|---|------------|-----------|-------|
| 1 | Checklist ejecutable por tab | Extender `AUTOMATIONS-BY-WORKBOOK.md` con checklists detallados | Sheets Structure |
| 2 | Plantilla de validación por columna | `docs/google-sheets-module/PLANTILLA-VALIDACION-COLUMNAS.md` | Sheets Structure |
| 3 | Orden de creación documentado | `docs/google-sheets-module/ORDEN-CREACION-TABS.md` | Sheets Structure |

### 1.4 Networks

| # | Entregable | Ubicación | Owner |
|---|------------|-----------|-------|
| 1 | Documentación de decisiones de infra | `docs/HOSTING-DECISION-LOG.md` o sección en HOSTING-EN-MI-SERVIDOR | Networks |

### 1.5 Dependencies

| # | Entregable | Ubicación | Owner |
|---|------------|-----------|-------|
| 1 | Convención: actualizar ENDPOINTS o service-map al añadir ruta | `docs/bmc-dashboard-modernization/ENDPOINTS.md` + nota en service-map | Dependencies |
| 2 | Matriz de dependencias env vars | `docs/bmc-dashboard-modernization/ENV-VARS-MATRIX.md` | Dependencies |

### 1.6 Integrations

| # | Entregable | Ubicación | Owner |
|---|------------|-----------|-------|
| 1 | Estado de OAuth documentado | `docs/integraciones/OAUTH-ESTADO.md` | Integrations |
| 2 | Checklist pre-go-live de integraciones | `docs/integraciones/CHECKLIST-PRE-GO-LIVE.md` | Integrations |

### 1.7 GPT/Cloud

| # | Entregable | Ubicación | Owner |
|---|------------|-----------|-------|
| 1 | Checklist de drift | `docs/openapi/CHECKLIST-DRIFT-OPENAPI.md` | GPT/Cloud |

### 1.8 Fiscal

| # | Entregable | Ubicación | Owner |
|---|------------|-----------|-------|
| 1 | FISCAL-PROTOCOL con ejemplos concretos por nivel | Extender `fiscal/FISCAL-PROTOCOL-STATE-RANKING.md` | Fiscal |
| 2 | Log de incumplimientos resueltos | `docs/team/fiscal/LOG-INCUMPLIMIENTOS-RESUELTOS.md` | Fiscal |
| 3 | Contexto restricciones fiscales (si aplica) | `docs/team/fiscal/CONTEXTO-FISCAL-DASHBOARD.md` | Fiscal |

### 1.9 Billing

| # | Entregable | Ubicación | Owner |
|---|------------|-----------|-------|
| 1 | Reglas de negocio explícitas | `docs/billing/REGLAS-NEGOCIO-FACTURACION.md` | Billing |
| 2 | Checklist de cierre mensual | `docs/billing/CHECKLIST-CIERRE-MENSUAL.md` | Billing |
| 3 | Formato estándar export (especificación) | `docs/billing/FORMATO-EXPORT-FACTURACION.md` | Billing |

### 1.10 Reporter

| # | Entregable | Ubicación | Owner |
|---|------------|-----------|-------|
| 1 | Plantilla de handoff | `docs/bmc-dashboard-modernization/PLANTILLA-HANDOFF.md` | Reporter |
| 2 | Prioridades en PROJECT-STATE | Añadir clasificación bloqueante/alto/medio/bajo a Pendientes | Orchestrator |

### 1.11 Orchestrator

| # | Entregable | Ubicación | Owner |
|---|------------|-----------|-------|
| 1 | Criterios de skip documentados | `docs/team/CRITERIOS-SKIP-PASOS.md` | Orchestrator |
| 2 | Pendientes por prioridad | Actualizar estructura de Pendientes en PROJECT-STATE | Orchestrator |

### 1.12 Contract

| # | Entregable | Ubicación | Owner |
|---|------------|-----------|-------|
| 1 | Contrato versionado | Añadir versión/fecha a planilla-inventory y DASHBOARD-INTERFACE-MAP | Contract |

### 1.13 Calc

| # | Entregable | Ubicación | Owner |
|---|------------|-----------|-------|
| 1 | Constantes y fórmulas documentadas | `docs/calc/CONSTANTES-Y-FORMULAS.md` | Calc |
| 2 | Flujo Cotizaciones → Sheets documentado | `docs/calc/FLUJO-COTIZACIONES-SHEETS.md` | Calc |

### 1.14 Security

| # | Entregable | Ubicación | Owner |
|---|------------|-----------|-------|
| 1 | Checklist de seguridad pre-deploy | `docs/security/CHECKLIST-SEGURIDAD-PRE-DEPLOY.md` | Security |
| 2 | .env.example completo y actualizado | Revisar y completar `.env.example` | Security |
| 3 | Documentación flujos OAuth | `docs/security/FLUJOS-OAUTH.md` | Security |

### 1.15 Judge

| # | Entregable | Ubicación | Owner |
|---|------------|-----------|-------|
| 1 | Entregables esperados por agente | Extender `JUDGE-CRITERIA-POR-AGENTE.md` con columna "Entregable" | Judge |

### 1.16 Parallel/Serial

| # | Entregable | Ubicación | Owner |
|---|------------|-----------|-------|
| 1 | Grafo de dependencias entre pasos | `docs/team/parallel-serial/GRAFO-DEPENDENCIAS-PASOS.md` | Parallel/Serial |

### 1.17 Repo Sync

| # | Entregable | Ubicación | Owner |
|---|------------|-----------|-------|
| 1 | Mapa de artefactos por repo | Extender `REPO-SYNC-SETUP.md` con tabla artefacto → repo | Repo Sync |
| 2 | Checklist pre-push | `docs/team/REPO-SYNC-CHECKLIST-PRE-PUSH.md` | Repo Sync |
| 3 | Log de syncs | `docs/team/REPO-SYNC-LOG.md` (plantilla) | Repo Sync |

### 1.18 Chat Equipo

| # | Entregable | Ubicación | Owner |
|---|------------|-----------|-------|
| 1 | Preguntas frecuentes | `docs/team/CHAT-EQUIPO-FAQ.md` | Chat Equipo |

---

## Fase 2 — Scripts y automatización

**Objetivo:** Scripts ejecutables que los agentes puedan usar.

### 2.1 Health check unificado (Dependencies)

| # | Entregable | Ubicación | Descripción |
|---|------------|-----------|-------------|
| 1 | `scripts/health-check.sh` | `scripts/health-check.sh` | Prueba 3001, 3849, 5173, /api/*, /health; reporte OK/FAIL |

### 2.2 Contract validation (Contract)

| # | Entregable | Ubicación | Descripción |
|---|------------|-----------|-------------|
| 1 | `scripts/validate-api-contract.sh` | `scripts/validate-api-contract.sh` | curl a endpoints, compara con contrato; PASS/FAIL |

### 2.3 Export estructura planillas (Mapping)

| # | Entregable | Ubicación | Descripción |
|---|------------|-----------|-------------|
| 1 | Script o proceso export | `scripts/export-planilla-structure.sh` o Node | Requiere credenciales Sheets; exporta tabs/columnas a JSON |

---

## Fase 3 — Endpoint y muestras

**Objetivo:** Endpoint de diagnóstico y muestras de respuestas API.

### 3.1 Endpoint /api/diagnostic (Audit/Debug)

| # | Entregable | Ubicación | Descripción |
|---|------------|-----------|-------------|
| 1 | Ruta GET /api/diagnostic | `server/routes/` o bmcDashboard.js | Dev/staging: versión, env vars presentes (sin valores), estado Sheets, integraciones |

### 3.2 Muestras de respuesta API (Mapping, Contract)

| # | Entregable | Ubicación | Descripción |
|---|------------|-----------|-------------|
| 1 | Carpeta `docs/api-samples/` | `docs/api-samples/` | JSON de ejemplo por endpoint (kpi-financiero, ventas, etc.) |

---

## Fase 4 — Manual / Matias

**Objetivo:** Tareas que requieren acción manual o acceso externo.

| # | Entregable | Owner | Notas |
|---|------------|-------|-------|
| 1 | Workbook de staging | Matias | Copia del workbook principal |
| 2 | Acceso/export logs Cloud Run | Matias | Configurar export o read-only |
| 3 | Logs webhooks Shopify/ML | Matias | Si hay sistema de logging |
| 4 | Snapshot GPT Builder config | Matias | Export manual desde Builder |
| 5 | Capturas/mockups dashboard | Matias | Screenshots por sección |

---

## Orden de ejecución sugerido

```
Fase 1.1–1.18 (documentación) — puede ejecutarse en paralelo por agente
    ↓
Fase 2.1 (health-check.sh) — depende de service-map para endpoints
Fase 2.2 (validate-api-contract.sh) — depende de muestras Fase 3.2
Fase 3.2 (muestras API) — puede hacerse con servidor corriendo
Fase 3.1 (endpoint diagnostic) — requiere código
    ↓
Fase 4 — según disponibilidad de Matias
```

---

## Progreso de implementación (2026-03-19)

### Fase 1 — Completa
- [x] DECISION-LOG-ESTRUCTURA.md
- [x] RESTRICCIONES-NEGOCIO.md
- [x] DESIGN-SYSTEM.md
- [x] ESTADO-VISUAL-SECCIONES.md
- [x] CRITERIOS-SKIP-PASOS.md
- [x] CHAT-EQUIPO-FAQ.md
- [x] CHECKLIST-SEGURIDAD-PRE-DEPLOY.md
- [x] FLUJOS-OAUTH.md
- [x] ENV-VARS-MATRIX.md
- [x] ENDPOINTS.md
- [x] PLANTILLA-VALIDACION-COLUMNAS.md
- [x] ORDEN-CREACION-TABS.md
- [x] HOSTING-DECISION-LOG.md
- [x] OAUTH-ESTADO.md
- [x] CHECKLIST-PRE-GO-LIVE (integraciones)
- [x] CHECKLIST-DRIFT-OPENAPI.md
- [x] FISCAL: ejemplos, LOG-INCUMPLIMIENTOS, CONTEXTO-FISCAL
- [x] Billing: REGLAS, CHECKLIST-CIERRE, FORMATO-EXPORT
- [x] PLANTILLA-HANDOFF.md
- [x] CONSTANTES-Y-FORMULAS.md
- [x] FLUJO-COTIZACIONES-SHEETS.md
- [x] GRAFO-DEPENDENCIAS-PASOS.md
- [x] REPO-SYNC: mapa artefactos, CHECKLIST-PRE-PUSH, LOG
- [x] planilla-inventory versionado
- [x] JUDGE-CRITERIA con columna Entregable (Mapping)
- [x] AUTOMATIONS-BY-WORKBOOK checklists extendidos

### Fase 2 — Completa
- [x] scripts/health-check.sh
- [x] scripts/validate-api-contract.sh
- [x] scripts/export-planilla-structure.sh (documentación)

### Fase 3 — Completa
- [x] GET /api/diagnostic (solo dev)
- [x] docs/api-samples/ (README + kpi-financiero.sample.json)

### Fase 4 — Manual (Matias)
- [ ] Workbook staging, logs Cloud Run, snapshot GPT Builder, capturas

---

## Criterios de aceptación por fase

### Fase 1
- [x] Documentos clave creados
- [x] PROJECT-STATE tiene Pendientes clasificados por prioridad
- [x] .env.example está completo

### Fase 2
- [ ] `bash scripts/health-check.sh` genera reporte OK/FAIL
- [ ] `bash scripts/validate-api-contract.sh` valida contra contrato
- [ ] Script export planilla (si aplica) genera JSON válido

### Fase 3
- [ ] GET /api/diagnostic devuelve JSON (solo en dev)
- [ ] docs/api-samples/ tiene al menos 3 endpoints documentados

### Fase 4
- [ ] Según lo que Matias pueda ejecutar

---

## Referencias

- Propuestas originales: [PROPUESTAS-MEJORAS-POR-AGENTE-2026-03-19.md](./PROPUESTAS-MEJORAS-POR-AGENTE-2026-03-19.md)
- PROJECT-STATE: [PROJECT-STATE.md](./PROJECT-STATE.md)
- service-map: [../bmc-dashboard-modernization/service-map.md](../bmc-dashboard-modernization/service-map.md)
