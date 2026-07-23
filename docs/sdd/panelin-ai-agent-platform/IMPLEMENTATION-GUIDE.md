# Implementation Guide — SDD-Driven Development

**Slug:** `panelin-ai-agent-platform`  
**Date:** 2026-07-23  
**Goal:** Close Actual→Goal gaps with falsifiable step-by-step TODOs.  
**North star:** [`SDD-TARGET.md`](SDD-TARGET.md) · Matrix: [`evidence/actual-vs-goal.md`](evidence/actual-vs-goal.md)

## How to use (SDDD loop)

1. Pick an **IMP-XX** with DoD checkboxes.
2. Implement only what the SDD already constrains (ADRs, gates, contracts).
3. Add/adjust evidence citations in `SDD.md` / `evidence/*`.
4. Run gates: `npm run test:agent` · `npm run test:agent-golden` · relevant channel smoke.
5. Append **Cambios recientes** in `docs/team/PROJECT-STATE.md`.
6. Re-score with `sdd-quality-auditor` when a P0 pack closes.

---

## Phase 0 — Spec hygiene (do first)

### IMP-01 — Kill tool-count drift in docs & deploy

**Goal:** One number of truth per environment; no 22/42/48 ghosts.  
**Maps to:** OG-05, OG-12

- [x] Diff local `AGENT_TOOLS` vs prod `GET /api/agent/tools-manifest` (**55 = 55** as of 2026-07-23 evening).
- [ ] Deploy API so prod count matches HEAD **or** document intentional prod lag with ticket.
- [ ] Update `.claude/agents/bmc-panelin-mcp.md` and any “22 tools” copy to point at `evidence/tools-manifest.md`.
- [ ] Add CI note or script: `node -e "import {AGENT_TOOLS}…"` count must equal manifest `count` in contract test.

**DoD:** Prod count == local HEAD; child SDD `panelin-chat-agent` links here for tools; MCP agent doc not stale.

---

### IMP-03 — Snapshot prod `ASSISTANTS_ACTIVE`

**Goal:** Ops can recreate channel enablement without tribal knowledge.  
**Maps to:** OG-06

- [x] Read prod env / GSM for `ASSISTANTS_ACTIVE` (names only in docs) — **`canales;ml;panelin`** Cloud Run 2026-07-23.
- [x] Append table to `PANELIN-IA-OPS.md` §9 + `evidence/assistants-active.md`.
- [ ] Verify hub `/hub/admin/assistants` matches env + `wa_settings` overrides (needs operator login).

**DoD:** OPS table exists; SDD §8 links it. **Docs DoD met 2026-07-23**; hub UI verify soft residual.

---

## Phase 1 — Grounding & safety (P0 product)

### IMP-04 — RAG production readiness

**Goal:** Similar-quote retrieve is a real product path, not dead code.  
**Maps to:** OG-07 · ADR-006

- [x] Document enable + rollback path — OPS §11 + `omni-ai-orchestrator-rag-enable.md` + SDD §6.3b (2026-07-23).
- [ ] Confirm `DATABASE_URL` + pgvector migration applied in prod.
- [ ] Run embed batch (`scripts/training/embedQuotes.js` or OPS equivalent) with real embeddings (not stub).
- [ ] Set `RAG_ENABLED=1`, tune `RAG_TOP_K` / `RAG_THRESHOLD`.
- [ ] Smoke: chat turn that triggers `recuperar_casos_similares` or auto-inject path.

**DoD:** OPS runbook section “Enable RAG” (**docs met**); at least one CONFIRMED prod retrieve log (**product residual**).

---

### IMP-07 — Align SuperAgent with calc + cost contracts

**Goal:** No second price path that invents or skips telemetry.  
**Maps to:** OG-03 · ADR-007

- [x] Document as-built cost event `superagent_ai_call` + parity target (import `logAgentCost`) — SDD §6.3 / §9.5 / ADR-007 (2026-07-23).
- [ ] Audit `superAgent.js` quote path vs `AE-AGENT-CALC-CONTRACT.md`.
- [ ] Emit `costTelemetry` / structured events (replace raw `console.log` in `logSuperAgentCost`).
- [ ] Add offline test: SuperAgent numbers match `/calc` for a fixture.
- [ ] Decide: keep parallel route **or** thin-wrap `calcular_cotizacion` (ADR update).

**DoD:** Test green; ADR-007 consequences updated; no silent price invention path. **Docs telemetry map closed**; code wiring residual.

---

### IMP-11 — Expand channel golden packs

**Goal:** Releases catch WA/ML/email regressions.  
**Maps to:** OG-04, OG-11

- [ ] Add goldens: WA write refusal without confirm; ML channel length; email draft-not-send.
- [ ] Keep `GOLDEN_REQUIRED=1` on `pre-release`.
- [ ] Update `evidence/goldens.md` index.

**DoD:** ≥22 cases or explicit pack folders; `test:agent-golden` green.

---

## Phase 2 — Observability & SLOs (P1)

### IMP-06 — Cost $/day query path

**Goal:** Know spend without guessing.  
**Maps to:** OG-09 · child G-06

- [x] Document Cloud Logging filter for `agent_core_call` / `ai_completion` / `superagent_ai_call` — `evidence/cost-query.md`.
- [x] Publish daily rollup procedure in PANELIN-IA-OPS §10 (v1 gcloud + sum).
- [ ] Optional: BigQuery export or hub card (do **not** use `/api/ai-analytics/trends` for LLM $ — wrong source).

**DoD:** Operator can answer “yesterday’s AI $?” from documented query — **MET 2026-07-23**. Hub UI optional.

---

