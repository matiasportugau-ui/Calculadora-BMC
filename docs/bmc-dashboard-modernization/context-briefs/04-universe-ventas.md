# Universe brief: Ventas

**Source:** IA report, DASHBOARD-VISUAL-MAP, DASHBOARD-EVALUATION-REPORT, bmcDashboard.js, server (ML, Shopify).

---

## Scope

- **From docs/code:** “Ventas 2.0” is a **planned** section (IA report); not implemented as a dedicated UI in the map or evaluation. **Implemented today:** (1) Sheet “Ventas realizadas y entregadas” — target for POST /api/marcar-entregado (Operaciones writes here); (2) Metas_Ventas — used by Finanzas KPI; (3) ML and Shopify integrations — server has ML OAuth, questions, orders; Shopify router (v4) for questions/quotes (replacing ML). No dedicated “Ventas” dashboard view in repo.
- **Directly observed:** Ventas realizadas sheet exists in bmcDashboard handleMarcarEntregado; ML/Shopify are sales-channel backends, not a Ventas “module” UI.

## Data

- **Sheets:** “Ventas realizadas y entregadas” (append-only from marcar-entregado), Metas_Ventas (read by Finanzas).
- **APIs:** MercadoLibre (auth, questions, orders), Shopify (webhooks, admin questions). Not exposed as a single “Ventas” API in the dashboard docs.
- **Env:** ML_*, Shopify_*, PUBLIC_BASE_URL for OAuth.

## Tech

- **Entry:** None for “Ventas” as a section. ML/Shopify routes live on Express (e.g. /auth/ml/*, /webhooks/shopify, Shopify admin flows).
- **Stack:** Express routes for ML and Shopify; token storage; no dedicated Ventas React or static page in dashboard folder.
- **Key files:** `server/index.js` (ML routes), `server/routes/shopify.js`, `server/shopifyStore.js`; references in skills to shopify-integration-v4, ML OAuth.

## Users / personas

- **Uncertain:** Who uses “Ventas 2.0” (pipeline view? channel management?). Not in docs.

## Current pain points

- **From IA report:** Ventas is a placeholder; scope TBD. No UI, no nav, no clear boundary with Finanzas (metas) or Operaciones (entregas → realizadas).
- **From evaluation:** ML OAuth redirect_uri localhost on Cloud Run; tokens not stored; PUBLIC_BASE_URL fix needed.

## Dependencies

- **On Operaciones:** Writes completed sales to “Ventas realizadas y entregadas.”
- **On Finanzas:** Reads Metas_Ventas for KPI.
- **On Shell:** Future “Ventas” nav item and route (to be defined).
- **On Invoque Panelin (future):** Possible pipeline or channel insights.

## Uncertainties

- Full scope of Ventas 2.0 (pipeline, channels, reporting?). Whether Ventas UI will aggregate ML/Shopify data or only show “Ventas realizadas” + metas. Relationship to Shopify admin vs BMC Dashboard.
