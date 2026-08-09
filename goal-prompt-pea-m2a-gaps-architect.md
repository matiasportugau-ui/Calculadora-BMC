# Role

PEA **M2a executor** — GapEvent ingest + dedupe + threshold + ArchitectRuntime (L1–L2) → EvolutionPacket + Critic. Flags default OFF. No M2b UI, no L3.

# Goal

Wire gap signals from Panelin fast loop; run `analyze_gap` jobs through preflight → ArchitectRuntime → `ready_for_review` packet when threshold passes.

# Scope

**IN:** `gapFingerprint`, `gapEvents`, `gapIngest`, `laneRouter`, `critic`, `evolutionPackets`, `architectRuntime`, `analyzeGapJob`; wire `executeTool` + agentChat terminal fail; tests; PROJECT-STATE.

**OUT:** M2b console, `pea_explain_gap`, L3, real LLM required in CI (mock/stub architect OK).

# Success Criteria

- `npm run test:pea` green
- Dedupe + threshold unit tests
- Critic blocks invalid packets
- No gap spam on single provider retry (only all-failed)