### IMP-12 — Emit SSE latency + provider on `done`

**Goal:** Measure p95 first-token / turn latency.  
**Maps to:** OG-15 · SDD-TARGET G1

- [ ] Server: include `provider_used`, `latency_ms` (and optional `ttft_ms`) on SSE `done`.
- [ ] Client: log/display in Dev panel only (prod UI optional).
- [ ] Capture baseline for 1 week; set alert threshold later.

**DoD:** Event schema documented in `evidence/surfaces.md`; Dev panel shows last-turn provider/latency.

---

### IMP-09 — Persist voice analytics (+ hub rollup)

**Goal:** Voice metrics survive cold starts; ops can see trends.  
**Maps to:** OG-13  
**Note:** Tool-call persistence already shipped (B-05 → `agent_tool_calls` + `getToolStatsAsync`).

- [ ] Migration: `agent_voice_events` (wake miss, TTS error, session mint fail).
- [ ] Dual-write from voice error log / Hands-free client beacons (privacy-safe).
- [ ] Optional hub card: tool-stats + voice error rate.
- [ ] Confirm prod `DATABASE_URL` path for tool-stats `source: db`.

**DoD:** Voice history survives redeploy; SDD §9.4 cites both tool + voice stores.

---

### IMP-02 — Event parity across SSE and `callAgentOnce`

**Goal:** One observability model for all channels.  
**Maps to:** OG-01 · ADR-003

- [ ] Inventory events emitted by `agentChat` vs `agentCore`.
- [ ] Normalize field names (`channel`, `assistant`, `provider`, `tokens`, `cost_usd`).
- [ ] Shared helper `logAgentTurn(...)` used by both paths.
- [ ] Unit test for schema presence.

**DoD:** Both paths emit same core fields; fitness test optional.

---

## Phase 3 — Product expansions (P1/P2)

### IMP-05 — Training KB production loop

**Goal:** Corrections improve answers in prod, not only local Dev.  
**Maps to:** OG-08

- [ ] Confirm GCS/local KB sync path for Cloud Run.
- [ ] Autolearn confidence gate remains ≥0.70; add review queue doc.
- [ ] Surface miss rate via `kbAnalytics` in Dev or hub.
- [ ] Weekly Gym ritual: promote goldens from high-miss questions.

**DoD:** OPS “KB sync” section; one promoted KB entry traced to improved golden.

---

### IMP-10 — Hybrid RAG + KB ranking

**Goal:** Better retrieve than either alone.  
**Maps to:** OG-14 · SDD-TARGET

- [ ] Design score: `α * embedding_sim + β * kb_keyword_boost`.
- [ ] Inject fused top-k into `buildSystemPrompt` when RAG on.
- [ ] A/B offline with goldens / eval:agent.
- [ ] Feature flag if needed (`RAG_HYBRID=1`).

**DoD:** Flag documented; eval not worse on existing goldens; SDD §6 updated.

---

### IMP-08 — Whisper Hands-free fallback UX

**Goal:** Firefox / no-SpeechRecognition browsers can still voice.  
**Maps to:** OG-10 · SDD-TARGET G2

- [ ] Detect `!isHandsFreeSupported()` → show push-to-talk.
- [ ] Wire to `POST /api/agent/transcribe`.
- [ ] Copy in UI: Hands-free ≠ Realtime (SEC/UI review).
- [ ] Manual matrix: Safari Hands-free, Chrome Hands-free, Firefox Whisper.

**DoD:** Matrix in SEC/OPS; no false Realtime Safari banner on embedded chat.

---

### IMP-13 — Prompt change process

**Goal:** Prompt edits are reviewable like code.  
**Maps to:** child G-07

- [ ] PR checklist: `chatPrompts.js` change → note in PROJECT-STATE + golden impact.
- [ ] Optional: content hash logged at boot (`prompts_sha`).
- [ ] Link from SDD §6 to process.

**DoD:** At least one PR follows checklist; SDD cites process.

---

## Phase 4 — Platform unification (P2, optional)

### IMP-14 — Capability tiers for tools

**Goal:** Safer MCP/GPT exposure (quote / CRM / admin).  
**Maps to:** SDD-TARGET tools pillar

- [ ] Tag each tool with tier in schema export.
- [ ] Filter manifest by tier query param.
- [ ] Document tiers in tools-manifest.

### IMP-15 — Channel-specific eval packs in promptfoo

**Goal:** Broader than presup orchestrator.  
**Maps to:** SDD-TARGET quality pillar

- [ ] Add `evals/promptfoo/panelin-chat.yaml` smoke (non-secret).
- [ ] Wire optional CI job (not blocking until stable).

---

## Recommended execution order (goal-oriented)

```text
Week 1:  IMP-01 → IMP-03 → IMP-07 → IMP-11
Week 2:  IMP-04 → IMP-06 → IMP-12 → IMP-02
Week 3:  IMP-05 → IMP-08 → IMP-09
Week 4:  IMP-10 → IMP-13 → (IMP-14/15 if capacity)
```

**Exit criteria for “platform ready for SDDD”:**

1. As-built SDD score ≥90 (quality-auditor).
2. Prod tool count == HEAD.
3. RAG either ON with smoke **or** explicitly deferred with OPS ticket.
4. Cost query path documented.
5. Goldens ≥19 and green under `GOLDEN_REQUIRED=1`.
6. Implementation TODOs above tracked (this file checkboxes).

---

## Non-goals (do not expand into)

- Rewriting the full BOM engine.
- Moving LLM inference to Vercel Edge.
- Removing human gates for “automation”.
- Unifying Cursor IDE agents into this runtime (separate `docs/team/AGENTS.md`).
