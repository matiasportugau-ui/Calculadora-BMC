# REPO SYNC REPORT — RUN 2026-03-19 / run31

## Alcance

Evaluación post-**Invoque full team** para sincronizar **`Calculadora-BMC`** (repo actual) con referencias a **`bmc-dashboard-2.0`** y **`bmc-development-team`** cuando variables `.env` / rutas locales estén configuradas.

## Estado Git (workspace)

| Campo | Valor |
|-------|--------|
| **Rama local** | `sheets-verify-config-b29b9` |
| **Tracking** | `origin/sheets-verify-config-b29b9` |
| **Último commit conocido** | `27b8fd4` — docs Pista 2 smoke prod (mensaje abreviado) |

## Cambios observados (no commiteados en esta corrida automática)

- **Modificados:** `docs/CHANGELOG.md`, `docs/team/INVOQUE-FULL-TEAM.md`, `docs/team/MATPROMT-FULL-RUN-PROMPTS.md`, `docs/team/PROJECT-STATE.md`, `docs/team/judge/JUDGE-REPORT-HISTORICO.md`, `src/components/PanelinCalculadoraV3_backup.jsx`, `src/components/RoofPreview.jsx`, `tests/validation.js`, y otros docs equipo/judge/autopilot.  
- **Sin seguimiento (`??`):** árbol `docs/team/...` (judge autopilot, matprompt autopilot, `AUTOPILOT-FULL-TEAM-RUNS-24-30.md`, handoff), más **`Calculadora-BMC/`** y **`OmniCRM-Sync/`** en raíz — **revisar** antes de `git add -A`.

## Riesgo: repos anidados o copias

Si `Calculadora-BMC/` u `OmniCRM-Sync/` son duplicados accidentales:

1. No ejecutar `git add` sobre ellos.  
2. Confirmar con Matias si deben ir a **`.gitignore`** o eliminarse del disco de trabajo.

## Acciones recomendadas (Matias / maintainer)

1. Revisar diff → **commit temático** (ej. `docs(team): autopilot Judge formal + run31` + `feat/fix calculadora` si aplica).  
2. `git push` a `origin` en la rama acordada.  
3. Si procede **Repo Sync externo**: copiar artefactos listados a `bmc-development-team` según convención del equipo.

## Criterio de cierre

- [ ] Sin paths anidados no deseados en el índice.  
- [ ] Push remoto verificado (`git status` limpio o solo ignorados).  
- [ ] PROJECT-STATE anota fecha de push si se cierra gap run22/run24.
