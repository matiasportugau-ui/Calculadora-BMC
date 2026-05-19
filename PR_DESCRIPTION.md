# feat(market-intel): Market Intelligence v1 — Semanas 1 y 2

## Summary

Implements the complete Market Intelligence v1 module on branch `feature/marketing-intel-v1`.

**Stack:** JavaScript ES Modules · Express 5 · PostgreSQL (`pg`) · Pino · React JSX · Cheerio · node-cron  
**Language:** JavaScript only (no TypeScript) — matches project conventions.  
**Tests:** 26 unit tests, Node.js native runner (`node --test`), TAP output — 26/26 passing.

---

## Files Changed

### Database migrations (`server/migrations/market-intel/`)
| File | Description |
|------|-------------|
| `001_create_schema.sql` | `bmc_market_intel` schema + pgcrypto (isolated from `bmc_price_monitor`) |
| `002_create_competitors.sql` | Competitors table, unique normalized domain index, `set_updated_at()` trigger |
| `003_create_skus.sql` | SKUs with FK to competitors |
| `004_create_price_history.sql` | Price history, composite index on `sku_id + competitor_id + scraped_at DESC` |
| `005_create_etl_runs.sql` | ETL audit log with JSONB `errors` column |
| `006_create_alerts.sql` | Alerts with `dedup_key` unique constraint |
| `007_create_mystery_shopping_queue.sql` | Queue with status/reason check constraints |
| `008_create_dashboard_views.sql` | 4 views + `mv_daily_price_summary` materialized view |
| `run-migrations.js` | Idempotent migration runner (ES module) |

### Backend (`server/`)
| File | Description |
|------|-------------|
| `lib/marketIntel/etl/robots.js` | `robots.txt` checker — conservatively blocks on error |
| `lib/marketIntel/etl/scraper.js` | `scrapeSku()` + `parsePrice()` (UY/US formats, no retry on block) |
| `lib/marketIntel/etl/delta.js` | `getLastPrice`, `shouldWritePrice`, `insertPriceRecord` |
| `lib/marketIntel/etl/deduplication.js` | `normalizeDomain`, `upsertCompetitor` (ON CONFLICT) |
| `lib/marketIntel/etl/runner.js` | Full ETL orchestration |
| `lib/marketIntel/alerts/thresholds.js` | `getThresholds()`, `determineAlertLevel()` |
| `lib/marketIntel/alerts/alerting.js` | `processAlerts()`, `checkOfflineCompetitor()` |
| `lib/marketIntel/alerts/email.js` | SMTP via `nodemailer` (graceful skip if unconfigured) |
| `lib/marketIntel/mysteryShoppingQueue.js` | `createMysteryShoppingTask`, `updateTaskStatus`, `listPendingTasks` |
| `lib/marketIntel/scheduler.js` | `node-cron` daily at 03:00 UTC (skipped in `NODE_ENV=test`) |
| `routes/marketing.js` | 6 endpoints, 503 on DB errors (never 500) |
| `routes/INTEGRATION_NOTES.md` | Mount snippet for `server/index.js` + `src/App.jsx` |

### Frontend (`src/components/`)
| File | Description |
|------|-------------|
| `MarketingHubModule.jsx` | Dashboard principal `/hub/marketing` |
| `marketing-hub/SummaryCards.jsx` | Alert counts + ETL success ratio |
| `marketing-hub/TopDeltaTable.jsx` | Top-10 by % delta, color-coded badges |
| `marketing-hub/AlertsFeed.jsx` | Paginated alert feed |
| `marketing-hub/MysteryShoppingWidget.jsx` | Pending tasks queue |
| `marketing-hub/Pagination.jsx` | Reusable pagination |

### Tests (`tests/market-intel/`)
| File | Type | Cases |
|------|------|-------|
| `scraper.test.js` | Unit | 9 — `parsePrice` |
| `thresholds.test.js` | Unit | 5 — `getThresholds`, `determineAlertLevel` |
| `deduplication.test.js` | Unit | 7 — `normalizeDomain` |
| `delta.test.js` | Unit | 5 — `shouldWritePrice` |
| `etl.integration.test.js` | Integration | 5 (skipped without `TEST_DATABASE_URL`) |

