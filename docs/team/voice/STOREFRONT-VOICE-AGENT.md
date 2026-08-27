# Storefront Voice Agent — Panelin on bmcuruguay.com.uy

Buyer-facing Grok Speech-to-Speech widget. Separate from operator Panelin BMC (`panelinBmcInstructions.js`).

| | |
|---|---|
| Demo (local API) | http://localhost:3001/storefront-voice/ |
| Widget | `/storefront-voice/widget.js` |
| Session | `POST /api/public/voice/session` |
| Tools | `POST /api/public/voice/action` |
| Flag | `PUBLIC_STOREFRONT_VOICE` (on in development; off in production unless `1`) |
| WhatsApp | `STOREFRONT_WA_NUMBER` default `59892663245` (store float) |

## Shopify install (HITL `APPLY=1`)

```html
<script src="https://panelin-calc-q74zutv7dq-uc.a.run.app/storefront-voice/widget.js" defer></script>
```

Cloud Run also needs `PUBLIC_STOREFRONT_VOICE=1` and CORS already includes `https://bmcuruguay.com.uy`.

## Safety

Public allowlist only: catalog/calc lista **web**, `capture_lead` (consent required → Admin 2.0 `origen=VW`), `handoff_whatsapp`. Does **not** call `/api/agent/voice/action`.
