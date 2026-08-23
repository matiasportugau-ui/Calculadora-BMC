# Runbook — WhatsApp Coexistence onboarding (Embedded Signup)

Conectar un número de WhatsApp a la Cloud API **desde `/hub/wa`** por la vía oficial de
Meta (coexistencia), sin copiar tokens a mano en Cloud Run. Meta muestra un **QR de
coexistencia** en su propio popup; el operador lo escanea con la app **WhatsApp Business**
y el número queda vinculado a la Cloud API **sin dejar de funcionar en el teléfono**.

Companion del checklist manual histórico: [`WHATSAPP-META-E2E.md`](../WHATSAPP-META-E2E.md).
Feature detrás del flag `WA_COEXISTENCE_ENABLED` (default OFF): con el flag apagado las
rutas `/api/wa/onboarding/*` responden 404 y nada del comportamiento actual cambia.

## Cómo funciona (flujo)

1. Operador → `/hub/wa` → **Configuración** → **Conexión / Números** → **Conectar WhatsApp**.
2. El frontend carga el FB JS SDK y lanza Embedded Signup con el `config_id` de coexistencia.
3. **Meta** renderiza el QR en su popup; el operador lo escanea con WhatsApp Business.
4. Al terminar, FB devuelve un `code` + (por el evento `WA_EMBEDDED_SIGNUP`) el
   `phone_number_id` y el `waba_id`.
5. El frontend POSTea `{ code, phoneNumberId, wabaId }` a `POST /api/wa/onboarding/exchange`.
6. El backend: intercambia `code`→token de negocio, suscribe la app a la WABA
   (`/subscribed_apps`), registra el número (`/register`, best-effort), trae los detalles
   y **persiste la conexión cifrada** (`wa_connections`, token AES-256-GCM).
7. El envío saliente resuelve las credenciales de la conexión activa
   (`server/lib/wa/waCredentials.js`), con **fallback al env** (`WHATSAPP_ACCESS_TOKEN` /
   `WHATSAPP_PHONE_NUMBER_ID`) si no hay conexión.

El QR NO lo dibuja este repo — lo renderiza Meta. Nuestro trabajo es lanzar el flujo,
capturar el resultado y persistir.

## Prerrequisito de consola Meta (app ya existe)

La app de Meta con producto WhatsApp y negocio verificado ya existe. Falta:

1. **Facebook Login for Business → crear una configuración de Embedded Signup** para el
   flujo de **coexistencia**. Anotar el `config_id`.
2. **Permisos con Advanced Access** en la app: `whatsapp_business_management` y
   `whatsapp_business_messaging`.
3. Confirmar que la callback del webhook (`{PUBLIC_BASE_URL}/webhooks/whatsapp`) y el
   `WHATSAPP_VERIFY_TOKEN` / `WHATSAPP_APP_SECRET` ya están configurados (los usa la
   ingesta entrante existente; el onboarding solo suscribe la WABA).

> El `featureType`/params exactos del popup los define Meta según la versión de Graph;
> el `config_id` es la fuente de verdad del comportamiento del Embedded Signup. Validar
> contra la doc vigente de Meta al configurar.

## Variables de entorno

Backend (Cloud Run / `.env`):

| Var | Uso |
|-----|-----|
| `WA_COEXISTENCE_ENABLED` | `1` para habilitar la feature (default `0`). |
| `META_APP_ID` | client_id del intercambio code→token. |
| `META_ES_CONFIG_ID` | `config_id` de la configuración de Embedded Signup. |
| `WHATSAPP_APP_SECRET` (o `META_APP_SECRET`) | client_secret del intercambio (reusado). |
| `TOKEN_ENCRYPTION_KEY` | 64 hex (32 bytes) — cifra el token persistido. **Obligatoria** para conectar. |
| `GRAPH_API_VERSION` | opcional, default `v21.0`. |

Frontend (Vite, build-time; el front prefiere `GET /api/wa/onboarding/config`):
`VITE_WA_COEXISTENCE_ENABLED`, `VITE_META_APP_ID`, `VITE_META_ES_CONFIG_ID`,
`VITE_META_GRAPH_VERSION` (opt).

## Flip / rollback

- **Encender:** setear las vars, `WA_COEXISTENCE_ENABLED=1`, redeploy. La sección
  "Conexión / Números" aparece en `/hub/wa` → Configuración.
- **Apagar (rollback instantáneo):** `WA_COEXISTENCE_ENABLED=0`, redeploy. Las rutas dan
  404 y el saliente vuelve a usar solo el env. Los números ya conectados quedan en
  `wa_connections`; al reactivar el flag, el resolver los vuelve a usar.

## Cómo conecta un número el operador

1. `/hub/wa` → **Configuración** → **Conexión / Números** → **Conectar WhatsApp**.
2. En el popup de Meta, elegir el negocio/WABA y **escanear el QR** con la app WhatsApp
   Business del teléfono con el número a vincular.
3. Al finalizar, el número aparece en la lista con pills **activo** / **suscripto**.
4. Para desconectar: botón de tacho en la fila (marca inactivo; no borra historial).

## Verificación

- `node tests/waCoexistenceOnboarding.test.js`, `node tests/waCredentials.test.js`,
  `node tests/secretBox.test.js` (offline).
- Migración: `npm run wa:migrate` → verificar tabla `wa_connections`.
- Live: conectar un número de prueba, mandar un WhatsApp entrante (aparece en el cockpit
  por el webhook existente) y responder desde el cockpit (usa el token de la conexión).

## Archivos

- Backend: `server/routes/waOnboarding.js`, `server/lib/wa/waOnboarding.js`,
  `server/lib/wa/waConnectionStore.js`, `server/lib/wa/waCredentials.js`,
  `server/lib/secretBox.js`, `wa-package/migrations/019_wa_connections.sql`.
- Frontend: `src/components/wa/WaCoexistenceOnboarding.jsx`, `src/utils/facebookSdk.js`,
  sección `conexion` en `src/components/BmcWaSettingsPanel.jsx`.
