# Shopify theme (local edit → upload)

Pull the live Online Store theme here, apply BMC patches, preview, then push.

## Best path (theme improvements)

1. **Connect Theme Access** — see [SETUP-THEME-ACCESS.md](SETUP-THEME-ACCESS.md)
2. `npm run shopify:theme:pull`
3. `npm run shopify:theme:apply-patches`  ← adds «Cotizar con Panelin» PDP CTA
4. `npm run shopify:theme:dev`            ← local preview
5. Theme Editor: add section **BMC Cotizar Panelin** under buy buttons
6. `npm run shopify:theme:push`           ← unpublished theme (safe)
7. Publish from Admin when approved

## Prerequisites

```bash
SHOPIFY_SHOP=your-store.myshopify.com
SHOPIFY_CLI_THEME_TOKEN=...   # Theme Access password
```

Shopify CLI: `npm i -g @shopify/cli @shopify/theme` (or use `npx shopify`).

## Commands

| Script | Purpose |
|--------|---------|
| `npm run shopify:theme:pull` | Download live theme → this folder |
| `npm run shopify:theme:apply-patches` | Copy BMC PDP Cotizar CTA into pulled theme |
| `npm run shopify:theme:dev` | Local preview + hot reload |
| `npm run shopify:theme:push` | Upload as **unpublished** theme |

Live push (careful): `npm run shopify:theme:push -- --live`

## Catalog edits (not theme)

http://localhost:5173/shopify-local — titles / prices drafts → upload via Admin API.

## Safety

- Pulled theme body is gitignored; `patches/` stays in git.
- Never commit Theme Access passwords or Admin tokens.
