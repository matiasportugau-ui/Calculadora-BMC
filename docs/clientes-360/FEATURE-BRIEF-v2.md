# Feature Brief — Panel de Clientes 360 (v2)

**Autor original:** Matias Portugau
**Fecha v1:** 2026-05-07
**Fecha v2:** 2026-05-08
**Estado:** Draft v2 — corregido contra repo real, listo para revisión
**Repo target:** `matiasportugau-ui/Calculadora-BMC`
**Branch:** `claude/add-clientes-360-Pvfuc`
**Audiencia:** autor + agentes que vayan a implementar

> **v2 corrige v1.** Esta versión incorpora la auditoría del repo (`auth ya existe`, `Postgres pelado, no Supabase SDK`, `wa-package + ml-crm-sync ya construidos`, `Shopify HMAC ya implementado`, `tokenStore.js es file-based AES-GCM`, `followups.js ya en producción`) y cierra las dudas abiertas / contradicciones internas detectadas en el interrogatorio de 10 preguntas. Lo que cambia respecto a v1 está marcado como **[v2]**. El v1 queda como referencia histórica.

---

## 0. Cambios de v1 a v2 (resumen ejecutivo)

| Tema | v1 decía | v2 corrige |
|---|---|---|
| Stack DB | "Supabase" como producto | Postgres 15 vía `pg`, migrations en `supabase/migrations/` por convención de naming. NO `@supabase/*` SDK. |
| Auth | "Implementar JWT con claim role" | Ya existe: Google OAuth + JWT bearer + refresh cookie + MFA TOTP + `identity.role_grants` por módulo. Agregar grants de módulo `clientes`, no rol nominal. |
| Roles `matias\|sandra\|ramiro` | Asume claim plano | No existen. Mapear vía `identity.role_grants(user_id, module, role)` con `module='clientes'`, `role IN ('admin','operator','field')`. |
| Shopify | "API disponible, no integrado" | Integrado: PKCE + HMAC OAuth + webhook HMAC. Falta el sync de pedidos a `customer_purchases`. |
| WhatsApp | "Implementar agent-sync-whatsapp en Phase 2" | Ya existe stack `wa-package/migrations` (17 tablas) + `waEnricherWorker`. Phase 1 lee de ahí, no se reescribe. |
| Followups | "Crear `customer_followups`" | Ya existe `server/routes/followups.js` con `followUpStore.js` (JSON local). Migrar a Postgres en Phase 1, **no paralelizar dos sistemas**. |
| CRM existente | Greenfield | Ya existe `ml-crm-sync.js`, `crmSearch.js`, `crmTaxonomy.js`, `quoteRegistry.js`, `bmc-dashboard-modernization/`. Phase 1 incluye **inventario + mapeo**. |
| Orquestación | "LangGraph **+** Cloud Run Jobs **+** Cloud Tasks" (3 cosas) | Cloud Run Jobs + Cloud Scheduler + tabla `agent_jobs` en Postgres como cola. Sin LangGraph (stack es Node ESM, LangGraph es Python-first). |
| `customer_events.source_ref UNIQUE` | UNIQUE simple | UNIQUE compuesto `(channel, source_ref)` — el mismo ID puede repetirse entre canales. |
| `agent-resolver` | Mencionado, sin algoritmo | Algoritmo definido (sec 4.4) + tabla `customer_aliases` para overrides manuales. |
| Frontend fetching | "duda abierta" | `@tanstack/react-query` v5 (justificado en sec 6.2). |
| Scoring | "Hourly, todos los clientes" | **Daily incremental** (solo clientes con eventos en últimas 24h) en SQL puro con window functions. Hourly solo para top-100 VIP. |
| OAuth state in-memory | Listado como bloqueante | El **`state` parameter (CSRF)** sí está in-memory en `mercadoLibreClient.js`. Los **tokens** sí están en disk con AES-256-GCM (`tokenStore.js`). Son cosas distintas. |
| NBA | "Llamada inline, sin spec" | Sonnet 4.6 con prompt caching + cache key `(customerId, scoreSnapshot.computed_at)` por 1h + Haiku 4.5 fallback en rate limit. |
| Costo | No estimado | $80-150/mes (sec 9.4). |
| Phase 1 scoring | "v1 con 5 factores" sin decir cuáles | Volumen + Recencia + Frecuencia + Conversión + Antigüedad. |

---

## 1. Resumen Ejecutivo

**Qué:** Sección **"Panel de Clientes"** dentro de Calculadora-BMC que centraliza el journey del cliente — interacciones, cotizaciones, compras, follow-ups y scoring — en una vista unificada.

