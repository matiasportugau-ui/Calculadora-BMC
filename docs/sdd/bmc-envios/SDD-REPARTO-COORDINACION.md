---
title: SDD — Coordinación de Reparto
version: 0.2
date: 2026-08-07
status: Implementing (MVP API + UI bar)
system_slug: bmc-reparto-coordinacion
---

# Coordinación de Reparto

## Resumen

Al organizar pedidos en `/logistica`, el batch pasa a **En Coordinación** hasta **Confirmar coordinación**, que genera **Nº de Reparto** `REP-YYYY-MM-DD-NNN`, snapshot en Postgres y plan Drive (híbrido legajo + `_Repartos/`).

## As-built MVP

| Pieza | Path | Status |
|-------|------|--------|
| Nº REP | `src/utils/logistica/repartoNumber.js` | DONE |
| FSM batch | `src/utils/logistica/repartoStatus.js` | DONE |
| DDL | `server/lib/enviosDb.js` REPARTOS_DDL | DONE |
| API | `server/routes/repartos.js` | DONE |
| UI bar | `src/components/logistica/RepartoBar.jsx` | DONE |
| Wire app | `BmcLogisticaApp.jsx` | DONE (local + API if token/DB) |
| Drive tree write | phase 3 | TARGET (`drivePlan` en confirm payload) |
| Client Drive `.bmc-envios.json` | GIS dual-write | **DONE** — [`SDD-DRIVE-COORDINACIONES.md`](./SDD-DRIVE-COORDINACIONES.md) (completed flag on confirm; server `_Repartos/` still TARGET) |

## API

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/repartos/health` | |
| GET | `/api/repartos` | list |
| POST | `/api/repartos` | create `en_coordinacion` |
| GET | `/api/repartos/:id` | + events + docs |
| PUT | `/api/repartos/:id` | autosave (not if coordinado) |
| POST | `/api/repartos/:id/confirm` | → coordinado + drivePlan |
| GET | `/api/repartos/:id/events` | timeline |

## Drive

### Client dual-write (AS-BUILT)

Operator **Guardar** / **Confirmar** writes resumable `ENV-….bmc-envios.json` via GIS (`drive.file`) under `Panelin BMC Cotizaciones/BMC Envíos Coordinaciones/`. Calculadora Drive panel can open → `/logistica`. Spec: [`SDD-DRIVE-COORDINACIONES.md`](./SDD-DRIVE-COORDINACIONES.md).

### Server híbrido (TARGET phase 3)

```
_Repartos/YYYY/YYYY-MM/REP-…/   ← canónico (DRIVE_REPARTOS_FOLDER_ID)
Clientes/{slug}/Entregas/{fecha}_REP-…/  ← legajo + shortcuts
```

Confirm today stores `drivePlan` path in snapshot only (no materialization).

## Estados

- Batch: draft → **en_coordinacion** → **coordinado** → en_curso → cerrado  
- Distinto de Ventas chips y de `stopStatusFsm`  
- Confirm = snapshot inmutable  

## Tests

```bash
node tests/repartoNumber.test.js
node tests/repartoStatus.test.js
```
