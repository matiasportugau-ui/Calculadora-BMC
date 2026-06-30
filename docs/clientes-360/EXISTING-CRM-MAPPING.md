# Existing CRM — Inventory & Mapping for Clientes 360

**Fecha:** 2026-05-08
**Branch:** `claude/add-clientes-360-Pvfuc`
**Propósito:** Inventario de **lo que ya existe** en Calculadora-BMC sobre clientes, cotizaciones, follow-ups, sync y auth, para que Phase 1 del Panel de Clientes 360 **no duplique** sistemas existentes y reuse lo que esté en producción.

> Phase 1 del v2 brief incluyó como tarea explícita: _"Auditoría e inventario de lo existente. Output: docs/clientes-360/EXISTING-CRM-MAPPING.md"_. Este es ese documento.

---

## 1. Resumen Ejecutivo

El repo tiene **mucho más CRM ya construido** de lo que asumía v1 del brief. La estrategia correcta es:

1. **Reusar `identity.quotes`** como fuente de cotizaciones (no crear duplicado en `clientes.customer_quotes` con datos completos — solo links + estado comercial).
2. **Reusar `wa-package` schema** como fuente de eventos WhatsApp.
3. **Reusar `requireServiceOrUser`** middleware con módulo nuevo `clientes` (siguiendo el patrón de `wa`, `ml`, `crm-personal`).
4. **Reusar `crmSearch.normalizePhone`** y agregar `normalizeRut`/`normalizeEmail` al mismo lib.
5. **Reusar `clientQuotesSheetSync`** como referencia de patrón sync→Sheets, no reinventar.
6. **Migrar `followUpStore` JSON → `clientes.customer_followups`** (ver §9.5 del v2 brief).
7. **Reusar `quoteRegistry` (GCS)** como fuente para timeline de cotizaciones públicas (anónimas).

---

## 2. Tabla de Inventario

| Componente | Path | Almacén | Rol en Clientes 360 | Acción Phase 1 |
|---|---|---|---|---|
| `followups` route | `server/routes/followups.js` | JSON file | Legacy followups CLI/API | **Migrar** datos a `clientes.customer_followups`; mantener legacy con `Deprecation` header |
| `followUpStore` | `server/lib/followUpStore.js` | `.followup/store.json` | Almacén legacy | Script de migración one-shot a Postgres |
| `crmSearch` | `server/lib/crmSearch.js` | Google Sheets `CRM_Operativo` (B4:AH500) | Búsqueda de clientes en CRM externo | **Reusar** `normalizePhone`. Wrap en `agent-resolver` para usar como source secundario. |
| `crmTaxonomy` | `server/lib/crmTaxonomy.js` | (logic only) | Categorización de eventos CRM | **Reusar** para `event_type` mapping |
| `identity.quotes` | Postgres schema `identity` | Postgres | Cotizaciones autenticadas | **Reusar como source of truth**; `clientes.customer_quotes` solo link + status |
| `quoteStore` | `server/lib/quoteStore.js` | Postgres `identity.quotes` | Persistence layer | **Reusar APIs** (`listMyQuotes`, `getMyQuote`, `claimAnonymousQuotes`) |
| `quoteRegistry` | `server/lib/quoteRegistry.js` | GCS bucket + memoria | Cotizaciones anónimas (Panelin agent) | **Reusar** como fallback para clientes sin login |
| `clientQuotesSheetSync` | `server/lib/clientQuotesSheetSync.js` | identity.quotes → Sheets «Base de datos cotis de clientes» | Sync push hacia Sheets | **Patrón a reusar** — no reinventar |
| `ml-crm-sync` | `server/ml-crm-sync.js` | ML API → Sheets `CRM_Operativo` | Sync push ML→Sheets | Phase 2: invertir, agregar pull ML→`clientes.customer_events` |
| `wa-package` | `wa-package/migrations/*.sql` (17 tablas) | Postgres schema `wa` | WhatsApp completo (mensajes, conversations, followups, rules, SLA) | **Reusar como fuente directa** de eventos WA |
| `waEnricherWorker` | `server/lib/waEnricherWorker.js` | enriquece `wa.messages` | Backfill de metadata WA | Phase 1: leer su output |
| `mercadoLibreClient` | `server/mercadoLibreClient.js` | OAuth + tokenStore | Cliente HTTP ML | Phase 2: usar para pull pedidos |
| `tokenStore` | `server/tokenStore.js` | Disk con AES-256-GCM | Tokens OAuth ML / Drive | Sin cambios |
| `shopify` route | `server/routes/shopify.js` | Postgres + GCS | OAuth + webhooks Shopify | Phase 2: agregar handler para `orders/create` → `clientes.customer_purchases` |
| `bmc-dashboard-modernization` | `docs/bmc-dashboard-modernization/sheets-api-server.js` | Sheets reader | Dashboard financiero | Sin cambios; Phase 3 puede compartir cards |
| `accessible-base-sync` | `scripts/accessible-base-sync.js` | Sheets ↔ KB | Knowledge sync | Sin cambios; ortogonal |
| `requireServiceOrUser` | `server/middleware/requireServiceOrUser.js` | (middleware) | Auth dual: service token OR JWT | **Reusar**; agregar módulo `clientes` |
| `identityAuth` | `server/lib/identityAuth.js` | Postgres `identity` | Google OAuth + JWT + refresh + RBAC | **Reusar `requireUser({module:'clientes', minLevel:'read'})`** |
| `BmcAuthProvider` | `src/contexts/BmcAuthProvider.jsx` | React Context | Auth provider FE | **Reusar**; agregar selector de módulo `clientes` |