**Por qué ahora:** Seguimiento fragmentado entre Sheets, WhatsApp, ML, Shopify y memoria del operador. Se pierden oportunidades por falta de priorización y no hay forma de saber **a quién contactar hoy**.

**Impacto esperado:**
- Reducir cotizaciones perdidas por falta de follow-up.
- Priorización diaria automática (3 perfiles operativos: admin / operator / field).
- Base para automatizaciones de marketing.

**Implementación:** Trabajo paralelo en branches por agente (sec 8.3), pero **sin agentes Python externos** ni LangGraph. Todo Node ESM dentro del servicio `panelin-calc` + Cloud Run Jobs siblings.

---

## 2. Contexto & Problema

### 2.1 Estado actual `[v2: corregido contra repo]`

| # | Fuente | Estado | Datos | Sync activo en repo |
|---|---|---|---|---|
| 1 | Google Sheets `CRM_Operativo` | Master operacional | Sí | `bmc-dashboard-modernization/sheets-api-server.js`; `accessible-base-sync.js` |
| 2 | Calculadora-BMC (cotizaciones) | Express + Postgres | Sí | `quoteStore.js`, `quoteRegistry.js`, `clientQuotesSheetSync.js` |
| 3 | MercadoLibre API (BMCCHAT) | OAuth presente | Sí | `mercadoLibreClient.js`, `ml-crm-sync.js`, `mlEtlRun.js`, `mlSearch.js`. **Sin HMAC en webhook**. |
| 4 | WhatsApp | OmniCRM extension → Sheets, **+** stack propio en `wa-package/` (17 migrations) | Sí | `wa.js` route, `waEnricherWorker`, scripts `wa-*`. **HMAC opcional**. |
| 5 | Email / FB / IG / Calls / Visits | Disperso | Inconsistente | `email-snapshot-ingest.mjs` parcial; resto no integrado |
| 6 | Shopify (bmcuruguay.com.uy) | OAuth + webhooks integrados (PKCE + HMAC) | Sí | `shopify.js`, `shopifyStore.js`. **Falta sync de pedidos a customer_purchases.** |

### 2.2 Pain points (sin cambios respecto v1)

- No hay vista única por cliente.
- No hay forma de saber qué cliente contactar hoy.
- No hay scoring ni ranking — todo es memoria del operador.
- Cotizaciones generadas se pierden si el lead no responde.
- Sandra (admin) no tiene contexto comercial al recibir un pago.
- Ramiro (ops) no sabe el historial cuando va a una visita técnica.

### 2.3 Restricciones `[v2: ampliadas]`

- No romper flujos existentes (Calculadora-BMC en producción).
- **Reutilizar lo construido**: `followups.js`, `wa-package`, `ml-crm-sync`, `crmSearch`, `crmTaxonomy`, `quoteRegistry`, `clientQuotesSheetSync`, `BmcAuthProvider`. **No crear sistemas paralelos.**
- Stack: Node 24.x ESM + Express 5 + React 18 + Vite 7 + Postgres (vía `pg`). **Sin LangGraph, sin Python, sin Supabase SDK.**
- Migration files siguen convención existente: `supabase/migrations/YYYYMMDDHHMMSS_<nombre>.sql`.
- Bajo presupuesto de tiempo del autor → branches paralelos delegables.

---

## 3. Solución: Panel de Clientes 360

(Sin cambios estructurales respecto a v1. Mantengo dashboard + tabla + ficha. Las correcciones son de implementación, no de UX.)

### 3.1 Dashboard general
9 cards: prioritarios hoy, follow-ups vencidos, presupuestos pendientes, en riesgo, VIPs, oportunidades de expansión, ranking global preview, actividad reciente, KPIs del mes.

### 3.2 Tabla de clientes
Columnas ordenables/filtrables. Filtros rápidos por estado.

### 3.3 Ficha individual
3 columnas: identidad / timeline + historial / inteligencia + acciones rápidas.

### 3.4 Automatización
Engine de reglas (sec 7).

---

## 4. Arquitectura de Datos `[v2: rehecha]`

### 4.1 Fuentes ordenadas por prioridad

```
Prioridad 1: Postgres existente (wa-package + identity + quoteRegistry)  ← integrar primero
Prioridad 2: Google Sheets CRM_Operativo (lo que NO esté en Postgres)
Prioridad 3: MercadoLibre API (pedidos + buyers, vía ml-crm-sync)
Prioridad 4: Shopify API (pedidos online — pieza faltante en sec 2.1)
Prioridad 5: Email/FB/IG/Calls/Visits (best effort)
```

