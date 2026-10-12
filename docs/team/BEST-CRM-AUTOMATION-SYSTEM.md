# Best commercial system BMC can run now

One sentence: keep two books, let inbound land a Pendiente row on Admin by itself, draft in the API, and leave every customer send, money row, and schema change behind a person.

This file is a design. It changes no spreadsheet, no flag, and no branch.

## Books

| Book | Id | Role in this loop |
|---|---|---|
| BMC crm_automatizado | `1N-4kyT_uSPSVnu5tMIc6VzFIaga8FHDDEDGcclafRWg` | Lead and quote book. Live tabs include Form responses 1, CRM_Operativo, Metas_Ventas, AUDIT_LOG. Master_Cotizaciones is absent. |
| 2.0 - Administrador de Cotizaciones | `1Ie0KCpgWhrGaAKGAS1giLo7xpqblOUOIHEg1QbOQuu0` | HITL queue. Tab `Admin.` |
| Pagos pendientes Dashboard | `1AzHhalsZKGis_oJ6J06zQeOb6uMQCsliR82VrSKUUsI` | Collection book. Live first tab is `Pendientes_`. |
| 2.0 - Ventas Dashboard | `1KFNKWLQmBHj_v8BZJDzLklUtUPbNssbYEsWcmc0KPQA` | Delivery book. Live tab `Ventas Realizadas y Entegadas`. |
| Stock E-Commerce Dashboard | `1egtKJAGaATLmmsJkaa2LlCv3Ah4lmNoGMNm4l0rXJQw` | Stock. Not a step in the quote send loop. |
| CALENDARIO DE VENCIMIENTOS Dashboard | `1bvnbYq7MTJRpa6xEHE5m-5JcGNI9oCFke3lsJj99tdk` | Calendar. Not a step in the quote send loop. |

`hecho confirmado`: Cloud Run service `panelin-calc`, revision `panelin-calc-01133-59r`, has `BMC_SHEET_ID` and `WOLFB_ADMIN_SHEET_ID` equal to the two ids above. `WOLFB_CRM_SHEET_ID` is unset, so the CRM side is `BMC_SHEET_ID`. `ADMIN_INBOUND_ROWS=true`. `WOLFB_DRY_RUN` is unset. `WOLFB_ADMIN_COT_DUAL_WRITE` is unset. `origin/main` `server/config.js` defaults `adminInboundRows` to false and `wolfbAdminCotDualWriteEnabled` to false. The production variable is what turns inbound on. Empty stays off.

`hecho confirmado`: this checkout is `feat/panelin-front-idle-closeout` and does not contain `ADMIN_INBOUND_ROWS`. The route and the flag live on `origin/main` (`server/lib/adminInboundRow.js`, `server/routes/hitlBoard.js`, `.github/workflows/deploy-calc-api.yml`).

## Step table