---

## 3. Mapeo de Tablas Existentes a Modelo Clientes 360

### 3.1 `identity.quotes` (existente) → `clientes.customer_quotes` (nueva)

`identity.quotes` columnas conocidas (de `quoteStore.js` + `clientQuotesSheetSync.js` columns):
```
quote_id, user_id, user_email, user_name, created_at, status,
total_usd, total_uyu, pdf_url, drive_file_id, wizard_payload_json,
sheet_synced_at, sync_batch_id
```

**Decisión:** `clientes.customer_quotes` NO duplica todos esos campos. Solo:
```sql
clientes.customer_quotes (
  customer_id uuid,           -- link a clientes.customers
  quote_id text,              -- FK lógica a identity.quotes.quote_id
  scenario text,              -- derivado de wizard_payload_json
  total_amount numeric,       -- alias de total_usd
  currency text,
  status text,                -- pending|won|lost|expired (status comercial)
  created_at, closed_at
)
```
Los campos detallados (`pdf_url`, `wizard_payload_json`, etc.) se leen vía join a `identity.quotes`.

**Sync trigger Phase 1:**
- Cuando `identity.quotes` se inserta/actualiza, un trigger SQL o un agente lee `user_email` → resuelve `customer_id` vía `clientes.customer_identities (channel='identity', external_id=user_id)` → upsert en `clientes.customer_quotes`.

### 3.2 `wa-package` schema → `clientes.customer_events`

Tablas WA relevantes (de los 17 migrations):
```
wa.conversations    → un evento por nueva conversación
wa.messages         → un evento por mensaje
wa.followups        → ya tienen su propio sistema; mapear a clientes.customer_followups
wa.suggestions      → no se mapea (interno del agente)
wa.quotes           → mapear a clientes.customer_quotes con channel='wa'
wa.audit_log        → no se mapea (auditoría interna)
wa.sla_breaches     → mapear a clientes.customer_events con event_type='sla_breach'
```

**Sync trigger Phase 1:** `agent-sync-postgres-existing` lee de `wa.messages` con `WHERE created_at > last_synced_at` y emite a `clientes.customer_events (channel='wa', source_ref=wa.messages.message_id)`.

### 3.3 `followUpStore` JSON → `clientes.customer_followups`

JSON store actual:
```json
{
  "version": 1,
  "items": [
    {
      "id": "uuid",
      "title": "...",
      "detail": "...",
      "tags": [...],
      "nextFollowUpAt": "ISO8601",
      "status": "open|done",
      "notes": [...]
    }
  ]
}
```

Mapeo a Postgres:
```
items[].id          → customer_followups.id
items[].title       → customer_followups.reason
items[].nextFollowUpAt → customer_followups.due_date
items[].status      → customer_followups.status (open→pending, done→done)
items[].notes       → opcional: array a tabla customer_followup_notes (Phase 2)
items[].tags        → customer_followups.tags text[] (campo nuevo no en v2 brief, agregar)
items[].detail      → customer_followups.detail text (campo nuevo no en v2 brief, agregar)
```

**Match a customer_id:** del `title` o `tags` parsear phone/email/RUT y resolver vía `agent-resolver`. Si no hay match, dejar `customer_id = NULL` con `reason='unmatched_legacy'`.

### 3.4 `crmSearch` (Sheets reader) → resolver helper

`crmSearch.normalizePhone(s) = s.replace(/\D/g, "")` — reusar tal cual.

Phase 1 agrega a `server/lib/crmSearch.js` (o crea sibling `customerResolverNormalize.js`):
```js
export function normalizePhoneE164UY(s) { /* prepend 598 if 8-9 digits */ }
export function normalizeEmail(s) { return String(s||"").toLowerCase().trim(); }
export function normalizeRut(s) { return String(s||"").replace(/\D/g, ""); }
```

---

## 4. Mapeo de Auth/Roles

### 4.1 Sistema actual

`identityAuth.js` define:
- **Roles:** `superadmin > admin > operator > comprador`
- **Niveles por módulo:** `admin > write > read > none`
- **Módulos existentes:** `calc`, `wa`, `ml`, `admin`, `plan-import`, `agent-admin`, `canales`, `crm-personal`
- Middleware: `requireUser({ module, minLevel })` o `requireServiceOrUser({ module, minLevel })`

### 4.2 Mapeo del v2 brief

| v2 brief grant | identity.role_grants record |
|---|---|
| `clientes.admin` | `(user_id, module='clientes', level='admin')` |
| `clientes.operator` | `(user_id, module='clientes', level='write')` |
| `clientes.field` | `(user_id, module='clientes', level='read')` |

