# REPO SYNC REPORT — RUN 2026-03-20 / run32

## Alcance

Evaluación post-**Full team sync (run32)** para sincronizar **Calculadora-BMC** (repo actual) con **bmc-dashboard-2.0** y **bmc-development-team** cuando proceda.

## Estado Git (referencia)

| Campo | Valor |
|-------|--------|
| **Rama canónica (post PR #33)** | `main` (merge sheets-verify-config-b29b9) |
| **Working tree** | Puede incluir docs/team run32 (MATPROMT, parallel-serial, reports, judge, PROJECT-STATE, PROMPT). |

## Artefactos generados este run (run32)

- `docs/team/matprompt/MATPROMT-RUN-2026-03-20-run32.md`
- `docs/team/MATPROMT-FULL-RUN-PROMPTS.md` (sección Bundle run32)
- `docs/team/parallel-serial/PARALLEL-SERIAL-PLAN-2026-03-20-run32.md`
- `docs/team/reports/REPORT-SOLUTION-CODING-2026-03-20-run32.md`
- `docs/team/reports/REPO-SYNC-REPORT-2026-03-20-run32.md` (este archivo)
- `docs/team/judge/JUDGE-REPORT-RUN-2026-03-20-run32.md`
- `docs/team/PROJECT-STATE.md` (Cambios recientes run32)
- `docs/team/PROMPT-FOR-EQUIPO-COMPLETO.md` (Próximos prompts run33)

## Qué sincronizar a repos hermanos

| Destino | Contenido sugerido |
|---------|---------------------|
| **bmc-dashboard-2.0** | Código dashboard/calculadora si hubo cambios; en run32 solo docs equipo — copiar artefactos equipo (PROJECT-STATE, PROMPT, MATPROMT, judge, reports, parallel-serial) si ese repo mantiene copia de docs/team. |
| **bmc-development-team** | PROJECT-TEAM-FULL-COVERAGE, JUDGE-CRITERIA-POR-AGENTE, PROJECT-STATE, PROMPT-FOR-EQUIPO-COMPLETO, RUN-ROADMAP-FORWARD-2026, artefactos run32 (matprompt, parallel-serial, reports, judge). |

## Acciones recomendadas (Matias / maintainer)

1. Revisar `git status` → commit temático (ej. `docs(team): full team sync run32 — MATPROMT, REPORT, JUDGE, REPO-SYNC`).
2. `git push origin main` (o rama acordada).
3. Si aplica Repo Sync externo: copiar artefactos listados a bmc-development-team (y bmc-dashboard-2.0 si corresponde) según convención.

## Criterio de cierre

- [ ] Commit run32 verificado.
- [ ] Push remoto si se desea dejar main al día.
- [ ] Copia a bmc-development-team (y bmc-dashboard-2.0) según necesidad.
