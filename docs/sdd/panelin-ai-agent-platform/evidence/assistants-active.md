# Evidence — ASSISTANTS_ACTIVE prod snapshot

**Date:** 2026-07-23  
**Closes (docs):** IMP-03 · G-P1-04

## Code defaults (CONFIRMED)

| Env | When `ASSISTANTS_ACTIVE` unset | Source |
|-----|--------------------------------|--------|
| `development` | `canales,panelin,email,wa,ml,wolfboard` | `server/config.js:385-393` |
| `production` | `canales` only | same |
| Separator | `,` **or** `;` (`;` preferred in transit — comma can break) | config comment 2026-07-04 |
| Always on | `seam` (not in allowlist; terminal) | `assistantRegistry.js` |

Registry keys: `canales`, `panelin`, `email`, `wa`, `ml`, `wolfboard`, `seam`.

## Prod snapshot (CONFIRMED 2026-07-23)

| Field | Value |
|-------|--------|
| Cloud Run service | `panelin-calc` · us-central1 · project `chatbot-bmc-live` |
| Env var present | **yes** |
| **Value** | **`canales;ml;panelin`** |
| RAG_ENABLED on revision env | **not set** (defaults **false** via config) |
| Omni daily budget | `OMNI_AI_DAILY_BUDGET_USD=50` (CONFIRMED on revision) |
| Doppler `bmc-backend/prd` | key **absent** (SoT is Cloud Run / GSM for this flag) |

**Interpretation:** Production allows Omni canales copilot, MercadoLibre assistant, and Panelin chat generation. Email / WA / wolfboard generation remain off unless toggled via hub runtime map or env change. `seam` remains available as terminal fallback.

## Live probe path

```text
GET /api/assistants/status
Auth: admin JWT or API_AUTH_TOKEN (requireServiceOrUser admin)
```

**CONFIRMED 2026-07-23:** unauthenticated → HTTP **401** `missing_credentials` (endpoint exists, not public).

Runtime toggles: `POST /api/assistants/:key/toggle` persists to `wa_settings` (layered over env allowlist). Do not treat env-only as full runtime state if hub toggles were used.

## How to re-snapshot

```bash
gcloud run services describe panelin-calc \
  --region=us-central1 --project=chatbot-bmc-live \
  --format='value(spec.template.spec.containers[0].env)' \
  | tr ',' '\n' | rg ASSISTANTS
# or YAML env list and find ASSISTANTS_ACTIVE
```

After change: verify hub `/hub/admin/assistants` matches env + `wa_settings` overrides.
