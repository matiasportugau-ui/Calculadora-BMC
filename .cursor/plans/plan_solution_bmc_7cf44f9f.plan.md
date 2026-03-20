---
name: Plan Solution BMC
overview: "Plan para el equipo Solution: desbloquear validación del KPI Report, actualizar handoffs, Repo Sync (crear y configurar bmc-dashboard-2.0 y bmc-development-team), Dependabot y Go-live."
todos: []
isProject: false
---

# Plan Solution — BMC Dashboard

Plan para el equipo **Solution** y handoff con **Coding**, basado en REPORT-SOLUTION-CODING.md, IMPLEMENTATION-PLAN-SOLUTION-CODING.md y PROJECT-STATE.md.

---

## Estado actual

| Área | Estado | Bloqueador |
|------|--------|------------|
| KPI Report (endpoint + UI) | Implementado en código | GET /api/kpi-report devuelve 404 en runtime |
| REPORT-SOLUTION-CODING | API/UI marcados "Pendiente" | Docs desactualizados |
| Solution validation | Pendiente | No puede validar en browser si 404 |
| Go-live | Parcial | 1.4, 2.x, 3.x, 5.x, 6.x pendientes |
| Dependabot | 7 vulnerabilidades | 2 moderate (esbuild, @tootallnate/once) |
| Repo Sync | No configurado | BMC_DASHBOARD_2_REPO, BMC_DEVELOPMENT_TEAM_REPO vacíos |

---

## Fase 1 — Desbloquear validación KPI Report

### 1.1 Diagnosticar 404 de /api/kpi-report (Coding)
### 1.2 Solution valida en browser

---

## Fase 2 — Actualizar documentos Solution/Coding

### 2.1 REPORT-SOLUTION-CODING.md
### 2.2 IMPLEMENTATION-PLAN-SOLUTION-CODING.md
### 2.3 GO-LIVE-DASHBOARD-CHECKLIST.md

---

## Fase 3 — Vulnerabilidades Dependabot (Coding)

Ejecutar `npm audit fix` (sin --force). Documentar si quedan abiertas.

---

## Fase 4 — Repo Sync (crear repos, configurar, verificar)

**Referencia:** [docs/team/REPO-SYNC-SETUP.md](docs/team/REPO-SYNC-SETUP.md)

### 4.1 Crear los repos en GitHub

| Repo | Contenido inicial |
|------|-------------------|
| **bmc-dashboard-2.0** | dashboard/, bmcDashboard.js, docs/google-sheets-module/, DASHBOARD-INTERFACE-MAP, planilla-inventory |
| **bmc-development-team** | docs/team/, .cursor/agents/, .cursor/skills/, reportes Judge, IMPLEMENTATION-PLAN, REPORT-SOLUTION-CODING |

### 4.2 Configurar .env

Añadir en `.env` (Opción A: paths locales, o B: URLs remotas):

```env
BMC_DASHBOARD_2_REPO=/path/to/bmc-dashboard-2.0
BMC_DEVELOPMENT_TEAM_REPO=/path/to/bmc-development-team
```

### 4.3 Documentar en PROJECT-STATE

En "Estado por área", añadir sección Repos (Repo Sync) con paths o URLs.

### 4.4 Verificación

Ejecutar full team run o invocar `bmc-repo-sync-agent` — el paso 7 sincronizará automáticamente tras configurar.

---

## Fase 5 — Go-live (manual / Solution aprueba)

Items 1.4, 2.x, 3.x, 6.1 del GO-LIVE-DASHBOARD-CHECKLIST.

---

## Orden de ejecución

Fase 1 → Fase 2 → Fase 3 → Fase 4 (Repo Sync) → Fase 5