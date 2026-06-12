# Product Centralization Status — Pricing / Technical Knowledge / Stock / Images (2026-06-12)

**Purpose**: Single source of truth review of the current state of product data centralization for BMC/Panelin. Covers pricing, stock, technical specs/knowledge, and visuals. Identifies the live "central" the operator can read/write, current collection points, and gaps for pushing consistently to all sales sites (Mercado Libre, Shopify, and Caucadi / third channel).

**Context date**: 2026-06-12 (post Panelin Platform v1 Fases 1-6 + Productos Maestro live).
**Primary project**: `~/calculadora-bmc` (Vite SPA + Express API + Postgres + Sheets/MATRIZ + FacturaExpress).

**Key live centrals (what you can already read + write today)**:
- **Panelin Postgres (recommended primary central for ops)**: `products`, `product_prices`, `price_lists`, `stock`, `stock_movements`, `stock_alerts`, `stock_thresholds`, `invoices`. Rich `products.meta jsonb` + `description` ready for technical + visual + per-channel data. Full audit via movements + price source tracking. Realtime via SSE.
- **Productos Maestro (Sheets bridge, live in prod)**: Merge of MATRIZ (prices/costs) + Stock E-Commerce sheet. In-app editor (Config → Productos (Maestro)) for linking SKUs↔CÓDIGOs, inline edits (costo/ventaLocal/ventaWeb/stock), simulate-then-write to Sheets. `npm run productos-maestro:reconcile` (and :json) for gap reports.
- **MATRIZ Google Sheet (BROMYROS tab, declared pricing source)**: Costs + venta local/web (ex IVA). Pulled for calc via `/api/actualizar-precios-calculadora` (CSV). Pushed via maestro or direct.
- **Panelin dashboard** (self-contained `panelin-platform/frontend/dashboard.html`): Products table (dblclick cost edit → prices refresh + toast), stock-by-depósito, alerts (ack), facturación, "Sync from FacturaExpress", live indicator (SSE), editable API base. Consumes `/api/panelin/*`.
- **API surface**: `/api/panelin/products*`, PATCH cost (recalc prices via SQL `panelin_recalc_prices_for_sku`), stock movements (safe, no-negative guard), etc. Auth via API_AUTH_TOKEN / grants. Also `/api/productos-maestro*` and Shopify list endpoints.
- **Legacy/calc**: `src/data/constants.js` (137 items, groups, dual venta/web + costo) + `src/data/matrizPreciosMapping.js` (SKU/path). Still primary for public cotizaciones engine. Some bake/sync from MATRIZ.

**Caucadi / third channel**: No references found in codebase (greps for caucadi/cauca/cauci/etc returned 0 relevant). Treated as the additional sales site/channel you manage (possibly secondary store, ML account, or custom). Needs details (base URL, auth, product API or manual process, current catalog location) to integrate collection/sync.

---

## 1. Pricing Centralization

**Sources of truth (current)**:
- Declared: MATRIZ Sheets (cols mapped: costo, venta local ex IVA, web ex IVA). Primary input for costs/margins.
- Operational central: Panelin `product_prices` (per `price_lists` 'venta_local' 35% margin, 'venta_web' 25% margin on cost) + `products.cost_usd`. Source field ('matriz', 'manual', 'recalc', 'facturaexpress', 'sync'). `panelin_recalc_prices_for_sku` on cost change.
- Sheets bridge: Productos Maestro (links + edits write back to MATRIZ/Stock sheets).
- Calculator runtime: `constants.js` + mapping (with CSV pull from MATRIZ). Dual lista via `LISTA_ACTIVA` ("venta" vs "web") + `p(item)`.
- Recent: Inline cost edit in Panelin dashboard or Maestro → immediate price updates visible.

**Status**: Strong progress on central (PG + maestro) for ops + live from ERP. Calc still partially on baked constants (unification per old May 2026 PRICING-UNIFICATION-PLAN.md is partially realized via Panelin + maestro; full Postgres-as-canonical + readonly Sheet view not fully cut over). Reconcile tools exist. Margins codified in price_lists seed. No negative/stock issues block pricing.

