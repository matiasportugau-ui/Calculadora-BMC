# Networks & Development Agent — Reference

Contexto técnico para evaluaciones de hosting, storage, email y migración.

---

## Stack Completo

| Componente | Tecnología | Ubicación |
|------------|------------|-----------|
| API principal | Express (Node) | server/index.js, puerto 3001 |
| Dashboard standalone | Node HTTP | sheets-api-server.js, puerto 3849 |
| Frontend | Vite + React | puerto 5173 |
| Sheets | Google Sheets API | BMC_SHEET_ID |
| Calc Cloud | Cloud Run | panelin-calc-*.run.app |
| Túnel dev | ngrok | puerto 4040 |
| Hosting propio | VPS, PM2, nginx | docs/HOSTING-EN-MI-SERVIDOR.md |

---

## Integraciones Activas

| Integración | Propósito | Config |
|-------------|-----------|--------|
| Google Sheets | CRM, cotizaciones, pagos, audit | BMC_SHEET_ID, GOOGLE_APPLICATION_CREDENTIALS |
| Google Drive | Save/Load proyectos | VITE_GOOGLE_CLIENT_ID |
| MercadoLibre | OAuth, preguntas, órdenes | ML_CLIENT_ID, ML_CLIENT_SECRET, ML_REDIRECT_URI_DEV |
| Shopify | Preguntas, cotizaciones | server/routes/shopify.js |
| Cloud Run | API de cálculo | OpenAPI docs/openapi-calc.yaml |
| ngrok | Túnel HTTPS para OAuth | ML_REDIRECT_URI_DEV |

---

## Endpoints API (Completo)

### Health & Auth
- GET /health
- GET /auth/ml/start, /auth/ml/callback, /auth/ml/status

### MercadoLibre
- GET /ml/users/me, /ml/items/:id, /ml/questions, /ml/orders
- POST /ml/questions/:id/answer

### BMC Dashboard
- GET /api/cotizaciones, /api/proximas-entregas, /api/coordinacion-logistica
- GET /api/kpi-financiero, /api/audit, /api/pagos-pendientes, /api/metas-ventas
- POST /api/marcar-entregado
- GET /api/server-export (estado sin secretos)

### Static
- GET /finanzas (Dashboard UI)

---

## Variables de Entorno

### Requeridas (Dashboard)
- BMC_SHEET_ID
- GOOGLE_APPLICATION_CREDENTIALS
- BMC_SHEET_SCHEMA (Master_Cotizaciones | CRM_Operativo)

### Requeridas (ML)
- ML_CLIENT_ID, ML_CLIENT_SECRET, ML_REDIRECT_URI_DEV

### Opcionales
- VITE_GOOGLE_CLIENT_ID, VITE_API_URL
- LOG_LEVEL, WEBHOOK_VERIFY_TOKEN, API_AUTH_TOKEN
- ML_TOKEN_STORAGE (file | gcs), ML_TOKEN_GCS_BUCKET
- BMC_SHEETS_API_PORT (default 3849)

---

## Servicios a Evaluar (Checklist)

- [ ] Hosting: VPS Netuy, Cloud Run, otro
- [ ] Storage: disco local, GCS, límites del plan
- [ ] Email: Gmail API, IMAP, webhooks
- [ ] Migración: orden, backup, rollback
- [ ] APIs no usadas: Google, ML, Shopify, proveedor de hosting

---

## AI Interactive Team

When collaborating with Mapping and Design agents (skill `ai-interactive-team`):

- **Discovery:** Document infrastructure changes (hosting, migration, new endpoint, storage).
- **Log for Mapping:** Config drift risks, Sheets API reachability, env vars.
- **Log for Design:** New URLs, ports, CORS, relative paths, loading/error states.
- **Artifacts:** HOSTING-EN-MI-SERVIDOR.md, migration plan, risk checklist.
- **Escalate** if infra constraints conflict with mapping or design; call user before looping.
