# CRM Column Mapping Validation — 2026-04-24

**Sources read:** `server/lib/crmOperativoLayout.js`, `server/routes/bmcDashboard.js`, `scripts/accessible-base-sync.js`, `.accessible-base/crm_operativo.json`, `.accessible-base/admin_cotizaciones.json`, `.accessible-base/manifest.json`, `docs/team/SHEETS-ACCESSIBLE-BASE.md`, `docs/google-sheets-module/MAPPER-PRECISO-PLANILLAS-CODIGO.md`

**Validated:** CRM_Operativo (BMC_SHEET_ID `1N-4kyT_uSPSVnu5tMIc6VzFIaga8FHDDEDGcclafRWg`), Admin 2.0 (WOLFB_ADMIN_SHEET_ID), snapshot colMaps in sync script.

---

## Result: GAPS FOUND

The core mapping is internally consistent within each layer. However, four concrete gaps exist between documentation, the sync script colMap, and/or live runtime behavior.

---

## Gap 1 — admin_cotizaciones column shift (doc stale by one column)

**Severity:** Medium — agents or operators reading `SHEETS-ACCESSIBLE-BASE.md` get wrong column letters.

| Source | H | I | J | K | L |
|--------|---|---|---|---|---|
| `SHEETS-ACCESSIBLE-BASE.md` | `consulta` | `respuesta` | `link_presupuesto` | `enviado` | — |
| `accessible-base-sync.js` (runtime) | — | `consulta` | `respuesta` | `link_presupuesto` | `enviado` |

The sync script carries an inline comment: _"Real layout confirmed by operator"_ and uses I=consulta, J=respuesta, K=link_presupuesto, L=enviado. The `.accessible-base/admin_cotizaciones.json` snapshot confirms the sync-script layout is live. The doc in `SHEETS-ACCESSIBLE-BASE.md` §3 is stale and shows columns shifted one position to the left.

**Fix needed:** Update `docs/team/SHEETS-ACCESSIBLE-BASE.md` §3 "Admin 2.0" table to match I/J/K/L layout.

---

## Gap 2 — CRM columns L–Q, U, X, Y absent from accessible-base snapshot

**Severity:** Low (snapshot is intentionally selective) — document as known blind spot.

The sync script `colMap` for `crm_operativo` extracts only these columns: B, C, D, E, F, G, H, I, J, K, W, AF, AG, AH, AI, AJ, AK.

Columns that are written to by live routes but not captured in the snapshot:

| Column range | Written by | Fields |
|---|---|---|
| L–Q | ML webhook (full row ingest) | Various ML metadata fields |
| R–T | Email ingest, WA webhook | `probabilidad_cierre`, `urgencia`, `validar_stock` |
| U | ML webhook | ML metadata |
| V–W | Email ingest | `tipo_cliente`, `observaciones` (W is captured) |
| X–AE | ML webhook | Extended ML fields up to AF |

Agents reading `.accessible-base/crm_operativo.json` cannot see data written to L–Q, R–T, U, or X–AE. This is acceptable for a targeted snapshot but means ML-enriched rows appear with those fields missing.

**No code fix required.** Document as known gap if agents need those fields in the future, the sync colMap must be extended.

---

## Gap 3 — `Monto estimado USD` / `MONTO_ESTIMADO` not in snapshot

**Severity:** Low.

`CRM_TO_BMC` in `bmcDashboard.js` maps header `"Monto estimado USD"` → `MONTO_ESTIMADO`. This field is returned by the live `/api/cotizaciones` endpoint but it is not included in the `accessible-base-sync.js` colMap for `crm_operativo`. The snapshot field set does not contain `monto_estimado`.

**Fix needed (if agents must read it offline):** Add the column letter for `"Monto estimado USD"` to the `colMap` in `scripts/accessible-base-sync.js` under the `crm_operativo` entry. The actual column letter must be verified in the live sheet (not derivable from code alone — the sync script uses letter-based mapping, not header-name matching, for CRM_Operativo).

---

## Gap 4 — `link_presupuesto` in snapshot contains numeric IDs, not URLs

**Severity:** Low (Sheets API limitation, not a code bug).

