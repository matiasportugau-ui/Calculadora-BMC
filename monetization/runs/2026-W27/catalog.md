# Product-Candidate Catalog — Run 2026-W27 (2026-07-03)

**Baseline run** — no prior state. Scoring 1–5 per axis; *effort is inverse* (5 = least packaging work). Composite = mean of the four. Full evidence citations in `catalog.json`.

**Environment note (hecho confirmado):** run executed in a remote container — only the Calculadora-BMC repo was scannable. `/Users/matias` and the rest of the GitHub account were NOT inventoried this run (duda abierta until a local run or widened session scope).

| # | Candidate | Source (evidence) | Packaging | Feas. | Market | Effort⁻¹ | Reuse | **Comp.** | Brief |
|---|-----------|-------------------|-----------|:--:|:--:|:--:|:--:|:--:|:--:|
| 1 | White-label quotation calculator SaaS | `src/utils/calculations.js`, `src/data/constants.js` (422 SKUs), `tests/validation.js` | SaaS | 4 | 5 | 2 | 5 | **4.00** | ✅ |
| 2 | MercadoLibre price-monitoring SaaS | `server/lib/marketIntel/` (scraper/dedup/delta/alerts/scheduler), `mlEtlRun.js` | SaaS | 4 | 4 | 3 | 4 | **3.75** | ✅ |
| 3 | BMC_KB B2B RAG API | `server/lib/rag.js`, `embeddings.js` (pgvector), `kb-package/` | API | 4 | 3 | 3 | 5 | **3.75** | ✅ |
| 4 | AI sales-chatbot template (construction e-comm) | `server/lib/agentCore.js`, `agentTools.js`, `calcLoopbackClient.js` | GPT-agent-template | 4 | 4 | 2 | 4 | **3.50** | ✅ |
| 5 | Quotation PDF template engine | `src/pdf-templates/` (7 layouts), `buildQuotationModel()`, `server/routes/pdf.js` | module/library | 4 | 2 | 3 | 5 | **3.50** | folded into #1 |
| 6 | WA Cockpit (team inbox + AI quoting) | `wa-package/`, `server/routes/wa.js`, WA soak runbook (commit 7b0d3a2) | SaaS | 3 | 4 | 2 | 4 | **3.25** | ✅ |
| 7 | Panelin MCP surface (22 tools) | `.claude/agents/bmc-panelin-mcp` | API/add-on | 3 | 3 | 3 | 4 | **3.25** | — |
| 8 | 2D roof-plan SVG dimensioning lib (ISO 129) | `roofPlanGeometry`, `PanelChainDimensions`, `RoofPlanDimensions.jsx` | module/library | 4 | 2 | 3 | 4 | **3.25** | — |
| 9 | TraKtiMe (tracking + Tauri desktop timer) | `traktime-package/`, `src-tauri/Cargo.toml` | SaaS | 4 | 2 | 3 | 3 | **3.00** | — |
| 10 | Omni orchestration (AI job queue + rules) | `server/routes/omni.js`, issues #409/#420 | internal-only (now) | 3 | 3 | 2 | 4 | **3.00** | — |
| 11 | Transportista logistics module | `transportista-cursor-package/`, `/logistica` `/conductor` `/inspector` | module/add-on | 3 | 3 | 2 | 3 | **2.75** | — |
| 12 | Telegram bot | `telegram-bot/` (graph, lib, tests) | module/add-on | 3 | 2 | 3 | 3 | **2.75** | — |
| 13 | shop-chat-agent (Shopify MCP template) | `shop-chat-agent/` — base is Shopify's open template | internal-only | 3 | 2 | 2 | 3 | **2.50** | — |
| 14 | Identity/RBAC mini-stack | `identityAuth.js`, `requireGrant.js`, `authMfa.js` | internal-only | 3 | 1 | 3 | 3 | **2.50** | — |
| 15 | Promptfoo evals harness | `evals/golden-cases`, `evals/promptfoo` | internal-only | 3 | 1 | 3 | 3 | **2.50** | — |

## Brief selection (top 3–5)

Top by composite: #1 (4.00), #2 (3.75), #3 (3.75), then a tie at 3.50 (#4, #5). **Deviation, stated explicitly (not silent):** #5 (PDF engine) ships as the output stage of the same quote pipeline as #1, and its market score is 2 — it is folded into brief #1 as an add-on revenue path. Its slot goes to #6 (WA Cockpit, 3.25), which is a genuinely distinct standalone system with its own migrations and market. Final brief set: **#1, #2, #3, #4, #6** — five briefs.

Per instruction, the three pre-explored Calculadora-BMC directions (white-label SaaS = #1, KB B2B API = #3, GPT chatbot template = #4) all scored in range and are anchored on the known directions.

## Cross-cutting signals (from Stage-1 evidence)

- **Data quality caveat for any catalog-derived product:** issue #358 (ISODEC 200 mm > 250 mm price inversion, verbatim from Matriz, decision pending) — a white-label product needs a catalog-validation layer (hecho confirmado).
- **Prod smoke failing today** (issues #540–#542, 2026-07-03) — not a monetization item, but flags that the live system the briefs lean on has an active ops incident (hecho confirmado).
- **Golf sweep resolved:** the only "golf" match in this repo is `scripts/seed-full-competitors.mjs:225` — `location: 'City Golf, Atlántida Norte + Progreso (Canelones)'`, a neighborhood name in competitor seed data. Name/path sweep: no matches. Not a module (hecho confirmado for this repo; duda abierta for the local Mac).
