# Supabase — Calculadora-BMC

Proyecto: **Calculadora-BMC** (`htnwozvopveibwppyjhg`) en organización `kotuexhacjrsqigswsvd`, región `us-east-1`.

Este directorio contiene migraciones SQL versionadas para el proyecto Supabase asociado a la Calculadora BMC.

## Schemas en uso

| Schema | Para qué |
|---|---|
| `bmc_price_monitor` | Monitor de precios BMC (Shopify ↔ MercadoLibre Uruguay). Snapshots, alertas, ETL observability. |

## Aplicar migraciones

### Opción A — Supabase CLI (recomendada)

```bash
# Una sola vez por máquina
brew install supabase/tap/supabase
supabase login

# Linkear este repo al proyecto
supabase link --project-ref htnwozvopveibwppyjhg

# Aplicar migraciones pendientes a la DB remota
supabase db push
```

### Opción B — Dashboard SQL Editor

Pegar el contenido de `migrations/<archivo>.sql` en
`https://supabase.com/dashboard/project/htnwozvopveibwppyjhg/sql/new` y ejecutar.

> Las migraciones son idempotentes (`if not exists`, `drop policy if exists ... create`),
> así que se pueden re-correr sin riesgo.

## Variables de entorno

Agregar a `.env` (ver `.env.example`):

```bash
SUPABASE_URL=https://htnwozvopveibwppyjhg.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key del dashboard>
# Para builds Vite (frontend) — si el artefacto en Cowork usara JWT del usuario:
VITE_SUPABASE_URL=https://htnwozvopveibwppyjhg.supabase.co
VITE_SUPABASE_ANON_KEY=<anon_key del dashboard>
```

Las claves se obtienen en `Settings → API` del dashboard de Supabase.

## Tabla por tabla — `bmc_price_monitor`

| Tabla | Para qué |
|---|---|
| `shopify_products` | Snapshot del catálogo Shopify BMC (USD). |
| `shopify_variants` | Variantes (espesor, color) por producto. |
| `ml_listings` | Tus publicaciones activas en MercadoLibre Uruguay (UYU). |
| `search_keywords` | Keyword editable por producto que usa el ETL para buscar competencia. |
| `ml_competitors` | Resultados de competencia en MLU por producto (top 10–20). |
| `fx_settings` | Tipo de cambio USD→UYU (singleton, source=BCU\|manual). |
| `price_alerts` | Diferencias detectadas (over_market \| under_market \| no_competitors). |
| `etl_runs` | Observabilidad de cada corrida del ETL (status, duraciones, errores). |

## Política de Row Level Security

* `service_role` → acceso total (usado por ETL desde Cloud Run con `SUPABASE_SERVICE_ROLE_KEY`).
* `authenticated` → read en todas las tablas + update solo en `search_keywords`.
* `anon` → sin acceso (no exponemos data sin JWT).

Si el artefacto en Cowork va a leer Supabase, usar JWT autenticado (no anon).
