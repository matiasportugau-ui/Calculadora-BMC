---
name: bmc-dashboard-audit-full
description: >
  Orchestrates the full BMC Dashboard audit pipeline: runs Audit Runner then
  Debug Reviewer sequentially. Produces report + debug export. Use when user
  asks for bmc audit completo, run audit a fondo, or "run until all done".
---

# BMC Dashboard Audit Full — Orchestrator

**Goal:** Run Audit Runner and Debug Reviewer sequentially until all done.

## Single Command

```bash
cd "/Users/matias/Panelin calc loca/Calculadora-BMC"
bash .cursor/skills/bmc-dashboard-audit-runner/scripts/run_audit_then_debug.sh
```

**Prerequisite:** API must be running (`npm run dev:full-stack` or `npm run start:api`).

## Sequential Flow

1. **Audit Runner** — Starts stack if needed, runs run_audit.sh, probes endpoints, writes to `.cursor/bmc-audit/`
2. **Debug Reviewer** — Parses report, exports issues/logs, writes DEBUG-REPORT.md and debug-export/

## Output

| Path | Content |
|------|---------|
| `.cursor/bmc-audit/latest-report.md` | Full audit report |
| `.cursor/bmc-audit/handoff.json` | Handoff metadata |
| `.cursor/bmc-audit/DEBUG-REPORT.md` | Debug report |
| `.cursor/bmc-audit/debug-export/issues.md` | Issues by severity |
| `.cursor/bmc-audit/debug-export/logs-raw.txt` | Log excerpts |
| `.cursor/bmc-audit/debug-export/config-gaps.md` | Config gaps |
| `.cursor/bmc-audit/debug-export/recommendations.md` | Fix recommendations |

## Agent Chain

- **bmc-dashboard-audit-runner** → produces report + handoff
- **bmc-dashboard-debug-reviewer** → consumes handoff, produces debug export

When using Cursor agents: invoke "run bmc audit a fondo" → Audit Runner runs → then invoke Debug Reviewer (or use run_audit_then_debug.sh for both in one go).
