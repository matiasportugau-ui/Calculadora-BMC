# Intelligent Run Plan — Product Central PIM (Panelin as Source of Truth)
**Pricing • Technical Knowledge • Stock • Images → Sync to Mercado Libre + Shopify + Caucadi**

**Date:** 2026-06-12  
**Reference:** `docs/team/PRODUCT-CENTRALIZATION-STATUS.md` (the collected audit)  
**Owner:** Matías (operator) + AI pair  
**Style:** Most intelligent execution — data-first, reuse-maximal, incremental, always verifiable, safe-by-default (dry-run + human gate on channel writes), operator-centric, event-aware, minimal new surface area.

## 1. Goal & Verifiable Success Criteria
**Primary Goal:** Make **Panelin Postgres (`products` + `product_prices` + `stock` + rich `meta` + `description`)** the single source of truth the operator can read/write for:
- Pricing (cost + venta_local / venta_web)
- Technical knowledge (structured specs + descriptions)
- Stock (live + history)
- Visuals (central image registry + refs)

From this central, deterministically **collect current state** from the three sites and **publish** (price/stock first, then full content + images) with measurable drift reduction.

**Success (all must be true at end of run):**
- 100% high-volume SKUs (top 80% by movement/quote volume) exist in Panelin `products` with `meta` containing at minimum: `tech` object, `images[]` (with roles + urls), `channels` mappings.
- `npm run productos-maestro:reconcile` + new `catalog:drift` reports show <5% price/stock drift vs channels after publish cycles.
- Operator can edit technical specs + attach image refs in one place (enhanced Panelin dashboard or maestro surface) and trigger publish.
- Shopify catalog pull → central upsert is automated + idempotent (via script or UI button).
- ML own listings + Caucadi (once defined) have at least price/stock + basic desc/images collected and a publish path (even if partial).
- Calculator can optionally source prices from Panelin (feature flag + fallback) with no regression in `gate:local:full` + smoke.
- Full audit trail (existing movements + new product change events + publish logs).
- All new surfaces covered by `gate:local`, dedicated smoke checks, and pre-deploy.
- One canonical `.runtime/central-catalog-snapshot-*.json` + human-readable report per major run.

**Non-goals (intentionally deferred):** Full customer-specific pricing, versioned historical product states, 100% automated ML listing creation (updates only), new DB tables in Phase 1-3 (jsonb first), replacing maestro completely.

## 2. Intelligence Principles (how we run this smarter)
- **Data first, always:** Phase 0 captures real current state from channels + sheets + constants before any code change. Every subsequent phase produces before/after diffs and coverage %.
- **Reuse everything:** Shopify GraphQL + full catalog endpoint already exist and are rich (images, variants, inventory, descriptionHtml). Panelin SQL `panelin_upsert_product` already accepts `description` + `meta jsonb`. `panelin_recalc_prices_for_sku`, events/SSE, maestro reconcile pattern, shopifyStore + `shopifyGraphql`, gcsUpload, existing dashboard HTML (fast to extend), RBAC/grants, .runtime/ reports, dry-run conventions.
- **Incremental + one channel at a time:** Shopify (highest leverage — pull API is production-ready) → ML (read-heavy) → Caucadi (discovery required) → calc unification.
- **Safe by default:** Every write to channels or central has `--dry-run` / simulate mode + explicit human confirmation for real writes. New "publish" actions start as no-op or report-only.
- **Operator in the loop:** Enhance the existing beautiful self-contained `panelin-platform/frontend/dashboard.html` (no new React SPA surface in early phases). Add tabs/sections for "Catalog", "Images", "Publish", "Drift".
- **Event + reconcile aware:** Wire product changes to existing `panelinEvents`. Produce maestro-style reconcile/drift reports after every collection or publish.
- **Minimal surface, maximal jsonb:** Extend PATCH `/products/:sku` (and add a richer upsert endpoint) to accept `description`, `meta` (smart merge). No new columns/migrations until real query need appears.
- **Measurable & auditable:** Every script outputs JSON + MD. Dashboard shows coverage badges. New events for `product.updated`, `catalog.collected`, `publish.attempted`.
- **Parallel where safe:** UI work on dashboard can run in parallel with backend collector script. Internal seeding (constants + quoteVisor images + maestro data) can run anytime.
- **Caucadi explicit:** Dedicated discovery sub-phase. Do not guess — either user provides details or we stub a "manual CSV/URL" collector.
- **Close the loops:** Feed central back to calculator (pricing) and presup orchestration (better BOM/tech data). Update smoke, AGENTS.md, pre-deploy, capabilities.
- **Rollback friendly:** Every change has a clear revert (feature flags, dry data, git + DB snapshots via movements).

