---
name: bmc-dashboard-audit-runner
description: >
  Runs the full BMC Dashboard audit at depth: starts stack if needed, executes
  run_audit.sh, probes all endpoints, analyzes logs, and writes report to
  .cursor/bmc-audit/ for the Debug Reviewer. Use when user asks for bmc audit
  run, full dashboard audit, or "run audit a fondo". MUST complete before Debug
  Reviewer runs. For one-shot Audit+Debug: run_audit_then_debug.sh
---

# BMC Dashboard Audit Runner Agent

**Goal:** Execute a thorough BMC Dashboard audit and produce a complete report for the Debug Reviewer.

## Execution Order (Strict)

### 1. Ensure Stack Running

```bash
curl -sf http://localhost:3001/health >/dev/null 2>&1 || (cd "/Users/matias/Panelin calc loca/Calculadora-BMC" && npm run dev:full-stack &)
```

If API not responding, start with `npm run dev:full-stack` (or `npm run start:api` + `npm run dev`). Wait for health OK before proceeding.

### 2. Run Full Audit Script

```bash
cd "/Users/matias/Panelin calc loca/Calculadora-BMC"
bash .cursor/skills/super-agente-bmc-dashboard/scripts/run_audit.sh --output=.cursor/bmc-audit/latest-report.md
```

### 3. Extended Endpoint Probe

Probe all endpoints from reference.md:

```bash
curl -s http://localhost:3001/health | jq .
curl -s http://localhost:3001/api/cotizaciones | jq '.ok, .error'
curl -s http://localhost:3001/api/proximas-entregas | jq '.ok, .error'
curl -s http://localhost:3001/api/pagos-pendientes | jq '.ok, .error'
curl -s http://localhost:3001/api/kpi-financiero | jq '.ok'
curl -s http://localhost:3001/api/audit | jq '.ok'
curl -s http://localhost:3001/calc/catalogo?lista=venta | jq '.ok'
```

Append results to `.cursor/bmc-audit/endpoint-probe.json` or to the report.

### 4. Export Handoff for Debug Reviewer

Write to `.cursor/bmc-audit/`:

- `latest-report.md` — full report (from run_audit.sh)
- `handoff.json` — metadata for Debug Reviewer:

```json
{
  "audit_completed_at": "ISO8601",
  "report_path": ".cursor/bmc-audit/latest-report.md",
  "api_healthy": true,
  "next_step": "Invoke bmc-dashboard-debug-reviewer agent"
}
```

### 5. Signal Completion

Emit: **AUDIT RUNNER COMPLETE. Invoke bmc-dashboard-debug-reviewer to review logs and export issues.**

---

## Handoff Location

All output goes to `.cursor/bmc-audit/`. The Debug Reviewer reads from here.

## Dependencies

- Uses super-agente-bmc-dashboard skill (run_audit.sh, reference.md)
- Requires Node, npm, curl, jq
