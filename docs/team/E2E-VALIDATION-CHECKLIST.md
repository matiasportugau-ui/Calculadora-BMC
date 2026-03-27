# E2E Validation Checklist — Dashboard BMC

**Owner:** Audit/Debug + Matias  
**Referencia:** IMPLEMENTATION-PLAN-POST-GO-LIVE.md §D1  
**Última actualización:** 2026-03-27 (plan PROJECT-STATE — smoke + curls prod)

Completar antes de presentar el dashboard a usuarios finales. Marcar con ✓ cuando se verifique.

---

## URLs producción (opcional — mismo checklist sustituyendo base URL)

| Entorno | Base URL | Notas |
|---------|----------|--------|
| **Cloud Run** | `https://panelin-calc-642127786762.us-central1.run.app` (o la URL actual de `gcloud run services describe panelin-calc`) | API: `<BASE>/api/...`; Calculadora: `<BASE>/calculadora`; Finanzas: `<BASE>/finanzas`. |
| **Vercel** | `https://calculadora-bmc.vercel.app` | Front calculadora; API debe apuntar a Cloud Run (`VITE_API_URL`) para datos Sheets. |

Ejemplo: `curl -sS -o /dev/null -w "%{http_code}" "https://…/health"` o `/api/kpi-report` (esperar 200 o 503 según config).

### Smoke automatizado (repo)

Desde la raíz del repo (sin levantar API local):

```bash
npm run smoke:prod
```

Comprueba `GET /health` (200 + `{ ok: true }`), `GET /capabilities` (200), `GET /auth/ml/status` (200 si hay token ML, **404** si aún no hay OAuth — ambos aceptables). Base URL: variable `BMC_API_BASE` o `SMOKE_BASE_URL`, o por defecto la Cloud Run del checklist. Salida JSON: `npm run smoke:prod -- --json`. Script: [`scripts/smoke-prod-api.mjs`](../../scripts/smoke-prod-api.mjs). En CI (push/PR a `main`): el job **`channels_pipeline`** en [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) ejecuta el pipeline ampliado (`channels:automated`: smoke + programa + humanGate).

### Resultados smoke — 2026-03-20 (curl, red pública)

Base **Cloud Run:** `https://panelin-calc-642127786762.us-central1.run.app`

| Ruta | HTTP | Nota |
|------|------|------|
| `/health` | 200 | Servicio vivo |
| `/api/kpi-report` | 503 | Sheets/credenciales no disponibles o no configurados en deploy — **esperable** (no 404) |
| `/api/cotizaciones` | 503 | Idem |
| `/api/kpi-financiero` | 503 | Idem |
| `/calculadora/` | 200 | SPA calculadora |
| `/finanzas/` | 200 | Dashboard finanzas |

**Vercel:** `https://calculadora-bmc.vercel.app` → `/` y `/calculadora/` **200**.

*Ejecutado por agente (Pista 2 — [SOLUCIONES-UNO-POR-UNO-2026-03-20.md](./plans/SOLUCIONES-UNO-POR-UNO-2026-03-20.md)).*

### Resultados smoke — run34 (2026-03-20, curl red pública)

| Origen | Ruta | HTTP | Nota |
|--------|------|------|------|
| **Cloud Run** | `/health` | 200 | Servicio vivo |
| **Cloud Run** | `/api/kpi-report` | 503 | Sheets no config en deploy — esperable |
| **Cloud Run** | `/api/cotizaciones` | 503 | Idem |
| **Cloud Run** | `/api/kpi-financiero` | 503 | Idem |
| **Cloud Run** | `/calculadora/`, `/finanzas/` | 404 | Revisar base path / deploy si se esperaban SPAs aquí |
| **Vercel** | `/`, `/calculadora/` | 200 | SPAs OK |

*Run34 (handoff itinerante): re-validación post-run33; APIs 503 coherente; Vercel 200; Cloud Run SPAs 404 — anotar para Networks si se requiere calculadora/finanzas en Cloud Run.*