**Cambio v2:** Phase 1 NO sale a Sheets ni APIs externas — primero unifica lo que ya está en Postgres (WA + cotizaciones + identity). Sheets en Phase 2.

### 4.2 Schema Postgres `[v2: corregido]`

Schema dedicado: `clientes` (paralelo a `identity`, `wa`, etc.).

```sql
-- ─── Maestra ──────────────────────────────────────────────────────────
create table clientes.customers (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  rut text,                              -- normalizado (solo dígitos)
  primary_phone_e164 text,               -- E.164 sin '+'
  primary_email text,                    -- lowercased + trimmed
  channels text[] not null default '{}', -- canales activos
  first_seen_at timestamptz not null default now(),
  last_contact_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on clientes.customers (primary_phone_e164);
create index on clientes.customers (primary_email);
create index on clientes.customers (rut);
create index on clientes.customers (last_contact_at desc nulls last);

-- ─── Identidades por canal (1:N) ─────────────────────────────────────
-- Reemplaza external_ids jsonb plano de v1.
create table clientes.customer_identities (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references clientes.customers(id) on delete cascade,
  channel text not null,             -- 'sheets','calculadora','ml','shopify','wa','email'
  external_id text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (channel, external_id)      -- ← UNIQUE compuesto, fix de v1
);
create index on clientes.customer_identities (customer_id);

-- ─── Provenance de campos (auditoría de conflictos) ──────────────────
-- Resuelve "qué fuente ganó cuando hubo conflicto" — gap de v1.
create table clientes.customer_field_provenance (
  customer_id uuid not null references clientes.customers(id) on delete cascade,
  field text not null,               -- 'display_name','rut','primary_phone_e164',...
  source_channel text not null,
  source_ref text,
  source_value text,
  observed_at timestamptz not null default now(),
  primary key (customer_id, field, source_channel, observed_at)
);

-- ─── Timeline unificado ──────────────────────────────────────────────
create table clientes.customer_events (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references clientes.customers(id) on delete cascade,
  channel text not null,             -- 'wa','calculadora','ml','shopify','email','fb','ig','call','visit'
  event_type text not null,          -- 'message','quote','purchase','visit','call','login','status_change'
  payload jsonb not null default '{}',
  occurred_at timestamptz not null,
  source_ref text,
  ingested_at timestamptz not null default now(),
  unique (channel, source_ref)       -- ← UNIQUE compuesto, idempotencia por canal
) partition by range (occurred_at);

-- Particiones por mes desde el deploy (sec 11 mitigación volumen)
create table clientes.customer_events_2026_05 partition of clientes.customer_events
  for values from ('2026-05-01') to ('2026-06-01');
-- ... script de creación automática mensual en agent-partition-rollover

create index on clientes.customer_events (customer_id, occurred_at desc);
create index on clientes.customer_events (channel, occurred_at desc);

-- ─── Cotizaciones (vista de Calculadora-BMC) ─────────────────────────
-- Nota: NO duplicamos quoteRegistry; esta tabla es link + estado comercial.
create table clientes.customer_quotes (
  customer_id uuid not null references clientes.customers(id) on delete cascade,
  quote_id text not null,            -- FK lógica a quoteRegistry
  scenario text not null,            -- solo_techo|techo_fachada|solo_fachada|camara_frig
  total_amount numeric(12,2) not null,
  currency text not null default 'USD',
  status text not null default 'pending', -- pending|won|lost|expired
  created_at timestamptz not null,
  closed_at timestamptz,
  primary key (customer_id, quote_id)
);

-- ─── Compras consolidadas (Shopify + ML + directas) ──────────────────
create table clientes.customer_purchases (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references clientes.customers(id) on delete cascade,
  channel text not null,             -- 'shopify','ml','direct'
  order_ref text not null,
  products jsonb not null default '[]',
  total_amount numeric(12,2) not null,
  currency text not null default 'USD',
  occurred_at timestamptz not null,
  unique (channel, order_ref)
);
create index on clientes.customer_purchases (customer_id, occurred_at desc);

-- ─── Scores (snapshot recalculado) ───────────────────────────────────
create table clientes.customer_scores (
  customer_id uuid primary key references clientes.customers(id) on delete cascade,
  volume_score smallint, frequency_score smallint, recency_score smallint,
  count_score smallint, tenure_score smallint, conversion_score smallint,
  expansion_score smallint, risk_inverse_score smallint,
  global_score smallint not null,    -- 0-100
  rank_volume int, rank_frequency int, rank_count int,
  rank_products int, rank_tenure int, rank_active_years int,
  rank_global int,
  computed_at timestamptz not null default now()
);
create index on clientes.customer_scores (global_score desc);
create index on clientes.customer_scores (computed_at);

-- ─── Follow-ups (REEMPLAZA followUpStore.js JSON) ────────────────────
-- Migration path en sec 9.5.
create table clientes.customer_followups (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references clientes.customers(id) on delete cascade,
  due_date date not null,
  reason text not null,
  rule_triggered text,               -- ID de regla en automation_rules, NULL si manual
  status text not null default 'pending', -- pending|done|dismissed
  assigned_to_user_id uuid references identity.users(user_id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index on clientes.customer_followups (status, due_date) where status = 'pending';
create index on clientes.customer_followups (assigned_to_user_id, due_date);

-- ─── Reglas de automatización ────────────────────────────────────────
create table clientes.automation_rules (
  id text primary key,
  name text not null,
  enabled boolean not null default true,
  when_dsl jsonb not null,
  then_dsl jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Aliases manuales (override del agent-resolver) ──────────────────
-- Necesario para resolver matches incorrectos detectados por el operador.
create table clientes.customer_aliases (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references clientes.customers(id) on delete cascade,
  channel text not null,
  external_id text not null,
  created_by uuid references identity.users(user_id),
  reason text,                       -- 'manual_merge','split_correction'
  created_at timestamptz not null default now(),
  unique (channel, external_id)
);

-- ─── Cola de jobs para agentes (reemplaza Cloud Tasks) ───────────────
create table clientes.agent_jobs (
  id uuid primary key default gen_random_uuid(),
  agent text not null,               -- 'sync-sheets','resolver','scoring',...
  payload jsonb not null default '{}',
  status text not null default 'queued', -- queued|running|done|failed
  attempts int not null default 0,
  max_attempts int not null default 3,
  scheduled_for timestamptz not null default now(),
  locked_by text,                    -- pod/run id
  locked_until timestamptz,
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index on clientes.agent_jobs (status, scheduled_for) where status = 'queued';

-- ─── Telemetría de runs (debugging) ──────────────────────────────────
create table clientes.agent_runs (
  id uuid primary key default gen_random_uuid(),
  agent text not null,
  job_id uuid references clientes.agent_jobs(id),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running', -- running|ok|error
  error text,
  metrics jsonb not null default '{}'
);
create index on clientes.agent_runs (agent, started_at desc);
```

