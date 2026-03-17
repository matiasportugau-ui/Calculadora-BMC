# CEO Go-Live Objective — "Project Working"

**Deadline:** End of this week (Friday EOD)
**Owner:** CEO AI Agent

---

## Definition of "Working"

The project is **working** when the following are true:

### Must Have (CEO can drive via full team runs)

| # | Criterion | How to verify |
|---|-----------|---------------|
| 1 | Dashboard stack runs (port 3001) | `npm run start:api` → server up |
| 2 | GET APIs respond (ventas, calendario, stock) | Contract validation 4/4 PASS |
| 3 | PUSH APIs implemented | Phase 2 routes in service-map |
| 4 | kpi-report returns 200 or 503 (not 404) | `curl localhost:3001/api/kpi-report` |
| 5 | No critical runtime errors | Audit report, logs clean |

### Should Have (may require Matias)

| # | Criterion | Owner |
|---|-----------|-------|
| 6 | Tabs manuales creados (A1) | Matias |
| 7 | Triggers Apps Script configurados (A2) | Matias |
| 8 | Deploy production (Cloud Run or VPS) | Networks + Matias |
| 9 | E2E validation checklist executed | Matias + Audit |

### Nice to Have

| # | Criterion |
|---|-----------|
| 10 | npm audit fix (low vulns) |
| 11 | Guía vendedores actualizada |

---

## CEO Evaluation After Each Run

After each "Invoque full team" run:

1. **Read** `docs/team/PROJECT-STATE.md` (Cambios recientes, Pendientes).
2. **Read** latest Judge report and Audit report.
3. **Check** Must Have (1–5): All ✓ → **working**.
4. **Check** Should Have (6–9): Document handoff to Matias if blocked.
5. **Decide:** Invoke again (automation left) | Report success | Escalate (only human blockers).

---

## Source References

- `docs/team/PROJECT-STATE.md` — Pendientes, estado por área
- `docs/bmc-dashboard-modernization/IMPLEMENTATION-PLAN-POST-GO-LIVE.md` — Fases A–E
- `docs/team/E2E-VALIDATION-CHECKLIST.md` — E2E checklist (if exists)
- `docs/google-sheets-module/AUTOMATIONS-BY-WORKBOOK.md` — Tabs, triggers
