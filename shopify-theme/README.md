# Shopify theme (local edit → upload)

Pull the live Online Store theme here, edit in Cursor, preview locally, then push.

## Prerequisites

1. `SHOPIFY_SHOP=your-store.myshopify.com` in `.env`
2. Shopify CLI (`npm i -g @shopify/cli @shopify/theme`) **or** Theme Access app password as `SHOPIFY_CLI_THEME_TOKEN`

## Commands

```bash
npm run shopify:theme:pull   # download → this folder
# edit Liquid / CSS / JSON templates
npm run shopify:theme:dev    # local preview with hot reload
npm run shopify:theme:push   # upload as **unpublished** theme (safe default)
```

Live push (careful): `npm run shopify:theme:push -- --live`

## Catalog edits (titles / prices)

Use Hub **Shopify Local Studio**: http://localhost:5173/hub/shopify  
Drafts are stored under `.runtime/shopify-studio-drafts.json` until you upload.

## Safety

- Do not commit pulled theme vendor blobs if huge — `shopify-theme/theme/` is gitignored when present.
- Never commit Theme Access passwords or Admin tokens.
