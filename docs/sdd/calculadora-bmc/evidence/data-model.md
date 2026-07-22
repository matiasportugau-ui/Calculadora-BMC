# Evidence — data model (R2)

## Stores

| Store | Purpose | Evidence |
|-------|---------|----------|
| **Google Sheets** | CRM operativo, finanzas, matriz costos, wolfboard Admin, bug reports | `/health` sheets_diagnostics; `config.bmcSheetId`, `BMC_MATRIZ_SHEET_ID` |
| **PostgreSQL** (`DATABASE_URL`) | Transportista trips, WA Cockpit, TraKtiMe, Omni, quote embeddings / pgvector | `.env.example`; migrations dirs |
| **GCS** | Encrypted ML tokens (`ML_TOKEN_GCS_*`) | `config.tokenStorage` / Cloud Run |
| **Local files** | Dev ML tokens `.ml-tokens.enc`; knowledge events JSONL | config |
| **Browser localStorage** | PDF layout `bmc.pdfLayout`; session UI prefs | CLAUDE.md / pdfGenerator docs |

## Postgres migration paths — CONFIRMED

| Domain | Path | Commands |
|--------|------|----------|
| RAG / embeddings | `migrations/0001_add_pgvector_and_quote_embeddings.sql`, `0002_…` | `psql "$DATABASE_URL" -f …` |
| Transportista | `transportista-cursor-package/migrations/` | `npm run transportista:migrate` |
| WA Cockpit | `wa-package/migrations/` (`wa_conversations`, messages, suggestions, quotes…) | `npm run wa:migrate` |
| TraKtiMe | (traktime migrate script) | `npm run traktime:migrate` |

## CRM / Sheets tabs (prod health sample)

Observed via `/health` sheets_diagnostics.tabs:

`Form responses 1`, `CRM_Operativo`, `Base de datos cotis de clientes`, `Manual`, `Parametros`, `Dashboard`, `Automatismos`, `DB`, `BUG_REPORTS`

**Deep column mapping:** `docs/google-sheets-module/MAPPER-PRECISO-PLANILLAS-CODIGO.md` — **out of scope** for this SDD body; cite only.

## Quote / calc data

- Pricing lists in `src/data/constants.js` (LISTA_ACTIVA venta/web).
- Totals via `calcTotalesSinIVA()` — prices USD without IVA; 22% IVA at total (`docs/PRICING-ENGINE.md`).
- Server calc loopback: `server/lib/calcLoopbackClient.js` → `127.0.0.1:${port}/calc/*` provenance `source: "ae_agent"`.

## Identity data

JWT access (~15min) + refresh (~30d); Google OAuth; grants RBAC (`requireGrant`). MFA TOTP (`authMfa`). See `server/lib/identityAuth.js`.
