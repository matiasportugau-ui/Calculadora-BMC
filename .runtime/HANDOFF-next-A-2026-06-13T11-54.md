# HANDOFF — After Product Central PIM orchestration Phase A (outbound publish worker)

**Date**: 2026-06-13 ~11:54
**Branch**: fix/review-5ae44e21-facturaexpress-platform (ahead of origin by 1+)
**Uncommitted (post A + propagate)**: M on server/lib/panelinEvents.js, scripts/publish-panelin-to-shopify.mjs, docs/team/PROJECT-STATE.md (from propagate), .grok/config etc (pre-existing broad dirty from branch), new .runtime/ publish-2026-06-13T11-51-34Z.{json,md}, propagation-report-2026-06-13T11-53-21.md, NEXT-PROMPT-AFTER-2026-06-13T11-53-21.md, this handoff, plan.md (this session's).

**Blockers**:
- No real Shopify shop + token + DATABASE_URL in this env (doppler + prior collector --write needed for candidates with meta.channels.shopify + for live price mutation to land). All dry runs correctly report 0 candidates or "--shop required".
- Real --write / end-to-end channel verification is human-gated (per AGENTS + PIM plan + NEXT rules).
- Broad git dirty from concurrent prior work (Fase6 + central + MCP) — auto-detect in propagate picked many files; A changes were the publish script + panelinEvents + reports + plan.

**What was completed in Phase A (per approved Next Run Orchestration Plan)**:
- panelinEvents.js: added product.* event types to JSDoc (price.updated, stock.updated, published) with example shapes; ready for emit sites.
- scripts/publish-panelin-to-shopify.mjs: 
  - Added doShopifyGraphql local helper (mirrors the fetch in server/routes/shopify.js).
  - Real price mutation: in !dry + shop+accessToken available, performs productVariantUpdate via GraphQL for the variantGid + price (venta_web or derived); userErrors captured in report.
  - publishForSku(sku, {write, shop?}) export wrapper (for direct/in-process worker calls, avoids shell exec); delegates to main via argv for single impl; main supports --shop.
  - Always writes fresh .runtime/publish-*.{json,md} with summary/actions (proposed or executed mutations).
  - shopArg support + meta last_published_* + last_publish_shop tracking on write path.
  - Dry run exercised post-edit (T11-51-34Z report generated; syntax clean; 0 candidates as expected).
- Worker in server/routes/panelin.js (pre-existing from baseline): already does direct `import { publishForSku }` + await on 'stock.movement' when ENABLE_PUBLISH_WORKER; now benefits from the real mutation path + export.
- Dry verification + report path exercised per plan template.
- Propagate run with our exact title/desc/area + --auto-next-prompt (created propagation-report T11-53-21 + NEXT-AFTER T11-53-21; updated STATE + STATUS).
- Baseline + advances documented in session plan.md.

**Literal next prompt to resume (copy-paste for next turn)**:
Continue the Product Central PIM next run orchestration after Phase A (outbound publish worker). 
Read: docs/team/PROJECT-STATE.md (latest Cambios + the Phase A entry + new propagation report), .runtime/propagation-report-2026-06-13T11-53-21.md + NEXT-PROMPT-AFTER-2026-06-13T11-53-21.md, this plan.md (Next Run Orchestration section, "Phase A completed"), .runtime/HANDOFF-next-A-2026-06-13T11-54.md, the fresh publish report T11-51, key sources (server/lib/panelinEvents.js, scripts/publish-panelin-to-shopify.mjs).
Then: evaluate Phase A (blocker = no shop/DB for real --write; code + dry + events + export + real mutation path complete and verified), mark in plan, then run Phase B (collector enhance + drift report to produce seed data for A testing) or C (dashboard meta editor + publish buttons, using chrome-devtools MCP from .grok/config for UI verify) per the template in the plan (Run → full verify context/project/advances → Save with propagate/STATE/handoff/git/plan update → Evaluate).
Use doppler run -- for any secret commands. Follow the exact verify list (git, reads of STATE/NEXT/plan/reports, ls .runtime, compass, mcp list/doctor, node --check, grep for wiring). Update todos if using them. Gate relevant (node --check + test:api sufficient for .mjs/server changes).
All per the approved "Next Run Orchestration Plan" in the session plan.md.

**Refs**:
- New publish report: .runtime/publish-panelin-to-shopify-2026-06-13T11-51-34Z.{json,md}
- Propagation from A: .runtime/propagation-report-2026-06-13T11-53-21.md + NEXT-PROMPT-AFTER-...
- Session plan: /Users/matias/.grok/sessions/%2FUsers%2Fmatias%2Fcalculadora-bmc/019ebb3b-7d8f-74f3-9ab5-ba4ba860300c/plan.md (A section)
- PIM plan Phase 5 + NEXT #1 for spec.

Ready for B/C or real creds + collector --write to test live push. 

(End of handoff)