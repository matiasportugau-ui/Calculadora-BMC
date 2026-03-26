# Procedimiento completo — Calculadora + API en Google Cloud Run

Runbook para dejar **operativo** el stack **API + Finanzas + Calculadora** en **Cloud Run**, con MATRIZ, Drive (opcional) y coherencia con el repo **Calculadora-BMC**.

**Referencias en repo:** `Dockerfile.bmc-dashboard`, `scripts/deploy-cloud-run.sh`, `cloudbuild.yaml`, `server/index.js`, `.env.example`, [`docs/VERCEL-CALCULADORA-SETUP.md`](../VERCEL-CALCULADORA-SETUP.md) (Vercel vs GCP), [`docs/ML-OAUTH-SETUP.md`](../ML-OAUTH-SETUP.md) (Mercado Libre).

**Checklist corta con valores `chatbot-bmc-live` / `panelin-calc` / MATRIZ:** [`CHECKLIST-DEPLOY-PANELIN-CALC-BMC.md`](./CHECKLIST-DEPLOY-PANELIN-CALC-BMC.md).

---

## 0. Alcance y decisión de arquitectura

| Modo | Front calculadora | Base API en el navegador |
|------|-------------------|---------------------------|
| **B — Recomendado GCP unificado** | `https://<servicio>.run.app/calculadora/` | Mismo origen (`VITE_SAME_ORIGIN_API=1` en imagen; ver `Dockerfile.bmc-dashboard`) |
| **A — Vercel + Cloud Run** | `https://calculadora-bmc.vercel.app` | `VITE_API_URL` apuntando a Cloud Run |

Este procedimiento cubre **B** de punta a punta y al final resume **A** si mantenés Vercel.

**URLs útiles tras el deploy (sustituí `<BASE>` por la URL real del servicio):**

- Calculadora: `<BASE>/calculadora/`
- Dashboard Finanzas: `<BASE>/finanzas/`
- Salud: `<BASE>/health`
- Capacidades: `<BASE>/capabilities`
- MATRIZ (CSV): `<BASE>/api/actualizar-precios-calculadora`

Obtener `<BASE>`:

```bash
gcloud run services describe panelin-calc --region=us-central1 --project=chatbot-bmc-live --format='value(status.url)'
```

---

## 1. Prerrequisitos

1. **Cuenta Google Cloud** con proyecto (en el repo suele usarse `chatbot-bmc-live`; confirmá con tu equipo).
2. **gcloud CLI** instalado y autenticado: `gcloud auth login` y `gcloud config set project TU_PROJECT_ID`.
3. **Permisos** mínimos: poder ejecutar Cloud Build, desplegar Cloud Run y editar variables del servicio (u operar Secret Manager si lo usan).
4. **Repo clonado** y dependencias: `npm ci` o `npm install` (para tests locales opcionales).
5. **Docker** (opcional): solo si vas a usar `./scripts/deploy-cloud-run.sh --local-docker` en lugar de Cloud Build.

---

## 2. Google Sheets — service account y planillas

1. **Service account JSON** (no commitear): el servidor usa `GOOGLE_APPLICATION_CREDENTIALS` apuntando a un archivo **dentro del contenedor** o variables montadas según cómo deployen (Secret Manager + volumen, o build arg — según práctica actual del proyecto).
2. **Compartir planillas** con el email de la service account (lector o editor según tab): workbook principal BMC, **MATRIZ de COSTOS y VENTAS**, etc. Detalle de IDs: [`.env.example`](../../.env.example) y hub [`docs/google-sheets-module/README.md`](../google-sheets-module/README.md).
3. Anotar **`BMC_MATRIZ_SHEET_ID`** (y `BMC_SHEET_ID` si aplica al dashboard) para el paso 4.

**Criterio de éxito:** en un entorno donde la API tenga credenciales válidas, `GET /api/actualizar-precios-calculadora` devuelve **CSV** (no JSON de error `MATRIZ sheet no configurado`).

