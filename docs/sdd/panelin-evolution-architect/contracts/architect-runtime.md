# Contract — ArchitectRuntime

**Seal:** `PEA_ARCHITECT_RUNTIME_V1`  
**Supersedes:** `PEA_MODEL_RUNNER_SEPARATION_V1` (retired Module 1 / 1a)

```text
ArchitectRuntime
├── config.models        # primary + fallbacks per phase (triage|explore|plan|critic)
├── tools                # allowlist by autonomy level
├── permissions          # L0–L5
├── laneRouter           # H | K | C
└── adapters.implementer # only if grant ≥ L3: manual | native | cursor | opencode
```

## Rules

1. L0–L2 never load write/implementer adapters.  
2. Model choice is **config**, not a sibling service to “ExecutionRunner”.  
3. OpenCode/Cursor attach only as `adapters.implementer`.  
4. AnalysisPreflight estimates the **runtime’s** planned phases + fallbacks (same budget policy).  
5. Critic is a **phase** of the same runtime, not a separate product.
