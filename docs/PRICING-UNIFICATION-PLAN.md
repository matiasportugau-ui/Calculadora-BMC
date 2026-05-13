# Pricing Unification Plan — BMC Calculator

**Status:** DESIGN ONLY (no execution yet) · **Created:** 2026-05-12 · **Source:** auditoría 3 Explore agents en sesión 2026-05-12

## Why this plan exists

Hoy (2026-05-12) descubrimos que el sistema de pricing es **dual-source con drift acumulado**:

- 8 pricing anomalies (`web < venta`) — 5 ya fixed, 3 pendientes (este PR los cierra)
- 1 SKU bug confirmado: `ISOWALL.80` usaba SKU `PU50MM` (este PR lo corrige a `PU80MM`)
- **0% coverage ISOPANEL en MATRIZ** (ghost group — 10 variants en constants.js, 0 en MATRIZ Sheet)
- **97% drift en FIJACIONES** (31 items en constants, solo 1 en MATRIZ)
- Tests con totales hardcoded rompen ante cualquier cambio de precio

**Decisión del owner (Matías):** documentar el plan completo ahora, ejecutar en sesión dedicada futura cuando haya bandwidth.

## State of the art (HOY)

### Pricing surface en código
- `src/data/constants.js` — 137 items en 7 grupos (PANELS_TECHO/PARED, FIJACIONES, PERFIL_TECHO/PARED, SELLADORES, HERRAMIENTAS, SERVICIOS). Estructura: `{label, venta, web, costo, unidad, [sku]}`.
- `src/data/pricing.js` — wrapper con cache + apply overrides.
- `src/utils/pricingOverrides.js` — gestiona localStorage `bmc-pricing-overrides`.
- Helper `p(item)` + `LISTA_ACTIVA` singleton (default `"web"`).

### Source declarada: MATRIZ
- Google Sheet, tab BROMYROS. Cols D=SKU, F=costo, L=venta_local, T=web (ex IVA).
- Pull: `GET /api/actualizar-precios-calculadora` (admin) → CSV.
- Push: `POST /api/matriz/push-pricing-overrides` (director) → cols F/L/T, validado, dry-run support.
- Mapping: `src/data/matrizPreciosMapping.js` con 200+ entries (10+ aliases legacy).

### Plataformas externas — estado HOY

| Plataforma | Pull (in) | Push (out) | Source de truth | Gap |
|---|---|---|---|---|
| **MATRIZ** | UI click manual | API limitada a F/L/T | Sí declarada | ISOPANEL 0%, FIJACIONES 3% |
| **Shopify** | Script `quoteVisorShopifyMap.json` (manual) | **NINGUNO** — Admin a mano | No | Sin sync ni webhook handler |
| **Mercado Libre** | Read competitive `price-monitor-etl.mjs` → Supabase | **NINGUNO** — sin push propio | No | ETL solo lectura competitiva |
| **constants.js** | N/A | Manual edit en código | Fallback | Drift acumulado |

## Decisión arquitectónica: Híbrido Postgres + Sheet readonly

**Opción elegida (B+D):** Postgres como canonical source of truth + Sheet auto-generada como vista read-only para visualización.

### Por qué híbrido (no Postgres puro ni MATRIZ puro)
- **Matías mantiene "ver en Sheets"** — workflow visual familiar para revisión rápida.
- **Postgres** garantiza validation (web ≥ venta ≥ costo), audit log, atomic updates, transactions.
- **Edita en UI propia** (no en Sheets) — evita typos, dropdowns rotos, sin transactions.
- **Sheet auto-generada** desde Postgres → vista vital para Matías, sin riesgo de edición humana directa.

### Por qué NO MATRIZ puro como source
- 30% drift sin nadie detectarlo
- Sheets sin transactions, sin validation, sin audit log real
- ISOPANEL y FIJACIONES nunca cabieron — la arquitectura ya falló

## Plan de 5 fases (estimación: 4-6 semanas total)

### Fase 1 — Foundation: Postgres + Audit + Tests (semana 1)

**Entregable:** tabla `products` poblada con todos los 137 items + API + validation.

Archivos:
- `migrations/0002_create_products_pricing.sql`
- `server/lib/productsRepository.js`
- `server/routes/products.js`
- `scripts/seed-products-from-constants.mjs`
- `tests/products-invariants.test.js`

```sql
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  path TEXT UNIQUE NOT NULL,  -- "PANELS_TECHO.ISODEC_PIR.esp.50"
  sku TEXT,
  label TEXT NOT NULL,
  unidad TEXT NOT NULL CHECK (unidad IN ('m²', 'unid', 'metro')),
  costo NUMERIC(10,4),
  venta NUMERIC(10,4),
  web NUMERIC(10,4),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CHECK (venta IS NULL OR costo IS NULL OR venta >= costo),
  CHECK (web IS NULL OR venta IS NULL OR web >= venta * 0.95)
);

CREATE TABLE products_audit_log (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id),
  changed_at TIMESTAMPTZ DEFAULT now(),
  changed_by TEXT,
  field TEXT,
  old_value TEXT,
  new_value TEXT,
  source TEXT  -- "ui", "matriz_sync", "shopify_webhook", etc.
);

CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_path ON products(path);
CREATE INDEX idx_audit_product ON products_audit_log(product_id, changed_at DESC);
```

**Notas críticas:**
- `path` es UNIQUE (no `sku`) — los SKU pueden duplicar legítimamente (mismo perfil físico en distintos catálogos).
- Tolerancia `web >= venta * 0.95` permite descuentos online intencionales hasta 5%.
- Audit log obligatorio en cada UPDATE para trazabilidad.

**Verification Fase 1:**
- `npm run db:migrate` exit 0
- `SELECT COUNT(*) FROM products` = 137
- `npm run test:products` 0 failures
- POST con venta < costo → 422
- POST con web < venta * 0.95 → 422

