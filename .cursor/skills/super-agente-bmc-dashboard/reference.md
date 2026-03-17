# Super Agente BMC Dashboard — Reference

## Quick Reference (URLs principales)

| Uso | Endpoint / URL |
|-----|----------------|
| Health check | `GET /health` |
| Cotizaciones | `GET /api/cotizaciones` |
| Dashboard | `GET /finanzas` o `http://localhost:5173` |
| Raíz `/` | No tiene handler — devuelve 404. Es normal. |

---

## Commands Cheat Sheet

### 1. Log Discovery & Tail

```bash
find . -type f \( -name "*.log" -o -path "*/.codebuddy/logs/*" -o -path "*/logs/*.log" \) -not -path "./node_modules/*" -not -path "./.git/*" 2>/dev/null | head -30
tail -n 500 *.log 2>/dev/null || true
# Per-file (if logs in subdir):
for f in $(find . -name "*.log" 2>/dev/null | head -10); do echo "=== $f ==="; tail -n 200 "$f" 2>/dev/null; done
```

### 2. System State

```bash
curl -s http://localhost:3001/health | jq .
pgrep -fl "node.*server"
lsof -i :3001
lsof -i :3849
lsof -i :5173
lsof -i :4040
```

### 3. Git

```bash
git log --oneline -20
git status
git branch -a
```

### 4. Config

```bash
test -f .env && echo "OK" || echo "MISSING"
grep -E "BMC_SHEET_ID|GOOGLE_APPLICATION_CREDENTIALS|ML_CLIENT" .env 2>/dev/null | sed 's/=.*/=***/'
test -f docs/bmc-dashboard-modernization/service-account.json && python3 -c "import json; json.load(open('docs/bmc-dashboard-modernization/service-account.json'))" && echo "Valid JSON" || echo "Invalid"
```

### 5. Dependencies

```bash
npm ls --depth=0
npm audit --audit-level=moderate 2>/dev/null || npm audit
test -f package-lock.json && echo "OK" || echo "MISSING"
```

### 6. Endpoints Verification

```bash
curl -s http://localhost:3001/health | jq .
curl -s http://localhost:3001/api/cotizaciones | jq .ok
curl -s http://localhost:3001/api/proximas-entregas | jq .ok
```

### 7. Security

```bash
grep -E "\.env|service-account" .gitignore 2>/dev/null
```

### 8. Sheets

```bash
curl -s http://localhost:3001/api/cotizaciones | jq '.ok, (.data | length)'
```

### 9. ngrok

```bash
curl -s http://127.0.0.1:4040/api/tunnels | jq '.tunnels[]?.public_url' 2>/dev/null || echo "ngrok not running"
```

---

## Anomaly Heuristics (Log Analysis)

| Heurística | Qué buscar | Acción |
|------------|------------|--------|
| **Spikes de errores** | Tasa de líneas con "error", "Error", "500", "401", "403" por ventana (ej. 5 min) | Contar por ventana; spike = >3x media |
| **Outliers en timestamps** | Gaps > 60s entre líneas consecutivas | Marcar como posible downtime o pausa |
| **Errores únicos/raros** | Mensajes que aparecen 1–2 veces en todo el log | Listar para revisión manual |
| **Auth failure bursts** | Secuencias de "Invalid", "expired", "401", "OAuth", "callback" | Correlacionar con ngrok/ML_REDIRECT_URI |
| **Timeouts repentinos** | "timeout", "ETIMEDOUT", "ECONNRESET" | Revisar ML_HTTP_TIMEOUT_MS, red |
| **Correlación endpoint** | Errores agrupados por path (ej. /api/cotizaciones, /auth/ml) | Identificar endpoint problemático |
| **Correlación ngrok** | Errores cerca de cambios de tunnel URL | Verificar ML_REDIRECT_URI_DEV actualizado |

---

## Endpoint Table

### Health & Auth

| Method | Path | Purpose |
|--------|------|---------|
| GET | /health | Health check, hasTokens, missingConfig |
| GET | /auth/ml/start | Start OAuth flow (redirect or JSON) |
| GET | /auth/ml/callback | OAuth callback |
| GET | /auth/ml/status | Token status |

### MercadoLibre Proxy

| Method | Path | Purpose |
|--------|------|---------|
| GET | /ml/users/me | Current ML user |
| GET | /ml/items/:id | Item details |
| GET | /ml/questions | Search questions |
| GET | /ml/questions/:id | Single question |
| POST | /ml/questions/:id/answer | Answer question |
| GET | /ml/orders | Search orders |
| GET | /ml/orders/:id | Single order |

### Webhooks

| Method | Path | Purpose |
|--------|------|---------|
| POST | /webhooks/ml | Receive ML webhooks (verify_token) |
| GET | /webhooks/ml/events | List recent events |

### BMC Dashboard (Sheets API)

| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/cotizaciones | Master_Cotizaciones rows |
| GET | /api/proximas-entregas | Deliveries this week |
| GET | /api/coordinacion-logistica | WhatsApp text for logistics |
| GET | /api/audit | AUDIT_LOG rows |
| GET | /api/pagos-pendientes | Pagos_Pendientes (pending) |
| GET | /api/metas-ventas | Metas_Ventas rows |
| GET | /api/kpi-financiero | KPI + calendar + byPeriod |
| POST | /api/marcar-entregado | Move to Ventas realizadas y entregadas |

### Static

| Method | Path | Purpose |
|--------|------|---------|
| GET | /finanzas | Dashboard UI (static) |

### 404 (paths sin handler)

| Response | Significado |
|----------|-------------|
| `{"ok":false,"error":"Not found","path":"/"}` | La ruta no existe. La raíz `/` no está pensada para uso directo. Ver Quick Reference arriba para endpoints válidos. |

---

## Config Vars

### Required (BMC Dashboard)

| Var | Purpose |
|-----|---------|
| BMC_SHEET_ID | Google Sheet ID |
| GOOGLE_APPLICATION_CREDENTIALS | Path to service-account.json |
| BMC_SHEET_SCHEMA | `Master_Cotizaciones` (default) o `CRM_Operativo` (Bnesser) |

### Required (MercadoLibre)

| Var | Purpose |
|-----|---------|
| ML_CLIENT_ID | OAuth client ID |
| ML_CLIENT_SECRET | OAuth client secret |
| ML_REDIRECT_URI_DEV | Callback URL (ngrok for dev) |

### Optional

| Var | Purpose |
|-----|---------|
| VITE_GOOGLE_CLIENT_ID | Google OAuth for frontend |
| VITE_API_URL | API base URL (default localhost:3001) |
| LOG_LEVEL | Pino level (default: info) |
| WEBHOOK_VERIFY_TOKEN | Webhook auth |
| API_AUTH_TOKEN | API key auth |
| TOKEN_ENCRYPTION_KEY | Encrypt .ml-tokens.enc |
| ML_TOKEN_STORAGE | file | gcs |
| ML_TOKEN_GCS_BUCKET | GCS bucket (Cloud Run) |

---

## Sheets Scopes

| Scope | Use |
|-------|-----|
| https://www.googleapis.com/auth/spreadsheets.readonly | Read-only |
| https://www.googleapis.com/auth/spreadsheets | Read + write |

### Required Sheets (tabs)

- Master_Cotizaciones
- Pagos_Pendientes
- AUDIT_LOG
- Ventas realizadas y entregadas
- Metas_Ventas