`server/lib/crmOperativoLayout.js` documents column AH (`LINK_PRESUPUESTO`) as _"URL al PDF o cotización (hyperlink en celda)"_. In `.accessible-base/crm_operativo.json`, every inspected row shows `"link_presupuesto": "44"` or `"link_presupuesto": "45"` — numeric strings, not URLs.

The Sheets API `values.get` returns the display text of a hyperlinked cell, not the underlying href. The numeric value is the text label the operator typed; the actual URL is embedded in the cell's hyperlink metadata and requires a different API call (`spreadsheets.get` with `includeGridData: true`).

**Implication:** Any agent or code reading `link_presupuesto` from the snapshot and expecting a URL will get a number. The live API route has the same limitation if it uses `values.get`.

**Fix needed (if URL is required):** Use `spreadsheets.get` with `includeGridData: true` to extract the hyperlink `uri` from the cell's `textFormatRun` or `hyperlink` property.

---

## Gap 5 — Three tabs failed to sync (manifest errors)

**Severity:** Medium — affected snapshots are absent or stale.

From `.accessible-base/manifest.json` (synced 2026-04-24T05:55):

| Sheet key | Error |
|-----------|-------|
| `master_cotizaciones` | `Unable to parse range: 'Master_Cotizaciones'` |
| `metas_ventas` | `Unable to parse range: 'Metas_Ventas'` |
| `audit_log` | `Unable to parse range: 'AUDIT_LOG'` |

These tabs do not exist in the live workbook under those exact names, or the service account lacks read access, or the tab names differ (case/accents/spacing). The snapshot files for these three are absent. Any agent or offline process relying on them gets empty data.

**Fix needed:** Verify the actual tab names in the Google Sheets workbook for `BMC_SHEET_ID`. If they differ from `Master_Cotizaciones`, `Metas_Ventas`, or `AUDIT_LOG`, update the `tab` field in the REGISTRY entries of `scripts/accessible-base-sync.js`. If access is the issue, grant the service account read permission on those tabs.

---

## Consistent mappings (no action required)

| Area | Status |
|------|--------|
| `crmOperativoLayout.js` AG–AK vs sync colMap | Aligned — AG=`provider_ia`, AH=`link_presupuesto`, AI=`aprobado_enviar`, AJ=`enviado_el`, AK=`bloquear_auto` |
| `CRM_TO_BMC` in `bmcDashboard.js` vs `MAPPER-PRECISO-PLANILLAS-CODIGO.md` | Aligned — all 12 mapped headers match |
| `mapPagos2026ToCanonical` vs MAPPER-PRECISO §2 | Aligned |
| `mapVentas2026ToCanonical` vs MAPPER-PRECISO §3 | Aligned |
| `mapStockEcommerceToCanonical` vs MAPPER-PRECISO §4 | Aligned |
| CRM header row (row 3, `headerRowOffset: 2`) | Consistent across `bmcDashboard.js`, `crmOperativoLayout.js` (HEADER_ROW=3), and sync script (`headerRow: 2` 0-indexed) |
| CRM first data row (row 4) | Consistent across all three sources |
| `FIRST_DATA_ROW = 4` in `crmOperativoLayout.js` used in route guards | Correct |
| Pagos workbook — first tab, header row 1 | Consistent |
| Stock workbook — first tab, header row 3 (`headerRowOffset: 2`) | Consistent |
| Ventas workbook — all tabs, header row 2 (`headerRowOffset: 1`) | Consistent |

---

## Action summary

| # | Gap | Owner | Action |
|---|-----|-------|--------|
| 1 | Admin_cotizaciones col shift in docs | bmc-docs-sync | Update `SHEETS-ACCESSIBLE-BASE.md` §3 to I/J/K/L |
| 2 | CRM L–Q, U, X–AE absent from snapshot | bmc-sheets-mapping | Document; extend colMap if agents need those fields |
| 3 | `monto_estimado` absent from snapshot | bmc-sheets-mapping | Add column letter + field to sync script colMap when column letter is confirmed |
| 4 | `link_presupuesto` returns numeric label not URL | bmc-api-contract | Clarify contract; fix via `includeGridData` if URL required |
| 5 | Three tabs fail to sync (tab name mismatch) | bmc-deployment | Verify live tab names; correct sync script REGISTRY |