**Gaps**:
- Dual sources (constants vs Panelin/PG vs Sheets) → drift risk.
- No automated continuous bake/push from central PG back to constants (or deprecate constants for calc).
- Channel-specific pricing (beyond the two lists) or customer tiers not modeled yet.
- Outbound push of prices to ML listings / Shopify variants / Caucadi is manual or absent.

**Read/Write for you**: Maestro UI + Panelin dashboard/API + Sheets direct + reconcile reports in `.runtime/`.

---

## 2. Stock / Inventory Centralization

**Current central**: **Panelin Postgres is winning**.
- `stock` (sku + deposito snapshot, qty, last_movement_at).
- `stock_movements` (immutable history: delta, qty_after, reason='facturaexpress_webhook'/'venta'/'manual'..., ref_id).
- Robust `panelin_record_stock_movement` (lock, no-negative guard, auto-alert).
- `stock_thresholds` + `stock_alerts` (low/critical, deduped spam prevention, ack).
- `panelin_products_full` view + API reshape (prices + stock per deposito + below_threshold).
- Driven by FacturaExpress (webhooks + `/sync/facturaexpress/invoices` POST → invoice upsert + per-item stock movement).
- Realtime: `panelinEvents` (EventEmitter) + SSE `/api/panelin/events` ('stock.movement', 'invoice.upserted'). Dashboard consumes with live refreshes + toasts + indicator.
- Complementary: Stock E-Commerce Google Sheet (bridged by Productos Maestro reconcile/links/edits).

**Status (Fase 6 complete as of 2026-06-12)**: Excellent for central read/write + live ops. Dashboard + API fully functional against real DB (92+ products exampled in recent work). Webhook + sync paths hardened. Alerts + ack live. Reconcile reports gaps vs ecom sheet.

**Gaps**:
- Push of central stock back to channels (Shopify inventory, ML available_quantity, Caucadi) not automated (channels may be updated directly from ERP or manually today).
- Multi-deposito modeling good in DB but may need channel-specific availability views.
- Historical stock for reporting (movements give it).

**Read/Write for you**: Panelin dashboard (stock tables, filters, movements history, alerts ack, sync button) + API (POST movements, GET stock/alerts) + maestro for sheet side + direct PG if needed. Live SSE makes it feel real-time.

---

## 3. Products Knowledge (Technical Specs + Descriptions)

**Current**:
- Panelin `products`: sku (PK/natural key), name, description (text), unit, category, cost_usd, active, meta (jsonb default {}), timestamps.
- `meta` is the extensible slot: ideal for structured tech (espesor, material EPS/PIR, lambda, fire rating, dimensions, autoportancia, usage, compatible accessories, certifications, installation notes, BOM hints).
- Legacy: `constants.js` labels + some attrs (ap, largo for perfiles). Calc scenarios/docs (CALC-*.md). AI training KB / RAG (more conversational). Productos Maestro links/names.
- Per-channel: Shopify product descriptions + metafields (pulled in /api/shopify/products GraphQL), ML item descriptions/attributes (via seller APIs or competitor ETL), quoteVisor maps, etc.
- AI surface: tools like "Get detailed product information including descriptions and images".

**Status**: Nascent structured central via Panelin products + meta. Description field exists and is returned in all product APIs/views. No enforced schema or population of rich technical data yet. Knowledge is fragmented (constants + listings + KB + calc code + PDFs + human memory).

**Gaps**:
- No master technical attribute taxonomy or editor.
- No automated population or validation of specs.
- No export/generation of channel-optimized copy (titles, bullets, tables, attrs for ML/Shopify SEO/filters) from central master.
- Descriptions in listings likely drift from any "truth".

**Read/Write for you**: Via Panelin API (GET/PATCH products, upsert via functions) + dashboard (currently shows name/desc but focused on cost/stock; easy to extend for rich editing of description/meta). Maestro for name/link. Future: add rich editor tab or use JSON meta editing.

---

## 4. Images & Visual Assets

