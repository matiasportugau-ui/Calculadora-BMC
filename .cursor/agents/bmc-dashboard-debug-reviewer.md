---
name: bmc-dashboard-debug-reviewer
description: >
  Reviews the Audit Runner output, analyzes logs and issues, exports them to
  structured files, and produces a debug report. Runs AFTER bmc-dashboard-audit-runner
  completes. Use when user asks for bmc debug review, export logs, review issues,
  or after "AUDIT RUNNER COMPLETE".
---

# BMC Dashboard Debug Reviewer Agent

**Goal:** Review the Audit Runner report, extract and export logs/issues, and produce a debug report.

## Prerequisites

- Audit Runner must have completed and written to `.cursor/bmc-audit/`
- Read `handoff.json` and `latest-report.md`

## Execution Order

### 1. Read Handoff

```bash
cat .cursor/bmc-audit/handoff.json
cat .cursor/bmc-audit/latest-report.md
```

### 2. Parse Report for Issues

Extract from latest-report.md:

- **Errors** — lines with "error", "Error", "500", "503", "401", "fail", "FALTA", "NO"
- **Warnings** — "⚠", "N/A", "no responde", "no encontrado"
- **Anomalies** — spikes, timeouts, auth failures (from Log Analysis section)
- **Config gaps** — missing .env vars, service-account, BMC_SHEET_ID

### 3. Export Logs

Create `.cursor/bmc-audit/debug-export/`:

- `issues.md` — structured list of issues with severity (critical/high/medium/low)
- `logs-raw.txt` — raw log excerpts from report (if any)
- `config-gaps.md` — missing or invalid config items
- `recommendations.md` — actionable fixes in priority order

### 4. Produce Debug Report

Write `.cursor/bmc-audit/DEBUG-REPORT.md`:

```markdown
# BMC Dashboard Debug Report

**Generated:** [timestamp]
**Source:** latest-report.md

## Summary
- Critical: N
- High: N
- Medium: N
- Low: N

## Issues (by severity)
[list]

## Config Gaps
[list]

## Log Excerpts
[relevant snippets]

## Recommendations
[prioritized fixes]
```

### 5. Signal Completion

Emit: **DEBUG REVIEWER COMPLETE. Output: .cursor/bmc-audit/DEBUG-REPORT.md and .cursor/bmc-audit/debug-export/**

---

## Handoff Input

Reads from `.cursor/bmc-audit/`:

- `handoff.json`
- `latest-report.md`
- `endpoint-probe.json` (if present)

## Output

Writes to `.cursor/bmc-audit/`:

- `DEBUG-REPORT.md`
- `debug-export/issues.md`
- `debug-export/logs-raw.txt`
- `debug-export/config-gaps.md`
- `debug-export/recommendations.md`