---

## 3. Variables de entorno en Cloud Run

No pegues secretos en el chat ni en commits. Configurá en **Cloud Run → servicio → Editar y desplegar nueva revisión → Variables y secretos**.

### 3.1 Obligatorias para calculadora + MATRIZ (mínimo producto)

| Variable | Propósito |
|----------|-----------|
| `GOOGLE_APPLICATION_CREDENTIALS` | Ruta al JSON en el contenedor **o** mecanismo equivalente del deploy |
| `BMC_MATRIZ_SHEET_ID` | Planilla MATRIZ para export CSV a la calculadora |
| `NODE_ENV` | `production` |

### 3.2 Dashboard / CRM (si usás el mismo servicio)

Revisá [`.env.example`](../../.env.example): `BMC_SHEET_ID`, otros `BMC_*_SHEET_ID`, `API_AUTH_TOKEN` / `API_KEY` para rutas protegidas, etc.

### 3.3 Mercado Libre, WhatsApp, IA, Shopify

Según lo que tengan activo en producción: `ML_*`, `PUBLIC_BASE_URL`, `WHATSAPP_*`, claves de IA, `SHOPIFY_*`. Guías: [`docs/ML-OAUTH-SETUP.md`](../ML-OAUTH-SETUP.md), [`docs/team/HUMAN-GATES-ONE-BY-ONE.md`](../team/HUMAN-GATES-ONE-BY-ONE.md).

### 3.4 Sincronizar desde `.env` local (opcional)

Script del repo: `./run_ml_cloud_run_setup.sh` (sincroniza un subconjunto; **cuidado** con comas en valores y con secretos). Alternativa: consola de Cloud Run o `gcloud run services update`.

---

## 4. Build de la imagen

La imagen **oficial** del proyecto incluye:

- `npm run build` de Vite con `VITE_BASE=/calculadora/` y **`VITE_SAME_ORIGIN_API=1`** (mismo host para SPA y API en Cloud Run).
- Static `dist` + servidor Express en puerto `3001` (`PORT` configurable por Cloud Run).

**Opción recomendada (Cloud Build, sin Docker local):**

```bash
./scripts/deploy-cloud-run.sh
```

Esto ejecuta `gcloud builds submit --config cloudbuild.yaml` y luego `gcloud run deploy`.

**Opción Docker local:**

```bash
./scripts/deploy-cloud-run.sh --local-docker
```

**Solo redeploy** (misma imagen ya en el registry):

```bash
./scripts/deploy-cloud-run.sh --no-build
```

---

## 5. Despliegue en Cloud Run

El script anterior ya hace `gcloud run deploy panelin-calc` con `--allow-unauthenticated` (ajustar si la política de seguridad exige IAM).

Comprobaciones inmediatas:

1. **URL del servicio** (ver sección 0).
2. **`GET /health`** → `200` y JSON con `ok: true`.
3. **`GET /capabilities`** → `200` (manifiesto; revisar `public_base_url` si aplica).

---

## 6. Verificación funcional — Calculadora y MATRIZ

1. Abrí en el navegador: `<BASE>/calculadora/`
2. **Configuración → Listado de precios → Cargar desde MATRIZ**  
   - Debe completar sin error de red.  
   - Si falla: revisá respuesta de `<BASE>/api/actualizar-precios-calculadora` (CSV vs 503 JSON).
3. **Cotización rápida:** armar un techo/pared y comprobar totales y PDF/WhatsApp si los usás.
4. **Registro GPT / cotizaciones** (si aplica): la app canónica usa `getCalcApiBase()` → en Cloud Run debe apuntar al mismo `<BASE>`.

---

## 7. Google Drive (GIS) — OAuth cliente web

Si usás guardar en Drive desde la calculadora:

