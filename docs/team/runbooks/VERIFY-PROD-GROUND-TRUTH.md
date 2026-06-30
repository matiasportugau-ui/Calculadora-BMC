# Runbook — Verify prod ground truth (Omni / Inbox AI-First)

**Goal:** cut through doc-vs-reality drift. Planning docs and audits assert things
("all `OMNI_*` flags = 1 in prod", "Email→CRM live", "ML ingest is a gap") that are
easy to claim and hard to confirm. This runbook + its script
([`scripts/verify-prod-ground-truth.mjs`](../../../scripts/verify-prod-ground-truth.mjs),
`npm run omni:ground-truth`) reconcile claims against **observable reality**.

**Read-only. No mutation. No customer contact.** Safe to run from CI, a laptop, or a sandbox.

## Two tiers

| Tier | Needs | What it proves |
|------|-------|----------------|
| **1 — public** | nothing (no secrets) | API is live; Sheets + tokens wired; deployed build SHA; WA volume (`/api/wa/health` exposes `count_chats` / `count_msgs_24h` with no auth) |
| **2 — DB** | `DATABASE_URL` (the `omni_*` Postgres) | data is actually **flowing** into the unified inbox: conversations / messages / ai_jobs / suggestions / email_ingest_log / quote_embeddings (per-channel counts + recency in last 24h) |

```bash
# Tier 1 only (anywhere, no creds):
npm run omni:ground-truth

# Tier 1 + Tier 2 (owner, with the prod omni_* DB):
DATABASE_URL='postgres://…' npm run omni:ground-truth

# JSON for CI / dashboards:
node scripts/verify-prod-ground-truth.mjs --json
```

Exit `0` = no hard failure. A `⚠ GAP` (e.g. "0 messages in 24h") is **not** a hard
failure — it usually means a flag is off or the channel is quiet, which is itself a
finding. Exit `1` only when the API is unhealthy or a table is unreadable.

This script **complements** `npm run smoke:prod` (which checks liveness of
health/capabilities/MATRIZ-CSV/WA-webhook/finanzas/suggest). Ground-truth focuses on the
**Omni data-flow** specifically.

## Last observed snapshot (Tier 1, captured 2026-06-30)

```
API /health        ✓ appEnv=production hasTokens=true hasSheets=true mlTokenStore=true CRM_Operativo=true
API /capabilities  ✓ gitSha=65df704c version=3.1.5
WA data-flow       ⚠ chats=0 msgs_24h=0   ← GAP: WA cockpit DB reachable (HTTP 200, not 503) but no WA traffic in 24h
```

Interpretation: the API is healthy and fully configured; the WA channel shows **no recent
inbound** — investigate whether WhatsApp is genuinely quiet or the WA mirror stopped (the
`/webhooks/whatsapp` → `wa_messages` path in `server/index.js`). Re-run Tier 2 with
`DATABASE_URL` to see whether `omni_*` is receiving anything at all.

## Doc-vs-reality claim ledger

Each claim below is paired with the **exact check** that confirms or refutes it. Run them
before trusting any roadmap that depends on the claim.

| # | Claim (source) | How to verify | Status as of 2026-06-30 |
|---|----------------|---------------|-------------------------|
| 1 | "All `OMNI_*` flags = 1 in prod" (PROJECT-STATE 2026-06-23) | Flags live in Cloud Run env / GitHub repo Variables, not in code. Confirm via `gcloud run services describe panelin-calc --format='value(spec.template.spec.containers[0].env)'` **or** Tier 2: if `omni_ai_jobs`/`omni_suggestions` have recent rows, the AI orchestrator flag is effectively on. | **Unverified from here** (no Cloud Run access in sandbox). Tier 2 settles it. |
| 2 | "Email→CRM pipeline live" (BLUEPRINT §2.3) | Tier 2 → `public.email_ingest_log` `last_24h > 0` (dedupe ledger only grows when email ingests). | **Owner-run** (needs `DATABASE_URL`). |
| 3 | "RAG grounding ready (dormant)" (PROJECT-STATE 2026-06-30) | Tier 2 → `quote_embeddings` has `embedded > 0` with a semantic `provider`; then `npm run omni:rag-precheck`. | **Owner-run.** Pre-check enforces semantic vectors. |
| 4 | "ML webhook → Omni ingest is a NOT-STARTED gap" (a planning agent, 2026-06-30) | **REFUTED in code.** `server/index.js:550` (live `/webhooks/ml`) fires `syncUnansweredQuestions` on `topic="questions"`, which calls `shadowWriteMlQuestions` → `mlQuestionToOmniEvent` → `shadowPersist` when `OMNI_ML_SHADOW_WRITE` is on (`server/ml-crm-sync.js:280–295`). The `routes/webhooks.js` `/ml` stub is a **dormant** decomposition artifact, not the live route. | **Already wired.** Caveat: Omni shadow-write only runs for questions *new to the Sheet* and is coupled to the Sheets sync succeeding. Historical/missed rows backfill via `npm run omni:backfill-ml-crm`. |
| 5 | "Approval feedback logging NOT STARTED" (same agent) | **REFUTED in code.** `server/routes/omni.js:26` imports `recordOmniPromptEval`/`getPromptEvalStats`; accept/reject (`:id/accept` ~1034, `:id/reject` ~1061) record `rating` outcomes via `evalFeedback.js`. | **Already wired.** |
| 6 | "FRT/SLA NOT STARTED" (same agent) | **PARTIALLY REFUTED.** `omni_conversations.first_agent_reply_at` is stamped on reply (`omni.js:744`) and `GET /omni/admin/overview` computes overdue / unassigned / avg+median FRT (`omni.js:189–231`). Genuinely missing: a *ranked, per-conversation* "act on this now" queue across all channels, and breach alerting. | **Data exists; actionable queue is the real gap** (see `GET /omni/actions/urgent`). |

> **Lesson for planners:** the Omni inbox is materially more complete than a fresh
> code-read suggests — several "NOT STARTED" items are wired behind flags. **Verify against
> this ledger before adding code**, or you'll rebuild what already exists (as nearly
> happened with ML ingest). Re-run `npm run omni:ground-truth` and update the snapshot +
> ledger whenever a claim's status changes.

## What this does NOT cover

- It can't read Cloud Run env vars (claim #1) — that needs `gcloud`/GitHub API. Tier 2 is
  the indirect proxy (recent AI jobs ⇒ orchestrator flag effectively on).
- It does not send a synthetic inbound message (that would touch real channels). A true
  end-to-end (inject → suggestion) belongs in the owner-gated enablement runbook
  ([`omni-ai-orchestrator-rag-enable.md`](./omni-ai-orchestrator-rag-enable.md) §5).
