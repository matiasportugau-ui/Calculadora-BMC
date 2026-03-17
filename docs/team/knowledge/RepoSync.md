# Knowledge — Repo Sync (RepoSync)

Rol: Repo Sync Agent. Skill: `bmc-repo-sync-agent`.

---

## Entradas (leer antes de trabajar)

- `docs/team/PROJECT-STATE.md` — cambios recientes, pendientes.
- Artefactos de la corrida: dashboard, equipo, reportes.
- Config: BMC_DASHBOARD_2_REPO, BMC_DEVELOPMENT_TEAM_REPO (si configurados).

---

## Salidas (qué produce)

- **bmc-dashboard-2.0** — código dashboard, rutas API, docs, config.
- **bmc-development-team** — PROJECT-STATE, criterios Judge, skills/agents, reportes.
- **Reporte al Orquestador** — qué se actualizó; PROJECT-STATE si aplica.

---

## Convenciones

- **Tras cada corrida** — evaluar qué cambió; sincronizar según destino.
- **Si repos no configurados** — omitir; reportar al Orquestador.
- **No sobrescribir** sin verificar; respetar estructura de cada repo.

---

## Handoffs

| Cuando | A quién | Formato |
|--------|---------|---------|
| Sync completado | Orquestador | Reporte; actualizar PROJECT-STATE si aplica. |

---

## Referencias

- Criterios del Juez: `docs/team/judge/JUDGE-CRITERIA-POR-AGENTE.md` (sección Repo Sync)
- Propagación: `docs/team/PROJECT-TEAM-FULL-COVERAGE.md` §4
- Skill: `.cursor/skills/bmc-repo-sync-agent/SKILL.md`