### 4.3 Estrategia de sync `[v2]`

Pipeline:

```
[Postgres existente] ──┐                              ┌──► clientes.customers
[wa-package]           │                              │
[quoteRegistry]        ├──► [agent-resolver] ────────►├──► clientes.customer_identities
[identity.users]       │   (match por phone/email)    │
                       │                              ├──► clientes.customer_events
[Sheets CRM]           │                              │    (UNIQUE channel+source_ref)
[ML API]              ─┤                              │
[Shopify API]         ─┘                              └──► customer_field_provenance
```

**Idempotencia:** `customer_events.source_ref` UNIQUE por canal. Re-runs no duplican.

**Conflictos de campos:** cada cambio escribe a `customer_field_provenance`. La regla de precedencia (sec 4.4) decide cuál se promueve a `customers.<field>`.

### 4.4 Algoritmo de `agent-resolver` `[v2: nuevo]`

```
Para cada evento entrante con (channel, external_id, contact_hint):
  1. Lookup directo: ¿existe customer_identities WHERE (channel, external_id)?
       → sí: usar ese customer_id. fin.
       → no: continuar.
  2. Match fuerte por contact_hint normalizado:
     a) phone_e164 == phone normalizado del hint
     b) email_lowercased == email del hint
     c) rut_digits == rut del hint
     Cualquiera de las 3 ⇒ link al customer encontrado.
  3. Match débil (fuzzy):
     - Levenshtein(display_name, hint.name) <= 2
     - AND (mismo canal previo OR phone prefix match)
     ⇒ candidato; insertar en agent_jobs como 'manual_review'.
  4. Sin match: crear nuevo customer + insertar identidad.

Override manual:
  - Tabla customer_aliases: si hay alias para (channel, external_id),
    forzar ese customer_id ignorando el resto.
```

**Reglas de precedencia para campos canónicos** (cuando dos fuentes difieren):
```
display_name:           sheets > ml > shopify > wa > calculadora
rut:                    sheets > calculadora > ml
primary_phone_e164:     wa > sheets > ml > shopify
primary_email:          shopify > sheets > ml
```

