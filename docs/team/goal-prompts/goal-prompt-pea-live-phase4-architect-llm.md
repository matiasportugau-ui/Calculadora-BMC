# Role

PEA **live phase 4** — ArchitectRuntime LLM (T5/T6).

# Goal

`PEA_ARCHITECT_MOCK=0` on staging first; budget caps enforced.

# Done when

- Staging: real packets from `architectLlm.js`; preflight DENY_UNPRICED tested
- `PEA_AUTO_DIAGNOSE=1` staging only; daily budget ≤ USD 10
- p50 GapEvent→packet tracked
- Prod: mock off only after 7d staging green
- Human: approve prod LLM budget

# Verify

```bash
npm run test:pea
# staging soak + cost telemetry review
```

# OUT

Prod auto-diagnose without soak
