# Security Reviewer — Reference

## Checklist (pre-deploy)

- [ ] .env no en repo; .env.example sin valores reales
- [ ] OAuth state validation (ttl, single use)
- [ ] Token storage encrypted (si aplica)
- [ ] Webhook HMAC verified before body parse
- [ ] CORS restrictivo en producción
- [ ] X-Frame-Options, X-Content-Type-Options
- [ ] GOOGLE_APPLICATION_CREDENTIALS path seguro

## Related

- Red: Infra, hosting, migración (afecta dónde corren los secrets)
- Integra: OAuth ML, Shopify, webhooks