**Current state**:
- **Channel-native**: Heavy on Shopify (many product images hosted on cdn.shopify.com; referenced in `src/data/quoteVisorShopifyMap.json` with specific 3D renders for goteros, perfiles, panels like ISODEC_GRIS.png, Isowall, etc.). Shopify GraphQL surfaces media in product queries.
- **Internal viz**: `PanelRendering/` (25 high-quality PNG/JPG/avif renders, likely for calculator 2D/3D previews and PDFs). Script `panel:rendering:sync` + `scripts/download-panel-rendering-assets.mjs`. Mapped in `src/data/roofPanel*MapUrl*.js` and catalog maps (e.g. `/images/isoroof-colonial-texas-panel.png` served from public/dist).
- **Quote/PDF assets**: Local in dist/bmc-pdf/, public/, pdf-designs/.
- **GCS**: Used for evidence/uploads (transportistaEvidence, driveUpload, gcsUpload lib) – potential for master asset storage.
- **AI/GPT**: Limited image gen to educational diagrams only. Tool mentions "descriptions and images".
- **No central registry**: No SKU → master_image(s) mapping with variants (technical cut, lifestyle, packaging, color), alt text, rights, last-updated. No upload-once-publish-everywhere. Images duplicated or manually attached per channel.

**Status**: Decentralized and channel-heavy (Shopify is de-facto image host for many SKUs). Good internal renders for calculator consistency. Zero unified visual PIM layer tied to the product master.

**Gaps** (high impact for consistent listings):
- Master visual source of truth missing.
- No automated attach/sync of images (or updated renders) to ML pictures array or Shopify media/metafields when publishing from central.
- Versioning / quality control of visuals across channels.
- Collection of current images from channels back into central (Shopify media URLs are pullable today via existing product list).

**Read/Write for you**: Manual today (Shopify admin, ML seller center, local folders + sync script for renders). Extend Panelin meta.images (array of {role: 'master'|'tech'|'lifestyle', url, alt, source: 'shopify'|'gcs'|'internal'}) + future UI or script.

---

## 5. Channel Integrations & Outbound (ML / Shopify / Caucadi)

**Mercado Libre**:
- Strong inbound/ops: OAuth (mercadoLibreClient.js reusable), questions/orders via mlSearch + agent suggest-response + CRM cockpit, competitor ETL (price-monitor-etl, marketIntel), /hub/ml, /auth/ml/status in smoke.
- Catalog management (own items): Limited. Can read/search public + seller (with token). Price/stock/title/desc/pictures updates possible via API but **not wired from any master**. No mature SKU → MLU/item_id mapping documented as production.
- Pricing/stock push: Manual or absent (per unification plan notes).

**Shopify**:
- OAuth (PKCE + HMAC), token store (encrypted in .shopify-shops), webhooks (validated; used for questions → Sheet), GraphQL helper.
- Product surface: `GET /api/shopify/products` (and pagination) does full GraphQL for products + variants (sku, price, compareAtPrice, inventoryQuantity, inventoryPolicy, productType, media implied in full queries, titles, descriptions). Ready for collection.
- Outbound: No automated update of prices (variant price), inventory, descriptions, media, or metafields (tech specs). Existing quoteVisor map shows awareness of Shopify media URLs.
- Questions/answers flow is mature (replaced ML for some).

**Caucadi (third)**:
- Unknown / not present in code. No routes, clients, mappings, or references. Assumed to be another live sales surface you want fed from the same central (pricing/tech/stock/images).

**General**:
- Collection (pull current state from channels → central): Partial. Maestro for sheets. Shopify product list ready to consume. ML seller items + media pullable but not scripted for upsert to Panelin. Images from Shopify CDN pullable.
- Write/publish (central → channels): Mostly missing. Foundation (clients, auth, GraphQL, price recalc, stock guards) exists in Panelin + shopify router + ML client. Old unification plan sketched workers for Shopify variantUpdate + ML item PUT + MATRIZ push.
- Bidirectional drift detection: Reconcile exists for sheets; live events for FacturaExpress. Nothing equivalent for channel drift yet (webhooks on Shopify exist but focused on questions).

