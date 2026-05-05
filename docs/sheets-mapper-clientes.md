# Sheets mapper — «Base de datos cotis de clientes» v1

> Companion to the master plan §Phase I. This document is the **source of truth**
> for the column contract and idempotency strategy of the Comprador quote sync.

## Spreadsheet

- **Spreadsheet ID**: `BMC_SHEET_ID` (same workbook used by the rest of `bmcDashboard.js`).
- **Tab name (literal)**: `Base de datos cotis de clientes`
- **Pre-flight**: the tab must exist before sync runs. The lib will create the
  header row (A1:K1) on first call but will NOT create the tab itself.

## Column contract (v1)

| Col | Field | Type | Notes |
|-----|-------|------|-------|
| A   | `quote_id`            | text  | **Idempotency key**. UUID from `identity.quotes.quote_id`. |
| B   | `user_email`          | text  | From `identity.users.email`. |
| C   | `user_name`           | text  | From `identity.users.name`. |
| D   | `created_at`          | ISO8601 | `identity.quotes.created_at`. |
| E   | `status`              | text  | `draft \| completed \| exported \| deleted`. |
| F   | `total_usd`           | number | 2 decimal places (string-formatted). |
| G   | `total_uyu`           | number | 2 decimal places (string-formatted). |
| H   | `pdf_url`             | url   | `identity.quotes.pdf_url`. |
| I   | `drive_file_id`       | text  | `identity.quotes.drive_file_id`. |
| J   | `sync_batch_id`       | text  | Run-level identifier (`enq-...`, `recon-...`, `manual-...`). |
| K   | `wizard_payload_json` | json (stringified) | Full payload at moment of sync. |

## Idempotency

- The lib looks up column A for the incoming `quote_id`.
- **If found**: full-row update (`A:K`).
- **If not found**: append a new row (`INSERT_ROWS`).
- The DB column `identity.quotes.sheet_synced_at` is bumped after a successful
  write; `identity.quotes.sheet_row_id` stores the 1-based row number.

## Triggers

| Trigger | Function | Cadence |
|---------|----------|---------|
| Quote completion → `enqueue(quote_id)` | `clientQuotesSheetSync.enqueue` | Debounced 60s aggregate flush. |
| Admin reconcile | `POST /api/admin/sheets/clientes/reconcile` | On-demand. Picks up rows where `sheet_synced_at IS NULL AND status='completed'`, up to `limit` (default 200). |
| Admin single-quote retry | `POST /api/admin/sheets/clientes/sync/:quote_id` | On-demand for one row. |

## Audit

- Every sync run inserts a row in `identity.audit_log`:
  - `action`: `sync_run` (single quote) or `reconcile_run` (batch)
  - `resource`: `sheets:base_clientes`
  - `payload`: `{ quote_id?, sheet_row_id?, batch_id, ok, fail, errors[] }`
- Per-quote events also inserted in `identity.quote_events` with kind
  `sheet_pushed`.

## Toggle / configuration

- `SHEETS_CLIENT_QUOTES_ENABLED=true` (default `false`) — master kill switch.
- `SHEETS_CLIENT_QUOTES_TAB=Base de datos cotis de clientes` (override).
- Service account credentials: read from `GOOGLE_APPLICATION_CREDENTIALS`,
  same as every other Sheets-using route.

## v2 considerations (not implemented)

- Column for `client_quote_id` (currently merged into the payload JSON) for
  faster joins with anonymous-pre-merge analytics.
- Hashed `email` in column B for PII minimization.
- `last_synced_at` column to capture latest write timestamp without round-trip
  to the DB.
