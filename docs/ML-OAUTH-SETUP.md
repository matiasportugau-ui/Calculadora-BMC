# Conectar OAuth de MercadoLibre

Para que el dashboard muestre preguntas, órdenes y mensajes de MercadoLibre, el backend necesita credenciales OAuth. Sigue estos pasos.

---

## 1. Crear aplicación en MercadoLibre

1. Entrá a **https://developers.mercadolibre.com.uy** (o `.com.ar` si usás Argentina).
2. Iniciá sesión con tu cuenta de vendedor.
3. **Mis aplicaciones** → **Crear nueva aplicación**.
4. Completá:
   - **Nombre:** p. ej. "BMC Calculadora"
   - **Descripción:** opcional
5. En **URLs de redirección** o **Notificaciones callbacks URL**:
   - Si aceptan `http://localhost`: usá `http://localhost:3001/auth/ml/callback`.
   - Si exigen **https** (ej. "La dirección debe contener https://"): usá un túnel (ngrok o localtunnel). Ejecutá `npx ngrok http 3001`, copiá la URL https que te den y usá `https://TU_URL/auth/ml/callback`. En el `.env` agregá `ML_REDIRECT_URI_DEV=https://TU_URL/auth/ml/callback`.
6. Guardá y copiá el **App ID** (Client ID) y el **Secret Key** (Client Secret).

---

## 2. Configurar variables de entorno

Agregá al `.env` del proyecto:

```env
ML_CLIENT_ID=tu_app_id_aqui
ML_CLIENT_SECRET=tu_secret_key_aqui
```

Opcional (para encriptar tokens en disco):

```env
TOKEN_ENCRYPTION_KEY=64_caracteres_hexadecimales
```

Para generar una clave de 64 hex: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

---

## 3. Iniciar el flujo OAuth

1. Asegurate de que el servidor esté corriendo (`npm run dev` o `node server/index.js`).
2. Abrí en el navegador:
   ```
   http://localhost:3001/auth/ml/start
   ```
3. MercadoLibre te pedirá autorizar la app. Aceptá.
4. Serás redirigido al callback; si todo va bien, verás un JSON con `ok: true` y `userId`.

---

## 4. Verificar que esté conectado

- **Estado:** `GET http://localhost:3001/auth/ml/status`
- **Health:** `GET http://localhost:3001/health` — muestra `hasTokens: true` si hay tokens.

---

## 5. Ver datos en el dashboard

Con OAuth conectado, el dashboard (panel interno en localhost:3847) debería mostrar las preguntas de MercadoLibre al consumir `GET /ml/questions`.

---

## 6. Cloud Run — Sincronizar credenciales

Si el backend está en Cloud Run (`*.run.app`), las variables `ML_CLIENT_ID` y `ML_CLIENT_SECRET` deben estar en el servicio:

1. Asegurate de tener `.env` con:
   ```env
   ML_CLIENT_ID=742811153438318
   ML_CLIENT_SECRET=tu_secret_aqui
   ```

2. Desde el directorio del proyecto:
   ```bash
   npm run ml:cloud-run
   ```
   Si el servicio tiene otro nombre (ej. `panelin-calc-642127786762`):
   ```bash
   ./run_ml_cloud_run_setup.sh panelin-calc-642127786762
   ```

3. La URL de callback debe coincidir en MercadoLibre:
   ```
   https://panelin-calc-642127786762.us-central1.run.app/auth/ml/callback
   ```

---

## 7. Persistencia de tokens en Cloud Run

Por defecto los tokens se guardan en un archivo local que se pierde en cada deploy. Para que persistan:

1. **Crear bucket GCS:**
   ```bash
   gsutil mb gs://panelin-calc-ml-tokens
   ```
   O desde la consola de Google Cloud → Cloud Storage → Crear bucket.

2. **Permisos IAM:** El service account de Cloud Run debe poder leer/escribir el bucket. Si usás el default (`PROJECT_NUMBER-compute@developer.gserviceaccount.com`), suele tener acceso. Para least-privilege, creá un SA dedicado y asignale `roles/storage.objectAdmin` en el bucket.

3. **Variables en `.env`:**
   ```env
   ML_TOKEN_GCS_BUCKET=panelin-calc-ml-tokens
   TOKEN_ENCRYPTION_KEY=64_caracteres_hex
   ```

4. **Sincronizar:** `npm run ml:cloud-run` incluirá `ML_TOKEN_STORAGE=gcs`, `ML_TOKEN_GCS_BUCKET` y `TOKEN_ENCRYPTION_KEY` en Cloud Run.

5. **Primera vez:** Tras el deploy, visitá `/auth/ml/start` para autorizar. Los tokens quedarán en GCS y sobrevivirán reinicios y nuevos deploys.

---

## 8. Preservar variables en deploy (Cloud Run)

Si usás GitHub Actions u otro CI para deployar a Cloud Run, las variables de entorno pueden sobrescribirse.

**Recomendación:** Tras cada deploy, ejecutá `npm run ml:cloud-run` para re-sincronizar las vars críticas desde `.env`:

- `PUBLIC_BASE_URL` — debe ser la URL del servicio (ej. `https://panelin-calc-642127786762.us-central1.run.app`)
- `ML_CLIENT_ID`, `ML_CLIENT_SECRET`
- `ML_TOKEN_GCS_BUCKET`, `TOKEN_ENCRYPTION_KEY` (si usás GCS)
- **BMC Dashboard:** `BMC_SHEET_ID`, `BMC_SHEET_SCHEMA`, `GOOGLE_APPLICATION_CREDENTIALS` (o path al service account) para que /api/* y /finanzas funcionen con Sheets.

**En workflows:** Si el deploy usa `gcloud run deploy` sin `--set-env-vars`, las vars existentes se mantienen. Evitá `--set-env-vars=""` vacío. Para asegurar vars tras deploy, añadí un paso post-deploy:

```yaml
- name: Sync ML env vars to Cloud Run
  run: npm run ml:cloud-run
  env:
    GCLOUD_PROJECT: ${{ secrets.GCLOUD_PROJECT }}
```

---

## Troubleshooting

| Problema | Solución |
|----------|----------|
| "Missing OAuth configuration" | Revisá que `ML_CLIENT_ID` y `ML_CLIENT_SECRET` estén en `.env` y reiniciá el servidor. |
| "Invalid or expired OAuth state" | El flujo OAuth expira en 10 min. Volvé a iniciar desde `/auth/ml/start`. |
| "OAuth not initialized" en `/ml/questions` | Completá el flujo OAuth (paso 3) antes de llamar a la API. |
| Redirect URI no coincide | La URL en `ML_REDIRECT_URI_DEV` debe coincidir exactamente con la configurada en la app de MercadoLibre. |
| MercadoLibre exige https | Usá ngrok: `npx ngrok config add-authtoken TU_TOKEN` y `npx ngrok http 3001`. En la app de ML y en `.env` poné `ML_REDIRECT_URI_DEV=https://xxx.ngrok-free.app/auth/ml/callback`. |

---

## Endpoints disponibles

| Endpoint | Descripción |
|----------|-------------|
| `GET /auth/ml/start` | Inicia OAuth (redirect a ML). `?mode=json` devuelve `{ authUrl }` sin redirect. |
| `GET /auth/ml/callback` | Callback de MercadoLibre (no llamar manualmente). |
| `GET /auth/ml/status` | Estado del token almacenado. |
| `GET /ml/questions` | Preguntas de MercadoLibre (requiere OAuth). |
| `GET /ml/orders` | Órdenes de MercadoLibre (requiere OAuth). |
| `GET /ml/users/me` | Datos del usuario conectado. |