## 3. Baseline Snapshot (Phase 0 — do this first, no code changes)
Before touching anything new:
1. `doppler run -- npm run productos-maestro:reconcile -- --json` → save `.runtime/productos-maestro-reconcile-*.json + .md`
2. Hit existing endpoints (with proper auth):
   - `GET /api/panelin/products` + `/products/:sku` (sample 5-10) → capture current central state.
   - `GET /api/shopify/catalog/full?shop=...&maxPages=5` (or the paginated /products) for one or more connected stores → full current Shopify catalog snapshot.
   - Any ML seller item export you have (or use existing ml tools to pull a sample of own active listings).
3. Export current `src/data/constants.js` + `matrizPreciosMapping.js` + `quoteVisorShopifyMap.json` (images).
4. Run `npm run smoke:prod -- --json` (baseline).
5. Produce a single `baseline-central-2026-06-12.json` with:
   - SKU coverage (Panelin vs MATRIZ vs Shopify vs constants)
   - Image coverage count
   - Price/stock sample diffs
   - Channel mappings present (or missing)
6. Commit or note the baseline in git + the status doc.

**Exit:** You have numbers and artifacts. "Current state captured" = green.

## 4. Phased Roadmap (Most Intelligent Order)

### Phase 1: Shopify Collector MVP + Basic Central Upsert (highest ROI, lowest risk)
**Why first:** Shopify already gives us titles, descriptionHtml, images (urls + alt), variants with sku/price/inventoryQuantity, etc. Immediate win for populating central with real channel data.

**Scope In:**
- New script: `scripts/collect-shopify-to-panelin.mjs` (modeled exactly on `reconcile-productos-maestro.mjs`)
  - Supports `--shop <myshop.myshopify.com>`, `--dry-run`, `--limit`, `--write`
  - Uses existing `/api/shopify/catalog/full` or direct `shopifyGraphql` + store (so it works from CLI with Doppler secrets)
  - SKU normalizer (reuse or copy logic from maestro linking + simple heuristics: upper, strip prefixes, etc.)
  - For each product/variant:
    - Upsert `products` (name from title, description from descriptionHtml or first variant, unit inferred, meta.images populated from the 20 images + roles guessed from altText/title)
    - Upsert `product_prices` for venta_web (from variant price) + source 'shopify-collect'
    - Upsert `stock` (from inventoryQuantity) + a movement record with reason 'shopify-collect'
    - Store channel mapping in `meta.channels.shopify = { product_id, variant_ids: [...], last_collected }`
- Extend `panelin.js` lightly:
  - Make `PATCH /products/:sku` accept optional `description`, `meta` (deep merge with existing, not blind replace), other safe fields.
  - Use the existing `panelin_upsert_product` SQL function (it already takes p_meta, description via the view/function).
  - Optionally add `POST /products/upsert` or just enhance the patch body.
  - Emit `product.updated` event (reuse panelinEvents).
- Enhance dashboard.html (small JS + HTML section):
  - New "Catalog Collector" card or tab with "Collect from Shopify" button (calls a new thin API route or the script via a proxy if needed; start with "run collector" that returns report).
  - In product detail: show `meta.images` as a small grid (click to open), `meta.channels` badges, "description" editable textarea (posts to PATCH).
- New reconcile/drift command or extension: `catalog:shopify-drift` (compare central prices/stock vs the pulled Shopify data).

