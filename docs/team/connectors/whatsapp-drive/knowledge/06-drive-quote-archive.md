# Drive quote archive

Drive hoy es **persistencia de cotizaciones**, no un corpus RAG.

## Archivo empresa (server)

Tras exportar PDF en la calculadora: `archiveQuotationToCompanyDrive` (`src/utils/companyDriveArchive.js`) → `POST /api/quotes/drive-archive`.

- Auth: `requireServiceOrUser` (no write anónimo).
- Router: `server/routes/quoteDriveArchive.js`.
- Guarda PDF + `{code}.bmc.json` bajo `DRIVE_QUOTE_FOLDER_ID` → carpeta cliente → carpeta código.
- Límites: PDF 12 MiB, JSON 4 MiB. Requiere `quotationCode`.
- `GET /api/quotes/drive-project?folderId=` carga el `.bmc.json` con OAuth **server** (deep-link `?openDrive=`). Sin JWT BMC; folder id = secreto por oscuridad.

`/calc/cotizar/pdf` también puede escribir el bundle (best-effort) si hay usuario + folder.

HTML mirrors (wolfboard / superAgent): `uploadQuoteToDrive` — a menudo archivos **flat** en el root de quotes, permiso `anyone:reader`.

## Drive personal (GIS browser)

El operador inicia sesión y guarda en su Drive:

- PDF + `{code}.bmc.json` en `cliente → código`.
- Lista / carga / borra carpetas de cotización.
- Coordinaciones logística: `BMC Envíos Coordinaciones/{ENV}.bmc-envios.json` (`bmc-envios-draft-v1`). Tests: `tests/enviosDrive.test.js`.

## Qué hay en `.bmc.json`

Estado reanudable del proyecto (inputs de calculadora + meta `quotationCode`). Sirve para **reabrir** la cotización, no para entrenar el modelo WA.

## Rutas

| Método | Ruta | Auth |
|--------|------|------|
| GET | `/api/drive/config` | JWT BMC |
| POST | `/api/drive/config` | JWT BMC |
| POST | `/api/quotes/drive-archive` | service or user |
| GET | `/api/quotes/drive-project?folderId=` | none (obscurity) |
| POST | `/calc/cotizar/pdf` | optional user |
| POST | `/api/envios/adjunto-fetch` | envíos auth |

No hay webhook de Drive. No hay job que indexe Drive hacia Training KB.
