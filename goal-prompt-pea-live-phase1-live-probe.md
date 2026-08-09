# Role

PEA **live phase 1** — IMP-PEA-00 live probe (G-09).

# Goal

Fill `evidence/live-probe.md` with real prod + staging evidence (no fabrication).

# Done when

- `npm run pea:live-probe -- --markdown` output pasted for prod and staging bases
- GAP-PLAN G-09 → closed or partial with dated evidence
- Human: Matias signs probe table

# Verify

```bash
BMC_API_BASE=https://panelin-calc-....run.app npm run pea:live-probe -- --markdown
```

# OUT

Enabling PEA flags
