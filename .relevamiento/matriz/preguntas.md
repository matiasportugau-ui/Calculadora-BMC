# PREGUNTAS CERRADAS AL DUEÑO — Parte 4

**Fecha:** 2026-04-23
**Formato:** máximo 5 preguntas cerradas (a/b/c). Respuestas permiten bajar dudas abiertas a hechos.

---

## P1. Modelo de deploy canónico de la API + frontend

Hoy conviven tres modelos (ver `conflictos.md` #1). ¿Cuál es el oficial?

- **(a)** Dos servicios separados vía GitHub Actions: `panelin-calc` (API, workflow `deploy-calc-api.yml`) + `panelin-calc-web` (frontend nginx, `deploy-frontend.yml`). Artifact Registry.
- **(b)** Servicio único full-stack `panelin-calc` vía Cloud Build manual (`Dockerfile.bmc-dashboard` + `cloudbuild.yaml`). GCR (legacy).
- **(c)** Frontend en Vercel (`calculadora-bmc.vercel.app`) + API sola en Cloud Run `panelin-calc`. Cloud Run frontend (`panelin-calc-web`) queda inactivo o como fallback.
- **(d)** Otra combinación — especificar.

---

## P2. Master de precios activo

¿Cuál es el master canónico para la calculadora hoy?

- **(a)** Google Sheet **`1oDMkBgWxX7cu7TpSvuO30tCTUWl68IBDhC4cQTP79Xo`** (MATRIZ de COSTOS y VENTAS 2026), consumido vía `GET /api/actualizar-precios-calculadora`. `src/data/constants.js` queda como fallback solo.
- **(b)** `src/data/constants.js` hardcodeado en el código. La MATRIZ sirve sólo de referencia contable, no modifica el runtime de la calc.
- **(c)** Ambos con sincronización esperada y tolerancia a drift (estado actual de facto).
- **(d)** Otro — especificar.

---

## P3. Schema CRM activo en producción

La API admite dos layouts del workbook `1N-4kyT_uSPSVnu5tMIc6VzFIaga8FHDDEDGcclafRWg` según `BMC_SHEET_SCHEMA`. ¿Cuál está configurado en Cloud Run hoy?

- **(a)** `CRM_Operativo` (default en código; tab "CRM_Operativo" + AUDIT_LOG + Parametros).
- **(b)** `Master_Cotizaciones` (schema alternativo; tabs "Master_Cotizaciones" + "Ventas realizadas y entregadas").
- **(c)** Ambos (lectura dual; no soportado oficialmente según código pero practicado).
- **(d)** No sé, hay que verificar en Cloud Run — requiere `gcloud run services describe`.

---

## P4. Estado de los repos hermanos

¿Cuáles de estos son realmente vivos hoy?

Lista referenciada en `.env.example` + docs:
```
GPT-Panelin-Calc, bmc-dashboard-2.0, bmc-development-team, conexion-cuentas-email-agentes-bmc,
Calculadora-BMC-GPT, GPT-PANELIN-V3.2, aistudioPAnelin, 2026_Mono_rep, ChatBOT,
Chatbot-Truth-base--Creation, bmc-cotizacion-inteligente, chatbot-2311
```

- **(a)** Sólo `GPT-Panelin-Calc` + `bmc-dashboard-2.0` + `bmc-development-team` (los 3 que están en `.env.example` como `BMC_DASHBOARD_2_REPO` / `BMC_DEVELOPMENT_TEAM_REPO` / `BMC_EMAIL_INBOX_REPO`).
- **(b)** Todos vivos, cada uno con rol específico.
- **(c)** La mayoría archivados/experimentales; operación real vive solo en `calculadora-bmc`.
- **(d)** Hace falta listar con `gh repo list matiasportugau-ui` desde un entorno con auth. (Nota: desde este entorno no se pudo).

---

## P5. Master Apps Script (.gs) — ¿el código del repo coincide con el que corre?

5 `.gs` existen en `docs/bmc-dashboard-modernization/` pero no hay pipeline automatizado de deploy.

- **(a)** Sí, siempre sincronizo manualmente con `clasp push` u otro flujo; el repo es la verdad.
- **(b)** No, la verdad vive en Apps Script bound al workbook; los `.gs` del repo son snapshots viejos.
- **(c)** Hay divergencia conocida que nadie reconcilió — necesita audit manual del Apps Script en el proyecto bound.
- **(d)** Otro — especificar.