1. **Google Cloud Console → APIs & Services → Credentials →** cliente OAuth tipo **Web application**.
2. **Authorized JavaScript origins:**  
   - `https://<tu-host>.run.app` (URL base **sin** `/calculadora`)  
   - Si mantenés Vercel: también `https://calculadora-bmc.vercel.app`
3. En el **build** que sirve la calculadora en ese origen, definir **`VITE_GOOGLE_CLIENT_ID`** (en Vercel variables de entorno; en Docker de Cloud Run, solo si inyectás build-args para el front — hoy el Dockerfile no define `VITE_GOOGLE_CLIENT_ID`; si hace falta en la misma imagen, habría que pasar `ARG`/`ENV` en el stage `calc-build` y rebuild).

**Nota:** En la imagen estándar `Dockerfile.bmc-dashboard`, si no se inyecta `VITE_GOOGLE_CLIENT_ID` en build time, Drive en producción seguirá pidiendo configuración; eso es independiente del “mismo origen” para la API.

---

## 8. Opción A — Mantener Vercel además de Cloud Run

1. En Vercel: `VITE_API_URL=<BASE>` (sin barra final), `VITE_BASE=/`, `VITE_GOOGLE_CLIENT_ID` si usás Drive.
2. Redeploy en Vercel tras cambiar `VITE_*`.
3. Detalle: [`docs/VERCEL-CALCULADORA-SETUP.md`](../VERCEL-CALCULADORA-SETUP.md).

---

## 9. DNS y dominio custom (opcional)

Si mapean un dominio a Cloud Run (p. ej. `calc.bmcuruguay.com.uy`):

1. Seguir asistente de **Cloud Run → Dominios personalizados**.
2. Actualizar **`PUBLIC_BASE_URL`** y redirects OAuth (ML, etc.) para que coincidan con la URL pública canónica.
3. Añadir el nuevo origen en **OAuth Drive** (GIS).

---

## 10. CI y humo en producción

Desde el repo (sin levantar API local):

```bash
npm run smoke:prod
```

Opcionalmente con base explícita:

```bash
BMC_API_BASE=https://TU-SERVICIO.run.app npm run smoke:prod
```

Esto valida health, capabilities y otros chequeos definidos en `scripts/smoke-prod-api.mjs`.

---

## 11. Rollback

1. **Cloud Run → Revisiones:** seleccionar revisión anterior estable → **Administrar tráfico** → 100% a esa revisión.
2. Si el problema fue **build**: redeploy desde un commit conocido bueno repitiendo sección 4–5.

---

## 12. Checklist final (resumen)

- [ ] Proyecto GCP y `gcloud` configurados
- [ ] Service account con acceso a MATRIZ (y planillas del dashboard si aplica)
- [ ] Cloud Run: `BMC_MATRIZ_SHEET_ID` + credenciales Sheets montadas correctamente
- [ ] Deploy con `Dockerfile.bmc-dashboard` (incluye `VITE_SAME_ORIGIN_API=1`)
- [ ] `<BASE>/calculadora/` carga y **Cargar desde MATRIZ** funciona
- [ ] `<BASE>/health` y `smoke:prod` OK
- [ ] OAuth Drive: orígenes JS actualizados si usás Drive
- [ ] (Opcional) Vercel con `VITE_API_URL` si querés dos frentes
- [ ] Documentar internamente la **URL canónica** y quién hace deploy

---

## 13. Orden recomendado (una sola pasada)

1. Prerrequisitos (§1)  
2. Sheets + IDs (§2)  
3. Variables Cloud Run (§3) — primero MATRIZ + credenciales  
4. Build + deploy (§4–5)  
5. Verificación API (§5–6)  
6. Drive / Vercel / dominio según necesidad (§7–9)  
7. Smoke + checklist (§10–12)

Si en algún paso el endpoint MATRIZ devuelve **503**, no continúes con “solo front”: corregí credenciales e ID de planilla hasta obtener CSV (§6).
