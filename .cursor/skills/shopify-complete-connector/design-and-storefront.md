# Shopify design & storefront playbook (BMC)

Use when the task is **visual / theme / UX** on the Shopify store or bridging storefront media into the calculator.

## Principles

1. **One composition** on marketing landing templates; avoid dashboard clutter on the storefront home.
2. **Brand first:** BMC / Panelin naming and product photography dominate; do not ship generic AI theme kits (purple gradients, cream+terracotta clichés).
3. **CDN truth:** Product images live on Shopify CDN; calculator visor consumes synced JSON (`quoteVisorShopifyFamilies.json`, `quoteVisorShopifyMap.json`).
4. **No Admin secrets in Liquid or storefront JS.**
5. Prefer **theme app extensions** for app-owned UI so uninstall cleans up.

## Surfaces

| Surface | When | Notes |
|---------|------|-------|
| Online Store 2.0 theme | Merchant-owned look | JSON templates, sections, `{% schema %}` |
| Theme app extension | App ships blocks/embeds | Best for Panelin widgets on PDP |
| Checkout Extensibility | Thank-you / checkout UI | Plus or extensibility-enabled plans |
| Hydrogen / headless | Custom React storefront | Optional; heavier ops — justify before adopting |
| Calculator visor | In-app quote UX | Sync scripts, not live Admin calls from browser |

## Workflow — theme / design change

```
Design task:
- [ ] Confirm target: live theme vs app extension vs calculator-only
- [ ] Pull brand assets / existing section list
- [ ] Implement in extension or theme PR
- [ ] Preview on development theme / `shopify theme dev`
- [ ] If media mapping changed: npm run visor:shopify-sync
- [ ] Document in PROJECT-STATE
```

### Calculator media bridge

1. Storefront or collection JSON must list panel products (not only accessories).
2. `npm run visor:shopify-families` / `visor:shopify-map` / `visor:shopify-sync`.
3. Scripts abort if Shopify returns **0** products — do not empty existing maps.
4. Strict family filters live in `scripts/build-quote-visor-shopify-families.mjs` (`FAMILY_STRICT_FILTERS`, allowlists).

### PDP / collection content

- Titles and descriptions: Spanish commercial copy; prices USD; IVA messaging per `COMERCIAL-CHAT-ML-SHOPIFY.md`.
- Metafields for tech specs (espesor, núcleo, au) when theme sections need structured data.
- Keep SKU alignment with Panelin / `constants.js` via metafield or tag convention.

## App Bridge / embedded admin design

If building Hub-like UI inside Shopify Admin (`shop-chat-agent/`):

- Use App Bridge / Polaris for **admin** chrome (this is an admin surface, not a marketing landing — cards/tables OK).
- Deep-link to BMC calculator or Hub when operators need full quote tooling.
- Auth: session token from Shopify → exchange/verify server-side; never trust client-only shop claims.

## Accessibility & performance

- Compress images; use Shopify image URL filters / srcset in Liquid.
- Avoid huge Liquid loops over all products on homepage.
- Prefer lazy-loaded galleries on PDP.

## Handoff to functionality

Design that needs live data (stock, custom price, quote CTA):

1. Add Storefront query or app proxy / BMC API endpoint.
2. Wire CTA to calculator (`calculadora-bmc.vercel.app` or configured public URL) with UTM + product handle/SKU.
3. Do not duplicate pricing engine in Liquid — link out or call BMC.
