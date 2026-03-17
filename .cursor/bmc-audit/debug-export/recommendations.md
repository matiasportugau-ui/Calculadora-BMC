# Recommendations

- If API not responding: npm run start:api
- If .env missing: copy from .env.example
- If service-account missing: download from GCP, save to docs/bmc-dashboard-modernization/
- If cotizaciones fails: verify BMC_SHEET_ID and share sheet with service account
- For persistent logs: node server/index.js 2>&1 | tee server.log
Resumen: revisar secciones anteriores. Recomendaciones:
- Si API no responde: npm run start:api
- Si .env falta: copiar de .env.example
- Si service-account falta: descargar de GCP, guardar en docs/bmc-dashboard-modernization/
- Si cotizaciones falla: verificar BMC_SHEET_ID y compartir sheet con service account
- Para logs persistentes: node server/index.js 2>&1 | tee server.log
