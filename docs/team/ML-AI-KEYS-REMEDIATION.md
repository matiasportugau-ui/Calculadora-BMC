# AI answer generation — provider keys remediation

> The /hub/ml-manager "✨ Generar con IA" button (and all agentCore suggest-response: CRM, WA, ML)
> returns **"All providers failed"** in prod. Diagnosed 2026-06-25. **This needs YOU** — every fix
> below requires billing or a console only the account owner can access. No code/sync fixes it.

## Why a sync won't help
The Doppler keys (`bmc-backend/prd`) **are** the Cloud Run keys (same source). Tested all of them
directly against each provider — they're not stale copies, they're the live dead keys. Local `.env`
has no AI keys. So there is no fresher/valid key anywhere to push to Cloud Run.

## Per-provider diagnosis (tested live, 2026-06-25)
| Provider | Test result | Root cause | What YOU must do |
|---|---|---|---|
| **Anthropic (claude)** — *primary, ranked first* | `400` "credit balance is too low" | Account out of credits | Add credits at console.anthropic.com → Plans & Billing |
| **OpenAI** | `429` `insufficient_quota` | Account out of quota/billing | Add billing at platform.openai.com → Billing |
| **Grok (x.ai)** | `400` "Incorrect API key provided" | Key invalid/revoked | Mint a new key at console.x.ai → update `GROK_API_KEY` (+`XAI_API_KEY`) |
| **Gemini (Google)** | key OK for ListModels (`200`) but **every** `generateContent` → `404` ("model no longer available" / not served) | Generative Language API not enabled-for-generation / key restricted on the Google project; backend also references retired model `gemini-2.0-flash` | In Google Cloud console for the key's project: enable **Generative Language API**, remove key API-restrictions, ensure billing; then code can target `gemini-2.5-flash` |

## Fastest path to working AI
**Fund Anthropic** (it's first in `AI_PROVIDER_RANKING`, `server/lib/suggestResponse.js:8`). One funded
provider makes the whole chain succeed — the button already falls through the chain correctly.

## After you fix a provider — how the key reaches prod
1. Update the key in Doppler: `doppler secrets set <NAME> --project=bmc-backend --config=prd`
2. Push to Cloud Run (prod reads GCP, not Doppler — no auto-sync):
   - via Secret Manager (canonical): update the secret `chatbot-bmc-live` mounts, then redeploy `panelin-calc`, OR
   - quick env override: `gcloud run services update panelin-calc --region us-central1 --update-env-vars <NAME>=...`
3. Verify (no deploy guesswork):
   ```
   curl -s -m60 -X POST https://panelin-calc-q74zutv7dq-uc.a.run.app/api/crm/suggest-response \
     -H 'Content-Type: application/json' -d '{"consulta":"prueba","origen":"mercadolibre"}' | jq '{ok,provider}'
   ```
   `ok:true` with a `provider` → AI generation works; the dashboard button will then return drafts.

## Code follow-up (optional, low value until API enabled)
`gemini-2.0-flash` is retired. If you choose the Gemini path, update the model to `gemini-2.5-flash`
in the agentCore Gemini call (`server/lib/agentCore.js:198` region) — but only after the Google API
enablement above, since current models also 404 on the key today.
