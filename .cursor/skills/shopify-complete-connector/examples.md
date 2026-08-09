# Shopify Complete Connector — examples

## Example 1: “Connect my Shopify store end-to-end”

**Agent actions:**

1. Apply this skill (not only v4).
2. Check `.env` for `SHOPIFY_*`, `PUBLIC_BASE_URL`, `TOKEN_ENCRYPTION_KEY`, `API_AUTH_TOKEN`.
3. Start API if down; open `GET /auth/shopify?shop=YOUR.myshopify.com`.
4. Verify token file under `.shopify-shops/` (encrypted).
5. Smoke: `curl -sS -H "X-Api-Key: $API_AUTH_TOKEN" "http://localhost:3001/api/shopify/products?shop=YOUR.myshopify.com&limit=5"`.
6. Confirm webhook URL in Partner dashboard → `/webhooks/shopify`.

**Output:** Short setup checklist + any missing env vars (names only, no secret values).

## Example 2: “Develop catalog sync / push prices”

1. Read `scripts/publish-panelin-to-shopify.mjs` and Panelin channel mapping.
2. Run `--dry-run` for one SKU; review `.runtime/publish-panelin-to-shopify-*.md`.
3. Only with explicit approval: `--write`.
4. Ensure scopes include product/inventory writes; re-OAuth if scopes changed.
5. Optionally refresh visor: `npm run visor:shopify-sync`.

## Example 3: “Change storefront design / theme”

1. Load [design-and-storefront.md](design-and-storefront.md).
2. Choose theme app extension vs theme edit.
3. Implement sections/CSS; preview on development theme.
4. If product imagery changed, run visor sync.
5. Keep Admin tokens off the storefront.

## Example 4: “Add orders webhook → Hub / Omni”

1. Subscribe `orders/create` (and needed topics).
2. Extend `POST /webhooks/shopify` topic switch: HMAC already required.
3. Normalize payload → internal event (follow Omni patterns if channeling to inbox).
4. Idempotent persist; fast 200.
5. Update PROJECT-STATE + Networks if public URL/topics change.

## Example 5: “Questions / auto-reply only”

Defer to [`shopify-integration-v4`](../shopify-integration-v4/SKILL.md) for Sheet + admin answer + UTC-3 scheduler. Use this skill only if OAuth/HMAC/shared router changes are needed.

## Example 6: “Expose a new Admin capability in BMC API”

Template:

```text
1. Scope: add X to SHOPIFY_SCOPES (document why)
2. Route: GET|POST /api/shopify/<resource> behind requireApiAuth
3. Implementation: shopifyGraphql({ shop, accessToken, query, variables })
4. Tests: offline mock of GraphQL response in tests/
5. .env.example + PROJECT-STATE
```

## Capability backlog (pick with user)

Use as a menu when the user says “all Shopify options”:

- [ ] OAuth install + token health endpoint
- [ ] Catalog read API (exists) + write/publish
- [ ] Inventory sync
- [ ] Collections / smart collections
- [ ] Metafields ↔ calculator SKUs
- [ ] Orders ingest → CRM/Omni
- [ ] Customers sync / GDPR
- [ ] Discounts / price rules
- [ ] Theme app extension (quote CTA)
- [ ] Checkout UI extension
- [ ] Shopify Function (discount/shipping)
- [ ] Embedded admin app polish (`shop-chat-agent`)
- [ ] Markets / multi-currency (read-only first)
- [ ] Analytics / reports export
- [ ] Flow / automation triggers
- [ ] Storefront API headless experiment
