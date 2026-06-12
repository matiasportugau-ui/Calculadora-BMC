# Panelin BMC Platform v1

Sistema centralizado de productos, precios, stock e integración con FacturaExpress (CFE) para BMC.

Construido fase por fase según el plan original.

## Stack
- **Postgres** (fuente de verdad): productos, precios, stock, movimientos, facturas, DLQ de webhooks, alertas.
- **Express** (API en `:3001`): endpoints `/api/panelin/*` + webhooks.
- **Google Sheets MATRIZ** (sync de costos/precios vía columnas G/J/K/R/S).
- **FacturaExpress** (login, sync bidireccional stock/precios, webhooks entrantes).
- **Dashboard** (HTML + Tailwind "Industrial Editorial Dark" estático).
- **Realtime** (WebSockets en `/realtime` + fallback polling).

## Requisitos
- Node 24+
- Docker / Postgres accesible vía `DATABASE_URL`
- Doppler (recomendado) o `.env` con secretos
- Credenciales Google (para MATRIZ)
- (Opcional) Credenciales FacturaExpress

## Puesta en marcha local (paso a paso)

```bash
# 1. Dependencias
npm install

# 2. Variables (usa Doppler o copia .env.example)
doppler run -- npm run env:ensure   # o edita .env manualmente

# 3. Migraciones de la plataforma (tablas + funciones + triggers de stock)
doppler run -- npm run panelin:migrate

# 4. (Recomendado) Cargar datos reales desde la MATRIZ
doppler run -- npm run panelin:sync-precios -- --tab BROMYROS --limit 50

# 5. Levantar el backend (API + WebSockets)
doppler run -- npm run start:api
# o en paralelo con el frontend Vite del proyecto: npm run dev:full
```

El servidor expone:

- `GET/POST/PATCH /api/panelin/products`
- `GET/POST /api/panelin/stock*`
- `GET/POST /api/panelin/invoices`
- `POST /api/panelin/sync/facturaexpress/*`
- `POST /webhooks/facturaexpress` (raw body + firma)
- `WS /realtime` (Fase 6)

## Dashboard

Abre directamente:

```bash
open panelin-platform/dashboard.html
# o
python3 -m http.server 8080 --directory panelin-platform
# luego visita http://localhost:8080/dashboard.html
```

Características del dashboard:
- Edición inline de costo → PATCH automático + recálculo de precios.
- Vista de stock + alertas con ACK.
- Facturas (lista + crear manual).
- Botones de sync con FacturaExpress.
- Conexión WebSocket live (actualiza tablas en tiempo real cuando llegan webhooks o mutaciones).
- Cambia la base de la API desde la UI si corres en otro puerto/host.

## Flujo en tiempo real (Fase 6)

1. Un webhook de FacturaExpress llega → `processFacturaExpressWebhook`:
   - Inserta/actualiza en `invoices`
   - Llama `panelin_record_stock_movement` (control de stock negativo + alertas automáticas)
   - `broadcast({type: 'stock-update' | 'invoice-added'})`

2. PATCH de costo desde dashboard o API → recálculo + `broadcast('price-update')`

3. El dashboard (HTML) recibe el mensaje WS y refresca las secciones afectadas.

## Comandos útiles

```bash
# Ver estado
doppler run -- npm run panelin:sync-precios:dry

# Probar endpoints (con API corriendo)
curl http://localhost:3001/api/panelin/status
curl http://localhost:3001/api/panelin/products | jq '.products[0]'

# Webhook simulado (para pruebas)
curl -X POST http://localhost:3001/webhooks/facturaexpress \
  -H "Content-Type: application/json" \
  -d '{"event":"invoice.created","data":{"external_id":"TEST-001","items":[{"sku":"TU-SKU","qty":-1}]}}'
```

## Estructura relevante

```
panelin-platform/
  migrations/          # 000, 001, 002 (tablas + funciones + seed price_lists)
  dashboard.html       # Frontend completo (Fase 5 + 6)
  README.md            # este archivo

server/
  lib/
    panelinDb.js
    realtime.js        # WS server + broadcast (Fase 6)
    facturaExpressClient.js
  routes/
    panelin.js         # toda la API /api/panelin/*
    webhooks.js        # /webhooks/facturaexpress + DLQ + triggers de stock

scripts/
  run-panelin-migrations.mjs
  panelin-sync-precios.mjs
  verify-panelin-fase*.mjs
```

## Notas / Limitaciones conocidas

- El sync de MATRIZ es un script (no endpoint HTTP por diseño).
- FacturaExpress usa credenciales reales (ver `FACTURAEXPRESS_*` en `.env.example` y Doppler).
- WebSockets usan path `/realtime`. Si usas proxy/reverse, asegúrate de pasar el upgrade.
- El dashboard es estático (sin build) para simplicidad de la Fase 5.

## Próximos pasos (Fase 7+)

- Workers de reintento de DLQ (`webhook_failures`).
- Más campos de FacturaExpress (ítems de factura → movimientos detallados).
- Autenticación en los endpoints de panelin (Bearer).
- Versión empaquetada (Vite o similar) del dashboard.

Sistema 100% funcional end-to-end con Postgres real, MATRIZ, FacturaExpress (stubs + webhooks) y UI en tiempo real.

¡Listo para usar!
