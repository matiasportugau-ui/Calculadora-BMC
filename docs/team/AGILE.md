# Tablero Ágil (Kanban) — Desarrollo BMC/Panelin

**Estado:** convención vigente para organizar el trabajo de **desarrollo de software**
(features, bugs, refactors, deuda técnica) del proyecto.

**Filosofía:** *Fix → Deploy → Fix → Deploy* (igual que `/nxt`). **Flujo continuo (Kanban)**,
pull-based, con límites **WIP**. **Sin sprints de tiempo fijo ni story points** — no encajan
con el ritmo async/agente de este equipo. Si más adelante se quiere ritmo, ver §8 (scrumban-lite).

**Dónde vive cada cosa:**

| Doc / herramienta | Rol |
|-------------------|-----|
| `PROJECT-STATE.md` | **State-of-truth narrativo** (qué cambió y por qué; human gates cm-0/1/2). |
| **Tablero GitHub** (Issues + Projects "BMC Dev") | **Tracker vivo de tareas** — las *cards*. |
| `BACKLOG.md` | **Espejo versionado** del backlog (índice diff-able en git). |
| `AGILE.md` (este) | **Las reglas** del tablero. |
| `FULL-TEAM-RUN-DEFINITION.md` | DoD del run de equipo; alimenta la DoD de abajo. |
| `.claude/commands/nxt.md` (`/nxt`) | Snapshot priorizado; también lista las top issues abiertas. |

---

## 1. Columnas del tablero + límites WIP

| Columna | Significado | WIP |
|---------|-------------|-----|
| **Backlog** | Idea/issue capturada, sin refinar. | ∞ |
| **Ready** | Refinada, cumple Definition of Ready, lista para tomar. | 8 |
| **In Progress** | Alguien la está desarrollando (1 asignado). | 3 |
| **In Review** | PR abierto, en review / CI corriendo. | 4 |
| **Done** | Mergeada a `main` + `gate:local` verde (+ deploy si aplica). | — |

**Regla pull:** no se empieza algo nuevo si la columna excede su WIP — primero se
desbloquea o cierra lo que está en curso. El WIP bajo en *In Progress* (3) es deliberado:
fuerza terminar antes de empezar.

## 2. Definition of Ready (DoR) — para mover a *Ready*

- Título accionable + `type:*` y `area:*` asignados.
- Criterios de aceptación claros (qué es "hecho").
- Sin dependencias bloqueantes abiertas (o marcadas `status:blocked` con el bloqueo descrito).

## 3. Definition of Done (DoD) — para mover a *Done*

Hereda de `FULL-TEAM-RUN-DEFINITION.md` §6 y de la secuencia "get it live" de `/nxt`:

1. Código + criterios de aceptación cumplidos.
2. `npm run gate:local` verde (lint + test + test:api). Para UI/build grande: `gate:local:full`.
3. Commit(s) con prefijo `type:` (feat/fix/refactor/docs/chore).
4. PR mergeado a `main` → CI despliega Vercel + Cloud Run.
5. Si cambia comportamiento: línea en `PROJECT-STATE.md` → **Cambios recientes**.

## 4. Etiquetas (labels)

| Grupo | Valores | Uso |
|-------|---------|-----|
| **type** | `type:feat` · `type:fix` · `type:refactor` · `type:docs` · `type:chore` | Naturaleza del trabajo. |
| **priority** | `priority:P0` · `P1` · `P2` · `P3` | Mapea 1:1 con `/nxt` (ver §5). |
| **area** | `area:calc` · `api` · `sheets` · `auth` · `pdf` · `chat` · `deploy` · `infra` | Subsistema; sirve de swimlane y mapea a los agentes. |
| **status** | `status:ready` · `in-progress` · `in-review` · `blocked` | Opcional si la columna del tablero ya lo refleja; `blocked` sí conviene siempre. |

### Mapa `area:*` → agente dueño (`.claude/agents/`)

| area | Agente |
|------|--------|
| `calc` / `pdf` | `bmc-calc-specialist` (plano 2D: `calculo-especialist`) |
| `api` | `bmc-api-contract` |
| `sheets` | `bmc-sheets-mapping` |
| `auth` / `infra` | `bmc-security` |
| `chat` | `bmc-panelin-chat` · `bmc-panelin-mcp` |
| `deploy` | `bmc-deployment` |
| (docs transversal) | `bmc-docs-sync` |

## 5. Prioridad — mapa con `/nxt`

| `/nxt` | label | Significado |
|--------|-------|-------------|
| 🔴 CRÍTICO | `priority:P0` | Roto en producción o bloquea otro trabajo. |
| 🟠 ALTO | `priority:P1` | User-facing, alto valor de negocio. |
| 🟡 MEDIO | `priority:P2` | Calidad, completitud o deuda técnica. |
| 🔵 BAJO | `priority:P3` | Nice to have, baja urgencia. |

## 6. Flujo de una tarjeta

1. Se crea como **Issue** (plantilla `feature` / `bug` / `tech-debt`) → entra a **Backlog**.
2. Refinada (DoR) → **Ready**.
3. Se toma (asignar + branch) → **In Progress** (respetar WIP = 3).
4. PR abierto con `Closes #N` → **In Review**.
5. Merge + DoD → **Done**; el issue se cierra solo vía `Closes #N`.

## 7. Setup único en GitHub (manual)

> El tooling disponible crea **Issues** pero **no** labels, milestones ni Projects v2.
> Hacer esto **una vez** en la UI del repo `matiasportugau-ui/calculadora-bmc`:

**a) Labels** (Settings → Labels → New label) — crear los de §4. Colores sugeridos:
`type:*` gris `#6E7681` · `priority:P0` `#D73A4A` · `P1` `#D93F0B` · `P2` `#FBCA04` ·
`P3` `#1D76DB` · `area:*` violeta `#5319E7` · `status:blocked` `#0B0B0B`.

**b) Project board** (repo → Projects → New project → **Board**): nombre **"BMC Dev"**,
columnas exactas `Backlog` · `Ready` · `In Progress` · `In Review` · `Done`. Setear el
límite WIP por columna (8 / 3 / 4) en el menú de cada columna.

**c) Milestones** (opcionales, Issues → Milestones): usar como *ciclos* ligeros
(ej. `Go-Live`, `Hardening`), **no** como sprints obligatorios.

**d) Auto-add** (Project → ⋯ → Workflows → "Auto-add to project"): filtro
`is:issue is:open` para que cada issue nuevo aterrice en *Backlog* sin trabajo manual.

## 8. Cadencia (opcional — scrumban-lite)

Sin ceremonias obligatorias. Si se quiere ritmo: una **revisión semanal de ~15'**
(mover/repriorizar Backlog→Ready, cerrar Done, revisar `status:blocked`). Nada de
planning/retro formales ni velocity mientras el equipo sea chico.

---

**TL;DR:** Issues = cards. Columnas `Backlog → Ready → In Progress → In Review → Done`
con WIP. Labels `type` / `priority` / `area`. DoD = `gate:local` verde + merge a `main`.
`PROJECT-STATE.md` sigue siendo el relato; este tablero es el tracker de tareas.
