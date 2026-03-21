# Repo Sync — REPORT — 2026-03-21 / run51

**Contexto:** Post–full team **run 51**. Repos configurados vía `.env`: `BMC_DASHBOARD_2_REPO`, `BMC_DEVELOPMENT_TEAM_REPO` (ver `docs/team/REPO-SYNC-SETUP.md`).

## Estado del repo local (Calculadora-BMC)

- **Rama de trabajo:** `main` (sincronizar con `origin/main` antes de copiar artefactos).
- **Artefactos nuevos run 51:** `docs/team/matprompt/MATPROMT-RUN-2026-03-21-run51.md`, `docs/team/parallel-serial/PARALLEL-SERIAL-PLAN-2026-03-21-run51.md`, `docs/team/reports/REPORT-SOLUTION-CODING-2026-03-21-run51.md`, `docs/team/judge/JUDGE-REPORT-RUN-2026-03-21-run51.md`, este archivo; actualizaciones en `PROJECT-STATE.md`, `PROMPT-FOR-EQUIPO-COMPLETO.md`, `MATPROMT-FULL-RUN-PROMPTS.md`, `RUN-ROADMAP-FORWARD-2026.md`, `JUDGE-REPORT-HISTORICO.md`.
- **Hub Sheets:** archivos bajo `docs/google-sheets-module/` (mapper, sync, variables 1:1) — copiar al repo **equipo/desarrollo** si esa copia mantiene paridad con `Calculadora-BMC`.

## Recomendación

1. **Commit** en `Calculadora-BMC` con mensaje descriptivo (full team run51 + docs hub).
2. **Push** `origin/main` cuando Matias apruebe.
3. **bmc-development-team:** actualizar índices de equipo / links a `google-sheets-module` README si el mirror los expone.
4. **bmc-dashboard-2.0:** sincronizar solo si el dashboard separado debe reflejar los mismos docs de mapeo; evitar duplicar reglas de negocio fuera del hub.

## Bloqueos

- Ninguno técnico en run 51; credenciales y push son acción humana.

**Handoff:** Orchestrator + Matias para push y mirrors.
