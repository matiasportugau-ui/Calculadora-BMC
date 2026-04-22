# Plan — Automatizar setup y verificación de Google Drive (OAuth GIS)

Objetivo: reducir a **un flujo repetible** (script + checks) el camino desde “sin Drive” hasta “login OK”, separando **lo que la máquina puede hacer** de **lo que Google/Vercel exigen por consola o políticas**.

Referencia actual en repo: **`npm run drive:one-shot -- '<client-id>'`** (flujo completo local + Vercel + build + dist), `npm run drive:bootstrap`, `npm run drive:configure`, `npm run drive:vercel-env`, `npm run verify:google-drive-oauth`, `npm run verify:google-drive-dist`, `./run_drive_setup.sh '<client-id>'`, `docs/GOOGLE_DRIVE_SETUP_PROMPT.md`, `docs/VERCEL-CALCULADORA-SETUP.md`, workflows `drive-oauth-verify.yml` y `drive-oauth-dist-verify.yml`.

---

## 1. Límites (qué no se puede “auto” al 100%)

- **Crear el OAuth Client ID “Web application”** y la **pantalla de consentimiento** con todos los matices suele hacerse por **Google Cloud Console** (o APIs de administración con permisos elevados). No todos los proyectos tienen habilitada creación vía API sin intervención humana.
- **Publicar** la app en consentimiento (producción) puede requerir revisión de Google.
- **Vercel**: inyectar `VITE_GOOGLE_CLIENT_ID` en el proyecto remoto requiere **token Vercel** (`vercel env`) o dashboard; es automatizable si aceptás guardar un token en CI/local.

Conclusión: el plan “auto” realista = **automatizar verificación + habilitar API + deep links + opcional sync de env**, y dejar **un paso humano corto** (copiar Client ID, confirmar orígenes JS).

---

## 2. Fase A — Ya hecho en repo (baseline)

| Entregable | Rol |
|------------|-----|
| `scripts/verify-google-drive-oauth-env.mjs` | Falla si falta o mal-forma `VITE_GOOGLE_CLIENT_ID` (`.env` + `.env.local`). |
| `npm run verify:google-drive-oauth` | Comando único para CI/local. |
| `run_drive_setup.sh` | Llama a `set-vite-google-client.mjs` + `npm run dev` (solo `.env.local`). |
| `npm run drive:bootstrap` | `gcloud services enable` + enlaces (opc. `--open`). |
| `npm run drive:configure` | Interactivo / `--set` / stdin → `.env.local` + verify. |
| `scripts/set-vite-google-client.mjs` | Upsert único de `VITE_GOOGLE_CLIENT_ID`. |

**DoD fase A:** cualquier dev corre `npm run verify:google-drive-oauth` antes de `npm run dev` cuando trabaja Drive.

---

## 3. Fase B — Script “bootstrap” de GCP (semi-auto) — **implementado**

**Comando:** `npm run drive:bootstrap` — `scripts/drive-oauth-bootstrap.sh`.

**Comportamiento:**

1. Resolver **proyecto GCP**: `GOOGLE_CLOUD_PROJECT` o `gcloud config get-value project`. Si vacío → error con instrucción.
2. **`gcloud services enable drive.googleapis.com --project="$PROJECT"`** (idempotente).
3. Imprimir URLs listas para abrir (deep links), sustituyendo `PROJECT`:
   - Consentimiento: `https://console.cloud.google.com/apis/credentials/consent?project=$PROJECT`
   - Credenciales: `https://console.cloud.google.com/apis/credentials?project=$PROJECT`
   - Biblioteca Drive: `https://console.cloud.google.com/apis/library/drive.googleapis.com?project=$PROJECT`
4. Opcional **macOS**: `open "<url>"` para la de credenciales (flag `--open`).
5. Recordatorio impreso: orígenes JS `http://localhost:5173`, `https://calculadora-bmc.vercel.app`, y el **origen base** de Cloud Run si aplica (leer de `PUBLIC_BASE_URL` / doc canónica).
6. Post-condición: invocar `npm run verify:google-drive-oauth` si ya hay Client ID en disco.

**DoD fase B:** una orden documentada (`npm run drive:bootstrap`) deja Drive API habilitada y al desarrollador en la pantalla correcta en ≤2 clics.

**Riesgos:** `gcloud` no instalado o sin login (`gcloud auth login`); permisos IAM insuficientes para `serviceusage.services.enable`.

---

## 4. Fase C — Asistente “pegar Client ID” — **implementado**

**Comando:** `npm run drive:configure` — `scripts/set-vite-google-client.mjs`.

