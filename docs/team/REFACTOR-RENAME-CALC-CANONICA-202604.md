# Refactor: rename Calculadora canónica + eliminar legacy

**Fecha:** 2026-04-30
**Branch:** `claude/rename-calc-canonical-bmzvF`
**PR:** _pendiente push (PAUSE POINT #3)_
**Autor:** Claude Code (sesión interactiva, master prompt `chore/rename-calc-canonical-202604`)

---

## Resumen

Renombré `src/components/PanelinCalculadoraV3_backup.jsx` (canónico desde el merge documentado en `IA.md`) a su nombre canónico `src/components/PanelinCalculadoraV3.jsx`, eliminé el monolito muerto `PanelinCalculadoraV3_legacy_inline.jsx` (sin importadores, congelado desde 2026-04-14) y el shim `src/PanelinCalculadoraV3.jsx` (sin importadores). Sin cambios funcionales: build / lint / tests pasan con los mismos warnings que el baseline.

## Definition of Done

- [x] `npm run build` exit 0; mismos warnings que baseline (3 chunks > 500 KB, vite:reporter sobre `captureDomToPng`)
- [x] `npm run dev` arranca, `curl http://localhost:5173/` → 200
- [x] `npm test` exit 0, 384 passed / 0 failed (igual al baseline) + 10 roofVisualQuoteConsistency + cockpitTokenOrigin OK
- [x] `npm run lint` exit 0, 0 errors / 2 warnings preexistentes (AgentAdminModule.jsx, roofEncounterModel.js)
- [ ] PR abierto contra `main`, no mergeado — _pendiente push (PAUSE POINT #3)_

## Decisión de scope (Opción B — Pragmático)

Phase B reveló **109 archivos** con refs a `_backup` y **5 archivos** con refs a `_legacy_inline`. La regla literal del master prompt (`grep` final = vacío) entraba en conflicto con el non-goal "No 'limpiar' otros archivos" y con la fidelidad de los registros históricos del repo. Con autorización explícita del usuario, apliqué **Opción B (Pragmático)**:

**Editado (~50 archivos):**
- 4 código/config: `src/App.jsx`, `src/utils/scenarioOrchestrator.js`, `eslint.config.js`, `src/PanelinCalculadoraV3.jsx` (borrado)
- 9 instrucciones de agentes/IDE: `CLAUDE.md`, `REPO_CONTEXT.md`, `.claude/agents/*` (2), `.claude/commands/*` (1), `.cursor/agents/*` (2), `.cursor/skills/*` (2)
- ~38 docs vivos: `IA.md` (rewrite manual), READMEs, `PROJECT-STATE.md`, `CHANGELOG.md`, `ROADMAP.md`, ADRs, planes activos, calc docs, etc.

**Excluido (~58 archivos), todos con timestamp explícito en nombre o contenido:**
- `.cursor/bmc-audit/latest-report-2026-03-16.md`, `latest-report.md`
- `docs/dev-trace/commits/2026/04/*.md` (16) y `worklog/2026/04/*.md` (7), `index.json`
- `docs/team/judge/JUDGE-REPORT-RUN-*.md` (3)
- `docs/team/reports/REPO-SYNC-REPORT-*.md` (3), `REPORT-SOLUTION-CODING-*`, `AUTOPILOT-FULL-TEAM-RUNS-*`
- `docs/team/orientation/MAGAZINE-SPREAD-UPDATE-LOGS-2026-04-09.{md,html}`
- `docs/team/ux-feedback/LIVE-DEVTOOLS-NARRATIVE-REPORT-*.md` (~14), `USER-NAV-REPORT-*`, `PRECISE-VISUAL-QUOTE-RESEARCH.md`, JSON evidence
- `docs/plans/FULL-TEAM-INSPECTION-FINDINGS-IMPLEMENTATION-PLAN.md`
- `.relevamiento/matriz/*` (raw inventory)
- `El sistema de cotas del plano 2D (líneas.ini` (miscommit con nombre roto, fuera de scope)

Justificación de la exclusión: estos archivos describen el repo en una fecha pasada (commit log, worklog diario, judge report por run, narrativa DevTools por sesión, audit dump). Editarlos falsificaría el registro temporal — un dev-trace fechado 2026-04-25 diciendo "se modificaron archivos: ..., `_backup.jsx`" hoy diría `PanelinCalculadoraV3.jsx`, lo cual es históricamente falso.

## Manejo de refs a `_legacy_inline` en docs vivos

3 docs activos mencionaban `PanelinCalculadoraV3_legacy_inline.jsx` con markdown links que ahora apuntan a archivo inexistente. Estrategia: reemplazar el link por texto plano con anotación `(eliminado 2026-04-30)`, preservando la narrativa.

Aplicado a:
- `docs/calculadora/README.md`: rewrite manual del bullet de arquitectura (línea 26) explicando ambas eliminaciones (`_legacy_inline` + shim)
- `docs/google-sheets-module/MATRIZ-SKU-GAP-Y-PLAN.md`: anotación inline
- `docs/team/PROJECT-STATE.md`: 5 ocurrencias en entradas dated, sed para convertir markdown link → texto plano + anotación

## Diff

```
$ git diff --cached --stat | tail -3
 ...adoraV3_backup.jsx => PanelinCalculadoraV3.jsx} |    0
 .../PanelinCalculadoraV3_legacy_inline.jsx         | 2351 --------------------
 3 files changed, 2354 deletions(-)

$ git diff --stat | tail -3
 src/App.jsx                                        |   4 +-
 src/utils/scenarioOrchestrator.js                  |   2 +-
 49 files changed, 148 insertions(+), 148 deletions(-)
```

## Baseline vs After

| Métrica | Baseline | After | Δ |
|---|---|---|---|
| Build time | 16.64s | 14.82s | -1.82s |
| Build exit | 0 | 0 | 0 |
| Tests passing | 384 | 384 | 0 |
| Lint errors | 0 | 0 | 0 |
| Lint warnings | 2 | 2 | 0 (mismos archivos) |
| Bundle chunks > 500 KB | 3 | 3 | 0 |
| `PanelinCalculadora*.js` chunk | `_backup-DJywsnTO.js` 782.52 KB | `-C5VrKnwi.js` 782.52 KB | rename only |
| Refs a `_backup` (todos) | 109 | 61 | -48 |
| Refs a `_backup` en scope activo | ~46 | 2 (1 .ini OOS + 1 narrativa intencional) | -44 |
| Refs a `_legacy_inline` (todos) | 5 | 5 (con anotación de eliminación) | 0 |

## Refs intencionalmente preservadas en el scope activo (2)

1. **`docs/calculadora/README.md:25`** — narrativa explícita: "Hasta el refactor del 2026-04-30 este archivo se llamaba `PanelinCalculadoraV3_backup.jsx`...". Necesaria para que un lector entienda el cambio histórico.
2. **`El sistema de cotas del plano 2D (líneas.ini:25`** — file con nombre roto (extensión `.ini` para texto markdown), parece miscommit del 2026-04-29. Out-of-scope por acuerdo explícito; recomendado limpiar en PR separado.

## Warnings esperados (no bloquean merge)

Idénticos al baseline:
- `vite:reporter`: `captureDomToPng` is dynamically imported but also statically imported — pre-existente, ahora apunta al nombre canónico
- `Some chunks are larger than 500 kB` — pre-existente; vendor-three (867 KB), vendor-pdf (975 KB), PanelinCalculadoraV3 (782 KB)
- `npm audit`: 1 moderate severity vulnerability — pre-existente, fuera de scope

## Rollback

```bash
git revert <commit-sha>          # rollback en main
# o
git push origin :claude/rename-calc-canonical-bmzvF  # eliminar la branch remota
```

## Próximos pasos sugeridos (fuera de scope)

- **Phase F (opcional):** cerrar warning `vite:reporter` quitando el import estático de `captureDomToPng` en `PanelinCalculadoraV3.jsx` (dejar sólo el dinámico).
- **Limpieza de archivos históricos** (Opción C parcial): si interesa que el grep de `_backup` quede vacío, hacer un PR específico que actualice los 58 archivos timestamped — tener en cuenta que falsifica registros.
- **Limpieza del .ini file** `El sistema de cotas del plano 2D (líneas.ini` — parece miscommit de notas técnicas; mover a `docs/notes/` con extensión correcta o borrar.
- **Splitting del monolito** de 6685 líneas (`PanelinCalculadoraV3.jsx`) en sub-componentes — proyecto separado.
- **Actualizar npm audit warnings** — fuera del refactor.
