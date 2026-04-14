# Checklist de seguridad pre-deploy

**Propósito:** Lista ejecutable para revisar seguridad antes de deploy. Marcar cada ítem al revisar.

**Cuándo usar:** Antes de deploy a Cloud Run, VPS Netuy, o cualquier ambiente productivo.

---

## 1. Variables de entorno

- [ ] `.env` no está en el repo (solo .env.example)
- [ ] `.env.example` no contiene valores reales (solo placeholders)
- [ ] `GOOGLE_APPLICATION_CREDENTIALS` apunta a service account con permisos mínimos
- [ ] `ML_CLIENT_SECRET` y `SHOPIFY_CLIENT_SECRET` solo en .env (nunca en código)
- [ ] `TOKEN_ENCRYPTION_KEY` configurado (64 hex chars) si se usan tokens
- [ ] `SHOPIFY_WEBHOOK_SECRET` configurado para validar HMAC

---

## 2. OAuth

- [ ] `ML_REDIRECT_URI` / `PUBLIC_BASE_URL` coincide con la URL de producción
- [ ] State validation activo (no deshabilitado)
- [ ] Tokens almacenados cifrados (TOKEN_ENCRYPTION_KEY o GCS con KMS)

---

## 3. CORS

- [ ] Orígenes permitidos restringidos en producción (no `*`)
- [ ] Credentials: true solo si es necesario
- [ ] Ver `server/index.js` cors config

---

## 4. Headers de seguridad

- [ ] `X-Frame-Options: DENY` (o SAMEORIGIN si hay iframes legítimos)
- [ ] `X-Content-Type-Options: nosniff`
- [ ] CSP configurado si aplica

---

## 5. Webhooks

- [ ] Shopify: HMAC validation activa con SHOPIFY_WEBHOOK_SECRET
- [ ] ML: verify token si aplica
- [ ] Raw body para webhooks que requieren firma

---

## 6. API / Rutas

- [ ] Rutas sensibles protegidas (API_KEY, auth)
- [ ] No hay rutas de debug en producción
- [ ] `/api/diagnostic` deshabilitado o solo en dev

---

## Referencias

- .env.example — variables documentadas
- bmc-security-reviewer — skill de revisión
- server/index.js — cors, headers
