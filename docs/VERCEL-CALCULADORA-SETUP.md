# Calculadora BMC en Vercel (`calculadora-bmc.vercel.app`)

**Rol respecto a producción canónica:** Vercel es el **frontend alternativo / secundario**. La **producción oficial** del producto está definida como **Cloud Run unificado** (SPA + API mismo origen). Ver [`docs/calculadora/CANONICAL-PRODUCTION.md`](calculadora/CANONICAL-PRODUCTION.md).

**Runbook completo (Cloud Run + calculadora + MATRIZ + checklist):** [`procedimientos/PROCEDIMIENTO-CALCULADORA-Y-API-CLOUD-RUN-COMPLETO.md`](procedimientos/PROCEDIMIENTO-CALCULADORA-Y-API-CLOUD-RUN-COMPLETO.md).

La app en [Vercel](https://calculadora-bmc.vercel.app) es el **frontend** (Vite/React) apuntando a la **API** (Cloud Run). Para que todo funcione hay que configurar **ambos lados**; esto implica más coordinación que el despliegue único en Cloud Run.

## 1. Variables en Vercel (obligatorio para MATRIZ y Drive)

En el proyecto Vercel: **Settings → Environment Variables**. Aplicar a **Production** (y **Preview** si querés previews con la misma API).

| Variable | Valor | Notas |
|----------|--------|--------|
| `VITE_API_URL` | `https://panelin-calc-q74zutv7dq-uc.a.run.app` | Sin barra final. Es la base HTTP de la API en producción (alineada con `scripts/smoke-prod-api.mjs`). Si cambiás el servicio Cloud Run, actualizá esto y **volvé a desplegar**. |
| `VITE_BASE` | `/` | Default; solo cambiar si la app no está en la raíz del dominio. |
| `VITE_GOOGLE_CLIENT_ID` | Client ID OAuth (tipo *Web application*) | Necesario para **Google Drive** (guardar/listar cotizaciones). Sin esto, la consola muestra `[GDrive] No VITE_GOOGLE_CLIENT_ID configured`. |

**Importante:** Vite **incrusta** `VITE_*` en el bundle en **tiempo de build**. Después de cambiar variables en el dashboard: **Redeploy** (Deployments → … → Redeploy) o `vercel --prod`.

## 2. Google Cloud Console (OAuth para Drive)

En **APIs & Services → Credentials →** tu cliente OAuth **Web application**:

- **Authorized JavaScript origins:** `https://calculadora-bmc.vercel.app`
- **Authorized redirect URIs:** para GIS con token client suele bastar el origen; si Google pide redirect, usá el que indique la consola para tu flujo.

Sin el origen de Vercel, el login de Drive puede fallar desde producción aunque funcione en `localhost`.

**`401 invalid_client` / “The OAuth client was not found”:** el `VITE_GOOGLE_CLIENT_ID` del bundle no coincide con un cliente OAuth vigente en Google Cloud (typo, credencial borrada u otro proyecto). Corregí el valor en Vercel o en local (`.env` / `.env.local`) y **redeploy**. Formato: `npm run verify:google-drive-oauth`.

**Subir `VITE_GOOGLE_CLIENT_ID` con Vercel CLI:** con el repo enlazado (`vercel link`) y sesión o `VERCEL_TOKEN`, ejecutá `npm run drive:vercel-env -- '<client-id>.apps.googleusercontent.com'` (actualiza **production** y **preview**; solo prod: `ONLY_PROD=1 npm run drive:vercel-env -- '…'`). Luego **redeploy** para que Vite incruste el valor.

**Comprobar que el build incrustó el Client ID (local o CI):** `npm run build && npm run verify:google-drive-dist` (usa el mismo ID que `process.env` o `.env` / `.env.local`; si no hay ID, el paso se omite). En GitHub: workflow **Drive OAuth — verify Client ID in dist** (`drive-oauth-dist-verify.yml`).

## 3. Cloud Run (para “Cargar desde MATRIZ”)

El botón **Cargar desde MATRIZ** en Config → Listado de precios hace `GET {base}/api/actualizar-precios-calculadora` (la `base` la resuelve `getCalcApiBase()` en `src/utils/calcApiBase.js`: `VITE_API_URL` en Vercel, u origen del sitio si `VITE_SAME_ORIGIN_API=1` en el build de Cloud Run).

Si la API responde **503** con un cuerpo tipo `MATRIZ sheet no configurado`, falta en **Cloud Run**:

- `BMC_MATRIZ_SHEET_ID` (ID de la planilla MATRIZ; ver comentarios en `.env.example`)
- `GOOGLE_APPLICATION_CREDENTIALS` apuntando a un JSON de service account **montado en el contenedor** o equivalente en Secret Manager (como ya usás para el resto del servicio)

Sincronización de variables hacia Cloud Run: `npm run ml:cloud-run` y/o la guía en `docs/ML-OAUTH-SETUP.md` según cómo mantengas secretos.

**Comprobación rápida (sin abrir Vercel):**

```bash
curl -sS "https://panelin-calc-q74zutv7dq-uc.a.run.app/api/actualizar-precios-calculadora" | head -c 200
```

Si ves CSV (líneas con `path`, costo, venta), la API está lista; solo falta que Vercel tenga `VITE_API_URL` correcto y un deploy reciente.

## 4. Deploy desde el repo

```bash
./scripts/deploy-vercel.sh --prod
```

El script exporta `VITE_API_URL` para **ese** deploy; para que quede fijo en todos los deploys, igual configurá las variables en el dashboard Vercel.

## 5. CORS

La API usa `cors()` abierto en `server/index.js`, así que el navegador en `https://calculadora-bmc.vercel.app` puede llamar a Cloud Run sin ajuste extra de CORS.

## 6. Centralizar en Google Cloud (API + calculadora en el mismo Cloud Run)

Si querés **un solo lugar en GCP** (menos piezas que Vercel + Cloud Run), el repo ya lo soporta:

- **`Dockerfile.bmc-dashboard`:** build de Vite con `VITE_BASE=/calculadora/` y `VITE_SAME_ORIGIN_API=1`. El contenedor sirve la SPA en **`/calculadora`** y la API en **`/api`**, **`/calc`**, etc. (`server/index.js`).
- **URL típica:** `https://<tu-servicio>.run.app/calculadora/`
- **MATRIZ / Sheets:** mismas variables que hoy en Cloud Run (`BMC_MATRIZ_SHEET_ID`, credenciales de la service account). No hace falta fijar `VITE_API_URL` en el build del contenedor: el navegador usa el **mismo origen** que la página.
- **Google Drive (GIS):** en OAuth, agregá **Authorized JavaScript origins** con la URL base de Cloud Run (sin path), p. ej. `https://panelin-calc-q74zutv7dq-uc.a.run.app`.

**Vercel** puede quedar como alias opcional o apagarse si todo el tráfico pasa por Cloud Run.

## Resumen checklist

**Opción A — Vercel + Cloud Run**

1. [ ] Vercel: `VITE_API_URL` + `VITE_GOOGLE_CLIENT_ID` (si usás Drive)
2. [ ] Redeploy en Vercel tras cambiar `VITE_*`
3. [ ] Google OAuth: origen JS `https://calculadora-bmc.vercel.app`
4. [ ] Cloud Run: `BMC_MATRIZ_SHEET_ID` + credenciales Sheets para el endpoint MATRIZ

**Opción B — Solo Cloud Run (centralizado en GCP)**

1. [ ] Build/push con `Dockerfile.bmc-dashboard` y deploy a Cloud Run
2. [ ] Abrir `https://<servicio>.run.app/calculadora/`
3. [ ] Mismas variables Sheets/MATRIZ en el servicio
4. [ ] OAuth Drive: origen JS = URL base del servicio `.run.app`
