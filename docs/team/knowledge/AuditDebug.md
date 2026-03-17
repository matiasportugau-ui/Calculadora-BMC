# Knowledge — Audit/Debug

Rol: Audit / Debug. Skills: `bmc-dashboard-audit-runner`, `cloudrun-diagnostics-reporter`.

---

## Entradas (leer antes de trabajar)

- `docs/team/PROJECT-STATE.md` — cambios recientes, pendientes.
- `run_audit.sh` — script de auditoría.
- API en 3001 — endpoints a probar.
- Si existe: `.cursor/bmc-audit/handoff.json` — handoff del Audit Runner.

---

## Salidas (qué produce)

- **Audit Runner:** run_audit.sh, probe endpoints, handoff.json a Debug Reviewer.
- **Debug Reviewer:** DEBUG-REPORT.md, logs exportados, issues estructurados.
- **Cloud Run diagnostics:** Estado del servicio, anomalías.
- **PROJECT-STATE:** Actualizar Cambios recientes tras audit.

---

## Convenciones

- **Audit Runner primero:** Debug Reviewer se ejecuta después.
- **Handoff:** handoff.json con metadata para Debug Reviewer.
- **Al terminar:** Actualizar PROJECT-STATE.

---

## Handoffs

| Cuando | A quién | Formato |
|--------|---------|---------|
| Audit completo | Debug Reviewer | handoff.json, latest-report.md. |
| Hallazgos que afectan Design/Networks/Mapping | Según hallazgo | Log for [Agent]. |

---

## Referencias

- Criterios del Juez: `docs/team/judge/JUDGE-CRITERIA-POR-AGENTE.md` (sección Audit)
- Propagación: `docs/team/PROJECT-TEAM-FULL-COVERAGE.md` §4
- Skills: `bmc-dashboard-audit-runner`, `cloudrun-diagnostics-reporter`
- Output: `.cursor/bmc-audit/`