(Ajustables vía tabla `clientes.field_precedence` si Phase 2 lo necesita; Phase 1 es hardcoded.)

---

## 5. Scoring y Rankings `[v2: rebalanceado]`

### 5.1 Modelo

| Factor | Peso | Cálculo | Phase |
|---|---|---|---|
| Volumen total | 20% | $ acumulados, percentil global | 1 |
| Recencia | 15% | decay exp desde `last_contact_at` | 1 |
| Frecuencia | 15% | compras/mes activo | 1 |
| Conversión presupuestos | 10% | won/(won+lost) | 1 |
| Antigüedad | 10% | meses desde `first_seen_at` | 1 |
| Cantidad compras | 10% | count percentil | 2 |
| Potencial expansión | 10% | productos comprados vs catálogo | 2 |
| Riesgo inverso | 10% | 1 - prob_churn | 3 |

**Phase 1 = 5 factores explícitamente nombrados** (cierra gap de v1).

### 5.2 Cálculo `[v2: incremental, no global hourly]`

- **Daily incremental:** un Cloud Run Job (`agent-scoring-incremental`) corre 1×/día (3am UYT) y recalcula **solo** los `customer_id` con eventos en últimas 24h. SQL puro, window functions para percentiles.
- **Hourly top-100:** `agent-scoring-vip` recalcula solo `WHERE global_score >= 80 OR rank_global <= 100`.
- **Full rebuild:** manual trigger `POST /api/clientes/scoring/rebuild` (admin only) — corre el job completo offline. Para N=10k tarda ~30s estimado, se puede hacer 1×/semana sin costo.

### 5.3 Rankings obligatorios (7) — sin cambios respecto v1
Volumen · Frecuencia · Cantidad · Productos · Antigüedad · Años activos · Global.

### 5.4 Rankings adicionales en MVP
**Phase 1:** Recencia, NBA. **Phase 2:** Riesgo abandono, Conversión. **Phase 3:** resto.

---

## 6. UI & UX `[v2]`

### 6.1 Stack frontend

`hecho confirmado`: React 18 + Vite 7 + `react-router-dom` 6 + Context puro (`BmcAuthProvider`). **Sin React Query / SWR / Redux / Zustand actualmente.**

**Decisión v2:** agregar `@tanstack/react-query` v5 como dep nueva. Justificación:
- Dashboard con 9 cards independientes ⇒ 9 queries en paralelo, cada una con su loading/error/cache. Context puro requiere reinventar todo eso.
- Tabla con filtros server-side ⇒ keepPreviousData + invalidate on mutate.
- Ficha con timeline en vivo ⇒ refetchOnWindowFocus + refetch interval.
- Footprint: ~13 KB gzipped, no afecta build de Vite.
- **No toca componentes existentes** — solo el módulo `clientes`.

### 6.2 Estructura `[v2]`

```
src/modules/clientes/
  ├── DashboardClientes.jsx
  ├── TablaClientes.jsx
  ├── FichaCliente.jsx
  ├── components/
  │   ├── ScoreGauge.jsx
  │   ├── TimelineUnificado.jsx
  │   ├── RankingsBlock.jsx
  │   ├── NextBestAction.jsx
  │   ├── FollowUpCard.jsx
  │   └── AccionesRapidas.jsx
  ├── hooks/
  │   ├── useCustomers.js          (react-query wrapper)
  │   ├── useCustomerEvents.js
  │   ├── useScoring.js
  │   ├── useFollowups.js
  │   └── useNba.js
  └── api/
      └── clientesClient.js        (fetch helpers + types Zod)
```

Routing: `/clientes` y `/clientes/:id`.

### 6.3 Vistas por perfil `[v2: vía role_grants]`

`identity.role_grants` extendido con `module='clientes'`:

| Grant | Vista por defecto | Acciones primarias |
|---|---|---|
| `clientes.admin` | Dashboard completo + tabla full | Todo |
| `clientes.operator` | Tabla filtrada (pagos pendientes) + fichas | Marcar pagos, notas admin |
| `clientes.field` | Mobile-first: lista de visitas + ficha simplificada | Confirmar visita, agregar nota campo |

**Implementación:** middleware `requireGrant('clientes', ['admin','operator','field'])` en routers. Frontend lee grants vía `useBmcAuth()` y renderiza variantes del mismo módulo.

Mapeo nominal a usuarios reales (no en código, vía seed): Matias→admin, Sandra→operator, Ramiro→field.

### 6.4 Componentes clave (sin cambios respecto v1)
ScoreGauge SVG · TimelineUnificado vertical con icono por canal · 5 botones de Acciones Rápidas.