**Read/Write for you today**: Pull Shopify catalog via the API (or direct in dashboard if wired). ML mostly read/answer. No unified "publish master changes" button.

---

## 6. Recommended Central Model & Collection/Sync Path

**Use Panelin as the canonical central** (already built for this):
- Extend `products.meta` (or add columns/views) with structured sections:
  - `tech`: {espesor_mm, material: 'EPS'|'PIR', lambda, resistencia_fuego, dimensiones, peso_m2, ap, ...}
  - `descriptions`: {short, long, bullets, seo_title, ml_attrs: {...}, shopify_metafields: {...}}
  - `images`: [{url, role: 'master'|'tech-cut'|'lifestyle'|'packaging', alt, source_channel, last_synced}]
  - `channels`: {ml: {item_id, status, last_price_push}, shopify: {product_id, variant_ids, media_ids}, caucadi: {...}}
  - `pricing_rules`, `bom_hints`, etc.
- Prices live in `product_prices` (source-audited, recalc-able).
- Stock live with history.
- User R/W: Enhance Panelin dashboard (or integrate into main /hub) for description/meta (JSON editor or form), image refs upload/reference, channel mappings. Maestro remains for quick Sheets price/stock hygiene.
- Calculator: Add optional `USE_PANELIN_PRICING` or scheduled bake from PG → constants (or direct fetch in calc with fallback).

