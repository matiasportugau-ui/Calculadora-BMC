# Google OAuth troubleshooting — runbook

Last updated: 2026-05-21
Owner: Matías Portugau · created after the `redirect_uri_mismatch` incident on prod login.

## What this covers

Diagnostico y resolución del error de Google **"Acceso bloqueado · Error 400: redirect_uri_mismatch"** (y variantes COOP / silent-refresh silencioso) en la SPA `calculadora-bmc.vercel.app`. Aplica también a cualquier flow OAuth que use el **Google Identity Services (GIS) Web SDK** con `display=popup`, ya sea para login de usuarios o para acceso al scope `drive.file`.

Trampa principal: el mensaje literal "redirect_uri_mismatch" **engaña** sobre la causa real. En el flow GIS popup la fix vive en **Authorized JavaScript origins**, NO en Authorized redirect URIs — son dos listas separadas en la misma página de la consola GCP.

## Síntoma rápido (cómo reconocer este bug específico)

- Usuarios viejos siguen logueados sin problemas (el `POST /api/auth/refresh` backend devuelve 200).
- Usuarios nuevos o re-logins ven la pantalla de Google "Acceso bloqueado".
- La consola del navegador muestra repetido `Cross-Origin-Opener-Policy policy would block the window.closed call. @ https://accounts.google.com/gsi/client:135` (esto es ruido del SDK, NO la causa).
- La URL del popup contiene `redirect_uri=gis_transform` (palabra clave del GIS SDK, no es un URI real).

## Diagnóstico (5 minutos con Playwright o DevTools)

### Opción A — Reproducir con Playwright (preferida; sin login real)

```js
// 1. Navegar
await page.goto('https://calculadora-bmc.vercel.app');

// 2. Si la sesión está cacheada, cerrarla
await page.getByRole('button', { name: /@gmail\.com/ }).click();
await page.getByRole('button', { name: 'Cerrar sesión' }).click();

// 3. Disparar el flow OAuth y capturar la tab que abre Google
await page.getByRole('button', { name: 'Iniciar sesión' }).click();
await page.getByRole('button', { name: 'Continuar con Google' }).click();

// 4. La URL de la tab #1 contiene los parámetros OAuth completos
//    Ese URL es la fuente de verdad para diagnosticar.
```

Parsear de esa URL los params clave:

| Param | Lo que indica |
|---|---|
| `client_id` | Cuál OAuth Client está activo. Comparar contra `vercel env pull` y `.env.local`. |
| `origin` | El `window.location.origin` que la app está enviando. Debe estar en la allowlist GCP. |
| `redirect_uri` | Si es `gis_transform` → flow popup, fix va en **JavaScript origins**. Si es un URI real → fix va en **redirect URIs**. |
| `response_type` | `token` (implicit) vs `code` (auth code). Cambia cuál endpoint backend consume el resultado. |
| `gsiwebsdk` | Si aparece → GIS Web SDK (popup). |
| `scope` | Qué permisos pide. Si incluye scopes sensibles (`drive.*`, `gmail.*`) el OAuth Consent Screen debe estar publicado. |

### Opción B — Capturar desde DevTools en tu navegador

1. Abrir DevTools → Network → preservar log
2. Hacer click en "Iniciar sesión" → "Continuar con Google"
3. Filtrar `accounts.google.com`
4. La primera request `GET https://accounts.google.com/v3/signin/accountchooser?...` tiene los mismos params en el query string

## Fix (configuración GCP, sin código)

### Paso 1 — Identificar el OAuth Client correcto

```bash
# Recordatorio: gcloud NO puede leer/editar OAuth 2.0 Client IDs (limitación oficial).
# Solo se accede vía GCP Console o REST API con scopes admin. Sin atajos CLI.

# Para confirmar qué client_id usa producción:
vercel env pull /tmp/v.env --environment=production --yes
grep VITE_GOOGLE_CLIENT_ID /tmp/v.env
rm /tmp/v.env
```

El project que aloja los OAuth Clients de BMC es **`chatbot-bmc-live`** (NO `panelin-calc` — ese es solo el Cloud Run service). Abrir:

```
https://console.cloud.google.com/apis/credentials?project=chatbot-bmc-live
```

Buscar el client con el ID que arrojó `vercel env pull`. Click para editarlo.

### Paso 2 — Agregar el origin del request

En **Authorized JavaScript origins** (sección de arriba), agregar exactamente lo que el diagnóstico mostró en `origin=` — sin trailing slash, sin path, scheme + host nada más:

```
https://calculadora-bmc.vercel.app
```

Defensive: agregar también el mismo URI en **Authorized redirect URIs** (sección de abajo) por si código futuro cambia a authorization-code flow.

Si se usan dominios custom (ej. `https://panel.bmcuruguay.com.uy`) o previews de Vercel con login activado, agregar cada uno por separado — Google no soporta wildcards en JS origins.

Click **SAVE**.

### Paso 3 — Esperar propagación

Google indica ~5 minutos. En la práctica suele ser < 2 min. Si la fix sigue fallando después de 10 min, releer el diagnóstico (puede que el client_id capturado por el browser sea distinto al que pensás).

## Verificación post-fix

```bash
# 1. Abrir browser en modo incógnito (descarta cookies cached)
# 2. Repetir el flow Iniciar Sesión → Continuar con Google
# 3. En lugar de "Acceso bloqueado" deberías ver la pantalla:
#    "You're signing back in to calculadora-bmc.vercel.app" → Continue
# 4. Después del click Continue, popup cierra y la app refresca con sesión activa
```

Network checklist en el app post-flow:

| Request | Status esperado | Significa |
|---|---|---|
| `GET googleapis.com/oauth2/v3/userinfo` | **200** | Google entregó userinfo del token nuevo |
| `POST /api/auth/google` | **200** | Backend validó el id_token y creó sesión |
| `GET /api/auth/me` (próximo refresh) | **200** | Sesión persistida |
| `POST /api/auth/refresh` | **200** | Refresh token funcional para silent refresh |

Si `oauth2/v3/userinfo` da 200 pero `POST /api/auth/google` da 4xx, el bug es de backend (token inválido o scopes faltantes), NO de OAuth client config.

## Por qué este bug aparece (causa raíz explicada)

El **GIS Web SDK popup flow** usa el placeholder `redirect_uri=gis_transform`. Google lo expande internamente a una URL `storagerelay://https/<origin>/?id=auth<n>`. Esa expansión es válida **sólo si** `<origin>` está en la lista "Authorized JavaScript origins" del OAuth Client.

Cuando el origin no está autorizado:
- El backend de Google rechaza el request OAuth
- Devuelve el código de error `redirect_uri_mismatch` aunque técnicamente la causa sea "origin not authorized"
- El popup se cierra antes que el usuario vea nada útil (o ve "Acceso bloqueado")

El refresh backend (server-side, vía `oauth2.googleapis.com/token` con `client_secret`) **NO** pasa por esta validación de origin. Por eso sesiones viejas siguen vivas mientras logins nuevos fallan — patrón confuso pero muy informativo si se conoce.

## Cosas adyacentes que NO son este bug

- **COOP errors** (`Cross-Origin-Opener-Policy policy would block...`) — son del SDK al detectar cierre de popup vía `window.closed`. Ruido, no causa.
- **Scope `drive.file` rechazado** — daría `access_denied` o "App not verified", NO `redirect_uri_mismatch`.
- **OAuth Consent Screen no publicado** — daría "Esta app aún está en pruebas" para usuarios fuera del test allowlist, NO redirect_uri_mismatch.
- **Token expirado** — `/api/auth/me` 401 sin trigger de popup; el silent refresh lo maneja.
- **Mismatch de client_id entre frontend y backend** — daría errores 4xx en `/api/auth/google`, no en la pantalla de Google.

## Apéndice — Lo que `gcloud` puede y no puede hacer aquí

```bash
gcloud auth list           # ✓ confirmar qué cuenta está activa
gcloud config get project  # ✓ confirmar proyecto activo
gcloud projects list       # ✓ verificar acceso al proyecto

# ✗ NO existe `gcloud auth oauth-clients list/get/edit`
# ✗ `gcloud alpha iap oauth-clients` es para IAP, no para Web Apps OAuth
# ✗ La API IAM Credentials NO expone los OAuth 2.0 Client IDs
# Resultado: la única forma de editar el client es manual en la Console.
```

## Historial de incidentes resueltos con este runbook

| Fecha | Síntoma | Fix aplicada | Refs |
|---|---|---|---|
| 2026-05-21 N | Bloqueo de logins nuevos post-launch de Open Google Registration | Agregado `https://calculadora-bmc.vercel.app` a Authorized JS origins del client `-hbkkonaqp9vvfk2qa9sv5go4bd8u4sj3` | [BITACORA-MATIAS.md#2026-05-21-N](../BITACORA-MATIAS.md) |