---

## 7. Automatización: Reglas y Recordatorios `[sin cambios]`

DSL JSON en `clientes.automation_rules`. `agent-automation` corre cada 30 min, evalúa contra `customer_scores` y `customer_events`, crea registros en `clientes.customer_followups`. Email digest vía Apps Script (reusa pipeline existente).

5 reglas iniciales (sec 7.2 de v1).

---

## 8. Orquestación Multi-Agente `[v2: simplificada]`

### 8.1 Agentes (todos Cloud Run Jobs, todos Node ESM)

| Agente | Trigger | Output |
|---|---|---|
| `agent-sync-postgres-existing` | Cloud Scheduler 5 min | events desde wa-package, quoteRegistry |
| `agent-sync-sheets` | Cloud Scheduler 5 min | events desde Sheets |
| `agent-sync-ml` | Cloud Scheduler 15 min + webhook (post-fix HMAC) | events desde ML |
| `agent-sync-shopify` | Cloud Scheduler 30 min | purchases desde Shopify |
| `agent-resolver` | Trigger: row inserted en `agent_jobs` con `agent='resolver'` | identidades resueltas |
| `agent-scoring-incremental` | Cloud Scheduler daily 3am | scores recientes |
| `agent-scoring-vip` | Cloud Scheduler hourly | scores top-100 |
| `agent-automation` | Cloud Scheduler 30 min | followups |
| `agent-nba` | HTTP request (no batch) | response inline a UI |
| `agent-reporter` | Cloud Scheduler daily 8am UYT | digest email |
| `agent-partition-rollover` | Cloud Scheduler monthly 1st | nueva partición `customer_events_YYYY_MM` |

**Total: 11 jobs.** Todos Node ESM. Sin LangGraph, sin Python.

### 8.2 Interfaces

- **Cola interna:** tabla `clientes.agent_jobs` (Postgres advisory locks via `locked_by` + `locked_until`). NO Cloud Tasks (innecesario para este volumen).
- **State:** Postgres es source of truth.
- **Logging:** `clientes.agent_runs` + pino (ya en stack) → Cloud Logging.

### 8.3 Branches paralelos para desarrollo `[v2]`

```
claude/clientes-360-schema           ← migration SQL completa
claude/clientes-360-resolver         ← agent-resolver + customer_aliases UI
claude/clientes-360-sync-existing    ← lee Postgres existente
claude/clientes-360-sync-sheets
claude/clientes-360-sync-ml          ← BLOQUEADO hasta HMAC ML resuelto
claude/clientes-360-sync-shopify     ← reusa shopify.js
claude/clientes-360-scoring          ← incremental + VIP
claude/clientes-360-automation       ← reglas + DSL
claude/clientes-360-followups-migration  ← migra followUpStore.js JSON → Postgres
claude/clientes-360-ui-dashboard
claude/clientes-360-ui-tabla
claude/clientes-360-ui-ficha
claude/clientes-360-nba              ← Claude API + cache
```

13 branches. Cada uno PR independiente, merge a `claude/add-clientes-360-Pvfuc`.

---

## 9. Cambios de Backend / Infraestructura `[v2]`

### 9.1 Express (panelin-calc Cloud Run)

Nuevos routers:
- `server/routes/clientes/customers.js` — CRUD customers + identities
- `server/routes/clientes/events.js` — timeline read
- `server/routes/clientes/followups.js` — **reemplaza** `server/routes/followups.js` (redirect 308 al nuevo path por compat)
- `server/routes/clientes/automation.js` — reglas
- `server/routes/clientes/scoring.js` — scores read + rebuild trigger
- `server/routes/clientes/nba.js` — Next Best Action

Middleware:
- `server/middleware/requireGrant.js` (nuevo) — wrapper sobre `requireUser()` + `getModuleGrants()` ya existentes.

### 9.2 Migration

**1 archivo:** `supabase/migrations/20260508000001_clientes_360_init.sql` con todas las tablas de sec 4.2.

**No se aplica con `apply_migration` automáticamente** — el autor revisa primero, luego ejecuta manual contra el proyecto remoto.

### 9.3 Frontend

- Nuevo módulo `src/modules/clientes/`.
- Tab "Clientes" en navegación principal (insertado en el header existente).
- Dependency nueva: `@tanstack/react-query@^5`.

### 9.4 Costo estimado mensual `[v2: nuevo]`