| Step | Current system | Sheet, tab, route, or flag | Mode | Evidence |
|---|---|---|---|---|
| Channel capture | `appendAdminInboundRow` writes one Admin row per WhatsApp, Mercado Libre, Facebook, Instagram, or email message. Estado cell is `Pendiente`. Dedupe is column C. | Admin `1Ie0KCpgWhrGaAKGAS1giLo7xpqblOUOIHEg1QbOQuu0`, tab `Admin.`. Flag `ADMIN_INBOUND_ROWS` (on in `panelin-calc-01133-59r`). Code: `origin/main` `server/lib/adminInboundRow.js`. | Automatic behind a flag that already exists, and that flag is on in production. | `hecho confirmado` |
| One CRM card | CRM_Operativo exists. Mercado Libre sync can write CRM rows (`server/lib/mlWebhookService.js` calls `syncMLCRM` when `bmcSheetId` is set). Admin inbound does not write this tab. No repo path turns every Admin row into one CRM card. | CRM `1N-4kyT_uSPSVnu5tMIc6VzFIaga8FHDDEDGcclafRWg`, tab `CRM_Operativo`. Form responses 1 is a separate tab on the same book. | Not automatic for a single card across channels. | `duda abierta` for Form responses 1 → CRM_Operativo. `hecho confirmado` that inbound append does not create the CRM card. |
| Admin queue | The Pendiente row is the queue. `GET /api/hitl/board` and Wolfboard `GET /pendientes` read tab `Admin.`. | Same Admin book and tab. Routes on `origin/main`: `server/routes/hitlBoard.js`, `server/routes/wolfboard.js`. | Automatic today as a read of rows inbound already wrote. | `hecho confirmado` |
| Draft | `POST /api/crm/suggest-response` returns text. It does not send. `POST /crm/cockpit/save-response` can store that text on CRM column AF (`respuestaSugerida`). The hub calls suggest per row from `src/hooks/useAdminCotizaciones.js`. Nothing in inbound calls it. | `server/routes/bmcDashboard.js`. CRM column AF via `server/lib/crmRowParse.js` (`get(31)`). | Human-gated. The route exists. A person or a clicked hub action starts it. | `hecho confirmado` |
| Human copy-send | `POST /api/hitl/row/update` may write Admin column J (`respuesta`), K (`link`), L (`estado`), or M. It does not call WhatsApp, Mercado Libre, Instagram, Messenger, or email. `POST /crm/cockpit/send-approved` can send only after `aprobadoEnviar` is Sí, the row is not already stamped, and `bloquearAuto` is not Sí. ML `autoAnswerPipeline` can post `/answers` only when `autoMode.fullAuto` is true. That flag defaults to false in `server/index.js` and is a local file that Cloud Run does not keep. | Admin book for the cola write. CRM book for send-approved. `server/lib/mlAutoAnswer.js`. | Human-gated. A drafted J or AF value is not a send. | `hecho confirmado` |
| Sent mark | After a successful send-approved, the handler writes CRM `Enviado el`. It does not move the Admin row onto the Enviados tab. Dual-write is off. | CRM `1N-4kyT_uSPSVnu5tMIc6VzFIaga8FHDDEDGcclafRWg`, tab `CRM_Operativo`, column written by `handleCrmCockpitSendApproved` in `server/routes/bmcDashboard.js`. | Human-gated. The stamp follows the approved send. Who moves Admin to Enviados has no citation. | `hecho confirmado` for the CRM stamp. `duda abierta` for the Admin Enviados move. |
| Delivery or collection | `POST /api/ventas/logistica-entregado` updates a venta only with `requireCrmCockpitWrite`. No cited job appends `Pendientes_` or `Ventas Realizadas y Entegadas` from an Admin row. | Ventas `1KFNKWLQmBHj_v8BZJDzLklUtUPbNssbYEsWcmc0KPQA`, tab `Ventas Realizadas y Entegadas`. Pagos `1AzHhalsZKGis_oJ6J06zQeOb6uMQCsliR82VrSKUUsI`, tab `Pendientes_`. Route: `server/routes/bmcDashboard.js`. | Human-gated. | `hecho confirmado` for the auth gate. `duda abierta` for any sheet-only formula that might still copy rows. |

## Admin row 1, read on this run

`hecho confirmado`: `'Admin.'!A1:L1` on `1Ie0KCpgWhrGaAKGAS1giLo7xpqblOUOIHEg1QbOQuu0` is:

| Col | Header read |
|---|---|
| A | a Drive file URL, not a field name |
| B | Asig. |
| C | Estado |
| D | Fecha |
| E | Cliente |
| F | Origen |
| G | Telefono-Contacto |
| H | Direccion / Zona |
| I | Consulta |
| J | Interpretacion AI |
| K | Respuesta AI |
| L | Datos Faltantes |

`hecho confirmado`: `server/routes/wolfboard.js` `mapAdminSheetRow` still treats I as consulta, J as respuesta, K as link, and L as estado. `origin/main` `server/lib/hitlAdminBoard.js` writes respuesta to J, link to K, and estado to L.

