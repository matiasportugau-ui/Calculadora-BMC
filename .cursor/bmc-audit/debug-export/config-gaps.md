# Config Gaps
 M .env.example
## Config (.env + service-account)
.env existe. Vars (valores ocultos):
BMC_SHEET_ID=***
GOOGLE_APPLICATION_CREDENTIALS=***
ML_CLIENT_ID=***
ML_CLIENT_SECRET=***
service-account.json: OK (JSON válido)
.env
.env.local
**/service-account*.json
docs/bmc-dashboard-modernization/service-account.json
.env.development.local
.env.test.local
.env.production.local
BMC_SHEET_ID: 1N-4kyT_uSPSVnu5tMIc6VzFIaga8FHDDEDGcclafRWg
- Si .env falta: copiar de .env.example
- Si service-account falta: descargar de GCP, guardar en docs/bmc-dashboard-modernization/
- Si cotizaciones falla: verificar BMC_SHEET_ID y compartir sheet con service account
