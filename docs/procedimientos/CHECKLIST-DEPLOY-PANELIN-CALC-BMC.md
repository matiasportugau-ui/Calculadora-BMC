# Checklist operativa — `panelin-calc` (BMC / Matias)

Lista corta con **valores concretos** que ya usa el repo. Los **secretos** (JSON de service account, `ML_CLIENT_SECRET`, tokens, etc.) **no** van acá: configurarlos solo en Cloud Run / Secret Manager / `.env` local.

**Runbook largo:** [`PROCEDIMIENTO-CALCULADORA-Y-API-CLOUD-RUN-COMPLETO.md`](./PROCEDIMIENTO-CALCULADORA-Y-API-CLOUD-RUN-COMPLETO.md).

**Mapa fases 0–9 (producción operativa “100%”, enlaces a runbooks):** [`PROCEDIMIENTO-PRODUCCION-OPERATIVA-100.md`](./PROCEDIMIENTO-PRODUCCION-OPERATIVA-100.md).

**Calculadora — decisión canónica y release:** [`docs/calculadora/CANONICAL-PRODUCTION.md`](../calculadora/CANONICAL-PRODUCTION.md), checklist producto [`docs/calculadora/RELEASE-CHECKLIST-CALCULADORA.md`](../calculadora/RELEASE-CHECKLIST-CALCULADORA.md), gaps pre-launch [`docs/calculadora/CALCULADORA-LAUNCH-GAPS.md`](../calculadora/CALCULADORA-LAUNCH-GAPS.md).

---

## Constantes del proyecto (repo)

| Qué | Valor |
|-----|--------|
| Proyecto GCP | `chatbot-bmc-live` |
| Región Cloud Run | `us-central1` |
| Servicio | `panelin-calc` |
| Imagen (Cloud Build) | `gcr.io/chatbot-bmc-live/panelin-calc` |
| URL canónica API (smoke / docs; **confirmar** con comando abajo) | `https://panelin-calc-q74zutv7dq-uc.a.run.app` |
| MATRIZ COSTOS/VENTAS 2026 (ID planilla; default en código si no seteás var) | `1oDMkBgWxX7cu7TpSvuO30tCTUWl68IBDhC4cQTP79Xo` |
| Calculadora en Cloud Run | `…/calculadora/` |
| Finanzas | `…/finanzas/` |
| Vercel (si usás modo A) | `https://calculadora-bmc.vercel.app` |

**Obtener la URL real del servicio (fuente de verdad):**

```bash
gcloud config set project chatbot-bmc-live
gcloud run services describe panelin-calc --region=us-central1 --format='value(status.url)'
```

Guardá el resultado como `BASE` para los checks de abajo.

---

## Fase 1 — Google Sheets (antes del deploy)

- [ ] Tenés el **email** de la service account que usa Cloud Run (termina en `gserviceaccount.com`).
- [ ] La planilla **MATRIZ** está compartida con ese email (al menos **lector**):  
  `https://docs.google.com/spreadsheets/d/1oDMkBgWxX7cu7TpSvuO30tCTUWl68IBDhC4cQTP79Xo`
- [ ] Si usás dashboard/API CRM: el workbook principal (`BMC_SHEET_ID` y tabs) también compartido con la misma cuenta (ver [`.env.example`](../../.env.example)).
- [ ] Decidido **dónde vive el JSON** en producción: Secret Manager montado como archivo / variable de entorno según tu deploy actual (no commitear el archivo).

---

## Fase 2 — Variables Cloud Run (`panelin-calc`)

En **Cloud Console → Cloud Run → panelin-calc → Editar y desplegar nueva revisión → Variables y secretos** (o `gcloud run services update`).

**Auditoría sin exponer valores** (solo nombres de variables; no pegues la salida de `describe` en chats ni captures con secretos visibles):

```bash
gcloud run services describe panelin-calc --region=us-central1 --project=chatbot-bmc-live --format=json \
  | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); (d.spec.template.spec.containers[0].env||[]).forEach(e=>console.log(e.name));"
```

**Mínimo para que “Cargar desde MATRIZ” funcione en `/calculadora/`:**

