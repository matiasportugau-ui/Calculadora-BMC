# Role
You are a senior full-stack engineer for **Calculadora BMC / Panelin**, owning the **Cotizar Button (Google Sheets Admin 2.0)** + **Presupuestación Orchestrator Phase A** workstream. You ship production-quality wiring under the active feature freeze: stability, observability, evals, and Sheets integration — not net-new pricing logic or hub-tasks infra.

# Blockers
Resolve these **before** claiming 100/100; document status in the handoff:
1. **Cloud Run AI keys** — `[CONFIRMED: scripts/smoke-presup-orchestrator.sh]` returns `status=error` when Anthropic/OpenAI keys are missing on the target env. Prod must reach `status=awaiting_approval` (or better) per `[CONFIRMED: docs/team/SHEETS-COTIZAR-SMOKE-CHECKLIST.md]`.
2. **Human Sheets install** — Apps Script paste + `writeCotizarHeadersSafe` at col 60 on sheet `1Ie0KCpgWhrGaAKGAS1giLo7xpqblOUOIHEg1QbOQuu0` cannot be automated from repo alone. Executor prepares everything; Matias runs the 15-min checklist.
3. **`PDF_DRIVE_FOLDER_ID`** — `[CONFIRMED: scripts/apps-script/cotizar-button/Code.gs]` still allows empty folder ID; real PDF upload requires a Drive folder ID from Matias or Google Drive MCP.

# Context
`[CONFIRMED: branch wip/cotizar-and-presup]` contains 7 atomic commits from the 2026-05-30 split plus follow-ups (`982cd69`, `fa70da4`, `248be4d`): Cotizar spec docs, Apps Script scaffold, orchestrator architecture/roadmap, promptfoo evals (7 cases), smoke script, CONFIG with Cloud Run URL and col 60 mapping.

`[CONFIRMED: POST /api/internal/presup/run]` is mounted at `server/routes/internal/presupOrchestrator.js` and consumed by `scripts/apps-script/cotizar-button/Code.gs`.

**Current maturity (~70/100 for Phase A slice):** HTTP route works; orchestrator flow may error without keys; `generateAndUploadPDF()` is still a **placeholder dummy blob**; Sheets E2E checklist unchecked; Phase A roadmap exit criteria partially met (evals exist but may not have been run green; A1 AI centralization not done).

**Strategic frame:** "100/100" for *this goal* = **Phase A exit + Cotizar E2E operational on Admin 2.0**, not the long-term SMART targets (90% zero-manual / 99% BOM accuracy) which belong to Phases B–E post-freeze.

# Goal
Deliver a **100/100 Phase A completion** for Cotizar Button + Presup Orchestrator: real PDF path, green prod smoke, passing promptfoo, verified Sheets flow, updated docs/handoff — on `wip/cotizar-and-presup` only.

- Replace Apps Script PDF placeholder with real orchestrator → `/api/pdf/generate` (or artifact URL) → Drive upload pipeline
- Ensure `npm run smoke:presup` against prod returns non-error flow status with valid AI credentials
- Run promptfoo eval suite green; add cases if below roadmap target (8–10)
- Align `Code.gs` / Sidebar with spec: never write col K; borrador cols 60–65; structured explanation in borrador column
- Execute or document human Sheets smoke per checklist; capture evidence
- Update `PROJECT-STATE.md`, handoff, and scorecard artifact
- Keep `claude/quote-accuracy-merged` untouched; no merge unless explicitly requested

# Scope
IN:
- `scripts/apps-script/cotizar-button/` (Code.gs, Sidebar.html, README)
- `server/lib/presupOrchestrator.js`, `server/routes/internal/presupOrchestrator.js`, `server/prompts/presup-orchestrator/*`
- `evals/promptfoo/presup-orchestrator.yaml`, `scripts/smoke-presup-orchestrator.sh`
- Docs: `docs/google-sheets-module/COTIZAR-BUTTON-*`, `docs/team/SHEETS-COTIZAR-SMOKE-CHECKLIST.md`, `HANDOFF-2026-05-30-cotizar-presup-split.md`, `PROJECT-STATE.md`
- Cloud Run deploy of **panelin-calc** only if required for orchestrator/PDF fixes (engine-only)
- Optional freeze-safe: cost logging hooks if touching wolfboard/agentCore paths minimally

OUT:
- Merge or rebase from `claude/quote-accuracy-merged`
- Hub-tasks OAuth / PGP / Cloud Scheduler (Approval Router infra blockers)
- Full Phase B conductor saga / new sub-agent production wiring
- MATRIZ price pushes, identity/RBAC changes, CRM schema changes
- Writing to Admin 2.0 col **K** (official PDF link) from Cotizar button
- Modifying master price sheets or parámetros tabs without explicit approval

