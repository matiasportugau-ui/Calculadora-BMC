# Review-loop log — 2026-05-17

- **Branch:** `claude/review-agent-output-J3s7j`
- **Started by:** Claude Code session
- **Iterations planned:** 10
- **Mode:** safe-fix commits (no dry-run)
- **Runbook:** [docs/team/REVIEW-LOOP-RUNBOOK.md](../REVIEW-LOOP-RUNBOOK.md)

---

## Round 1 / 10 — calc-specialist + api-contract + security

- **Chosen:** Fix `Kin anclaje` → `Kit anclaje` typo in `src/data/constants.js:198`
- **Commit:** `5e6cfe1`
- **Risk / LOC:** low / 1
- **Why-chosen:** Customer-visible PDF text, zero blast radius, single-byte fix.
- **Deferred (api-contract):** Remove `console.log` fallback in `server/routes/agentChat.js:1048`. Real but touches hot SSE turn-handler; defer to a focused logging-hygiene PR.
- **Deferred (security):** `traktimeDb` pool error → pino. Proposed diff adds a function parameter (signature change) → not actually low-risk.
- **Judge score:** 8/10 (clear customer-facing win)
- **Verify:** lint 0 errors / tests pass (36 RAG + 8 mlSignature passing)

## Round 2 / 10 — panelin-chat + sheets-mapping + docs-sync

- **Chosen:** Bump README Node badge + Requisitos text from 20 → 24.x
- **Commit:** `ec011c3`
- **Risk / LOC:** low / 2
- **Why-chosen:** Doc-only, fixes a discrepancy CLAUDE.md explicitly flags; new contributors otherwise install the wrong Node major.
- **Deferred (sheets-mapping):** Default `BMC_SHEET_SCHEMA` in `server/config.js:82` + `.env.example:246` still targets defunct `Master_Cotizaciones` tab → should be `CRM_Operativo`. **HIGH IMPACT but safety-gate-blocked** (touches `server/config.js` and `.env.example`). Surface for human review.
- **Deferred (panelin-chat):** agent went async; result will surface later as standalone item.
- **Judge score:** 7/10 (high-leverage doc sync, but pales next to the deferred sheets fix)
- **Verify:** lint 0 errors / tests pass

## Round 3 / 10 — calculo + fiscal + deployment

- **Chosen:** Fix VerificationBadge SVG `<title>` tooltip — nest in `<circle>` and restore `pointerEvents="auto"` on the circle (parent `<g>` is pointer-none)
- **Commit:** `903b317`
- **Risk / LOC:** low / 3
- **Why-chosen:** Real UX regression — the only on-hover feedback on the plano↔BOM badge was unreachable. Agent's original 3-LOC fix only moved `<title>` into `<circle>` but the parent `<g pointerEvents="none">` still suppressed hover; expanded to 4 LOC with explicit `pointerEvents="auto"` override.
- **Deferred (fiscal):** Replace hardcoded `"IVA 22%"` label in helpers.js with `getIVA()`-derived label. Agent correctly self-marked `risk=med` — touches customer-facing money copy across PDF + WhatsApp. Surface for human review.
- **Deferred (deployment):** smoke-prod-api.mjs summary omits `/api/wa/health` in pass/fail filter. Real but cosmetic; held for a later round.
- **Late finding from Round 2 (chat):** redundant `console.warn` in `PanelinChatPanel.jsx:438`. Queued for Round 5.
- **Judge score:** 9/10 (real UX bug, surgical fix, low blast radius)
- **Verify:** lint 0 errors / tests pass

## Round 4 / 10 — calc + api-contract + security

- **Chosen:** Redact `err.message` from `/api/agent/exec-tool` 500 response (server/routes/agentChat.js:276)
- **Commit:** `2ef5a2f`
- **Risk / LOC:** low / 1
- **Why-chosen:** Public unauthenticated endpoint leaking raw upstream exception text (could include file paths, DB strings, API error bodies). pino already captures the structured error on the line above, so no ops visibility lost.
- **Deferred (calc):** Hardcoded version string `v3.1.0` in PDF footer at `helpers.js:526` while package.json is 3.1.5 — saved for Round 7.
- **Deferred (api-contract):** Contract-doc shape mismatch in `.claude/agents/bmc-api-contract.md` (id vs entry) — saved for a later round.
- **Judge score:** 9/10 (real info-leak fix, 1 LOC, public endpoint)
- **Verify:** lint 0 errors / tests pass

## Round 5 / 10 — chat (queued from R2) + sheets + docs

