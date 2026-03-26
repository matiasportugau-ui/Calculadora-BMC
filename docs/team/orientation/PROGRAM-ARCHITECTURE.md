# Arquitectura de orientación de programa

## 1. Problema que resuelve

Con **muchas áreas** (producto, CRM, ML, infra, fiscal, correo, deploy), el riesgo es perder:

- **Altura:** en qué fase macro estás (fundaciones vs escalar vs optimizar).
- **Anchura:** qué stream avanzó y cuál está bloqueado.
- **Tiempo:** orden de magnitud de esfuerzo restante (no pretende ser Gantt exacto).

Esta arquitectura separa **tres capas** que ya usás en el repo y les suma una cuarta **máquina-legible**:

| Capa | Archivo / herramienta | Rol |
|------|------------------------|-----|
| **Historial y pendientes narrativos** | `docs/team/PROJECT-STATE.md` | Qué pasó, qué falta en prosa; fuente única de verdad *humana*. |
| **Cockpit de sesión** | `docs/team/SESSION-WORKSPACE-CRM.md` | Foco del día/semana, workstreams kanban-lite. |
| **Seguimiento accionable** | `npm run followup`, `/api/followups` | Recordatorios y cola “due” sin mezclar con el roadmap. |
| **Mapa de programa (fases + tareas)** | `orientation/programs/*.json` + `npm run program:status` | Dónde estás en el **cronograma**, % aproximado, próximos pasos. |

## 2. Modelo mental: fases × streams

- **Fases (vertical):** secuencia o solapamiento de etapas con **criterios de salida**. Ej.: “Fundaciones”, “Operación comercial integrada”, “Escala y hardening”.
- **Streams (horizontal):** áreas que **avanzan en paralelo** (Calculadora, CRM/ML, Infra, Fiscal/compliance). No terminan a la vez; **convergen** en puntos definidos (ver §4).

**Regla:** una tarea pertenece a **un stream** y enlaza a **una fase** por contexto (en el JSON: `phaseHint` o agrupación por archivo).

## 3. Divergencia y convergencia natural

- **Diverge:** cada stream acumula tareas `todo` / `doing` sin bloquear a los demás mientras no haya dependencia explícita (`dependsOn` en el JSON).
- **Converge:** en **puntos de convergencia** (deploy, release, cierre mensual fiscal, “run” del equipo completo): todas las áreas deben cumplir un **mínimo** (checklist). El JSON lista `convergencePoints` con referencias a comandos o docs.
- **Tareas realizadas → próximas:** al marcar `done`, el script `program:status` muestra las siguientes `todo` sin depender de reescribir el PROMPT completo.

## 4. Buenas prácticas

1. **Un solo programa maestro activo** por repo (`bmc-panelin-master.json`). Otros proyectos: copiá la plantilla y renombrá.
2. **Sincronización semanal:** 10 min para alinear `currentPhaseId`, estados de fase y tareas con la realidad; luego un párrafo en `PROJECT-STATE` si hubo corrimiento fuerte.
3. **Estimaciones:** `estHours` es **orden de magnitud** (2 / 4 / 8 / 16); no micromanagement.
4. **Definition of Done** por tarea: campo opcional `doneWhen` en el JSON (texto corto).
5. **No duplicar:** el detalle largo vive en planes (`docs/team/plans/`, PANELSIM); aquí solo **punteros** (`refs`).

## 5. Cronograma y “altura” del proyecto

- Cada **fase** tiene `estWeeks` como rango (ej. `"3-6"`) — tiempo **humano-calendario** orientativo, no SLA.
- **Altura** = `currentPhaseId` + resumen de fases anteriores `done`.
- **Progreso % por cantidad** = tareas `done` / tareas totales (peso uniforme).
- **Progreso % por esfuerzo** (`pctWeighted` en `npm run program:status -- --json`) = suma de `estHours` de tareas `done` / suma de `estHours` de todas las tareas (solo tareas con horas estimadas > 0 cuentan en el denominador de horas).

## 6. Cómo extender hacia “casi un juego”

- Misma fuente JSON: añadí `xp` o `badges` en una v2 **solo** si ya tenés hábito de actualizar el archivo semanalmente.
- Hoy el “game loop” mínimo es: **`program:status` matinal** + **`followup due`** + **una** decisión CEO en `SESSION-WORKSPACE`.

## 7. Referencias cruzadas

- Equipo de roles: `docs/team/PROJECT-TEAM-FULL-COVERAGE.md`
- Runs numerados: `PROMPT-FOR-EQUIPO-COMPLETO.md`
- Contrato API: `GET /capabilities`, `npm run test:contracts`
