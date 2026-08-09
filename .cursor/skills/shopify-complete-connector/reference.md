# Shopify Complete Connector — API & platform reference

Companion to `SKILL.md`. Load this when implementing or debugging Admin/Storefront/webhooks.

## 1. Env & Partner app

| Variable | Role |
|----------|------|
| `SHOPIFY_CLIENT_ID` | App API key |
| `SHOPIFY_CLIENT_SECRET` | App secret (HMAC + token exchange) |
| `SHOPIFY_WEBHOOK_SECRET` | Webhook HMAC (often same as client secret for custom apps; confirm in Partner dashboard) |
| `SHOPIFY_SCOPES` | Space-separated scopes |
| `SHOPIFY_QUESTIONS_SHEET_TAB` | Sheet tab for question ingest |
| `TOKEN_ENCRYPTION_KEY` | 64 hex chars (32 bytes) for `shopifyStore` |
| `PUBLIC_BASE_URL` | HTTPS base for OAuth redirect + webhooks |
| `API_AUTH_TOKEN` | Protects `/api/shopify/*` |
| `BMC_SHEET_ID` | Spreadsheet for question rows |

Partner Dashboard checklist:

1. Create app (custom or public) → set App URL / redirect to `{PUBLIC_BASE_URL}/auth/shopify/callback`.
2. Enable scopes matching `SHOPIFY_SCOPES`.
3. Webhooks → `{PUBLIC_BASE_URL}/webhooks/shopify` (or subscribe via Admin GraphQL `webhookSubscriptionCreate` after install).
4. For embedded admin: configure `shop-chat-agent/shopify.app.toml` `application_url` + `redirect_urls`.
5. GDPR mandatory webhooks for public apps.

## 2. OAuth flow (this repo)

1. `GET /auth/shopify?shop={shop}.myshopify.com`
2. Server builds PKCE verifier/challenge, stores state payload in Postgres (`oauthStateStore`), sets cookies, redirects to Shopify authorize URL.
3. `GET /auth/shopify/callback` — verify `shop`, `hmac`, `state` (consume once), exchange `code` + verifier for tokens, `shopifyStore.setTokens(shop, tokens)`.
4. Subsequent Admin calls: `https://{shop}/admin/api/{version}/graphql.json` with `X-Shopify-Access-Token`.

Shop domain validation: `^[a-zA-Z0-9][a-zA-Z0-9.-]*\.myshopify\.com$`.

## 3. Admin GraphQL — common operations

Prefer GraphQL over REST. Keep version in one place (currently `2024-01` in `shopify.js`).

### Products (read)

Already wrapped:

- `GET /api/shopify/products?shop=&limit=&cursor=&status=&q=`
- `GET /api/shopify/catalog/full?shop=&pageSize=&maxPages=&status=&q=`

Fields returned: id, handle, title, status, vendor, productType, tags, options, images, variants (sku, price, inventoryQuantity, …).

### Products (write) — patterns

- `productCreate` / `productUpdate` / `productVariantsBulkUpdate`
- `productCreateMedia` for images
- Inventory: `inventorySetQuantities` (Inventory API) — requires `write_inventory`
- Prices: variant `price` / `compareAtPrice`; BMC source of truth is MATRIZ / Panelin, not ad-hoc edits

### Orders & customers

- Queries: `orders`, `order(id)`, `customers`, `customer(id)`
- Mutations: note updates, tags, draftOrderCreate, refunds (high caution)
- Webhooks: `orders/create`, `orders/updated`, `orders/paid`, `customers/create`, …

### Metafields & metaobjects

- Namespace reserved for BMC e.g. `bmc` / `panelin`
- Use for cross-links: calculator SKU ↔ Shopify variant GID
- Metaobjects for structured tech sheets if theme needs them

### Discounts

- `discountCodeBasicCreate`, automatic discounts, Shopify Functions for custom logic
- Request `write_discounts` only when building this track

## 4. Storefront API vs public JSON

| Need | Use |
|------|-----|
| Theme / headless cart, customer accounts | Storefront API (storefront access token; separate from Admin) |
| Visor image sync without Admin | Public `https://{storefront}/collections/.../products.json` (as visor scripts do) |
| Server-side catalog for Hub/CRM | Admin GraphQL via `/api/shopify/*` |

Never ship Admin access tokens to Vite/`VITE_*` env.

## 5. Webhooks

- Endpoint: `POST /webhooks/shopify` with `express.raw` body (see `server/index.js`).
- Verify `X-Shopify-Hmac-Sha256` with timing-safe compare.
- Headers: `X-Shopify-Topic`, `X-Shopify-Shop-Domain`, `X-Shopify-Webhook-Id`.
- Respond **200** quickly; enqueue heavy work.
- Idempotency: store webhook id or hash(topic+id).

Topics to enable by track:

| Track | Topics (examples) |
|-------|-------------------|
| Catalog | `products/create`, `products/update`, `products/delete`, `inventory_levels/update` |
| Orders | `orders/create`, `orders/updated`, `orders/cancelled` |
| Customers / GDPR | `customers/create`, `customers/data_request`, `customers/redact`, `shop/redact` |
| App | `app/uninstalled` → delete tokens |

## 6. Shopify CLI & app project

`shop-chat-agent/` is an embedded app scaffold:

- `shopify.app.toml` — client_id, scopes, webhooks api_version, auth redirect_urls
- `shopify.web.toml` — local web process
- Extend for admin UI blocks / chat; keep secrets out of git

Useful CLI (when Partner auth available on the machine):

```bash
cd shop-chat-agent && npx shopify app dev
```

## 7. Rate limits & errors

- Admin GraphQL: cost-based throttle; use bulk operations for huge catalogs.
- On 429 / `THROTTLED`: exponential backoff; surface clean 502/503 to BMC clients.
- Missing scope: Shopify returns access denied — add scope, re-install/re-authorize shop.

## 8. Testing checklist

- [ ] OAuth install on staging shop
- [ ] Token file decrypts with `TOKEN_ENCRYPTION_KEY`
- [ ] `GET /api/shopify/products?shop=...` with API key returns `ok: true`
- [ ] Webhook with invalid HMAC → 401; valid → 200
- [ ] `app/uninstalled` clears shop tokens
- [ ] Visor sync does not overwrite maps when remote product count is 0
- [ ] Publish script `--dry-run` shows planned mutations before `--write`

## 9. Official docs (external)

- Admin API: https://shopify.dev/docs/api/admin-graphql
- Storefront API: https://shopify.dev/docs/api/storefront
- Apps / auth: https://shopify.dev/docs/apps/auth
- Webhooks: https://shopify.dev/docs/apps/webhooks
- Theme app extensions: https://shopify.dev/docs/apps/online-store/theme-app-extensions
- Checkout Extensibility: https://shopify.dev/docs/api/checkout-extensions
- Functions: https://shopify.dev/docs/api/functions