### Resultados — 2026-03-27 (plan ejecución, curls red pública)

Base **Cloud Run (canónica smoke):** `https://panelin-calc-q74zutv7dq-uc.a.run.app`

| Ruta | HTTP | Nota |
|------|------|------|
| `/health` | 200 | Servicio vivo |
| `/api/kpi-report` | 200 | Sheets/credenciales operativos en prod (antes 503 en run34) |
| `/api/cotizaciones` | 503 | Workbook/tabs o permisos no disponibles para este endpoint en el deploy verificado — revisar `BMC_SHEET_ID` / tabs CRM vs expectativa |
| `/calculadora/` | 200 | SPA calculadora |
| `/finanzas/` | 200 | Dashboard finanzas |

**Smoke `npm run smoke:prod` (misma base):** OK — `/health`, `/capabilities`, `public_base_url` alineado, `GET /api/actualizar-precios-calculadora` (CSV MATRIZ), `/auth/ml/status` 404 sin token ML, `POST /api/crm/suggest-response` 200.

**Reconciliación MATRIZ (duplicados `path` en CSV prod):** `curl -sS BASE/api/actualizar-precios-calculadora | node scripts/reconcile-matriz-csv.mjs - --json` → `ok: false`, `duplicatePathCount` > 0 (limpiar filas duplicadas en planilla BROMYROS o acordar regla de import). El `-` es obligatorio para leer desde stdin.

**Operador run 55 / gates:** [`RUN55-OPERATOR-CHECKLIST.md`](./RUN55-OPERATOR-CHECKLIST.md).

---

## Pre-requisitos

- [ ] Servidor API corriendo (`npm run start:api` o equivalente)
- [ ] Workbook principal compartido con la service account (email del JSON de credenciales)
- [ ] .env con BMC_SHEET_ID (y workbooks adicionales si aplica)

---

## Checklist E2E

| ID | Check | Cómo verificar | Estado |
|----|-------|----------------|--------|
| D1.1 | Compartir workbook principal con service account | En Google Drive: compartir el workbook con el email del service account (lectura/escritura según necesidad) | ⬜ |
| D1.2 | /api/cotizaciones con datos reales | `curl http://localhost:3001/api/cotizaciones` → 200 y array con al menos un elemento (o 503 si Sheets no disponible) | ⬜ |
| D1.3 | /api/kpi-financiero retorna monedas reales | `curl http://localhost:3001/api/kpi-financiero` → 200 y payload con monedas/periodos | ⬜ |
| D1.4 | /api/kpi-report 200 | `curl http://localhost:3001/api/kpi-report` → 200 (o 503 si Sheets no configurado). Si 404: reiniciar servidor (ruta existe en bmcDashboard.js línea ~1130, montada en /api). | ⬜ |
| D1.5 | Marcar entregado en UI → verificar en Sheet | En dashboard #operaciones: "Marcar entregado" en una fila → abrir la Sheet y comprobar que el estado/campo se actualizó | ⬜ |
| D1.6 | Notificaciones bell → verificar datos | Clic en campana; ver que cargan notificaciones (o mensaje vacío si no hay) | ⬜ |
| D1.7 | Calculadora 5173 → PDF → Drive | Abrir Calculadora (puerto 5173); generar PDF; verificar que aparece en Google Drive configurado | ⬜ |
| D1.8 | Shopify webhook test | Si aplica: enviar webhook de prueba; verificar que se recibe y se procesa (o documentar skip) | ⬜ |

---

## Notas

- **kpi-report 404:** La ruta está definida en `server/routes/bmcDashboard.js` y el router se monta en `server/index.js` como `app.use("/api", createBmcDashboardRouter(config))`. Si el servidor se inició antes de añadir la ruta, hace falta reiniciar.
- **503:** Respuesta esperada cuando Sheets no está configurado o no hay credenciales; no es fallo de ruta.
- Al completar, actualizar PROJECT-STATE (Pendientes) y opcionalmente JUDGE si fue run formal.
