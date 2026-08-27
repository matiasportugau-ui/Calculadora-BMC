# Storefront Voice Agent — Panelin on bmcuruguay.com.uy

Buyer-facing **Panelin Front**: floating calculator-body chat (avatar + chips + composer) plus Grok Speech-to-Speech **on open**. No operator chrome (sidebar / DEV / model). Text and mic share the same thread. Separate from operator Panelin BMC (`panelinBmcInstructions.js`).

Architecture SoT: `docs/sdd/storefront-voice-agent/SDD.md`. Policy: classify → assess → green; quote only on insist; lista web + PDF; never flete; Admin 2.0 `origen=VW`.

| | |
|---|---|
| Demo (local API) | http://localhost:3001/storefront-voice/ |
| Widget | `/storefront-voice/widget.js` |
| Avatar | `/storefront-voice/panelin.png` |
| Session | `POST /api/public/voice/session` |
| Identify | `POST /api/public/voice/identify` (name + phone → Admin 2.0 row) |
| Chat log | `POST /api/public/voice/log` (transcript → col J) |
| Text chat | `POST /api/public/voice/chat` |
| Tools | `POST /api/public/voice/action` |
| Flag | `PUBLIC_STOREFRONT_VOICE` (on in development; off in production unless `1`) |
| WhatsApp | `STOREFRONT_WA_NUMBER` default `59892663245` (store float) |

## Shopify install (HITL `APPLY=1`)

```html
<script src="https://panelin-calc-q74zutv7dq-uc.a.run.app/storefront-voice/widget.js" defer></script>
```

Cloud Run also needs `PUBLIC_STOREFRONT_VOICE=1` and CORS already includes `https://bmcuruguay.com.uy`.

## Safety

Public allowlist: catalog/calc lista **web**, `generar_pdf` (insist path, flete=0), `capture_lead` (consent → Admin `origen=VW`, PDF in col K), `handoff_whatsapp`. Browser shop tools (same origin): `shop_search`, `shop_product`, `get_cart`, `add_to_cart`, `navigate`, `open_url`, `share_link`. Does **not** call `/api/agent/voice/action`. Never quote flete. Catalog SKUs can go to the Shopify cart.

`add_to_cart` and the widget **Carrito** button dispatch Horizon `cart:update` and call `Shopify.actions.openCart()` so the live drawer + header bubble stay in sync. `/cart` opens the drawer instead of a full navigation (voice call keeps going). Product `navigate` still `location.assign` and resumes via `sessionStorage bmc_panelin_resume`.
