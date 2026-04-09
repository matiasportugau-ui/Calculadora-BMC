# Matriz de dependencias — Variables de entorno

**Propósito:** Módulo X requiere env var Y. Ayuda a detectar configs faltantes antes de deploy.

**Fuente:** server/config.js, .env.example.

---

## Por módulo

| Módulo | Env vars requeridas | Opcionales |
|--------|---------------------|------------|
| **Sheets / bmcDashboard** | BMC_SHEET_ID, GOOGLE_APPLICATION_CREDENTIALS | BMC_PAGOS_SHEET_ID, BMC_CALENDARIO_SHEET_ID, BMC_VENTAS_SHEET_ID, BMC_STOCK_SHEET_ID |
| **MercadoLibre** | ML_CLIENT_ID, ML_CLIENT_SECRET | ML_REDIRECT_URI_DEV, ML_REDIRECT_URI_PROD, PUBLIC_BASE_URL, TOKEN_ENCRYPTION_KEY, ML_TOKEN_FILE |
| **Shopify** | SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET | SHOPIFY_WEBHOOK_SECRET, SHOPIFY_QUESTIONS_SHEET_TAB, SHOPIFY_SCOPES |
| **Cloud Run** | PORT (default 3001), PUBLIC_BASE_URL (prod) | K_SERVICE (auto) |
| **Repo Sync** | BMC_DASHBOARD_2_REPO, BMC_DEVELOPMENT_TEAM_REPO | — |

---

## Por funcionalidad

| Funcionalidad | Vars necesarias |
|---------------|-----------------|
| Dashboard básico | BMC_SHEET_ID, GOOGLE_APPLICATION_CREDENTIALS |
| Pagos Pendientes | + BMC_PAGOS_SHEET_ID |
| Calendario vencimientos | + BMC_CALENDARIO_SHEET_ID |
| Ventas 2.0 | + BMC_VENTAS_SHEET_ID |
| Stock E-Commerce | + BMC_STOCK_SHEET_ID |
| OAuth MercadoLibre | ML_CLIENT_ID, ML_CLIENT_SECRET, TOKEN_ENCRYPTION_KEY |
| OAuth Shopify | SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET |
| Webhooks Shopify | + SHOPIFY_WEBHOOK_SECRET |

---

## Verificación

Ejecutar antes de deploy:

```bash
# Verificar que .env tiene las vars de .env.example
for var in $(grep -E '^[A-Z_]+=' .env.example | cut -d= -f1); do
  grep -q "^$var=" .env 2>/dev/null || echo "Falta: $var"
done
```

---

## Referencias

- .env.example
- server/config.js
