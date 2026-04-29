# ADR 0001 — Source of truth for each entity post-Supabase migration

- **Status:** proposed
- **Date:** 2026-04-29
- **Author:** session 2026-04-29 audit (v1.3 Fase 0 #4)
- **Decision needed by:** before any Fase 1 schema migration ships
- **Related:** `/Users/matias/.cursor/plans/telemetry_kb_autolearn_41450d75.plan.md`,
  `docs/team/AUDIT-AREA-4.md`, `docs/EXTERNAL-CONNECTIONS.md`

## Context

The BMC Calculadora platform v1.3 roadmap proposes adopting Supabase
(Postgres + pgvector + Auth + Storage) as the home for several entities
that today live in a mix of:

- **Google Sheets workbooks** (CRM_Operativo, Master_Cotizaciones,
  Pagos_Pendientes, Metas_Ventas, AUDIT_LOG, Manual, Parametros, etc.)
- **Cloud Run filesystem** (`data/training-kb.json`, JSONL conversations,
  feedback files, `data/knowledge/*.md`)
- **Cloud Storage (GCS)** buckets — quote PDFs (`bmc-cotizaciones`),
  ML token store, KB GCS mirror
- **Postgres `DATABASE_URL`** — Transportista evidencia / firmas (separate
  database from the proposed Supabase project)
- **In-memory only** — OAuth state Maps, conversation index cache, KB
  cache

Without an explicit decision per entity, the migration risks dual-write
ambiguity ("is the cotización in Sheets or Supabase?"), data drift
(updates landing in one store but not the other), and circular sync
loops. This ADR exists to lock those decisions before code lands.

## Drivers

1. **Auth.** v1.3 Fase 1 introduces user accounts (`profiles` + `tier`)
   that require Supabase Auth as the user store. Anything keyed by
   user_id will need to live in Supabase or join to it via FK.
2. **Numeración BMC-YYYY-NNNNN.** Atomic sequence requires an ACID store
   with a server-side counter (Sheets cannot guarantee this under
   concurrent load).
3. **RAG / pgvector.** Fase 2 requires vector similarity search on KB
   content — only feasible in Postgres with pgvector.
4. **CRM integrity.** The current Sheets-based CRM flow is operationally
   stable but fragile under multi-writer scenarios. Migrating it is
   higher-risk and lower-priority than auth/numeración/KB.

## Decision

For each entity, this ADR records: **the source of truth (SoT)** post-
migration, **whether it's a one-shot move or dual-write**, and **the
cutover criterion**.

| Entity | Today | SoT after Fase 1+ | Cutover style | Cutover criterion |
|--------|-------|-------------------|---------------|-------------------|
| **Usuarios / `profiles`** | n/a (no user accounts) | **Supabase `auth.users` + `profiles`** | one-shot at Fase 1 launch | Fase 1 ships |
| **Tier / role assignment** | n/a | **Supabase `profiles.tier` + `tier_requests`** | one-shot | Fase 1 ships |
| **Cotizaciones (drafts)** | `Master_Cotizaciones` Sheet + `data/quotations/` PDF cache | **Supabase `quotations` (payload jsonb)** | dual-write window for 30 days, then Sheets read-only | "30 days no Sheets writes from API" |
| **Cotizaciones (sent / frozen)** | GCS `bmc-cotizaciones/` + Drive (`DRIVE_QUOTE_FOLDER_ID`) | **Supabase Storage** with hash + frozen pdf URL; GCS deprecated | dual-write window | same as drafts |
| **Número BMC (BMC-YYYY-NNNNN)** | n/a (manual / not enforced) | **Supabase RPC `next_bmc_number()` with atomic SEQUENCE** | one-shot | first quote with new format ships |
| **`parent_quote_id` (re-cotización)** | n/a | **Supabase `quotations.parent_quote_id`** | one-shot | with numeración |
| **Pagos pendientes** | `Pagos_Pendientes` Sheet | **Supabase `payments_pending`** | dual-write | 30 days |
| **Transportista evidencia** | Postgres (`DATABASE_URL`) — separate database | **Stays in dedicated Postgres** (NOT Supabase) | no migration | n/a — distinct system |
| **CRM_Operativo (todo el flujo comercial)** | `CRM_Operativo` Sheet | **Stays in Sheets** for v1.3 | no migration | revisit post-Fase 3 |
| **Metas_Ventas, AUDIT_LOG** | Sheets | Stays in Sheets | no migration | n/a |
| **KB entries (`training-kb.json`)** | local JSON + GCS mirror | **Supabase `kb_entries` + `kb_entry_embeddings`** | one-shot at Fase 2 launch | Fase 2 ships |
| **KB documents (`data/knowledge/*.md`)** | disk | **Supabase `kb_documents`** | one-shot | with KB entries |
| **Conversation events** | local JSONL daily | **Supabase `conversations` + `conversation_turns` + `conversation_actions`** | per-channel cutover (D4.2: chat → WA → ML) | shadow log parity ≥ 7d |
| **Response feedback** | local JSONL daily | **Supabase `response_feedback`** | one-shot | with conversations |
| **Training session audit log** | local JSONL | **Supabase `training_sessions`** | one-shot | with KB |
| **Prompt sections + history** | `data/training-kb.json` `_promptSections` field + `data/prompt-backups/` | **Supabase `kb_prompt_sections` + `kb_prompt_section_history`** | one-shot | with KB |
| **OAuth state (PKCE verifier, Shopify state)** | in-memory Map | **Supabase `oauth_state` table OR move to Memorystore** | one-shot | when Cloud Run scales beyond 1 instance |
| **ML tokens (encrypted)** | GCS `${ML_TOKEN_GCS_BUCKET}` | **Stays in GCS** (encryption with `TOKEN_ENCRYPTION_KEY`); migration adds value at zero risk | no migration | n/a |
| **Service account JSON** | Secret Manager `panelin-service-account` | Stays in Secret Manager | no migration | n/a |

## Consequences

### Positive
- Each entity has one canonical store; cross-references become FKs.
- `quotations.user_id` enables RLS-based per-user isolation from Fase 1.
- Numeración becomes atomic; no "two requests, same number" risk.
- KB search becomes semantic (cosine) instead of token-overlap-only.
- The Transportista DB and Sheets stay where they work; no forced
  refactor of those flows for v1.3.

### Negative / risk
- Dual-write windows are operational complexity (30 days for
  cotizaciones + pagos). Need monitoring + reconciliation script.
- Sheets-based CRM remains the reality for ops staff in v1.3 — admins
  will see two surfaces (Sheets and Supabase queries) until v1.4 or
  later.
- `oauth_state` move requires care: if state is lost mid-flow, OAuth
  callbacks fail. Sticky sessions are an alternative.
- Cost: Supabase Pro tier needed for production (RLS, branching,
  pgvector). Estimate before commitment.

### Open questions
1. **Will `Master_Cotizaciones` Sheet be read-only after the cutover or
   fully retired?** Read-only preserves an audit trail; full retirement
   simplifies but loses the human-friendly grid.
2. **Branching strategy.** Supabase branches per Fase / per developer or
   single staging branch? Affects Fase 2 RAG eval workflow.
3. **Backups.** Supabase auto-backups vs. our own GCS dump cron?

## Consequences if NOT adopted

- v1.3 Fase 1+ cannot ship without per-entity decisions, so this ADR is
  effectively a hard prerequisite. Skipping it means each Fase 1 PR
  has to re-litigate the same questions case-by-case.

## Status & next step

This ADR is **proposed**. Promote to **accepted** after a one-meeting
walkthrough with the team where each row above is signed off (or
amended). After acceptance, the table becomes the canonical input for
the Fase 1 schema migration script.

## Revision history

- 2026-04-29 — initial draft (audit-driven, no team review yet).
