# Theme Access setup (required to pull / push the live theme)

Without these, Local Studio can still edit **catalog** drafts, but **theme Liquid** cannot be pulled.

## 1. Create Theme Access password

1. Shopify Admin → **Apps** → search **Theme Access** (Shopify app) → install
2. Create a password for a collaborator / CLI user
3. Copy the password

## 2. Put values in `.env` (repo root)

```bash
SHOPIFY_SHOP=your-store.myshopify.com
SHOPIFY_CLI_THEME_TOKEN=shptka_...   # Theme Access password
SHOPIFY_STOREFRONT_URL=https://bmcuruguay.com.uy
```

Do **not** commit `.env`.

## 3. Pull → patch → preview → upload

```bash
npm run shopify:theme:pull
npm run shopify:theme:apply-patches
npm run shopify:theme:dev
# In the browser preview: Product page → confirm «Cotizar con Panelin»
npm run shopify:theme:push
```

Then in Admin → Online Store → Themes → open the **unpublished** theme → Customize → Product template → add section **BMC Cotizar Panelin** under the buy button → Preview → Publish when ready.

## 4. What the patch adds

| File | Role |
|------|------|
| `snippets/bmc-cotizar-cta.liquid` | Button → Calculadora BMC (`?chat=1&shopify_handle=…`) |
| `sections/bmc-cotizar-banner.liquid` | Theme Editor section |
| `assets/bmc-cotizar-cta.css` | BMC teal CTA styles |

## Troubleshooting

- `SHOPIFY_SHOP` empty → set myshopify domain (not bmcuruguay.com.uy)
- Auth errors → regenerate Theme Access password
- Section missing after push → confirm files exist under theme `sections/` and template is OS 2.0 JSON