**Verification / Gates:**
- `node scripts/collect-shopify-to-panelin.mjs --shop=... --dry-run` → produces rich JSON + MD report with before/after, new SKUs, image counts, SKU match rate.
- With `--write`: actual upserts happen; re-run reconcile shows coverage jump.
- Manual: open dashboard.html, refresh products, see new meta/images/desc for SKUs that matched.
- `doppler run -- npm run gate:local` (server clean).
- Add a smoke check for the collector report endpoint or script exit code.
- Exit criteria: ≥30-50 SKUs (or all high-volume) have images + description + shopify channel id in central after one successful write run. Drift report generated.

**Risks & Controls:** SKU mismatch (heuristic + manual link fallback like maestro). Rate limits (page and respect Shopify limits, sleep). Token missing (graceful 401 like existing).

**Parallel:** Can start dashboard HTML edits while script is being written.

### Phase 2: Panelin Central R/W Surface Polish (description, meta, images, channels)
**Goal:** Operator can comfortably read + write the rich fields in one place.

**Deliverables:**
- Extend the existing beautiful dashboard (add "Technical", "Images", "Channels", "Actions" sections or a side panel per product).
  - Technical: form fields or JSON editor for `meta.tech` (starter keys from status doc: espesor_mm, material, lambda, etc. + free-form).
  - Images: gallery of current refs + "Add reference" (url + role + alt + source). Button to "Collect images from connected channels".
  - Publish stub: "Dry-run publish to Shopify" / "ML" buttons that call future publish endpoints and show the diff report.
- Backend: richer PATCH that accepts and persists `meta` (smart merge) + `description`. Add basic validation or at least passthrough.
- Optional: simple `GET /api/panelin/catalog/summary` (counts, coverage % by channel, last_collected).
- Wire the new `product.updated` event into SSE so live dashboards update when collector or operator writes.

**Verification:** Interactive test in dashboard.html (edit desc/meta → PATCH → see persisted on refresh + in /products/:sku). Coverage numbers visible.

**Exit:** Operator can maintain technical + image data without leaving the Panelin surface.

### Phase 3: ML Collection + Internal Seed + Image Registry Basics
- Script or extension: `collect-ml-to-panelin.mjs` (use `mercadoLibreClient`, seller items search, fetch item details including pictures, attributes, description, price, available_quantity).
  - SKU mapping: first pass heuristic (title contains known panel codes or exact SKU match); fall back to report for manual linking.
  - Populate `meta.channels.ml`, `meta.images` (append ML picture urls with role 'channel-ml'), prices/stock where trustworthy (flag as 'ml-collected').
- Internal seed script step: pull from `constants.js`, `quoteVisorShopifyMap.json` (rich image URLs already mapped to SKUs), maestro data, PanelRendering manifests → enrich descriptions + images + starter `meta.tech` (family-based).
- Basic image registry discipline: `meta.images` array always; add a small helper to normalize and dedupe.
- Produce combined drift report (Shopify + ML vs central).

**Verification:** Same dry-run + write + report pattern. Dashboard shows ML badges + extra images for matched SKUs.

### Phase 4: Caucadi Discovery + General Collector + Drift Detector
- Explicit sub-task: user provides Caucadi details (or we add a "manual" mode: URL to CSV/JSON export of their catalog, or simple REST if they give endpoint + auth pattern).
- If none: create `collect-caucadi-stub.mjs` that reads a local file or prompts and upserts with `meta.channels.caucadi = { source: 'manual', ... }`.
- Generalize the collectors into a thin orchestrator or shared lib (or just keep separate scripts that all feed the same upsert path — simpler and more debuggable).
- New reusable `catalog:drift` or extend maestro reconcile to also compare against live channel pulls (Shopify + ML).
- Optional: simple coverage dashboard card.

**Exit:** All three channels have a documented collection path (even if Caucadi is manual/CSV).

### Phase 5: Outbound Publish Engine (price/stock first, then full)
**MVP Publish:**
- New thin publish surface: `scripts/publish-panelin-to-shopify.mjs --sku=... --dry-run` (or all changed since last).
  - Use existing shopifyGraphql + tokens.
  - First: variant price + inventoryQuantity (highest value, lowest risk).
  - Then: product descriptionHtml, metafields for tech specs, media attach (fileCreate or product media update using the central image refs — start with referencing existing CDN urls to avoid upload complexity).
