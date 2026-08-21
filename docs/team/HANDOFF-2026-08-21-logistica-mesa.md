# HANDOFF — /logistica mesa depo → main

| Field | Value |
|-------|--------|
| date | 2026-08-21 |
| agent | IAlfred (conductor) + `bmc-logistica` |
| branch | `feat/logistica-mesa-depo-20260821` |
| worktree | `~/calculadora-bmc/.worktrees/logistica-mesa-depo` |
| based on | `origin/main` `fc4fc91a` |

## Done

- Extraído el trabajo 20–21 ago de `/logistica` **fuera** de `feat/paid-white-label-presupuestos` (#1051 no se toca).
- Mesa: chips Entrega / Retiran planta / **Viene a depo = BMC URUGUAY**.
- Origen por carga; faltas `goto_levantes`; Guardar = este Mac; Leaflet + OSRM fail-open.
- Agent Forge: `.claude/agents/bmc-logistica.md` + evals.
- Lint: 0 errors. Unit tests logística verdes. Playwright viewports **78/78** vs `http://127.0.0.1:5178/logistica`.

## Out of this PR

- #1051 paid white-label
- Mascot / conversational voice
- `/seguimiento` customer track
- Quitar tutorial + Respondamos Rapido (siguen en `main` Shell)
- OSRM truck profile
- N-P7 monitor como producto (sí va el util `coordinationMonitor` que usa la cola)

## Next prompt

```
Continue from here: merge PR feat/logistica-mesa-depo-20260821 to main after review. Then HITL: Vercel --prod + Cloud Run panelin-calc (envios.js OSRM). Verify GET https://calculadora-bmc.vercel.app/logistica 200 and mesa de ruta. Do not merge #1051. Dirty tree ~/calculadora-bmc stays paid sandbox.
```

## Verify

```bash
cd ~/calculadora-bmc/.worktrees/logistica-mesa-depo
node tests/wizardState.test.js && node tests/uyGazetteer.test.js && node tests/logisticaTruckerAgent.test.js
LOGISTICA_URL=http://127.0.0.1:5178/logistica node scripts/e2e-logistica-viewports.mjs
```