- **Chosen:** Remove redundant `console.warn` in dictation `onError` (PanelinChatPanel.jsx:438) — useDictation already surfaces the same string via `dictation.error` in the mic-button title.
- **Commit:** `0c1d7b0`
- **Risk / LOC:** low / 2
- **Why-chosen:** Production debug noise on every dictation failure; no observability loss because the same string is already in component state.
- **Deferred (sheets):** Duplicate `findKey` candidate strings in `bmcDashboard.js:415,459,460` mappers (4 LOC dead code) — saved for Round 8.
- **Deferred (docs):** `bmc-panelin-mcp.md` frontmatter + smoke comment + CLAUDE.md drift (22 tools → actually 28) — saved for Round 8.
- **Judge score:** 6/10 (real but low-impact dead-code cleanup)
- **Verify:** lint 0 errors / tests pass

## Round 6 / 10 — calculo + fiscal + deployment

- **Chosen:** Unify currency label `U$S` → `USD` in `QuotePreviewModal.jsx:11`
- **Commit:** `dd0b9ae`
- **Risk / LOC:** low / 1
- **Why-chosen:** Rest of the codebase (PDF, WhatsApp copy, helpers) uses `USD`; the chat-quote preview modal alone said `U$S`. Visible inconsistency between preview and printed PDF for the same client.
- **Deferred (calculo):** AABB font-constant swap in `roofPlanCotaObstacles.js:26,31,39,45` (4 LOC). Agent self-marked low but this is geometry math affecting cota placement — **re-classified MED**, surface for human review.
- **Deferred (deployment):** smoke-prod-api WA Cockpit summary fix — queued for Round 9.
- **Judge score:** 7/10 (customer-visible copy inconsistency, surgical)
- **Verify:** lint 0 errors / tests pass

## Round 7 / 10 — calc (queued) + api-contract + security

- **Chosen:** Redact `err.message` from `/api/agent/transcribe` 500 response (`server/routes/agentTranscribe.js:111`)
- **Commit:** `95b3d8b`
- **Risk / LOC:** low / 1
- **Why-chosen:** Same info-leak pattern as Round 4 but on a different public route (transcribe). Pino log already captures the structured error.
- **Deferred (calc):** Stale v3.1.0 footer in helpers.js:526 — queued for Round 10.
- **Deferred (api-contract):** Add live validator coverage for `POST /agent/train` shape in `scripts/validate-api-contracts.js` (22 LOC). High-leverage but infrastructure-shaped — surface for human review.
- **Judge score:** 9/10 (info-leak fix, public endpoint, 1 LOC)
- **Verify:** lint 0 errors / tests pass

## Round 8 / 10 — chat + sheets (queued) + docs (queued)

- **Chosen:** Sync MCP tool count `22 → 28` in `CLAUDE.md:103`, `.claude/agents/bmc-panelin-mcp.md:3` (frontmatter), and `:83` (smoke comment).
- **Commit:** `9039cad`
- **Risk / LOC:** low / 3
- **Why-chosen:** Three independent files drifted from the live tool list (which the same agent file body correctly says is 28). Future agents/integrations reading these would undercount by 6 tools (the Wolfboard write surface).
- **Deferred (sheets):** Duplicate `findKey` candidate strings in `bmcDashboard.js:415,459,460` — rolled to Round 9.
- **Judge score:** 7/10 (corrects 3 files, agent-facing accuracy)
- **Verify:** lint 0 errors / tests pass

## Round 9 / 10 — calculo + fiscal + deployment (queued)

- **Chosen:** Include WA Cockpit (`GET /api/wa/health`) in `smoke-prod-api.mjs` failure-hint filter and success summary
- **Commit:** `5c60c76`
- **Risk / LOC:** low / 2
- **Why-chosen:** WA Cockpit is already a `criticalFail` check (line 255) but the success/failure copy doesn't name it — a real outage falls back to the generic "ver checks ✗ arriba", delaying post-deploy diagnosis.
- **Deferred (sheets, rolled R8→R9):** Duplicate findKey candidates in bmcDashboard.js mappers — rolled to Round 10 as a tiebreaker option.
- **Judge score:** 8/10 (ops diagnostic clarity during post-deploy)
- **Verify:** lint 0 errors / tests pass

## Round 10 / 10 — calc (queued) + api-contract + security