### Fase 2 — Calculator integration (3-5 días)

**Entregable:** la calculadora lee precios desde Postgres (con fallback a constants.js).

Cambios:
- `src/data/pricing.js`: `getPricing()` fetch desde `/api/products` con cache 5 min
- Fallback a constants.js si API caída (resilience)
- `useEffect` en App.jsx para warmup cache al inicio
- Deprecar `localStorage bmc-pricing-overrides`
- Refactor tests con totales hardcoded a tolerancia ±2% o snapshot tests

**Tests a refactorear:**
- `tests/verifiedQuotePayload.test.js` — totals 8345.41, 7076.0, 5124.0
- `tests/calcLoopbackClient.test.js` — totals 1234, 4242

**Verification Fase 2:**
- Cargar calculadora → pricing igual al actual ±0.01
- Apagar API → calculadora sigue funcionando (fallback)
- `npm run gate:local` 0 fail

### Fase 3 — Outbound sync workers (1-2 semanas)

**Entregable:** workers que escriben de Postgres a MATRIZ, Shopify, ML.

3 workers:

#### `server/jobs/sync-products-to-matriz.mjs`
- Cuando producto cambia, escribir a Sheet (cols F/L/T)
- Reusa lógica de `POST /api/matriz/push-pricing-overrides`
- Idempotente (ignora skipped paths)

#### `server/jobs/sync-products-to-shopify.mjs`
- Shopify Admin GraphQL `productVariantUpdate(price)`
- **Requiere OAuth Shopify Admin** — primera vez ata trabajo de setup
- Mapping: `quoteVisorShopifyMap.json` → Shopify variant_id
- Rate limit: Shopify 2 req/s, esperar entre llamadas

#### `server/jobs/sync-products-to-ml.mjs`
- ML Admin API `PUT /items/{id}` con `price` field
- Reusa `server/mercadoLibreClient.js` (OAuth ya implementado)
- Mapping requerido: SKU → ML item_id (NO existe hoy, hay que construir)
- Rate limit: ML 60 req/min per app

**Trigger:** Pull-based (cron cada 1 hora corre los 3 workers, sync delta desde último `synced_at` por plataforma).

**Verification Fase 3:**
- Cambiar precio en Postgres → sync a MATRIZ en <5 min
- Sync a Shopify rate-limited correctamente
- Sync a ML respeta rate limits
- Audit log refleja cada sync con `source: "platform_sync"`

### Fase 4 — Inbound monitoring (1 semana, opcional)

- Shopify webhook `products/update` → audit log + alert si diverge de Postgres
- ML competitor monitoring sigue como está
- No auto-overwrite — alertar y dejar a humano decidir

### Fase 5 — UI + cutover (3-5 días)

- UI mínima `/hub/admin/precios` con tabla editable
- Permisos: solo Matías + director role
- Feature flag `USE_PG_PRICING` para flip-flop seguro
- **Auto-generate Sheet view** desde Postgres (Sheet readonly para Matías visualizar)
- Cutover: Postgres es canonical, MATRIZ Sheets queda READ-ONLY (auto-generada)

## NO incluir en MVP

- Versionado de precios históricos (point-in-time queries)
- Precios por canal customer-specific (B2B vs B2C)
- Aprobación 2-step para cambios masivos
- Reportes de drift automatizados
- Bulk import desde CSV con preview

## Riesgos identificados

1. **Tests rompen** — totales hardcoded. Refactor obligatorio en Fase 2 a tolerancia.
2. **Migration loss** — primera carga debe ser idempotente y reversible.
3. **Race conditions durante cutover** — si Matías edita Sheets a mano DURANTE Fase 5, divergencia. Mitigación: Sheets read-only en Fase 5.
4. **OAuth Shopify Admin** — primera vez requiere setup. Puede no estar implementado.
5. **ML SKU mapping** — NO existe `MATRIZ_SKU → MLU_ID`. Construirlo es trabajo aparte (puede ser manual al principio).
6. **Per regla 2 vision_meta** (no atar 6+ meses): plan 4-6 semanas, pero cada fase entrega valor independiente.

## Critical files to read before execution

- `src/data/constants.js` — 137 items fuente
- `src/data/pricing.js` — wrapper hoy
- `src/data/matrizPreciosMapping.js` — 200+ SKU→path
- `server/routes/bmcDashboard.js:2110+` (GET matriz) y `:2715+` (POST overrides)
- `server/mercadoLibreClient.js` — OAuth ML ya implementado
- `scripts/price-monitor-etl.mjs` — ETL existente
- `scripts/build-quote-visor-shopify-map.mjs` — script Shopify map
- `docs/PRICING-ENGINE.md` — pricing logic docs

## Trigger para ejecutar este plan

Decidir cuándo arrancar cuando suceda uno o más:
- Matías reporta tiempo significativo perdido sincronizando precios manualmente
- Más de 5 anomalies nuevas se acumulan (drift >5%)
- Se necesita escalar a más de 1 canal de venta nuevo
- Se quiere agregar B2B con precios customer-specific
- Antes de onboarding del 2do miembro del team (no quieren replicar workflow manual)

## Estado actual relacionado (no parte del plan grande)

- ✅ Fix 5 pricing anomalies (PR #213 merged 2026-05-12)
- ✅ Fix 3 pricing anomalies + SKU PU80MM (este PR — fix/pricing-cleanup-2026-05-12)
- ⏸ ISOPANEL EPS sigue 100% drift (no en MATRIZ)
- ⏸ FIJACIONES siguen 97% drift (no en MATRIZ)
- ⏸ 10 SKU duplicates legítimos (no son bug — perfiles físicos compartidos)