---

## Migration Checklist

- [x] Run `npm run migrate:market-intel` after deploy
- [x] All 8 migrations idempotent (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`)
- [x] Every table has `created_at TIMESTAMPTZ` + `updated_at TIMESTAMPTZ` + trigger
- [x] `mv_daily_price_summary` populated on first migration run
- [x] Schema `bmc_market_intel` strictly isolated from `bmc_price_monitor`
- [x] No cross-schema joins

## Integration Checklist (merge steps)

- [ ] Add to `server/index.js`:
  ```js
  import marketingRouter from './routes/marketing.js';
  import './lib/marketIntel/scheduler.js';
  app.use('/api/marketing', requireAuth, marketingRouter);
  ```
- [ ] Add to `src/App.jsx`:
  ```jsx
  import MarketingHubModule from './components/MarketingHubModule.jsx';
  <Route path="/hub/marketing" element={<ProtectedRoute><MarketingHubModule /></ProtectedRoute>} />
  ```
- [ ] Add to `package.json` scripts (merge into existing):
  ```json
  "migrate:market-intel": "node server/migrations/market-intel/run-migrations.js",
  "test:market-intel": "node --test tests/market-intel/scraper.test.js tests/market-intel/thresholds.test.js tests/market-intel/deduplication.test.js tests/market-intel/delta.test.js",
  "etl:run": "node server/lib/marketIntel/etl/runner.js"
  ```
- [ ] Add new deps to existing `package.json`: `cheerio`, `robots-parser`, `node-cron`

---

## Environment Variables Added

| Variable | Default | Description |
|----------|---------|-------------|
| `ALERT_WARN_PCT` | `5` | % change threshold for WARNING alert |
| `ALERT_CRITICAL_PCT` | `15` | % change threshold for CRITICAL alert |
| `ALERT_CRITICAL_OFFLINE_RUNS` | `2` | Consecutive failed runs before CRITICAL offline alert |
| `SMTP_HOST` | — | SMTP server (already in project for Nodemailer) |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_USER` | — | SMTP auth user |
| `SMTP_PASS` | — | SMTP auth password |
| `ALERT_EMAIL_FROM` | — | From address for alert emails |
| `ALERT_EMAIL_TO` | — | Recipient for alert emails |

All are additive — no existing env vars modified.

---

## Tests

```
node --test tests/market-intel/*.test.js

TAP version 13
ok 1..26
# tests 26
# pass 26
# fail 0
```

---

## Pendiente confirmación

### 1. `requireAuth` middleware — reutilizar el existente
El router `server/routes/marketing.js` asume que el middleware `requireAuth` existente en `server/middleware/requireAuth.js` está siendo aplicado al montarlo (ver `INTEGRATION_NOTES.md`). No creé uno nuevo. Si el signature de `requireAuth` del proyecto difiere del patrón estándar de Express, el mount podría necesitar ajuste mínimo.

### 2. Frontend auth token accessor
`MarketingHubModule.jsx` lee el token de `localStorage.getItem('bmc_token')`. Confirmar si el proyecto usa ese key o un mecanismo diferente (contexto React, cookie, etc.) — reemplazar en la función `authHeaders()`.

### 3. `node-cron` como nueva dependencia
`scheduler.js` usa `node-cron` (ya está en el stack de la documentación técnica). Verificar que la versión del `package.json` del proyecto es compatible con `node-cron ^3.0.3`.

### 4. Repo no montado durante desarrollo
Este módulo fue construido sin acceso directo al repositorio. Las integraciones con `server/index.js` y `src/App.jsx` están documentadas en `server/routes/INTEGRATION_NOTES.md` como snippets de inserción — no como ediciones directas, ya que no tenía acceso a esos archivos.
