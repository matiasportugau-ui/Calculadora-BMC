---
title: System Design Document — BMC Finanzas Hub
version: 0.1 (draft)
date: 2026-07-16
status: Draft
author: Matias Portugau / Cursor agent
system: BMC Finanzas Hub (Calculadora BMC)
related: metalog-bank-ledger (private local pipeline; out of Vercel deploy)
---

# System Design Document: BMC Finanzas Hub

## 1. Introduction & Goals

### 1.1 Problem Statement

Metalog SAS (BMC Uruguay) already imports BROU bank statements into Calculadora BMC at `/hub/banco`, with free-text category and entity classification. That module is **hidden from the top navigation**, and there is **no dedicated cash-flow analysis surface** that forces consistent categorization.

Operators need a first-class **Finanzas** module (same prominence as TraKtiMe / Market Intel) where:

1. **Banco** remains the ledger (import, filter, edit movements).
2. **Cash Flow** makes classification the path to understanding inflow/outflow by managerial category.

Bank data is audit-sensitive (active DGI context). Classification is **managerial inference**, not fiscal authority. The private Python ledger (`metalog-bank-ledger`) stays local; this hub reuses the existing BMC `/api/banco` Postgres store.

### 1.2 Goals

| Priority | Goal                                                             |
| -------- | ---------------------------------------------------------------- |
| P0       | Top-nav **Finanzas** entry pointing at `/hub/finanzas`           |
| P0       | Internal tabs **Banco** \| **Cash Flow**                          |
| P0       | Fixed cash-flow taxonomy (select, not free text) for `categoria` |
| P0       | Cash Flow view: unclassified queue + monthly/category aggregates |
| P1       | Redirect `/hub/banco` → `/hub/finanzas/banco`                    |
| P1       | Wolfboard Finanzas card CTA → `/hub/finanzas`                    |
| P2       | Optional: align rules engine patterns to taxonomy (later)        |

### 1.3 Stakeholders

| Role                    | Interest                                            |
| ----------------------- | --------------------------------------------------- |
| Matias (operator/admin) | Daily classify + cash-flow visibility               |
| Sandra / accountant     | Managerial reports; must not treat UI as DGI filing |
| BMC admins              | Module grant `banco` controls access                |
| Future agents           | SDD + code as source of truth for Finanzas UX       |

### 1.4 System Context (C4 L1)

**External interfaces**

| Interface              | Direction | Protocol    | Description          |
| ---------------------- | --------- | ----------- | -------------------- |
| Browser → SPA          | →         | HTTPS       | React hub routes     |
| SPA → `/api/banco/*`   | →         | HTTPS/JSON  | Auth bearer + cookie |
| Operator → BROU export | ←         | Manual file | XLS/CSV upload       |
| metalog-bank-ledger    | ⊥         | Local only  | No runtime coupling  |

### 1.5 Constraints

- **Privacy:** do not publish `metalog-bank-ledger/data/*` or private Canvas to Vercel.
- **Auth:** keep grant slug `banco` (avoid permission migration).
- **FX:** no DGI interbancaria conversion inside this hub (v1). Native currency per account.
- **Classification:** managerial labels only; unmatched → `sin_clasificar` / null.
- **Stack locked:** Calculadora BMC React SPA + Express API + Postgres (existing `banco_*` tables).
- **UI pattern:** TraKtiMe-style internal tab bar (`TraKtiMeModule.jsx`).

### 1.6 Solution Strategy

- **Architecture style:** feature module inside modular monolith (Calculadora BMC).
- **Reuse:** `BancoLedgerModule.jsx` + `server/routes/banco.js`.
- **Shell:** new `FinanzasModule` hosts tabs; Banco embeds existing ledger; Cash Flow is new panel + thin API.
- **Trade-off accepted:** dual native currency panels instead of unified UYU control (unified stays local-only for now).

---

## 2. Architecture Views

### 2.1 Container View (C4 L2)

Browser SPA (React + Vite) ↔ Express `/api/banco/*` ↔ Postgres `banco_*` tables. BROU XLS imported via upload.

### 2.2 Component View — Finanzas module (C4 L3)

