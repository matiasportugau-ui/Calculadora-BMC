# Cómo se trabaja en BMC / Panelin
## Guion del facilitador — 50 min + 10 min de práctica

**Audiencia:** equipo completo BMC/Panelin (humanos y quienes operan agentes).
**Repo:** https://github.com/matiasportugau-ui/Calculadora-BMC
**Live:** https://calculadora-bmc.vercel.app
**Fecha de datos:** 15 ago 2026 (America/Montevideo).

**Proceso canónico de esta sesión (solo estos cuatro):**
1. `docs/team/AGILE.md`
2. `CLAUDE.md`
3. `AGENTS.md`
4. `.github/PULL_REQUEST_TEMPLATE.md`

**Flag:** `CONTRIBUTING.md` está **stale en arquitectura** (dice “un solo archivo JSX”, “no fetch / no localStorage”). No proyectarlo como mapa del sistema. Las reglas de plata (`p(item)`, `ceil`, IVA) que siguen ahí se citan al final, no como arquitectura.

**No inventar proceso.** Si no está en esos cuatro (o el flag de CONTRIBUTING), se dice “no está escrito” o se cita el archivo extra como *hecho de producto / higiene*, no como regla nueva.

**Proyectar:** AGILE §§1–3 y el PR template. No proyectar HANDOFF-*.

---

## Objetivo (leerlo en voz alta, 1 min)

Al salir, cada persona puede:

1. Tomar una issue **Ready**, abrir un branch y saber cuándo está **Done**.
2. Correr el gate correcto y llenar el PR sin inventar checklist.
3. No romper plata, voz ni human gates.
4. Dejar de alimentar la cola de 175 PRs draft.

---

## 0. Setup — 2 min

Abrir juntos tres pestañas:

- GitHub Projects BMC Dev (Backlog, Ready, In Progress, In Review, Done)
- docs/team/PROJECT-STATE.md sección Cambios recientes
- docs/team/AGILE.md

Decir (AGILE): Issues = cards. PROJECT-STATE es el relato. AGILE son las reglas.

Filosofía (AGILE): Fix, Deploy, Fix, Deploy. Kanban continuo, pull-based. Sin sprints ni story points.

## 1. Qué es este repo — 6 min

Producto: cotizador de paneles BMC Uruguay / Panelin v3.1.5. Copy en español. Plata en USD. Motor sin IVA; IVA 22% una vez al total. Fuente: CLAUDE.md.
CONTRIBUTING.md arquitectura: STALE. No es un solo JSX.
Sistema real (CLAUDE.md): React+Vite src/ :5173; Express server/ :3001 Node 24.x; Vercel front; Cloud Run API.
Calc canónico: src/components/PanelinCalculadoraV3_backup.jsx. No renombrar. Precios: constants.js. Motor: calculations.js.
Antes de trabajo no trivial (CLAUDE.md + AGENTS.md): PROJECT-STATE, AGENTS.md, SDD por secciones, knowledge/rol si aplica.
Dev local: env:ensure then dev:full. Node 24.

## 2. Kanban y WIP — 12 min

Proyectar AGILE.md secciones 1-3. Leer las columnas en voz alta.
Columnas y WIP (AGILE.md, se respeta):
- Backlog: idea sin refinar. WIP infinito.
- Ready: refinada, DoR. WIP 8.
- In Progress: una persona, un branch. WIP 3.
- In Review: PR abierto, CI. WIP 4.
- Done: merge a main + gate:local verde (+ deploy si aplica).
Regla pull (AGILE): no se empieza algo nuevo si la columna excede su WIP.
Definition of Ready (AGILE, verbatim): título accionable + type y area; criterios de aceptación; sin bloqueos (o status:blocked descrito).
Definition of Done (AGILE sección 3, VERBATIM — leer en voz alta):
1. Código + criterios de aceptación cumplidos.
2. gate local verde: lint, test, test:api. UI grande: gate local full.
3. Commits con prefijo type: feat, fix, refactor, docs, chore.
4. PR mergeado a main. CI despliega Vercel y Cloud Run.
5. Si cambia comportamiento: línea en PROJECT-STATE Cambios recientes.
Labels (AGILE): type feat/fix/refactor/docs/chore; priority P0-P3; area calc/api/sheets/auth/pdf/chat/deploy/infra; status:blocked si aplica.
Flujo de tarjeta (AGILE sección 6): Issue a Backlog; DoR a Ready; asignar+branch a In Progress (WIP 3); PR con Closes número a In Review; merge+DoD a Done.
Cadencia opcional: 15 min semanales. Sin planning ni retro formales.

## 3. Branch, commit, gate, PR — 12 min

Branch (CONTRIBUTING, vigente; arquitectura no): feat/area-desc, fix/area-desc, chore/desc, docs/desc, refactor/area-desc, prices/fecha. Evitar sufijos hex de agente y branch sin PR más de 7 días.
Commits (CLAUDE.md + AGILE + PR template): inglés, cortos, prefijo type: feat, fix, refactor, docs, chore.
Antes de review (CLAUDE.md + AGENTS.md + PR template): gate local (lint + test + test:api). UI grande: gate local full. Un test suelto: node tests/archivo. No audit fix --force. No commitear .env.
Proyectar PULL_REQUEST_TEMPLATE.md y leerlo. Checklist DoD: gate local; gate local full si UI grande; commits type:; línea STATE si cambio comportamiento; más de 500 LOC adds = DRAFT y split atómico (CLAUDE.md).
Draft = aún no revisen. Ready = gate verde, DoD tildado, se puede mergear. El template exige Closes número.
CODEOWNERS: default matiasportugau-ui. Protection live (15 ago): checks Lint Check + Validate Calculations + Env drift; 0 reviews requeridos. El doc housekeeping pide 1 review; live no lo fuerza. La disciplina de review es de equipo, no de GitHub hoy.

