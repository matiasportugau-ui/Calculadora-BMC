# IMPLEMENTATION-GUIDE — PEA

> Ordered build path. Do not skip security/cost foundations for “cool Architect demos”.  
> SoT: [`SDD.md`](SDD.md) · Targets: [`SDD-TARGET.md`](SDD-TARGET.md).

## Flags (defaults preserve prod)

| Flag | Default | Meaning |
|------|---------|---------|
| `PEA_ENABLED` | `0` | Master switch for emit + worker |
| `PEA_AUTO_DIAGNOSE` | `0` | Allow AUTO_RUN L1–L2 without per-gap click |
| `PEA_WORKER_ENABLED` | `0` | Claim `pea_jobs` |
| Budget envs | see SDD §6.3 | Preflight caps |

---

## IMP-PEA-00 — Live UNKNOWN probe (ops, read-only)

**Done when:** Doc note in `evidence/live-probe.md` + `npm run pea:live-probe` — **partial** (prod rows pending human).

- `DATABASE_URL` target (name only, no secrets)  
- Whether `omni_ai_jobs` migrations applied in that DB  
- Active Omni/Panelin feature flags on Cloud Run (names)  
- Whether any staging service/DB exists outside repo  

**Does not block** IMP-01..04 code; **blocks** L3+.

---

## IMP-PEA-01 — ADR freeze + contracts in repo

**Done when:**

- [x] `SDD.md` v1.0 Accepted  
- [ ] `contracts/*.md` seals copied (this guide + contracts dir)  
- [ ] Link from `docs/sdd/panelin-ai-agent-platform/README.md` Related  
- [ ] PROJECT-STATE Cambios recientes entry  

---

## IMP-PEA-02 — AnalysisPreflight + budget ledger

**Files (TARGET):**

- `server/lib/pea/analysisPreflight.js`  
- `server/lib/pea/budgetLedger.js`  
- `server/migrations/pea/001_budget_ledger.sql`  
- `tests/peaAnalysisPreflight.test.js`  

**Done when:**

- Estimate includes system + gap + evidence + tools + max out + rounds + retries + **sum fallbacks** × safety 1.20  
- Verdicts: AUTO_RUN | ASK_INTERNAL | DECOMPOSE | DENY_UNPRICED  
- Reservation row in ledger; settle on complete/fail  
- Unit tests for each verdict; unpriced model → DENY  

**Depends:** model price table (reuse Omni registry or PEA mirror).

---

## IMP-PEA-03 — Schema `pea.*` + outbox + `pea_jobs`

**Migrations:** `002_pea_core.sql` (tables in SDD §9.7) + `003_pea_jobs.sql`  

**Done when:**

- TX can write gap_event + outbox atomically  
- Worker claims with `FOR UPDATE SKIP LOCKED`  
- Process kill mid-job → retryable (no silent loss)  
- Tests with test DB or transactional mock  

**Reuse:** patterns from `omni_ai_jobs` — **separate tables**.

---

## IMP-PEA-04b — Panelin permission rulesets + doom-loop (Module 7 deferred)

**When:** After M2 (gaps→Architect L0–L2) ships; part of **M3 platform**, not M1–M2.  
**Done when:** `agentPermissions` allow/deny/ask + doom-loop guard wired to write tools; tests cover repeat tool spam.  
**Do not** block IMP-PEA-02/03/06/07 on this.

## IMP-PEA-04 — SideEffectRegistry inventory (platform)

**Files:** `server/lib/sideEffectRegistry.js` (+ codegen from `agentTools` where possible)  

**Done when:**

- Each AGENT_TOOL declares `risk_level` R0–R3, reversible, approval_policy  
- Unregistered tool name → deny at registry API  
- Document inventory in `evidence/side-effect-inventory.md`  

**Note:** Full Panelin enforce can be gradual; **PEA Architect tools must be registered day-1**.

---

## IMP-PEA-05 — Principal + authorize fail-closed (platform, phased)

**Scope for PEA MVP slice:**

- PEA routes use JWT/operator auth only; **no** `X-Panelin-Role` elevation  
- Actions: `pea:gap:read`, `pea:analyze`, `pea:grant:write`, `pea:implement`  

**Full platform rewrite** of header-role defaults = parallel track; track as IMP-PEA-05b.  
**Blocks L3** until 05b or equivalent risk acceptance documented.

---

## IMP-PEA-06 — GapEvents emit + fingerprint dedupe

**Wire:**

