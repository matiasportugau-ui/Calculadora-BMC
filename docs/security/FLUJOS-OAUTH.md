# Flujos OAuth — MercadoLibre y Shopify

**Propósito:** Diagrama o descripción de flujos OAuth. Validar que no haya fugas de tokens.

---

## MercadoLibre

1. **Inicio:** Usuario va a /auth/ml/start
2. **Redirect:** Redirige a auth.mercadolibre.com.uy con client_id, redirect_uri, state
3. **Callback:** Usuario autoriza → redirect a /auth/ml/callback?code=...&state=...
4. **Validación:** state debe existir en oauthStates (TTL 10 min)
5. **Tokens:** Intercambio code por access_token, refresh_token; guardar en tokenStore (cifrado)
6. **Uso:** ML client usa tokens para /ml/questions, /ml/orders, etc.

**Seguridad:** state validation, TOKEN_ENCRYPTION_KEY, tokens no en logs.

---

## Shopify

1. **Inicio:** Usuario va a /auth/shopify (o equivalente)
2. **Redirect:** A Shopify OAuth con client_id, redirect_uri, scope
3. **Callback:** /auth/shopify/callback con code
4. **Tokens:** Intercambio; guardar
5. **Webhooks:** POST /webhooks/shopify con HMAC; validar SHOPIFY_WEBHOOK_SECRET

**Seguridad:** HMAC validation en webhooks, secrets en .env.

---

## Referencias

- server/index.js, server/routes/shopify.js
- OAUTH-ESTADO.md
- CHECKLIST-SEGURIDAD-PRE-DEPLOY.md