1. Acepta `--set ID`, argumento posicional, **stdin** (no TTY) o pregunta interactiva.
2. Valida formato (alineado con `verify-google-drive-oauth-env.mjs`).
3. Upsert en `.env.local` (`run_drive_setup.sh` delega aquí).
4. Ejecuta `verify-google-drive-oauth-env.mjs` al final.

**DoD fase C:** no hace falta editar `.env.local` a mano para el Client ID.

---

## 5. Fase D — Producción / Vercel (auto con token) — **implementado (D1)**

| Entregable | Rol |
|------------|-----|
| `npm run drive:vercel-env` | `scripts/vercel-drive-env-push.sh` — `vercel env add VITE_GOOGLE_CLIENT_ID` para **production** y **preview** (`ONLY_PROD=1` solo prod). Requiere CLI + proyecto enlazado + `vercel login` o `VERCEL_TOKEN`. |
| `docs/VERCEL-CALCULADORA-SETUP.md` | Nota de uso + redeploy obligatorio tras cambiar `VITE_*`. |

**D2 (Action que escribe en Vercel vía API):** no implementado; se puede añadir si querés token `VERCEL_TOKEN` solo en GitHub Secrets y un workflow que invoque la API de Vercel.

**DoD fase D:** desde la laptop con Vercel CLI, actualizar `VITE_GOOGLE_CLIENT_ID` sin abrir el dashboard; **redeploy** para bakear en el bundle.

**Riesgos:** token con scope amplio; no commitear `.vercel` ni tokens.

---

## 6. Fase E — CI (no bloqueante por defecto) — **implementado (opt-in)**

- Workflow **manual** `.github/workflows/drive-oauth-verify.yml` (`workflow_dispatch`). Si el secret `VITE_GOOGLE_CLIENT_ID` no existe → mensaje y **exit 0** (no rompe forks). Si existe → `node scripts/verify-google-drive-oauth-env.mjs` (lee `process.env`, sin `npm ci`).
- `verify-google-drive-oauth-env.mjs` acepta **`process.env.VITE_GOOGLE_CLIENT_ID`** además de `.env` / `.env.local` (útil para Actions y otros runners).

**DoD fase E:** desde Actions → Run workflow, comprobar formato del Client ID sin tocar el job principal de CI.

---

## 7. Fase F — Smoke de bundle (sin Playwright) — **implementado**

| Entregable | Rol |
|------------|-----|
| `npm run verify:google-drive-dist` | `scripts/verify-vite-google-client-in-dist.mjs` — tras `vite build`, busca el Client ID esperado (misma prioridad que el verify de env) dentro de `dist/**/*.js`. Sin ID configurado → **omitido (exit 0)**. |
| `.github/workflows/drive-oauth-dist-verify.yml` | `workflow_dispatch`: si existe secret `VITE_GOOGLE_CLIENT_ID` → `npm run build` + `verify:google-drive-dist`; si no → exit 0. |

**Playwright / login real en Google:** fuera de alcance (frágil en CI sin cuenta de prueba dedicada).

**DoD fase F:** detectar regresión “`VITE_GOOGLE_CLIENT_ID` no incrustado en el bundle”, no “Google acepta el login”.

---

## 8. Orden de implementación sugerido

1. ~~**B** — `drive:bootstrap`~~ Hecho.
2. ~~**C** — `drive:configure` + `set-vite-google-client.mjs` + `run_drive_setup.sh`~~ Hecho.
3. ~~**D** — script Vercel + doc~~ Hecho (`drive:vercel-env`).
4. ~~**E** — workflow opt-in~~ Hecho (`drive-oauth-verify.yml`).
5. ~~**F** — smoke de bundle~~ Hecho (`verify:google-drive-dist` + `drive-oauth-dist-verify.yml`).

---

## 9. Definition of Done (proyecto completo “auto”)

- Un nuevo dev con `gcloud` configurado puede: `npm run drive:bootstrap` → crear cliente en la UI → `npm run drive:configure` → `npm run dev` → login Drive OK en `localhost`.
- En prod: variable `VITE_GOOGLE_CLIENT_ID` alineada con ese mismo cliente y **origen JS** incluido para el host real; redeploy documentado o scriptado.
- `npm run verify:google-drive-oauth` pasa antes de considerar el entorno “listo para Drive”.

---

## 10. Seguimiento

| Tarea | Estado |
|-------|--------|
| Verify + `.env.local` + `run_drive_setup.sh` seguro | Hecho |
| `drive:bootstrap` (enable API + URLs) | Hecho |
| `drive:configure` + upsert Node único | Hecho |
| `drive:vercel-env` (Vercel CLI) | Hecho |
| CI opt-in (`drive-oauth-verify.yml`) | Hecho |
| Smoke dist (`verify:google-drive-dist`, `drive-oauth-dist-verify.yml`) | Hecho |

Actualizá esta tabla al cerrar fases.