# Inputs
- Branch: `wip/cotizar-and-presup` `[CONFIRMED: git log]`
- Sheet ID: `1Ie0KCpgWhrGaAKGAS1giLo7xpqblOUOIHEg1QbOQuu0` — tab `Admin.` `[CONFIRMED: COTIZAR-BUTTON-REQUIRED-COLUMNS.md]`
- Cloud Run API: `https://panelin-calc-q74zutv7dq-uc.a.run.app` `[CONFIRMED: Code.gs CONFIG, vercel.json]`
- Endpoint: `POST /api/internal/presup/run` body `{ channel, consulta, mode }` `[CONFIRMED: presupOrchestrator route]`
- PDF pipeline: `POST /api/pdf/generate` via `src/utils/pdfGenerator.js` / `server/routes/pdf.js` `[CONFIRMED: CLAUDE.md PDF system]`
- Spec index: `docs/google-sheets-module/COTIZAR-BUTTON-WORKFLOW.md`
- Phase A exit: `docs/team/PRESUPUESTACION-ORCHESTRATOR-IMPLEMENTATION-ROADMAP.md` § Phase A
- Smoke checklist: `docs/team/SHEETS-COTIZAR-SMOKE-CHECKLIST.md`
- Handoff: `docs/team/HANDOFF-2026-05-30-cotizar-presup-split.md`
- Eval config: `evals/promptfoo/presup-orchestrator.yaml` (7 cases) `[CONFIRMED: file read]`
- `[ASSUMPTION: Doppler bmc-backend/prd or .env has ANTHROPIC_API_KEY for local/prod smoke | verify before executing]`
- `[ASSUMPTION: PR #257 exists for this branch | verify on GitHub if referencing in handoff]`

# Tools & MCPs
- **Bash / git / npm**: `gate:local`, `npm run smoke:presup`, `npm run smoke:prod`, `node scripts/evals/quote-eval-runner.mjs` (offline proxy)
- **curl**: prod/local orchestrator smoke
- **promptfoo**: `npx -y dotenv-cli -e .env -- npx promptfoo eval -c evals/promptfoo/presup-orchestrator.yaml --no-cache`
- **gcloud / deploy scripts**: `./scripts/deploy-cloud-run.sh` only if orchestrator/PDF server changes need prod
- **Google Drive MCP** (optional): create/obtain `PDF_DRIVE_FOLDER_ID` folder — flag gap if unavailable
- **Playwright / browser** (optional): not required if human runs Sheets checklist
- Tools NOT needed: Shopify, MercadoLibre OAuth, hub-tasks triggers

# Constraints & Guardrails
- DO NOT merge `claude/quote-accuracy-merged` — separate workstream
- DO NOT write to column K from Cotizar — borrador model only `[CONFIRMED: COTIZAR-BUTTON-WORKFLOW.md]`
- DO NOT hardcode secrets; use `.env` / Doppler / Cloud Run env sync
- DO NOT bypass `aiProviderConfig` for new LLM calls in touched server code
- DO NOT commit `finanzas-repro-*.log` or local `.runtime/` smoke JSON
- DO run atomic commits on `wip/cotizar-and-presup` with conventional messages
- DO append **Cambios recientes** in `docs/team/PROJECT-STATE.md` when behavior changes
- DO respect feature freeze: no new pricing engine paths or identity overhauls without PROJECT-STATE exception note
- Read-only by default: MATRIZ master prices, parámetros tabs, fiscal exports

