# Estado de OAuth — Integraciones

**Propósito:** Documentar qué apps están configuradas (ML, Shopify), redirect URIs, scopes. Evita proponer cambios que rompan OAuth existente.

---

## MercadoLibre

| Parámetro | Valor / Estado |
|-----------|----------------|
| ML_CLIENT_ID | 742811153438318 |
| ML_CLIENT_SECRET | Configurado en .env |
| Redirect URI (dev) | http://localhost:3001/auth/ml/callback |
| Redirect URI (prod) | PUBLIC_BASE_URL + /auth/ml/callback |
| Token storage | File (.ml-tokens.enc) o GCS |
| TOKEN_ENCRYPTION_KEY | Requerido para cifrado |

---

## Shopify

| Parámetro | Valor / Estado |
|-----------|----------------|
| SHOPIFY_CLIENT_ID | Configurar en .env |
| SHOPIFY_CLIENT_SECRET | Configurar en .env |
| Redirect | /auth/shopify/callback |
| SHOPIFY_WEBHOOK_SECRET | Para validar HMAC |
| SHOPIFY_SCOPES | read_products, write_products, read_orders, etc. |

---

## Referencias

- .env.example
- server/config.js
- docs/security/FLUJOS-OAUTH.md