| Component             | Responsibility                          | File (target)                                    |
| --------------------- | --------------------------------------- | ------------------------------------------------ |
| **BmcModuleNav**      | Top pill **Finanzas**                   | `src/components/BmcModuleNav.jsx`                |
| **FinanzasModule**    | Shell, tab bar, nested routes           | `src/components/hub/finanzas/FinanzasModule.jsx` |
| **BancoLedgerModule** | Import, filters, movement table, PATCH  | existing `hub/banco/BancoLedgerModule.jsx`       |
| **CashFlowPanel**     | Unclassified queue, KPIs, charts/tables | `hub/finanzas/CashFlowPanel.jsx`                 |
| **Taxonomy constant** | Shared category list + labels           | `hub/finanzas/cashFlowTaxonomy.js`               |
| **banco routes**      | CRUD + new cash-flow aggregate          | `server/routes/banco.js`                         |
| **RequireGrant**      | `module=banco`                          | existing auth                                    |

### 2.3 Primary data flows

**A. Import extract:** Operator uploads BROU XLS → POST `/import` → upsert movements (dedup_hash) → apply rules → refresh grid.

**B. Classify for cash flow:** Cash Flow tab → GET `/cash-flow` + GET `/movements?sin_clasificar=1` → PATCH `/movements/:id` with taxonomy key → refresh aggregates.

---

## 3. Domain model

### 3.1 Existing tables (reuse)

- `banco_accounts` — account_id, name, currency (UYU/USD), …
- `banco_movements` — fecha, descripcion, debito, credito, **categoria**, **entidad**, dedup_hash, …
- `banco_rules` — pattern → categoria/entidad

### 3.2 Cash-flow taxonomy (fixed select)

| Key                     | Label (ES)            | Kind             |
| ----------------------- | --------------------- | ---------------- |
| `ingreso_venta`         | Ingreso venta         | inflow           |
| `ingreso_otro`          | Otro ingreso          | inflow           |
| `aporte_socio`          | Aporte socio          | inflow           |
| `egreso_proveedor`      | Proveedores           | outflow          |
| `egreso_sueldo`         | Sueldos               | outflow          |
| `egreso_operativo`      | Operativo             | outflow          |
| `egreso_financiero`     | Financiero            | outflow          |
| `egreso_impuesto`       | Impuestos             | outflow          |
| `transferencia_interna` | Transferencia interna | neutral / either |
| `retiro_socio`          | Retiro socio          | outflow          |
| *(null)*                | Sin clasificar        | unknown          |

**Note:** `entidad` (bmc / expreso_este / personal / mixta) stays orthogonal to cash-flow category — keep both.

### 3.3 Cash-flow aggregates (API contract)

`GET /api/banco/cash-flow?account_id&from&to`

```json
{
  "ok": true,
  "currency": "UYU",
  "totals": { "inflow": 0, "outflow": 0, "net": 0 },
  "unclassified_count": 0,
  "monthly": [
    { "month": "2026-01", "inflow": 0, "outflow": 0, "net": 0, "cumulative": 0 }
  ],
  "by_category": [
    { "category": "ingreso_venta", "label": "Ingreso venta", "total": 0, "kind": "inflow" }
  ]
}
```

Definitions:

- **inflow** = sum(credito)
- **outflow** = sum(debito)
- **net** = inflow − outflow
- Unclassified = `categoria IS NULL`

Multi-account “Todas”: return `currency: "MIXED"` and either require account filter for charts, or return parallel `by_currency` buckets — **v1 requires account filter for chart clarity** when currencies differ.

---

## 4. UX specification

### 4.1 Top navigation

- Label: **Finanzas**
- Route: `/hub/finanzas`
- Placement: after Market Intel, before Tareas
- Active: `/hub/finanzas*` and legacy `/hub/banco*`

### 4.2 Internal tabs (TraKtiMe pattern)

| Tab       | Route                     | Content                                                                                                        |
| --------- | ------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Banco     | `/hub/finanzas/banco`     | Existing ledger UI (embedded)                                                                                  |
| Cash Flow | `/hub/finanzas/cash-flow` | KPIs + classify queue + monthly/category tables (charts if echarts already available; else dense tables first) |

