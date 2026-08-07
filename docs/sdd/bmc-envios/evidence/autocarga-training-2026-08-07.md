# Evidence — Autocarga A→C→B training run

**Date:** 2026-08-07  
**Branch:** `feat/logistica-ops-session`  
**Goal:** `goal-prompt-logistica-autocarga-a-c-b-d.md`

## Phase A — Ventas list hygiene

| Check | Result |
|-------|--------|
| Garbage rows (`#ID. Pedido`, ENCARGO=`PEDIDO`, empty nombre) | **Filtered** via `isVentasLogisticaCandidate` / `filterVentasLogisticaCandidates` |
| Toast `para .` | **Fixed** — `labelVentasCandidate` always yields nombre / `#pedido` / `fila N` / `parada sin nombre` |
| Fake PDF cells | **Sanitized** — `sanitizeEncargoCell` drops labels; free-text ENCARGO → `encargoPlain` |
| Unit tests | `node tests/ventasSheetMap.test.js` — 6 passed |

## Phase C — Admin multi-key match

| Check | Result |
|-------|--------|
| Pure module | `src/utils/logistica/adminQuoteMatch.js` — pedido / phone / name weights |
| Unique pedido | auto-apply |
| Same name + different phones | ambiguous, no auto-apply |
| Name-only | never auto-apply |
| API | `POST /api/envios/match-quotes` (auth) — accepts `quotes[]`; 503 if omitted (Sheets owned by dashboard) |
| Client wire | `agregarStop` → `tryAdminQuoteMatch` via `GET /api/cotizaciones` when Sheets up |
| Unit tests | `node tests/adminQuoteMatch.test.js` — 7 passed |

Live API smoke (quotes in body):

```json
{"ok":true,"autoApply":true,"best":{"score":0.952,"reasons":["pedido exacto 1344059","tel exacto 99382033","nombre ~85%"]}}
```

## Phase B — PDF proxy

| Check | Result |
|-------|--------|
| API | `POST /api/envios/adjunto-fetch` (auth) |
| Alvaro Drive `1SPwE80c1aQ6HsqR1fMPAAvcuVsk0YhQv` | **200** — ~50KB PDF (`%PDF` / base64 `JVBERi0…`) |
| Client | `inferPanelsAndAccessoriesFromPdf` tries proxy first, then browser |

## Phase D — Client fixtures

| Client | Expectation after ship |
|--------|------------------------|
| Petinho #1344059 | Still OK (filename ISO* + optional Admin/PDF) |
| Alvaro #1345381 | PDF bytes via **proxy** (browser CORS bypassed) |
| Garbage rows | **Not listed** in Cargar actuales |

## Residual

- Admin live match depends on `GET /api/cotizaciones` Sheets config (local may be “Sheets not configured”).
- Dropbox ENCARGO: proxy uses `dl=1`; not fully golden-tested this run.
- Quantities from filename still default 1 unless PDF text parse succeeds.

## Files touched

- `src/utils/logistica/ventasSheetMap.js`
- `src/utils/logistica/adminQuoteMatch.js` (new)
- `src/utils/logistica/packageDims.js` / cargo packing dims (prior session)
- `src/components/BmcLogisticaApp.jsx`
- `server/routes/envios.js`
- `tests/ventasSheetMap.test.js`, `tests/adminQuoteMatch.test.js`