- [ ] `BMC_MATRIZ_SHEET_ID` = `1oDMkBgWxX7cu7TpSvuO30tCTUWl68IBDhC4cQTP79Xo` (u otro ID si la MATRIZ cambió de archivo).
- [ ] `GOOGLE_APPLICATION_CREDENTIALS` apunta a la **ruta válida dentro del contenedor** donde montaste el JSON (o el mecanismo que ya usen en este servicio).
- [ ] `NODE_ENV` = `production` (si no está ya).

**Resto según lo que usen en prod** (marcar lo que aplique):

- [ ] `BMC_SHEET_ID` y otros `BMC_*_SHEET_ID` (Finanzas, CRM, etc.)
- [ ] `PUBLIC_BASE_URL` = tu `BASE` sin barra final (OAuth ML / webhooks).
- [ ] `ML_CLIENT_ID`, `ML_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY`, storage de tokens (`ML_TOKEN_*`), etc. → [`docs/ML-OAUTH-SETUP.md`](../ML-OAUTH-SETUP.md)
- [ ] `API_AUTH_TOKEN` o `API_KEY` si usan cockpit / rutas protegidas.
- [ ] `WHATSAPP_*`, claves de IA, `SHOPIFY_*` si están en este mismo servicio.

**Sincronizar un subconjunto desde `.env` local (opcional, con cuidado):**

```bash
cd /ruta/a/Calculadora-BMC
./run_ml_cloud_run_setup.sh panelin-calc
```

### Fase 2b — Solo vos (manual): `GOOGLE_APPLICATION_CREDENTIALS` + MATRIZ en `panelin-calc`

**Atajo reproducible (CLI):** desde la raíz del repo, con `gcloud` autenticado y el secret ya creado en Secret Manager:

```bash
./scripts/cloud-run-matriz-sheets-secret.sh
```

Por defecto usa secret **`GOOGLE_APPLICATION_CREDENTIALS`**, montaje **`/secrets/sa-key.json`** y MATRIZ **`1oDMkBgWxX7cu7TpSvuO30tCTUWl68IBDhC4cQTP79Xo`**. Otro secret: `SECRET_NAME=tu-secret ./scripts/cloud-run-matriz-sheets-secret.sh`.

El endpoint `GET /api/actualizar-precios-calculadora` exige **ruta a un archivo JSON** que exista **dentro del contenedor** (`server/routes/bmcDashboard.js`). Si falta `GOOGLE_APPLICATION_CREDENTIALS` o el archivo no está montado, verás:

`MATRIZ sheet no configurado (BMC_MATRIZ_SHEET_ID, GOOGLE_APPLICATION_CREDENTIALS)`.

**Pasos (orden recomendado):**

1. **IAM → Service accounts:** identificá la cuenta que debe leer Sheets (mismo criterio que para `BMC_SHEET_ID`). Anotá el **email** `…@…gserviceaccount.com`.
2. **Sheets → MATRIZ:** compartí la planilla con ese email (**Lector** mínimo).  
   URL de referencia: `https://docs.google.com/spreadsheets/d/1oDMkBgWxX7cu7TpSvuO30tCTUWl68IBDhC4cQTP79Xo`
3. **Secret Manager** (proyecto `chatbot-bmc-live`): **Create secret** (ej. nombre `bmc-sheets-sa-json`). Valor = **contenido completo** del archivo JSON de clave de esa service account (no lo pegues en chats).
4. **Cloud Run → `panelin-calc` → Edit & deploy new revision:**
   - **Volumes → Add volume → Secret:** elegí el secret del paso 3; **mount path** fijo, ej. `/secrets`.
   - Tras guardar, la consola muestra la **ruta exacta del archivo** dentro del contenedor (suele ser algo como `/secrets/bmc-sheets-sa-json` o similar según nombre del secret).
5. **Variables:** agregá `GOOGLE_APPLICATION_CREDENTIALS` = esa **ruta exacta** (string, sin comillas raras).
6. **Variables (recomendado explícito):** `BMC_MATRIZ_SHEET_ID` = `1oDMkBgWxX7cu7TpSvuO30tCTUWl68IBDhC4cQTP79Xo` (o el ID real si cambió).
7. **Deploy** la revisión.
8. **Probar en terminal** (sin pegar secretos en ningún lado):

   ```bash
   BASE="$(gcloud run services describe panelin-calc --region=us-central1 --project=chatbot-bmc-live --format='value(status.url)')"
   curl -sS "$BASE/api/actualizar-precios-calculadora" | head -c 400
   ```

   Esperado: **CSV** (texto con `path`,…). Si aparece `Credenciales Google no encontradas`, la ruta de `GOOGLE_APPLICATION_CREDENTIALS` no coincide con el archivo montado.
