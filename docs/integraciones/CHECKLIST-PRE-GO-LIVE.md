# Checklist pre-go-live — Integraciones

**Propósito:** Verificar que Shopify y MercadoLibre funcionan en producción antes de go-live.

---

## MercadoLibre

- [ ] ML_CLIENT_ID y ML_CLIENT_SECRET configurados en prod
- [ ] Redirect URI en ML Developer apunta a URL de producción
- [ ] TOKEN_ENCRYPTION_KEY configurado
- [ ] OAuth flow probado: /auth/ml/start → callback → tokens guardados
- [ ] /ml/questions, /ml/orders responden con datos reales
- [ ] Webhooks ML (si aplica): URL y verify token configurados

---

## Shopify

- [ ] SHOPIFY_CLIENT_ID y SHOPIFY_CLIENT_SECRET configurados
- [ ] Redirect URI en Shopify Partners apunta a producción
- [ ] SHOPIFY_WEBHOOK_SECRET configurado
- [ ] OAuth flow probado
- [ ] Webhook /webhooks/shopify: HMAC validation OK
- [ ] SHOPIFY_QUESTIONS_SHEET_TAB configurado si aplica

---

## CORS

- [ ] Orígenes permitidos incluyen URL de producción
- [ ] No usar `*` en producción

---

## Referencias

- docs/security/CHECKLIST-SEGURIDAD-PRE-DEPLOY.md
- OAUTH-ESTADO.md
