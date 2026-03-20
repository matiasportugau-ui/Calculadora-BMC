# Repo Sync Report — 2026-03-20 / run22

**Ejecutado por:** bmc-repo-sync-agent (síntesis orquestada)  
**Fecha:** 2026-03-20  
**Run:** Full team — propagate & synchronize

---

## Resumen

Run 22 documenta **qué** propagar desde **Calculadora-BMC** (repo de trabajo) hacia **bmc-dashboard-2.0** y **bmc-development-team**. La ejecución de `git push` en los remotos **requiere** entorno local de Matias con remotes configurados ([REPO-SYNC-SETUP.md](../REPO-SYNC-SETUP.md)).

---

## Artefactos a sincronizar (run22)

### bmc-dashboard-2.0

| Artefacto | Notas |
|-----------|--------|
| `src/**` | Alinear con este repo si el dashboard de desarrollo es copia canónica de la calculadora embebida — **diff manual** recomendado (últimos cambios: `PanelinCalculadoraV3.jsx`, `calculations.js`, `helpers.js`, `constants.js`, `matrizPreciosMapping.js`, `RoofPreview.jsx` en backup, etc.). |
| `docs/bmc-dashboard-modernization/service-map.md` | Última actualización 2026-03-20 (run22). |
| `docs/bmc-dashboard-modernization/dependencies.md` | Opcional: misma fecha si se edita en sync. |

### bmc-development-team

| Artefacto | Notas |
|-----------|--------|
| `docs/team/PROJECT-STATE.md` | Copiar o merge desde este repo (Cambios recientes run22). |
| `docs/team/PROMPT-FOR-EQUIPO-COMPLETO.md` | Igual. |
| `docs/team/README.md` | Índice con `interactions/`. |
| `docs/team/interactions/**` | **Nueva carpeta:** `TEAM-INTERACTION-QUANTUM-DOC-2026-03-20.md`. |
| `docs/team/matprompt/MATPROMT-RUN-PROPAGATE-SYNC-2026-03-20.md` | Bundle run22. |
| `docs/team/parallel-serial/PARALLEL-SERIAL-PLAN-2026-03-20-run22.md` | Plan ejecución. |
| `docs/team/reports/REPORT-SOLUTION-CODING-2026-03-20-run22.md` | Nuevo. |
| `docs/team/reports/REPO-SYNC-REPORT-2026-03-20-run22.md` | Este archivo. |
| `docs/team/judge/JUDGE-REPORT-RUN-2026-03-20-run22.md` | Nuevo. |
| `docs/team/judge/JUDGE-REPORT-HISTORICO.md` | Merge línea run22. |
| `docs/team/IMPROVEMENT-BACKLOG-BY-AGENT.md` | Fila MATPROMT + texto N dinámico §2. |
| `docs/team/knowledge/MATPROMT.md` | Nuevo (KB MATPROMT). |
| `docs/team/knowledge/README.md` | Entrada MATPROMT.md. |

---

## Acción recomendada

1. Desde la raíz de **este** repo: `git status` → commit de artefactos run22 si aún no están en main.  
2. Clonar o abrir **bmc-development-team** y **bmc-dashboard-2.0**: copiar rutas listadas o `git pull` si el flujo es un solo monorepo de verdad.  
3. Variables `.env`: `BMC_DASHBOARD_2_REPO`, `BMC_DEVELOPMENT_TEAM_REPO` (sin commitear secretos).

---

## Estado

- **Documentación run22:** generada en Calculadora-BMC.  
- **Push remoto:** no ejecutado por agente (sin credenciales/remotes en sesión).