- Similar for ML (extend client for price update on item, description, attributes, pictures array).
- Wire to Panelin events: on `product.updated` or explicit "publish" action, enqueue (simple for now: just log + optional immediate run if small).
- Safety: per-publish report with exact mutations that would happen, confirmation step (or require --confirm), source='panelin-publish' in any channel side notes.
- MATRIZ: optional auto or manual push of cost/venta from central (readonly view recommended per unification plan).

**Later:** Full content publish, image upload orchestration (GCS master → channel), batch + scheduling.

**Verification:** Change a price or stock or description in central → dry publish report shows exact GraphQL mutations → real write → verify on Shopify admin / ML seller center that it landed. Re-collect and confirm drift reduced.

**Dashboard integration:** "Publish" buttons next to products that show last published vs current.

### Phase 6: Calculator Unification + Full Gates + Prod Cutover + Polish
- Decide + implement `USE_PANELIN_PRICING` (or direct fetch in pricing layer with 5min cache + fallback to constants).
- Refactor affected tests (tolerances instead of exact totals).
- Enhance smoke: new checks for collector reports, publish dry-run, central coverage endpoints, `/api/shopify/products` still works, Panelin products count + sample meta.
- Update AGENTS.md (new scripts), pre-deploy (drift check), capabilities snapshot, operator runbook.
- Full `gate:local:full` + `smoke:prod`.
- Produce final handoff report + update the status doc.
- Optional: deprecate or mark constants.js paths as "legacy / sourced from central".

**Exit:** Everything green, operator owns the central, changes flow to channels, calc is consistent or explicitly on central.

## 5. Cross-Cutting Concerns (apply to every phase)
- **Secrets / Env:** Everything via doppler (bmc-backend/prd or equivalent). Never hardcode shop domains or tokens.
- **Auth:** All new endpoints under existing requireApiAuth or panelin requireGrant patterns. Dashboard uses the same token mechanism.
- **Logging + Events:** pino + panelinEvents for product changes and publish attempts.
- **Reports:** Every script writes `{timestamp}-report.json` + `.md` to `.runtime/`. Human readable first line summary.
- **SKU Mapping:** Centralize a small `normalizeSku()` + optional manual link table (reuse maestro link concept).
- **Images:** Never hotlink blindly long-term — collect urls + alt + role first. Later add optional GCS copy step using existing gcsUpload.
- **Testing:** New unit tests for mappers/normalizers (offline). Contract tests for new API bodies.
- **Docs:** After each phase that adds user-facing behavior, update the status doc + AGENTS.md + relevant runbook.
- **Rollback:** Feature flag for calc source; collector/publish always have --dry-run; DB changes are upserts (idempotent).

## 6. Immediate Next Commands (after you approve this plan)
1. Review this plan + the status doc.
2. Provide Caucadi details (or "stub for now").
3. Run Phase 0 baseline (the reconcile + Shopify catalog/full pulls).
4. "Start Phase 1" → I implement the Shopify collector script + minimal panelin PATCH extension + dashboard enhancements.
5. You test dry-run, approve write on a subset or with confirmation.
6. Iterate.

**Example follow-up prompts you can use:**
- "Run the baseline snapshot now"
- "Implement Phase 1 Shopify collector (dry-run first, full script + light backend + dashboard section)"
- "Enhance the panelin dashboard with technical + images editor"
- "Add ML collector"
- "Build the first publish worker for Shopify price/stock"

This plan is deliberately **most intelligent**: it starts with measurement, maximizes reuse of production code that already exists (Shopify full catalog, Panelin upsert + events + dashboard, maestro patterns), keeps every step reversible and report-driven, delivers value early (Shopify data in central within days), and scales to all three channels + calc without big-bang risk.

The collected central (`PRODUCT-CENTRALIZATION-STATUS.md`) + this run plan now live together in `docs/team/`. You control both.

Ready when you are. Say the word and we execute the most intelligent path.