### 4.3 Cash Flow screen layout

1. Account + date filters (shared semantics with Banco)
2. KPI row: Ingresos · Egresos · Neto · Sin clasificar
3. **Classify queue** (sin_clasificar): date, description, debit/credit, category select, entidad select
4. Monthly table (inflow/outflow/net/cumulative)
5. By-category breakdown (signed totals)

### 4.4 Banco tab change

- Replace free-text category `<input>` with taxonomy `<select>`
- Keep import, filters, entidad, monthly summary toggle

---

## 5. Quality attributes

### 5.1 Security

- `RequireGrant module="banco" minLevel="read"` on all Finanzas routes and APIs
- Write (import/PATCH) requires write level (existing middleware behavior)
- No bank CSVs in git; uploads stay in DB
- Do not log full statement bodies to client analytics

### 5.2 Reliability

- Import remains idempotent via `dedup_hash`
- Cash-flow endpoint read-only; failures surface as UI error banner

### 5.3 Performance

- Movements already paginated (PAGE_SIZE 100)
- Cash-flow aggregates: single SQL with filters (same as `/summary`)
- Classify queue: cap (e.g. 50) + link to Banco for full list

### 5.4 Observability

- Reuse existing API logging; no new LLM observability
- Optional: count of unclassified in Wolfboard card later (P2)

### 5.5 Cost

- Negligible (no LLM). Charts client-side only.

---

## 6. AI architecture

**N/A for v1.** No LLM classification in this delivery. Future optional: suggest category from description via rules/LLM — out of scope.

---

## 7. Architecture Decision Records

### ADR-001: Expose as Finanzas shell, keep grant `banco`

**Status:** Accepted  
**Context:** Renaming grant to `finanzas` would break admin assignments.  
**Decision:** UI label Finanzas; auth module remains `banco`.  
**Consequences:** + no migration; − naming mismatch in admin UI until documented.

### ADR-002: No FX unification in Calculadora v1

**Status:** Accepted  
**Context:** DGI FX lives in private metalog pipeline; BCU/API complexity.  
**Decision:** Cash Flow is native per account/currency.  
**Consequences:** + simpler, safer; − no single UYU control chart in prod (use local dashboard).

### ADR-003: Fixed taxonomy over free-text categories

**Status:** Accepted  
**Context:** Free-text prevents reliable cash-flow grouping.  
**Decision:** Shared select list; PATCH still stores string keys.  
**Consequences:** + clean aggregates; − legacy free-text values may need one-time remap or show under “Otras”.

### ADR-004: Do not deploy metalog-bank-ledger SPA

**Status:** Accepted  
**Context:** Private bank data gitignored; AGENTS.md forbids wiring without care.  
**Decision:** Rebuild Cash Flow UX against `/api/banco` in Calculadora.  
**Consequences:** + one auth/deploy surface; − feature parity with local Vite dashboard may lag.

---

## 8. Risks

| Risk                            | Impact | Likelihood | Mitigation                                            |
| ------------------------------- | ------ | ---------- | ----------------------------------------------------- |
| Legacy free-text categorias     | Medium | High       | Map known values; bucket unknown as “Otras” in charts |
| Mixed UYU+USD “Todas”           | Medium | Medium     | Require account filter for Cash Flow charts           |
| Users treat UI as fiscal truth  | High   | Medium     | Disclaimer in UI + SDD                                |
| Nav confusion Banco vs Finanzas | Low    | Low        | Redirect + copy                                       |

---

## 9. Glossary

| Term                    | Meaning                                               |
| ----------------------- | ----------------------------------------------------- |
| **Finanzas**            | Top-level BMC hub module (nav label)                  |
| **Banco**               | Ledger sub-tab: import + movement grid                |
| **Cash Flow**           | Analysis sub-tab driven by classified movements       |
| **categoria**           | Managerial cash-flow class stored on movement         |
| **entidad**             | BMC / Expreso Este / Personal / Mixta                 |
| **sin_clasificar**      | Missing category (blocks clean cash-flow attribution) |
| **metalog-bank-ledger** | Private local Python+Vite ledger (parallel system)    |