**Collection (ingest "current state from all our sites" into central)**:
1. Run existing `productos-maestro:reconcile` (and capture reports) as baseline for prices/stock links.
2. Use/extend Shopify product list (existing GraphQL) → map by SKU → upsert Panelin products (name, description from channel, prices from variants, stock from inventoryQuantity, images from media edges → meta.images, channel ids).
3. For ML: script using mercadoLibreClient (seller items search or /users/{id}/items/search) + fetch item details (pictures, desc, attrs, price, available) → map SKU (heuristic or manual first) → upsert meta.ml + prices/stock where trustworthy.
4. For Caucadi: once details provided, similar collector (REST/CSV/scrape).
5. Internal: pull from constants + mapping + quoteVisor image map + PanelRendering + existing maestro data → seed descriptions/images/meta.tech.
6. Images: reference (don't duplicate) + optional GCS master copy via existing gcsUpload. Add `panel:images:collect` or similar.
7. Output: idempotent upsert script(s) e.g. `scripts/collect-catalog-to-panelin.mjs --shopify --ml --maestro --constants --write`. Dry-run + report first. Store snapshots in .runtime/.

**Write / push from central to sites**:
- Workers or on-demand: price/stock updates (high frequency, via Panelin events or cron).
- Full publish (description + tech attrs + images + pricing) for new/updated products.
- Shopify: extend existing graphql + store to do productUpdate + variantUpdate (price, inventory) + productSetMedia or fileCreate + metafieldsSet.
- ML: extend client for item price/stock update, description/attrs, pictures (upload or attach URLs).
- Caucadi: TBD.
- Safety: simulate/dry-run, audit log (already in movements/prices source), human gate for big changes, drift alerts.
- MATRIZ: keep as auto-generated readonly view or selective push for human review (per unification plan).

**Risks**:
- Drift during transition (constants vs PG vs channels vs Sheets).
- Rate limits / auth on channels (Shopify 2/s-ish, ML per-app).
- SKU mapping quality (heuristic + manual links like maestro).
- Images: auth/rights when re-using channel CDNs vs hosting masters.
- Calculator breakage if pricing source flips without full test coverage.
- Multi-user writes (RBAC via grants + requireGrant already in place; Panelin uses similar).

---

## 7. Immediate Recommended Next Steps (prioritized)


**Collection baseline shipped** — 2026-06-12 via propagation automate (see report-2026-06-12T16-35-27).


**Collection baseline shipped** — 2026-06-12 via propagation automate (see report-2026-06-12T09-53-51).


**Collection baseline + tooling shipped (planning phase)** — 2026-06-12 via propagation automate + intelligent run plan. See .runtime/propagation-report-2026-06-12T09-35-02.md, docs/team/PRODUCT-CENTRAL-PIM-INTELLIGENT-RUN-PLAN.md, and GOAL-product-centralization-collector-with-propagation.md. Actual `scripts/collect-catalog-to-panelin.mjs` (Shopify-first collector) + real data seeding still pending implementation (plan Phase 1). Marker updated for accuracy — see PROJECT-STATE.md 2026-06-12 central PIM entry.

1. **Review & align**: Read this doc + latest `docs/team/PROJECT-STATE.md` + `panelin-platform/frontend/dashboard.html` + `server/routes/panelin.js` + `server/lib/productosMaestro.js`. Confirm Panelin PG (not Sheets) is the master you want to R/W for technical + pricing + visual going forward.
2. **Clarify Caucadi**: Provide any details (how you currently manage products there, login, API if any, catalog export, etc.) so we can add a collector stub.
3. **Seed/collect baseline**:
   - Run (with doppler): `npm run productos-maestro:reconcile -- --json` (capture latest gaps report).
   - Implement + run a collector script that pulls current Shopify catalog (leverage existing code) + seeds Panelin products + meta (images, desc, prices, stock) for as many SKUs as map. Dry first.
   - Extend to pull ML own items where possible.
   - Populate a starter set of tech specs in meta from constants + known families (ISODEC, ISOFRIG, perfiles, fijaciones...).
4. **Enhance R/W UX for central**:
   - Add description + meta editor (or JSON) to Panelin dashboard or a new /hub/panelin or reuse Productos Maestro surface.
   - Surface current channel images in the product detail view.
5. **Unblock calc consistency**: Decide on bake strategy or direct pricing fetch for calculator (with resilience to PG down).
6. **Outbound MVP**: One channel first (e.g. price/stock push to Shopify variants using existing auth/graphql). Then descriptions + images. Wire to Panelin events or manual "publish" action.
7. **Docs & propagation**: Update AGENTS.md (new commands), runbooks, capabilities if adding surfaces. Add to pre-deploy/smoke.
8. **Handoff**: After collection script + first seed run, produce snapshot report + .runtime/central-catalog-seed-*.json. Update this status doc.

**Related files to know** (core):
- Migrations: `panelin-platform/migrations/*`
- Libs: `server/lib/panelinDb.js`, `productosMaestro.js`, `panelinEvents.js`, `facturaExpressClient.js`
- Routes: `server/routes/panelin.js`, `shopify.js`, `bmcDashboard.js` (maestro + some sheets), `webhooks.js`
- UI: `panelin-platform/frontend/dashboard.html`, `src/components/ProductosMaestroEditor.jsx`
- Scripts: `reconcile-productos-maestro.mjs`, matriz syncs, panel rendering sync
- Old design: `docs/PRICING-UNIFICATION-PLAN.md`
- Runbooks: `docs/OPERATOR-RUNBOOK-PRODUCTOS-MAESTRO.md`
- Data: `src/data/constants.js`, `matrizPreciosMapping.js`, `quoteVisorShopifyMap.json`
- Sheets hub: `docs/google-sheets-module/`

**Verification commands** (inside project, with doppler for secrets):
- `npm run productos-maestro:reconcile`
- `doppler run -- npm run gate:local` (after changes)
- Smoke: `npm run smoke:prod` (covers MATRIZ + health)
- Panelin status: API + open dashboard.html against it
- Shopify pull test: hit the /api/shopify/products (requires connected shop + auth)

This doc is the collected central snapshot you (and agents) can read and iteratively write. It lives alongside PROJECT-STATE and the operator runbook.

Next prompt example to continue: "Implement the Shopify catalog collector script to seed Panelin products + meta (prices, stock, descriptions, image refs) from current live data. Dry-run first, then apply. Also add a minimal meta.images viewer in the panelin dashboard."

**Status of this review**: Complete audit from code, migrations, docs, AGENTS, PROJECT-STATE, routes, and recent Fase work. Ready for collection implementation.