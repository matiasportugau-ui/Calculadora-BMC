# Cronograma y seguimiento — un solo panel

**Propósito:** Saber **en qué fase estás**, **qué tareas tocan**, **qué sigue** y **cómo dar seguimiento** sin saltar entre diez documentos. Este archivo es el **índice operativo**; los datos viven en el JSON maestro y en tu sesión.

**Procedimiento paso a paso (WhatsApp → Mercado Libre → Correo):** [`PROCEDIMIENTO-CANALES-WA-ML-CORREO.md`](./PROCEDIMIENTO-CANALES-WA-ML-CORREO.md) — checklist; **pipeline paralelo sin intervención:** `npm run channels:automated` (`--write` opcional); onboarding legible: `npm run channels:onboarding`. Runbook async: [`orientation/ASYNC-RUNBOOK-UNATTENDED.md`](./orientation/ASYNC-RUNBOOK-UNATTENDED.md).

**Runbook asíncrono (pipeline completo, sin depender de Matias en cada paso):** [`orientation/ASYNC-RUNBOOK-UNATTENDED.md`](./orientation/ASYNC-RUNBOOK-UNATTENDED.md).

**Plan maestro (Fase 0→5, tabla de rutas en el repo):** [`orientation/EXECUTION-PLAN-MASTER.md`](./orientation/EXECUTION-PLAN-MASTER.md).

---

## 1. Comando automatizado (empezar aquí)

En la raíz del repo:

```bash
npm run project:compass
```

Arranque con smoke + brújula (deja el doc canónico enlazado al final):

```bash
npm run channels:onboarding
```

Hace en un solo paso:

1. `program:status` — fase actual, % aproximado de tareas, streams, **próximos pasos sugeridos**.
2. `followup due` — recordatorios **vencidos** (CLI `followup`, mismo almacén que `/api/followups`).

Salida JSON (para agentes / integración):

```bash
npm run project:compass -- --json
```

Salida solo del programa (sin follow-ups):

```bash
npm run program:status
npm run program:status -- --json
```

Smoke rápido de **producción** (sin servidor local; usa `BMC_API_BASE` o URL por defecto Cloud Run):

```bash
npm run smoke:prod
```

Correo **ventas** → CRM (tras `npm run panelsim-update` en el repo IMAP, con API local o `BMC_API_BASE`):

```bash
npm run email:ingest-snapshot -- --dry-run --limit 5
npm run email:ingest-snapshot -- --limit 3
```

---

## 2. Fuentes de verdad (qué editar y cuándo)

| Qué | Archivo | Cuándo actualizar |
|-----|---------|-------------------|
| **Fases, streams, tareas, `currentPhaseId`** | [`orientation/programs/bmc-panelin-master.json`](./orientation/programs/bmc-panelin-master.json) | Al cerrar una tarea, cambiar de fase o replanificar (ideal: semanal + al hito). |
| **Diario de cambios del repo** | [`PROJECT-STATE.md`](./PROJECT-STATE.md) | Tras cambios que afecten al equipo o al deploy (protocolo AGENTS). |
| **Cockpit de la sesión / semana** | [`SESSION-WORKSPACE-CRM.md`](./SESSION-WORKSPACE-CRM.md) | Inicio o fin de bloque de trabajo: foco, logros §2, próximas acciones §4. |
| **Recordatorios con fecha** | `npm run followup` / API followups | Cuando necesites “volver a esto el día X”. |

Arquitectura y buenas prácticas del programa: [`orientation/PROGRAM-ARCHITECTURE.md`](./orientation/PROGRAM-ARCHITECTURE.md). Plantilla de cronograma genérico: [`orientation/CHRONOGRAM-TEMPLATE.md`](./orientation/CHRONOGRAM-TEMPLATE.md).

---

## 3. Evolución del proyecto (lectura rápida)

- **Fases** `p1` → `p2` → `p3` están definidas en el JSON (`phases[]`). La activa es `currentPhaseId`.
- **Progreso ~%** = tareas con `status: done` / total de tareas en todos los streams (orden de magnitud, no ciencia exacta).
- **Próximos pasos** en consola priorizan `doing` y luego `todo` por `estHours` (ajustable editando tareas).

---

## 4. Rutina sugerida (seguimiento cercano)

| Frecuencia | Acción |
|------------|--------|
| **Cada día / bloque** | `npm run project:compass` → elegir **una** tarea de la lista → ejecutar. |
| **Al cerrar algo** | Marcar tarea en `bmc-panelin-master.json` (`done`) + línea corta en `SESSION-WORKSPACE-CRM.md` §2. |
| **Semanal** | Revisar criterios de salida de la fase actual + `followup list` / posponer lo que no aplica. |
| **Tras deploy** | `npm run pre-deploy` + entrada en `PROJECT-STATE.md` si cambia comportamiento compartido. |

---

## 5. Relación con full team y runs numerados

- **Run numerado** (MATPROMT, artefactos): [`PROMPT-FOR-EQUIPO-COMPLETO.md`](./PROMPT-FOR-EQUIPO-COMPLETO.md), [`INVOQUE-FULL-TEAM.md`](./INVOQUE-FULL-TEAM.md).
- Este **cronograma** no reemplaza el run; **alinea** el trabajo diario con el mismo mapa de tareas multi-área.

---

## 6. Punteros técnicos recientes (CRM / canales)

- WhatsApp Cloud API: webhook `GET/POST /webhooks/whatsapp`, variables `WHATSAPP_*` — ver `PROJECT-STATE.md` (Cambios recientes) y `server/index.js`.
- Follow-ups en API: `GET/POST/PATCH /api/followups*` — ver `AGENTS.md`.