- **First attempt:** wire `helpers.js:526` to `APP_SEMVER` from `src/appSemver.js` (prevents future drift). **REVERTED** — exposed a pre-existing latent bug: `appSemver.js` imports `package.json` without Node's required `with { type: "json" }` attribute. Worked under Vite; plain Node `node tests/` chokes with `ERR_IMPORT_ATTRIBUTE_MISSING`. Revert was clean.
- **Chosen (second attempt):** hardcode `v3.1.0 → v3.1.5` in `src/utils/helpers.js:526` (agent's original 1-LOC proposal).
- **Commit:** `7d64ac7`
- **Risk / LOC:** low / 1
- **Why-chosen:** Customer-facing PDF footer shows wrong version; literal swap until `appSemver.js` JSON-import bug is fixed in a focused PR.
- **Surfaced bug (new top-3 deferred):** `src/appSemver.js:1` — fix the bare `import pkg from "../package.json"` to use `with { type: "json" }` (or read pkg.version from a build-time injected constant). Affects any plain-Node consumer of the module.
- **Judge score:** 6/10 (small customer-visible win + caught a hidden interop bug worth flagging)
- **Verify:** lint 0 errors / tests pass

---

## Final report

| Metric | Value |
|--------|-------|
| Rounds attempted | 10 |
| Commits made     | 10 (+ 1 Phase-A workflow commit) |
| Deferred items   | 7 |
| Reverted items   | 1 (within Round 10, recovered same round) |
| LOC changed (review-loop commits) | +18 / -14 |
| Files touched    | 10 |

### Commits

| Round | Commit | Title |
|------:|--------|-------|
| 1  | `5e6cfe1` | Fix `Kin anclaje` typo → `Kit anclaje` in PDF label |
| 2  | `ec011c3` | Bump README Node badge + requisitos to 24.x |
| 3  | `903b317` | Fix VerificationBadge SVG title hover (nest title in circle, restore pointer-events) |
| 4  | `2ef5a2f` | Redact raw err.message in `/api/agent/exec-tool` 500 response |
| 5  | `0c1d7b0` | Remove redundant console.warn in dictation onError |
| 6  | `dd0b9ae` | Unify currency label `U$S → USD` in QuotePreviewModal |
| 7  | `95b3d8b` | Redact err.message in `/api/agent/transcribe` 500 response |
| 8  | `9039cad` | Sync MCP tool count `22 → 28` in CLAUDE.md + agent description + smoke comment |
| 9  | `5c60c76` | Include WA Cockpit in smoke-prod-api success/failure summary |
| 10 | `7d64ac7` | Bump PDF footer version `v3.1.0 → v3.1.5` |

### Top deferred (next-steps list for the user)

1. **Default `BMC_SHEET_SCHEMA`** in `server/config.js:82` + `.env.example:246` still points to the defunct `Master_Cotizaciones` tab — should be `CRM_Operativo`. **HIGH IMPACT.** Safety-gated (config + env). Needs human review.
2. **`appSemver.js` JSON-import without attribute** (surfaced by Round 10 revert). `src/appSemver.js:1` uses `import pkg from "../package.json"` — works under Vite, fails under plain Node ESM. Add `with { type: "json" }` or move the version into a literal const.
3. **AABB font constant in cotaObstacles** (`src/utils/roofPlanCotaObstacles.js:26,31,39,45`). Geometry math currently over-estimates label height ~18%, pushing cotas farther than needed. Surgical but is geometry math — needs visual regression.

Honorable mentions (also deferred):
- Hardcoded `"IVA 22%"` label across PDF + WhatsApp (`helpers.js:332,516,845`) — should derive from `getIVA()`. Med-risk: customer-facing money copy.
- Live validator coverage for `POST /agent/train` shape in `scripts/validate-api-contracts.js` (22 LOC).
- Contract-doc shape mismatch in `.claude/agents/bmc-api-contract.md:36` (`id` vs `entry`).
- Duplicate `findKey` candidate strings in `server/routes/bmcDashboard.js:415,459,460` (dead-code; 4 LOC cleanup).
- `console.log` fallback dead code in `server/routes/agentChat.js:1048`.
- `traktimeDb` pool error handler → pino (needs signature redesign).

### Per-area heat map

| Area | Findings surfaced | Committed | Deferred |
|------|------------------:|----------:|---------:|
| Calc / pricing          | 3 | 2 | 1 |
| API contract            | 3 | 0 | 3 |
| Security                | 3 | 2 | 1 |
| Chat                    | 1 | 1 | 0 |
| Sheets mapping          | 2 | 0 | 2 |
| Docs sync               | 2 | 2 | 0 |
| Calculo (SVG geometry)  | 2 | 1 | 1 |
| Fiscal                  | 2 | 1 | 1 |
| Deployment              | 1 | 1 | 0 |

### Recommendation

**ready-for-review** as a draft PR for the 10 chore-commits. The deferred list is a coherent next-PR backlog — items #1 and #2 are highest leverage.