**Decisión:** En lugar de inventar 3 niveles nominales (`admin/operator/field`), reusar los 4 niveles existentes (`admin/write/read/none`):
- `admin` = todo (Matias)
- `write` = crear/editar followups, agregar notas, marcar pagos (Sandra)
- `read` = solo lectura + acciones de campo (Ramiro)

Los routers de `clientes` usan `requireUser({ module: 'clientes', minLevel: 'admin'|'write'|'read' })`. Frontend lee `useBmcAuth().user.modules.clientes` y renderiza variantes.

### 4.3 Seed inicial Phase 1

```sql
-- Asume identity.users ya tiene a los 3 usuarios.
INSERT INTO identity.role_grants (user_id, module, level)
SELECT user_id, 'clientes', 'admin' FROM identity.users WHERE email = 'matias@bmc...';
-- repetir para sandra (write), ramiro (read).
```

(Emails reales se confirman fuera de este doc.)

---

## 5. Patrón de Sync — Reusar `clientQuotesSheetSync` como Plantilla

`clientQuotesSheetSync.js` ya implementa:
- Debounce 60s
- Idempotency key (column A en Sheets, `quote_id` en Postgres)
- Reconcile loop (`sheet_synced_at IS NULL`)
- Single-quote retry
- Toggle por env var (`SHEETS_CLIENT_QUOTES_ENABLED`)

Los 11 agentes de Clientes 360 (sec 8.1 del v2 brief) deben seguir este patrón:
1. Cron / event trigger → `enqueue(jobPayload)`
2. Debounced flush
3. Idempotency vía `customer_events.UNIQUE(channel, source_ref)` o `agent_jobs.id`
4. Reconcile loop al iniciar el agente
5. Toggle por env var (`AGENT_<NAME>_ENABLED`)

---

## 6. Lista de Reuso vs Reescritura — Resumen

### Reusar tal cual (Phase 1):
- `requireServiceOrUser` middleware (agregar módulo `clientes`)
- `requireUser` desde `identityAuth.js`
- `getRole`, `getModuleGrants`
- `BmcAuthProvider` + `useBmcAuth`
- `quoteStore.listMyQuotes`, `getMyQuote`, `claimAnonymousQuotes`
- `quoteRegistry` (cotizaciones anónimas vía Panelin)
- `crmSearch.normalizePhone`
- `wa-package` schema (lectura directa)
- `getWaPool` (pool Postgres compartido)

### Reusar como referencia de patrón (no copiar):
- `clientQuotesSheetSync` (patrón debounce + reconcile)
- `ml-crm-sync` (patrón ETL ML → tabla)
- `shopify.js` (patrón webhook HMAC)

### Reescribir/migrar (Phase 1):
- `followups.js` route → `clientes/followups.js`
- `followUpStore.js` JSON → `clientes.customer_followups` Postgres

### Reescribir (Phase 2+):
- ML webhook handler (agregar HMAC + mapear a `customer_events`)

### Crear nuevo (Phase 1):
- `server/middleware/requireGrant.js` (helper)
- `server/lib/clientes/customerResolver.js` (algoritmo §4.4 v2 brief)
- `server/lib/clientes/scoringSql.js` (factores v1)
- `server/routes/clientes/*.js` (routers)
- `src/modules/clientes/*` (frontend completo)
- `supabase/migrations/20260508000001_clientes_360_init.sql`
- 11 agentes (Cloud Run Jobs siblings, no en `panelin-calc` server)

---

## 7. Checklist de Antes-de-Phase-1

- [x] Auditoría escrita (este doc)
- [ ] Migration SQL diseñada (siguiente PR)
- [ ] `requireGrant.js` middleware (siguiente PR)
- [ ] Confirmación de emails reales para seed de grants (Matias, Sandra, Ramiro) — pending humano
- [ ] Confirmación de `BMC_SHEET_ID` para CRM_Operativo lectura — ya en config

---

## Apéndice A — Archivos críticos referenciados

```
server/lib/identityAuth.js              auth + RBAC core
server/middleware/requireServiceOrUser.js  middleware patrón
server/lib/quoteStore.js                identity.quotes APIs
server/lib/quoteRegistry.js             GCS quotes (anónimas)
server/lib/clientQuotesSheetSync.js     patrón sync push
server/lib/crmSearch.js                 Sheets reader + normalize
server/lib/crmTaxonomy.js               event_type taxonomy
server/lib/followUpStore.js             legacy JSON store
server/lib/waDb.js                      wa schema pool
server/ml-crm-sync.js                   ML→Sheets sync
server/mercadoLibreClient.js            ML OAuth client
server/routes/followups.js              legacy /api/followups
server/routes/wa.js                     WA route + webhook
server/routes/shopify.js                Shopify HMAC + webhooks
server/tokenStore.js                    OAuth tokens (AES-GCM)
src/contexts/BmcAuthProvider.jsx        FE auth context
src/hooks/useBmcAuth.js                 FE auth hook
supabase/migrations/                    5 migrations existentes
wa-package/migrations/                  17 migrations WhatsApp
```
