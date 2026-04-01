# Producción canónica — Calculadora Panelin BMC

**Fuente única** para la decisión de arquitectura oficial de la Calculadora en producción. Complementa [`README.md`](./README.md) y el runbook [`docs/procedimientos/PROCEDIMIENTO-CALCULADORA-Y-API-CLOUD-RUN-COMPLETO.md`](../procedimientos/PROCEDIMIENTO-CALCULADORA-Y-API-CLOUD-RUN-COMPLETO.md).

---

## Decisión

| Rol | Entorno |
|-----|---------|
| **Producción oficial (canónico)** | **Google Cloud Run** — servicio unificado que sirve **SPA + API** en el mismo origen |
| **Secundario / transición** | **Vercel** — solo frontend; requiere `VITE_API_URL` hacia Cloud Run y otro ciclo de deploy/OAuth |

**Modo documentado en el repo:** **B — GCP unificado** (recomendado en el procedimiento). Modo **A — Vercel + Cloud Run** sigue soportado para previews o migración, **no** como narrativa operativa principal.

---

## Por qué Cloud Run unificado

- **Un solo deploy** y una sola URL base para health, MATRIZ CSV, `/calculadora/`, `/api/*`.
- **Same-origin API:** la imagen oficial (`Dockerfile.bmc-dashboard`) usa `VITE_SAME_ORIGIN_API=1` y `VITE_BASE=/calculadora/`; el cliente resuelve la API vía [`src/utils/calcApiBase.js`](../../src/utils/calcApiBase.js) sin `VITE_API_URL` embebido en el bundle de prod unificado.
- **Smoke y pre-deploy** del repo están alineados a esa base (`npm run smoke:prod`, `npm run pre-deploy`).
- **Menos drift:** un solo conjunto de CORS/orígenes OAuth para Drive cuando se incluye en el alcance; Vercel + Cloud Run duplica variables, orígenes JS y riesgo de desalineación.

---

## URLs y artefactos (referencia; confirmar en deploy)

- **Calculadora (ejemplo histórico en docs):** `https://panelin-calc-q74zutv7dq-uc.a.run.app/calculadora/`
- **Salud:** `{BASE}/health`
- **MATRIZ CSV:** `{BASE}/api/actualizar-precios-calculadora`
- **URL real del servicio:** `gcloud run services describe panelin-calc --region=us-central1 --project=chatbot-bmc-live --format='value(status.url)'`

---

## Vercel en esta narrativa

Vercel queda como **alternativa** (frontend estático + API remota). Documentación específica: [`docs/VERCEL-CALCULADORA-SETUP.md`](../VERCEL-CALCULADORA-SETUP.md). No reemplaza la definición de producción canónica anterior.

---

## Google Drive en producción unificada

Si **Drive** forma parte del alcance del release oficial, el build debe incluir `VITE_GOOGLE_CLIENT_ID` y en Google Cloud Console los **Authorized JavaScript origins** deben incluir la **URL base del servicio Cloud Run** (sin path), no solo `localhost` o Vercel. Ver sección correspondiente en el procedimiento Cloud Run completo.

---

*Última actualización documental: 2026-03-31.*
