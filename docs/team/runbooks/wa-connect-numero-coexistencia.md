# Runbook — Conectar un número de negocio a la Cloud API por COEXISTENCIA + verificar por terminal

Conectar un número que **hoy vive en la app WhatsApp Business** a la **Cloud API oficial de Meta
(sin BSP)** por **coexistencia**: el número queda conectado a la API **sin dejar de funcionar en el
teléfono** y **sin pérdida de datos**. Luego se verifica y se hace el primer envío desde la terminal.

> **Caso concreto de esta corrida:** número de negocio **+598 92 663 245** (BMC Uruguay / METALOG SAS).
> El destinatario de prueba (un 2º número que controlás) se pasa en el momento del envío — no se commitea.

Coexistencia vs migración: la **migración** (`POST /{PHONE_NUMBER_ID}/register` + PIN de dos pasos)
**borra** la cuenta del teléfono. La **coexistencia** (Embedded Signup / Facebook Login for Business)
**no** borra nada — Meta muestra un **QR** que escaneás con la app WhatsApp Business. Este runbook usa
coexistencia. La conexión en sí ya está implementada en el repo (ver
[`wa-coexistence-onboarding.md`](./wa-coexistence-onboarding.md), flag `WA_COEXISTENCE_ENABLED`).

---

## Definition of Done

1. App tipo Business con producto WhatsApp + WABA vinculada al portfolio (se **verifica** en el paso 0).
2. Número vinculado por **Embedded Signup coexistencia** (QR escaneado); se obtiene su `PHONE_NUMBER_ID`;
   **sigue funcionando en la app**.
3. **System User (Admin)** asignado a App + WABA con **token permanente** con scopes
   `whatsapp_business_messaging` + `whatsapp_business_management`.
4. `.env` (gitignored) poblado con los nombres del repo: `META_APP_ID`, `WHATSAPP_APP_SECRET`,
   `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_VERIFY_TOKEN`, **`WABA_ID`**.
5. Mensaje real entregado a un destinatario de prueba con `hello_world`, devolviendo `wamid.*` y
   estado `delivered`.

## Plan de dos columnas

| # | Vos — click en el portal Meta | Terminal (read-only primero) |
|---|---|---|
| 0 | — | **Diagnóstico** con un token temporal del [Graph API Explorer](https://developers.facebook.com/tools/explorer/) (read-only). Poné `META_APP_ID`, `WHATSAPP_APP_SECRET`, `WABA_ID`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN=<token temporal>` en `.env` y corré `bash scripts/wa-check.sh`. Mapea WABA/número/scopes y `account_review_status`. |
| 1 | Business Settings → **Security Center** → estado de **Business Verification**. Si no está, iniciarla. | Gate externo — se marca el blocker y su timeline. |
| 2 | App → **Facebook Login for Business** → crear **configuración de Embedded Signup** (coexistencia) → copiar `config_id`. Pedir **Advanced Access** de `whatsapp_business_management` + `whatsapp_business_messaging`. | Poner `META_APP_ID` y `META_ES_CONFIG_ID` en `.env` / repo Variables. |
| 3 | Business Settings → **Users → System Users** → crear System User **Admin** → asignar **App** + **WABA** → **Generate token** con los 2 scopes de WhatsApp → copiar el token permanente. | Pegar el token en `.env` (`WHATSAPP_ACCESS_TOKEN`). `bash scripts/wa-check.sh` valida scopes + expiración vía `/debug_token`. **El token nunca se pega en el chat.** |
| 4 | En `/hub/wa` → Configuración → **Conexión / Números** → **Conectar WhatsApp** → en el popup de Meta, **escanear el QR con la app WhatsApp Business** del teléfono con el número. | El frontend (PR #1089) hace el code-exchange → `/api/wa/onboarding/exchange` → persiste. Confirmar el `PHONE_NUMBER_ID` + `WABA_ID` y reflejarlos en `.env`. |
| 5 | (si el display name está pendiente) confirmar **display name** en WhatsApp Manager. | `bash scripts/wa-check.sh` → `code_verification_status` / `verified_name`. |
| 6 | Dar de alta un **destinatario de prueba** (2º número que controles). | `bash scripts/wa-send-template.sh <TEST_RECIPIENT>` → `hello_world` → `wamid.*`. Confirmar recepción. |

## Scripts (en `scripts/`)

- **`wa-check.sh`** — read-only. `source .env`; `GET /debug_token` (validez + scopes, sin imprimir el
  token), `GET /{WABA_ID}?fields=id,name,account_review_status`,
  `GET /{PHONE_NUMBER_ID}?fields=display_phone_number,verified_name,quality_rating,code_verification_status`.
  Sale ≠ 0 si falta un scope de WhatsApp o el token es inválido.
- **`wa-send-template.sh <E.164> [plantilla] [idioma]`** — envía `hello_world` (default) al destinatario;
  pide confirmación (salta con `WA_SEND_YES=1`); imprime el `wamid.*`. Nunca imprime el token.

Ambos leen `.env` (mismos nombres que `server/config.js`). `GRAPH_API_VERSION` overridable (default `v21.0`).

## Gates externos (Meta) — bloqueos y su fix

- **Business Verification** — Embedded Signup coexistencia y el Advanced Access de los scopes de WhatsApp
  normalmente **requieren el negocio verificado**. Si está en revisión / sin iniciar, es el gate crítico
  (timeline típico: **días**). Se avanza el resto (System User, `.env`, scripts) en paralelo.
- **Advanced Access** de los 2 scopes pendiente → el popup de Embedded Signup puede fallar; se solicita en
  App Review.
- **Número en uso / display name** — si el número ya está atado a otra WABA, o el display name se rechaza,
  se resuelve en **WhatsApp Manager** (no con `/register`, porque es coexistencia).

## Verificación end-to-end

1. `bash scripts/wa-check.sh` → WABA id/name, número con `code_verification_status: VERIFIED`, y token con
   ambos scopes de WhatsApp.
2. `bash scripts/wa-send-template.sh <TEST_RECIPIENT>` → `wamid.*`.
3. El destinatario confirma que llegó el mensaje.
4. El número **sigue operativo en la app WhatsApp Business** (prueba de coexistencia).

## Próximo paso: webhook + código

Confirmar `{PUBLIC_BASE_URL}/webhooks/whatsapp` suscrito a la WABA (PR #1089 lo hace en `subscribeApp`),
`WHATSAPP_VERIFY_TOKEN` coincidente, y `npm run wa:cloud-check -- --probe`. A partir de ahí, enviar/recibir
desde código ya funciona: el resolver de salida (`server/lib/wa/waCredentials.js`) usa el número conectado.