## 4. Hard rules plata, voz, HITL — 10 min

AGENTS.md: Human gates stay: grants, finanzas unlock, user_confirmed writes. Nunca optimize away. No apagar ASSISTANTS_ACTIVE para un smoke verde.
CLAUDE.md precios: sin IVA; IVA 22% una vez via calcTotalesSinIVA; LISTA_ACTIVA venta vs web; p(item) resuelve el precio. CONTRIBUTING (reglas de plata, no arquitectura): nunca hardcodear precios; siempre p(item); cantidades Math.ceil nunca round/floor; montos toFixed(2).
Sheets (AGENTS.md + CLAUDE.md): 503 si no disponible, nunca 500. No hardcodear sheet IDs, tokens ni URLs de prod. Secrets solo en .env. Log pino, no console.log en prod.
Voz: AGENTS.md trata human gates y money/channel como no-goals de autonomía (harness). CI tiene voice_health como señal, no gate de merge. No enseñar PRs draft de voz como ley (ej. fail-closed relay) hasta que estén en main.
HITL extras (hecho en main, PR 1038 / STATE 13 ago, no está en AGILE): agregar_extraordinario solo tras frase del vendedor. Logística Verificar con IA propone; Aplicar es humano; no escribe Sheets. Citar STATE, no inventar proceso extra.
Tras cambio de comportamiento (CLAUDE.md + AGENTS.md + template): línea en Cambios recientes. No editar STATE sin esa línea. Si cambia topología/ADR: parchear SDD en la misma sesión (CLAUDE.md).

## 5. Higiene: 175 PRs — 5 min

Hechos públicos 15 ago 2026 (GitHub Search API). No es proceso nuevo; es el gap vs AGILE WIP 4 y vs CLAUDE draft-no-eterno.
175 PRs abiertos. 148 draft. 137 de cursor[bot] (136 draft). 27 ready (varios Dependabot). 13 issues. Último merge de producto a main: PR 1038 el 13 ago 08:03 UY, extras HITL + PA5852 + workspace.
AGILE dice In Review WIP 4. Hay 175 PRs. PENDIENTES-AUDIT (11 may) ya decía PRs rotos (74, 73% draft). PR-CLEANUP de esa fecha bajó a 57. Hoy 175. CONTRIBUTING: housekeeping primer viernes, scripts/branch-housekeeping-monthly.sh.
Lo que SÍ está escrito: no empezar si In Review > 4 (AGILE pull). PR >500 LOC adds = DRAFT y split (CLAUDE + template). Branch sin PR 7 días = candidata a archivar (CONTRIBUTING). No inventar una quinta regla de cola.

## 6. Mapa rápido por área — 3 min

AGILE area -> agente: calc/pdf = bmc-calc-specialist; api = bmc-api-contract; sheets = bmc-sheets-mapping; auth/infra = bmc-security; chat = bmc-panelin-chat / mcp; deploy = bmc-deployment.
Hotspots (CLAUDE.md): calc UI backup.jsx + constants.js + calculations.js; API server/index.js + routes/; voz/chat agentCore + agentTools + agentVoice; auth requireAuth + requireGrant; logística src/utils/logistica y /logistica; finanzas /hub/finanzas (unlock).
Tests que importan: gate local = lint + test + test:api (+ test:pea en package.json; AGILE no nombra pea, el script sí). test:core, test:api, test:agent. smoke:prod contra API pública. pre-release para release.

## 7. Práctica en pares — 10 min

Sobre una issue Ready real del tablero BMC Dev:
1. Escribir el branch name (feat|fix|.../area-desc).
2. Escribir el mensaje de commit type: en inglés.
3. Decir qué comando corren antes del PR (gate local o full).
4. Llenar el PR template: qué cambia, Closes, tipo, checklist DoD, notas al reviewer, línea STATE si aplica.
5. El otro par dice: Draft o Ready? Toca plata, voz o Sheets? Hay WIP en In Progress o In Review?
Cierre: cada uno nombra UNA card que va a terminar esta semana, no empezar. (AGILE: terminar antes de empezar.)

## Cheat sheet (handout)

Leer: PROJECT-STATE, AGILE, SDD secciones del task.
Tomar: issue Ready. WIP In Progress max 3. In Review max 4.
Branch: feat|fix|chore|docs|refactor / area-qué. Commits type: en inglés.
Gate: gate local. UI grande: gate local full. PR: Closes + DoD + notas.
Grande: más de 500 LOC adds = DRAFT, después split.
Plata: p(item), ceil, sin IVA, IVA una vez al total.
Humano: grants, unlock finanzas, user_confirmed writes. No auto-write Sheets. Sheets caído = 503.
Cerrar: merge main + línea en Cambios recientes.
No: audit fix --force, commitear .env, force-push main, apagar human gates para un smoke, STATE sin Cambios recientes.

## Fuentes (no reescribir, enlazar)

- docs/team/AGILE.md — tablero, WIP, DoR, DoD
- CLAUDE.md — stack, commits, PR>500 DRAFT, STATE, no audit --force
- AGENTS.md — gate, Do Not, human gates
- .github/PULL_REQUEST_TEMPLATE.md — checklist
- CONTRIBUTING.md — p(item), ceil, branches; IGNORAR un solo JSX y no-fetch
- docs/team/PROJECT-STATE.md — relato; no es AGILE
