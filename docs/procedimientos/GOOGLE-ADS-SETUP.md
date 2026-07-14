# Google Ads API — Setup y Regeneración de Credenciales

Integración de la Google Ads API en `panelin-calc` (`server/lib/googleAdsClient.js` +
`server/routes/ads.js`, mount `/api/ads`). Cubre las 3 cuentas BMC bajo la MCC
"BMC Manager" (`3971648492`): BMC Uruguay (`8607757427`), BMC (`5831137980`), y una
cuenta huérfana vacía (`4264589825`).

## Los 5 secretos

| Key | Dónde vive | Sensibilidad |
|---|---|---|
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Google Ads UI → BMC Manager → Admin → API Center | Alta — Secret Manager |
| `GOOGLE_ADS_OAUTH_CLIENT_ID` | GCP Console (`chatbot-bmc-live`) → OAuth client | ID público — env var |
| `GOOGLE_ADS_OAUTH_CLIENT_SECRET` | idem | Alta — Secret Manager |
| `GOOGLE_ADS_REFRESH_TOKEN` | Generado vía el flujo manual de abajo | Alta — Secret Manager |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | La MCC (`3971648492`) | ID público — env var |

Ninguno de estos 5 valores debe aparecer nunca en memorias, transcripts, o git —
solo en Google Ads API Center, Doppler (`bmc-backend/prd`), y GCP Secret Manager
(`chatbot-bmc-live`).

## Regenerar el refresh token — el ÚNICO flujo sancionado

**NUNCA uses el botón "Authorize APIs" del OAuth Playground.** Ese botón emite el
authorization code bajo el client_id propio del Playground (`407408718192`), no el
de BMC — el refresh token resultante queda atado al Playground y cualquier
intercambio posterior con el client_id/secret reales de BMC falla con
`unauthorized_client`. Esto ya pasó una vez (ver `~/goal-prompt-fix-google-ads-refresh-token.md`).

El flujo correcto (ya implementado en `~/fix-refresh-token.sh`):

1. Construí la URL de autorización vos mismo, con el client_id **real** de BMC
   (`642127786762-48q1ssvp...`, GCP project `chatbot-bmc-live`):
   ```
   https://accounts.google.com/o/oauth2/v2/auth?client_id=<CLIENT_ID>&redirect_uri=https://developers.google.com/oauthplayground&response_type=code&scope=https://www.googleapis.com/auth/adwords&access_type=offline&prompt=consent
   ```
2. Abrí esa URL, logueate con la cuenta operativa (`matias.portugau@gmail.com`),
   aceptá. El Playground es solo la landing page pre-whitelisteada — nunca corre
   el intercambio, solo recibe el `code=` en la URL de vuelta.
3. Copiá el `code=` de la URL (expira en ~10 min — regenerá la URL si se vence).
4. Intercambialo manualmente:
   ```bash
   curl -sS -X POST https://oauth2.googleapis.com/token \
     --data-urlencode "client_id=<CLIENT_ID>" \
     --data-urlencode "client_secret=<CLIENT_SECRET>" \
     --data-urlencode "code=<CODE>" \
     --data-urlencode "grant_type=authorization_code" \
     --data-urlencode "redirect_uri=https://developers.google.com/oauthplayground"
   ```
   El `refresh_token` de la respuesta queda atado al client_id real de BMC.

## Hardening de una sola vez: Publishing status del OAuth client

En GCP Console → APIs & Services → OAuth consent screen (client
`642127786762-48q1ssvp...`): confirmá que el **Publishing status sea "In
production"**, no "Testing". En "Testing", Google expira el refresh token cada
7 días sin avisar — si el token se te vence solo, es probablemente esto y no un
bug de la integración.

## Smoke test (gate antes de tocar prod)

```bash
bash ~/google-ads-bootstrap-auto.sh
```

Este script: valida las 4 credenciales vía un intercambio refresh→access token,
llama `listAccessibleCustomers`, y **solo si eso funciona** empuja a Doppler
(`bmc-backend/prd`) → GCP Secret Manager (`chatbot-bmc-live`) → Cloud Run
(`panelin-calc`, `--update-secrets`). Si el smoke falla, aborta antes de tocar
nada — no hace falta desandar nada a mano.

## Vinculación de cuentas a la MCC

`GET /api/ads/mcc/linked-accounts` corre `SELECT customer_client.* FROM
customer_client` contra la MCC y devuelve qué cuentas están efectivamente
vinculadas hoy. Si BMC Uruguay (`8607757427`) no aparece, vincularla es una
acción manual de 2 clicks en la UI de Google Ads (MCC → Sub-account settings →
Link existing account) — no vale la pena escribir código API para un paso
estructural que se hace una sola vez.
