# Updated Literal Next Prompt (post-propagation of "Product Central PIM orchestration Phase A: first outbound publish worker (Shopify price/inventory push) driven by panelinEvents")

Read:
- docs/team/PRODUCT-CENTRALIZATION-STATUS.md (now marked shipped)
- docs/team/PROJECT-STATE.md (latest entry + propagation report)
- .runtime/propagation-report-2026-06-13T11-53-21.md

Previous full automated run (collector + propagation) is complete.

Recommended next (choose or run multiple in parallel with subagents):
1. Implement first outbound publish worker (Shopify variants/inventory + price push) driven by panelinEvents.
2. Add Caucadi collector stub once details are provided.
3. Enhance panelin-platform dashboard or /hub with rich meta editor (tech specs + images gallery).
4. Decide pricing source strategy for the calculator (Panelin PG live vs constants bake) and implement resilient fallback.
5. Full team run on the centralization work (invoke "Equipo completo").

Rules: doppler run -- for all secret commands, gate:local (relevant), update PROJECT-STATE, call propagate-change.mjs again at the end of the next run.

Literal next prompt ready for copy-paste into a new goal session.