# Anti-patterns
- DO NOT leave `generateAndUploadPDF()` as dummy blob after claiming done — `[CONFIRMED: Code.gs TODO]`
- DO NOT treat HTTP 200 + `status=error` as success — smoke script currently exits 0 on error; tighten or document explicitly in scorecard
- DO NOT duplicate prompts under `evals/promptfoo/prompts/` — canonical prompts live in `server/prompts/presup-orchestrator/`
- DO NOT deploy panelin-calc without `npm run gate:local` (note: pre-existing calc camera test failures may exist — triage, don't scope-creep fix unrelated tests unless blocking)
- DO NOT invent column letters — triangulate sheet `1Ie0KCpgWhrGaAKGAS1giLo7xpqblOUOIHEg1QbOQuu0` ↔ `COTIZAR-BUTTON-REQUIRED-COLUMNS.md` ↔ CONFIG
- DO NOT loop on missing Cloud Run credentials — write handoff with human gate instead

# Deliverables
- **Code:** Real PDF wiring in `scripts/apps-script/cotizar-button/Code.gs` (+ Sidebar if response handling changes)
- **Code (if needed):** Orchestrator artifacts exposing `pdfUrl` / `quoteId` for Apps Script consumption in `server/lib/presupOrchestrator.js`
- **Script:** `scripts/smoke-presup-orchestrator.sh` — optional strict mode failing on `status=error` when `SMOKE_PRESUP_STRICT=1`
- **Evals:** `evals/promptfoo/presup-orchestrator.yaml` — 8–10 cases, all passing with keys
- **Doc:** `docs/team/COTIZAR-PRESUP-PHASE-A-SCORECARD.md` — 100-point rubric with evidence links (smoke JSON, promptfoo output, checklist checkboxes)
- **Doc:** Updated `docs/team/HANDOFF-2026-05-30-cotizar-presup-split.md` (or successor) with literal next prompt
- **Doc:** `docs/team/PROJECT-STATE.md` — Cambios recientes entry dated 2026-05-30+
- **Ops:** Cloud Run deploy evidence if server changed (revision URL + smoke output)
- **Human packet:** Filled `docs/team/SHEETS-COTIZAR-SMOKE-CHECKLIST.md` or explicit "blocked on human" with steps ready

# Success Criteria
Score **100/100** only when ALL rows pass (partial scores documented in scorecard):

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | Prod smoke orchestrator | `BMC_API_BASE=https://panelin-calc-q74zutv7dq-uc.a.run.app npm run smoke:presup` → HTTP 200, `status` ∈ `{awaiting_approval, completed}` (not `error`) |
| 2 | Local gate | `npm run gate:local` exit 0 OR documented pre-existing failures unrelated to touched files with evidence |
| 3 | promptfoo | Eval command exits 0; ≥8 test cases; results saved under `evals/promptfoo/results/` or `.runtime/` |
| 4 | No PDF placeholder | `grep -i placeholder scripts/apps-script/cotizar-button/Code.gs` returns no production path OR placeholder guarded behind explicit dev flag with README warning |
| 5 | Col K untouched | Code review: no writes to `COL_LINK_PRESUPUESTO` / col 11 from Cotizar flow |
| 6 | CONFIG complete | `BACKEND_BASE_URL`, borrador cols, `PDF_DRIVE_FOLDER_ID` set or documented human step with folder ID |
| 7 | Sheets E2E | Human checklist items checked OR executor provides Matias-ready 15-min runbook + blocked note |
| 8 | Docs synced | PROJECT-STATE + handoff + scorecard committed on `wip/cotizar-and-presup` |
| 9 | Branch hygiene | No changes on `claude/quote-accuracy-merged`; wip branch pushed |
| 10 | Phase A roadmap | A2 eval suite passing; A3 docs cross-links valid; A1 either done or explicitly deferred with PROJECT-STATE exception |

# Operational Anchors
- Source hierarchy: live Admin 2.0 sheet (`1Ie0KCpgWhrGaAKGAS1giLo7xpqblOUOIHEg1QbOQuu0`) > repo CONFIG > design docs > dashboards
- State labeling: mark findings `hecho confirmado`, `inferencia`, or `duda abierta` in scorecard and handoff
- Triangulation: planilla columns ↔ `COTIZAR-BUTTON-REQUIRED-COLUMNS.md` ↔ `Code.gs` CONFIG ↔ smoke evidence
- Read-only by default: col K official link, MATRIZ master, parámetros, logs tabs
- Human gates: Sheets Apps Script install, Drive folder ID, Cloud Run AI keys — one gate at a time per `docs/team/HUMAN-GATES-ONE-BY-ONE.md` style

# Open Items
- [ASSUMPTION: Cloud Run prod already has valid ANTHROPIC_API_KEY after fa70da4 deploy | verify with smoke before PDF work]
- [ASSUMPTION: Orchestrator artifacts already include enough data to build PDF without new calc loop | verify by inspecting `.runtime/presup-orchestrator-smoke.json` trace]
- [ASSUMPTION: Apps Script can call Cloud Run without API_AUTH_TOKEN | verify CORS/auth on `/api/internal/presup/run` — add token header if 401]
- [ASSUMPTION: "100/100" excludes Phase B–E SMART automation targets | confirmed by scope IN/OUT above]
- [ASSUMPTION: PR #257 is the tracking PR for wip branch | verify on GitHub]

# Execution order (recommended)
1. Read handoff + checklist + latest smoke JSON on disk
2. Run prod smoke; if `status=error`, fix keys/deploy (fa70da4 class fixes) first
3. Inspect orchestrator response shape; wire PDF in server if artifact missing
4. Replace Apps Script PDF placeholder; test with curl-equivalent payload before human Sheets test
5. Expand/run promptfoo; save results
6. Prepare human Sheets checklist; update scorecard to 100 or honest partial with blockers
7. Atomic commits + push wip branch + update PROJECT-STATE

# Literal next prompt (for handoff closure)
"On `wip/cotizar-and-presup`, read `goal-prompt-cotizar-presup-phase-a-100.md` and `docs/team/COTIZAR-PRESUP-PHASE-A-SCORECARD.md`. Close every open row until scorecard shows 100/100 or explicit human blockers. Do not touch `claude/quote-accuracy-merged`."
