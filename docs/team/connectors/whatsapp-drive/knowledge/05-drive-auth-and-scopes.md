# Drive auth y scopes

Tres identidades Google. No intercambiar tokens entre ellas.

## 1. SPA — Google Identity Services (GIS)

- Código: `src/utils/googleDrive.js`.
- Client: `VITE_GOOGLE_CLIENT_ID` (OAuth **Web application**).
- Scopes: `openid email profile` + `https://www.googleapis.com/auth/drive.file`.
- Access token en `localStorage` key `bmc.gdrive.identity` (~1 h). Consent flag `bmc.gdrive.consented`.
- El mismo GIS `signIn` lo reusa `BmcAuthProvider` para login BMC (`POST /api/auth/google`).
- UI: `GoogleDrivePanel.jsx`, `DriveFolderConfig.jsx`.
- Carpeta raíz por defecto: **`Panelin BMC Cotizaciones`**. Preferencia por usuario en Postgres `identity.user_drive_config` vía `GET/POST /api/drive/config` (JWT BMC). **El server no guarda tokens Drive del usuario.**

## 2. API identity (no Drive)

- `GOOGLE_OAUTH_CLIENT_ID` debe ser el **mismo** Web client (`aud`).
- Emite JWT BMC / cookie `bmc_sess`. No llama Drive API.

## 3. Server uploads (archivo empresa)

- Preferido: `GOOGLE_DRIVE_CLIENT_ID` / `SECRET` / `REFRESH_TOKEN` (OAuth Desktop, cuenta dueña).
- Código: `server/lib/driveUpload.js`. Scope: **`drive.file`**.
- `DRIVE_QUOTE_FOLDER_ID` debe ser una carpeta **creada por ese mismo client** (si no, `drive.file` no la ve).
- Fallback: service account (`GOOGLE_APPLICATION_CREDENTIALS`). Google rechaza uploads a My Drive (“Service Accounts do not have storage quota”). Soft-fail a propósito.

## Limitación crítica para un conector WA→Drive

`drive.file` **solo** ve archivos/carpetas que **esta app** creó o que el usuario le otorgó. No se puede listar un árbol de “biblioteca de conocimiento” creado fuera de la app.

Dos OAuth clients (GIS Web vs Desktop server) = dos “apps”. Archivos de uno suelen ser **invisibles** para el otro. Por eso `GET /api/quotes/drive-project` usa **OAuth de servidor**, no el token GIS del browser (`?openDrive=`).

Adjuntos logística: `enviosAdjuntoFetch` descarga URLs **públicas/compartidas** Drive/Dropbox **sin** OAuth. Links privados fallan.

## Setup GIS (operador)

Skill: `.cursor/skills/bmc-google-drive-oauth/SKILL.md`. One-shot: `npm run drive:one-shot -- '<client-id>.apps.googleusercontent.com'`. Verify: `npm run verify:google-drive-oauth`. **Prohibido** `drive` / `drive.readonly` full sin decisión de producto/seguridad.