9. **Navegador:** `$BASE/calculadora/` → Config → Listado de precios → **Cargar desde MATRIZ**.

**Seguridad:** si alguna vez volcaste variables de entorno con claves en un chat o log, **rotá** esas claves y migrá lo sensible a **Secret Manager** (no dejar API keys en env plano a largo plazo).

---

## Fase 3 — Build y deploy

Desde la raíz del repo **Calculadora-BMC**:

```bash
export GCLOUD_PROJECT=chatbot-bmc-live
export GCLOUD_REGION=us-central1
export GCLOUD_SERVICE=panelin-calc
./scripts/deploy-cloud-run.sh
```

- [ ] Cloud Build terminó sin error.
- [ ] `gcloud run deploy` terminó sin error.

**Solo redeploy** (misma imagen):

```bash
./scripts/deploy-cloud-run.sh --no-build
```

---

## Fase 4 — Verificación HTTP (sustituí `BASE`)

```bash
BASE="$(gcloud run services describe panelin-calc --region=us-central1 --project=chatbot-bmc-live --format='value(status.url)')"
echo "$BASE"
curl -sS "$BASE/health" | head -c 300
echo ""
curl -sS "$BASE/api/actualizar-precios-calculadora" | head -c 400
echo ""
```

- [ ] `GET $BASE/health` → **200**, JSON con `"ok":true`.
- [ ] `GET $BASE/api/actualizar-precios-calculadora` → **CSV** (líneas con `path`,…), **no** JSON `MATRIZ sheet no configurado`.

**Navegador:**

- [ ] Abrís `$BASE/calculadora/` → carga la UI.
- [ ] Config → Listado de precios → **Cargar desde MATRIZ** → mensaje de éxito (sin error de red).

**Smoke del repo (opcional):**

```bash
BMC_API_BASE="$BASE" npm run smoke:prod
```

- [ ] Pasa o anotás qué paso falla (IA/ML puede depender de keys).

---

## Fase 5 — Google Drive (GIS), si lo usás desde la calculadora

En **Google Cloud Console → Credentials →** cliente OAuth Web:

- [ ] **Authorized JavaScript origins** incluye el origen de `BASE` **sin path** (ej. `https://panelin-calc-xxxxx-uc.a.run.app`).
- [ ] Si mantenés **Vercel:** también `https://calculadora-bmc.vercel.app`.
- [ ] En **Vercel**, variable `VITE_GOOGLE_CLIENT_ID` definida y redeploy (en Cloud Run unificado, el ID de cliente solo sirve si lo inyectás en el **build** de Vite; ver nota en el runbook largo).

---

## Fase 6 — Vercel (modo A, opcional)

Si el front sigue en Vercel apuntando a esta API:

- [ ] `VITE_API_URL` = tu `BASE` (sin `/` final).
- [ ] `VITE_BASE` = `/`
- [ ] Redeploy del proyecto Vercel tras tocar `VITE_*`.

Guía: [`docs/VERCEL-CALCULADORA-SETUP.md`](../VERCEL-CALCULADORA-SETUP.md).

---

## Fase 7 — Si algo falla

- [ ] **503 MATRIZ:** revisar `BMC_MATRIZ_SHEET_ID` + credenciales + share con service account.
- [ ] **404 /calculadora:** revisar que la revisión desplegada sea la imagen construida con `Dockerfile.bmc-dashboard` (incluye `dist`).
- [ ] **Rollback:** Cloud Run → revisiones → tráfico 100% a revisión anterior estable.

---

## Una línea: “¿listo?”

Listo cuando: **`/health` OK**, **`/api/actualizar-precios-calculadora` devuelve CSV**, y **`/calculadora/` + Cargar desde MATRIZ** funciona en el navegador con tu `BASE` actual.