- `executeTool` finally → gap on `ok:false` (rate-limited classes)  
- `agentChat` terminal provider fail  
- `buildQuote_rejected` / calc_validation  
- feedback bad / high hedges (optional v1)  

**Done when:**

- Fingerprint stable; occurrences increment  
- Soft provider failover does **not** spam gaps  
- `GET /api/pea/gaps` auth’d  

---

## IMP-PEA-07 — Architect L1–L2 + lanes + Critic + EvolutionPacket

**Files:** `architectRuntime.js`, `laneRouter.js`, `critic.js`, `evolutionPackets.js`  

**Done when:**

- Job: evidence → **threshold** → preflight → triage(**lane**) → explore → plan → **Critic** → packet `ready_for_review`  
- `primary_lane` ∈ {H,K,C}; K path can create PAOS candidate draft  
- Read-only tools only at L2; fitness test proves no write APIs called  
- Critic fail → one revise or DECOMPOSE (no silent ready_for_review)  
- Max model calls / paid attempts enforced (Critic counts)  
- Spanish operator summary field on packet  

---

## IMP-PEA-08 — Console + durable grants

**Done when:**

- Hub/Gym UI or minimal HTML: list gaps, view packet, Approve/Reject, **Escalate L3** (creates grant)  
- Grant row required for any implementer call  
- Audit events on grant create/revoke  

---

## IMP-PEA-09 — `pea_explain_gap` Panelin tool

**Done when:**

- Tool in AGENT_TOOLS; read-only  
- Goldens: narrates without inventing prices  
- Does not block quote tools  

---

## IMP-PEA-10 — Staging topology

**Done when:**

- `panelin-calc-staging` (or equiv) + separate Postgres + outbound OFF  
- `GET /api/environment` returns `{ env, project, db_label }`  
- CI fails if staging config references prod sheet IDs / WA phone  

**Gate:** no IMP-11 without this green.

---

## IMP-PEA-11 — Replay (staging)

**Done when:**

- `pea.replay_runs` can re-drive evidence packing against staging  
- No prod connectors  

---

## IMP-PEA-12 — Implementer adapters L3–L5 (behind ArchitectRuntime)

**Adapters:** `manual` (goal-prompt file) → `native` (gh branch/PR) → `cursor` → `opencode`  
**Rule:** adapters load only when grant ≥ L3; never into L2 tool allowlist.

**Done when:**

- L3 creates `pea/<fingerprint>` branch + draft PR body from packet  
- L4 only on that PR  
- L5 merge requires grant maxLevel≥5 + green `gate:local` subset + risk checkbox if R2+  

---

## IMP-PEA-13 — Ratchet closeout (Module 9 locked: mandatory)

**Done when:**

- On packet accept / PR merge: **at least one** of golden | fitness sensor | RULE-PROVENANCE row is written (fail closed if none)  
- Gap marked `resolved` with links  
- Lane K may additionally bridge PAOS (does not replace the PEA ratchet artifact)  

---

## Suggested milestone cuts (Q&A Module 10 = **10a** locked)

| Milestone | IMPs | Ship |
|-----------|------|------|
| **M0 Spec** | 01 + GAP-PLAN P0 (schemas/DDL/OpenAPI/checklist) | Docs recreation-ready; re-score ≥90 |
| **M1 Cost+Queue** | 02, 03 | Preflight + schema + jobs (flags off) |
| **M2a Gaps+Architect** | 06, 07 | GapEvents + threshold + ArchitectRuntime → packet + Critic |
| **M2b Explain+UI** | 08, 09 | Console + `pea_explain_gap` + grant store (**L3 disabled**) |
| **M2c Ratchet gate** | partial 13 | Accept packet **requires** ≥1 ratchet link (manual); auto-writer later |
| **M3 Platform harden** | 04, 04b, 05, 05b | Registry + Principal + permissions/doom-loop |
| **M4 Implement** | 10, 11, 12, 13 full | Staging → L3 adapters (manual→native→Cursor→OpenCode last) |

---

## Test commands (TARGET)

```bash
npm run test:pea          # 15 files — in gate:local + CI
npm run pea:live-probe    # IMP-PEA-00 helper
npm run pea:staging-check # CI staging isolation
PEA_ENABLED=1 PEA_WORKER_ENABLED=1 npm run dev:api
```

## Do not

- Call LLM before dedupe + preflight  
- Store PEA operational state in Sheets/Drive/chat  
- Use in-memory eventBus for GapEvents  
- Escalate autonomy from natural language alone  
- Run OpenCode against prod Cloud Run  