| Componente | Volumen asumido | $/mes |
|---|---|---|
| Cloud Run Jobs (11 jobs, ~30k invocaciones) | N=10k clientes | $5-15 |
| Cloud Scheduler (11 jobs) | — | $1 |
| Postgres incremental (8 tablas + particionado) | — | $5-15 |
| Claude API (NBA, Sonnet 4.6 con prompt caching) | 200 req/día, ~3k tok input cached + 500 tok output | $30-60 |
| Cloud Logging | — | $0-5 |
| **Total** | | **$40-95/mes** |

Con prompt caching activado (skill `claude-api`), el factor Claude baja a la mitad porque el system prompt + catálogo se cachean por 5 min.

### 9.5 Plan de migración de followUpStore.js → Postgres `[v2: nuevo]`

```
Step 1 (PR followups-migration):
  - Script `scripts/migrate-followups-to-postgres.mjs`:
    leer JSON → match a customers (vía agent-resolver) → insert en clientes.customer_followups.
  - Endpoint /api/followups (legacy) responde 200 + warning header `Deprecation: ...`.
Step 2:
  - /api/followups proxy a /api/clientes/followups (read-through).
Step 3 (en Phase 3):
  - Endpoint legacy retorna 308 Permanent Redirect.
  - Borrar followUpStore.js JSON tras backup.
```

### 9.6 Bloqueantes de seguridad `[v2: corregido]`

| Item | Estado real (post-audit) | Phase que requiere fix |
|---|---|---|
| ML webhook sin HMAC | Confirmado: no hay HMAC en `mlEtlRun.js` | Phase 2 (sync ML) |
| WhatsApp HMAC opcional | Confirmar en `wa.js` | Phase 2 (si se sumará a webhook directo, no si solo se lee de wa-package) |
| `WEBHOOK_VERIFY_TOKEN` vacío | Confirmar en `.env` | Phase 2 |
| OAuth tokens "in-memory" | **Falso.** Tokens están en `tokenStore.js` con AES-256-GCM file-based. | — |
| OAuth `state` param (CSRF) in-memory | **Probable** en `mercadoLibreClient.js`. Vulnerable a restart durante OAuth dance. | Phase 2 (cuando se exponga callback público) |
| Shopify HMAC | **Ya implementado** (PKCE + query HMAC + webhook HMAC) | — |

**Phase 1 NO requiere ningún fix de seguridad** porque solo lee de Postgres interno + Sheets (auth Google ya existente). Los fixes son gating de Phase 2.

---

## 10. Plan Incremental `[v2: refinado]`

### Phase 1 — MVP Core (Semanas 1-2)

- [ ] **Auditoría e inventario** de lo existente (followups, wa-package, ml-crm-sync, crmSearch, quoteRegistry, clientQuotesSheetSync). Output: `docs/clientes-360/EXISTING-CRM-MAPPING.md`.
- [ ] Migration `20260508000001_clientes_360_init.sql` (8 tablas + 2 auxiliares de jobs).
- [ ] Seed de grants `clientes.{admin,operator,field}` para usuarios actuales.
- [ ] `agent-sync-postgres-existing`: lee wa-package + quoteRegistry → events.
- [ ] `agent-resolver` con algoritmo de sec 4.4 (sin fuzzy aún, solo match fuerte).
- [ ] Routers: `clientes/customers.js`, `clientes/events.js`, `clientes/followups.js`.
- [ ] Frontend: TablaClientes + FichaCliente básica + ruta `/clientes`.
- [ ] Migración followUpStore JSON → Postgres (Step 1 + 2 de sec 9.5).
- [ ] Scoring v1 (5 factores: volumen, recencia, frecuencia, conversión, antigüedad) en SQL.

**Criterio de done Phase 1:** abrir `/clientes`, ver tabla con clientes derivados de Postgres existente, abrir ficha y ver timeline con cotizaciones + mensajes WA. Score visible.

### Phase 2 — Multi-canal & Automatización (Semanas 3-4)

- [ ] **Resolver bloqueantes de seguridad** (ML HMAC, WA HMAC si aplica, WEBHOOK_VERIFY_TOKEN, OAuth state CSRF).
- [ ] `agent-sync-sheets` (lee CRM_Operativo).
- [ ] `agent-sync-ml` (lee ML API + webhook con HMAC).
- [ ] `agent-sync-shopify` (lee orders).
- [ ] `agent-automation` engine + 5 reglas iniciales.
- [ ] Dashboard general (9 cards).
- [ ] Vistas diferenciadas por grant (admin/operator/field).
- [ ] Scoring v2 (3 factores adicionales: cantidad, expansión, riesgo).
- [ ] Fuzzy match en `agent-resolver` + UI manual review.

