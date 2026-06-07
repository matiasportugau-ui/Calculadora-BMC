# BMC Uruguay — Auditoría Técnica MAESTRO (2026-06-07)

Auditoría exhaustiva **read-only** de Calculadora-BMC (METALOG SAS). Construye sobre la
auditoría previa de `.relevamiento/matriz/` (2026-04-23), que no tenía acceso a `gh` / `gcloud` / Drive.
Esta corre **con** esos accesos (GitHub MCP, Google Drive MCP, probe HTTP en vivo a Cloud Run).

## Deliverables

| Archivo | Qué es |
|---|---|
| `BMC-MAESTRO-AUDIT.xlsx` | **Google Sheet MAESTRO** (8 tabs). Subir a Drive y abrir → se convierte en Google Sheet. |
| `dashboard.html` | Dashboard visual de resumen (abrir en navegador). |
| `audit-metadata.json` | Reporte completo machine-readable. |
| `MAESTRO_data/*.csv` | Un CSV por tab (importables individualmente). |
| `build_maestro.py` | Generador (fuente única; `python3 audit/build_maestro.py` regenera todo). |

### Tabs del MAESTRO
`00_Overview` · `01_Infraestructura` · `02_Sheets_Analysis` · `03_Repo_Analysis` ·
`04_Endpoints` · `05_Security_Findings` · `06_Critical_Questions` · `07_Recommendations`

### Cómo crear el Google Sheet MAESTRO
No hay API de escritura de Sheets disponible en este entorno, así que el MAESTRO se entrega como `.xlsx`:
1. Subir `audit/BMC-MAESTRO-AUDIT.xlsx` a la carpeta de Drive `1acJ_FV7qATEe9p6zlwvq7dc4_qTAKrs-`.
2. Click derecho → Abrir con → Hojas de cálculo de Google (o Archivo → Importar). Mantiene los 8 tabs.

## Hallazgos cabecera

- **Prod = main.** Cloud Run `panelin-calc` HTTP 200, gitSha desplegado `3153b11` == `main` local. `hasSheets=true`, `hasTokens=true`. **`missingConfig: ML_CLIENT_SECRET`**.
- **3 hallazgos CRÍTICOS de seguridad** — el principal: **C1** `.accessible-base/crm_operativo.json` (297 leads + teléfonos) commiteado al repo (no en `.gitignore`).
- **~226 endpoints** (~70 públicos); writes a Sheets de producción **sin auth** (`POST /api/cotizaciones`, `/pagos`, `/ventas`, `/marcar-entregado`, `PUT /api/productos-maestro/links`) y `GET /api/crm/cockpit-token` devuelve el bearer.
- **8 Sheets** con problemas: MATRIZ con SKUs duplicados + `#REF!`; Stock con 106 `#REF!`; `crm_automatizado` ≈ `CALENDARIO` duplicados; lifecycle de venta fragmentado en 3 libros.
- **P3 y P4 resueltas en vivo**; P1/P2 con respuesta recomendada; **P5 sigue abierta**.

## Constraints respetadas
- Read-only: no se mutó ningún dato fiscal ni Sheet.
- Sin secretos/tokens/credenciales en los reports (redactados).
- Sin PII de clientes (nombres/teléfonos redactados; conteos solamente).
- La remediación de C1 (purgar git history) se deja como **recomendación** para el dueño — no se reescribió historia ni se borraron archivos trackeados sin aprobación.