Those two code maps and this header disagree. The older sentence "I consulta, J respuesta, K link, L enviado" is not what row 1 says now. J on the sheet is Interpretacion AI. K is Respuesta AI. L is Datos Faltantes. A HITL patch of `respuesta` therefore lands in the column whose header says Interpretacion AI. This design does not write a cell to correct that.

`inferencia`: until a person decides which header is the operational contract, the safe reply column to show an operator is K (Respuesta AI), and the safe missing-data column is L. Basis: the header text, not the positional code map.

## Zero-human loop

No.

Customer send does not already run with no person. The cola write saves a cell. `send-approved` refuses to send until `aprobadoEnviar` is Sí. ML full-auto exists in code and defaults off.

Money or delivery rows do not already run with no person. `logistica-entregado` requires an authenticated cockpit write. No cited path fills `Pendientes_` or `Ventas Realizadas y Entegadas` from a new Admin message.

Schema or Apps Script changes do not already run with no person. `ALLOW_SCHEMA_CREATE` is absent on `origin/main`. The bound script is still a manual function on the CRM book. Its header still says to paste it into the Admin workbook. That header is the wrong book.

The smallest remaining human gate is one approval: a person sets Aprobado enviar to Sí and then `POST /crm/cockpit/send-approved` may leave BMC. The cola dashboard does not make that call. Copying the reply into the original app is the same gate, done by hand.

Removing that person is unsafe with the current controls. The only unattended sender is ML `fullAuto`, it is off, it does not cover the other channels, and it does not guard price, stock, or the header mismatch above. Money rows and schema edits have no unattended control that is safe to leave on.

## Still human

- Approving a customer-facing send (`aprobadoEnviar` = Sí, or copying the reply out of the dashboard).
- Choosing the reply text when suggest-response was not clicked.
- Deciding which Admin column is the reply after the row-1 conflict.
- Creating the single CRM_Operativo card for a non-ML inbound row.
- Moving an Admin row to Enviados.
- Writing delivery on `Ventas Realizadas y Entegadas` and collection on `Pendientes_`.
- Any Apps Script run, tab create, or header rewrite.
- WhatsApp Cloud API registration and the short access token. Do not retry Graph with that token.

## Do not build

- Do not pick a winner among the three held copy-and-brake proposals. They stay registered and unchosen.
- Do not run `runInitialSetup`.
- Do not run `scripts/setup-sheets-tabs.js --crm-go-live`.
- Do not `files.copy` the live workbooks in this design.
- Do not Apps Script push.
- Do not merge #1320. Do not merge #1321. Do not merge #1318. Do not merge #1301.
- Do not turn on `WOLFB_ADMIN_COT_DUAL_WRITE`.
- Do not turn on ML `fullAuto` to fake a zero-human loop.
- Do not collapse the CRM book and the Admin book into one spreadsheet.
- Do not treat a drafted column J or column AF value as a message that already reached the customer.
- Do not bind `BMC_Dashboard_Automation` to the Admin workbook.
- Do not invent prices, accessories, or tax totals here.

## Conflicts left open

- `Metas_Ventas` and `AUDIT_LOG` are present on CRM `1N-4kyT_uSPSVnu5tMIc6VzFIaga8FHDDEDGcclafRWg` as of this read. Draft #1320 says they are absent. Do not merge #1320 to settle that. It is open, draft, and conflicting. The fresh tab list is the operational source for "are the tabs there." The PR text is not. No setup run closes the gap. `Master_Cotizaciones` is not on that book.
- Admin row 1 versus `wolfboard.js` and `hitlAdminBoard.js`, as written above.
- Checklist item 6.0 in `docs/bmc-dashboard-modernization/GO-LIVE-DASHBOARD-CHECKLIST.md` records `POST /api/crm/suggest-response` green on 2026-07-04 against revision `panelin-calc-00693`. That is a draft endpoint, not send authority. The live revision now is `panelin-calc-01133-59r`. This design does not tick the checklist.
- Local branch `feat/panelin-front-idle-closeout` does not contain the inbound and HITL files that `origin/main` has. Production is ahead of this checkout for that loop. Do not treat the dirty checkout as the only source.