### Phase 3 — Inteligencia & Escalado (Semanas 5-6)

- [ ] `agent-nba` con Claude Sonnet 4.6 + prompt caching.
- [ ] Cross-sell rules.
- [ ] Email digest diario (`agent-reporter`).
- [ ] Sync canales secundarios (FB/IG/email/calls/visits) — best effort.
- [ ] Rankings adicionales (recencia visible, conversión, riesgo).
- [ ] Retirar endpoint legacy `/api/followups`.

---

## 11. Riesgos y Dependencias `[v2: actualizada]`

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Resolver crea duplicados (mismo cliente, IDs distintos) | Alta | Alto | Match fuerte primero + tabla `customer_aliases` para overrides + UI manual review |
| Conflicto de campos entre fuentes | Alta | Medio | `customer_field_provenance` + reglas de precedencia documentadas (sec 4.4) |
| ML webhook sin HMAC | Alta | Alto | **Bloqueante de Phase 2.** Phase 1 no lo requiere. |
| Volumen de eventos crece | Media | Medio | Particionado mensual + retention policy de 24 meses (definir en Phase 3) |
| Datos sucios en Sheets | Alta | Alto | Layer de normalización (E.164 phone, lowercase email, RUT solo dígitos) + flag `customer_aliases.reason='manual_review'` |
| Followups duplicados en transición | Media | Medio | Step 2 de sec 9.5 (proxy read-through) evita reinserción |
| Ramiro sin internet en obra | Alta | Bajo | PWA con `vite-plugin-pwa` (ya en deps) + cache de últimas 50 fichas |
| Costo Claude API se dispara | Baja | Medio | Cache key `(customerId, scores.computed_at)` + Haiku fallback + rate limit 10/min/usuario |
| Postgres advisory locks no escalan | Baja | Bajo | A partir de N=50k clientes, evaluar Cloud Tasks |

---

## 12. Próximos Pasos `[v2]`

1. **Revisar v2 con autor** y aprobar / pedir más correcciones.
2. **Resolver 4 bloqueantes de seguridad** (paralelo a Phase 1, gating para Phase 2).
3. **Crear `EXISTING-CRM-MAPPING.md`** auditando followups, wa-package, ml-crm-sync, crmSearch, quoteRegistry, clientQuotesSheetSync.
4. **Crear migration SQL** `supabase/migrations/20260508000001_clientes_360_init.sql`.
5. **Spawn agentes paralelos** sobre los 13 branches (sec 8.3) — 1 PR por branch.
6. **Reader testing** del v2 con Claude fresh para validar claridad.

---

## Apéndice A — Glosario

- **NBA:** Next Best Action.
- **CLV:** Customer Lifetime Value.
- **VIP:** `global_score >= 80`.
- **Riesgo:** `recency > 180d AND score > 60`.
- **Escenario:** `solo_techo|techo_fachada|solo_fachada|camara_frig`.
- **E.164:** formato internacional de phone (`598XXXXXXXX` para Uruguay, sin `+`).
- **Grant:** registro en `identity.role_grants` que autoriza un rol dentro de un módulo.
- **Provenance:** registro de qué fuente proveyó qué valor de qué campo en qué momento.

## Apéndice B — Referencias internas (sin URLs externas)

- `OAUTH-CHECKLIST.md` — bloqueantes de seguridad.
- `SECRETS-MIGRATION.md` — rotación API_AUTH_TOKEN.
- `server/routes/followups.js` + `server/lib/followUpStore.js` — sistema legacy a migrar.
- `wa-package/migrations/*.sql` — 17 migrations existentes de WhatsApp.
- `server/ml-crm-sync.js` — sync ML existente.
- `server/lib/crmSearch.js` + `crmTaxonomy.js` — utilities CRM existentes.
- `server/lib/quoteRegistry.js` — registry de cotizaciones existente.
- `server/lib/clientQuotesSheetSync.js` — sync Sheets existente.
- `server/lib/identityAuth.js` + `identity` schema — auth existente.
- `server/tokenStore.js` — token store file-based AES-256-GCM.
- `src/contexts/BmcAuthProvider.jsx` — auth provider frontend existente.

## Apéndice C — Referencias externas (sin links — agregar paths cuando se confirmen)

- OmniCRM Sync Chrome Extension — repo externo, fuente de WhatsApp/ML/FB/IG hacia Sheets.
- Apps Script CRM_Operativo — script-side de Sheets.
- (v1 mencionaba "Multi-Agent Marketing System / LangGraph" — descartado en v2 por incompatibilidad de stack.)
