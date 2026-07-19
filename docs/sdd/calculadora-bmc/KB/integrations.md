# KB — integrations

External systems consumed by calculadora-bmc (as-built).

| System | Direction | Protocol / auth | Config names |
|--------|-----------|-----------------|--------------|
| **Vercel** | Host SPA | HTTPS | project linked to repo |
| **Cloud Run** (`panelin-calc`) | Host API | HTTPS; secrets from GCP SM | `PUBLIC_BASE_URL`, K_SERVICE |
| **Google Sheets** | R/W CRM/finanzas | Service account JSON | `BMC_*_SHEET_ID`, `GOOGLE_APPLICATION_CREDENTIALS` |
| **Google OAuth** | User login + Tasks | OAuth / ID token | `GOOGLE_OAUTH_CLIENT_ID`, Tasks OAuth routes |
| **Google Drive** | Quote archive / config | OAuth / SA | driveConfig routes |
| **Mercado Libre** | Listings/Q&A/orders | OAuth + API | `ML_CLIENT_*`, token GCS |
| **Meta WhatsApp / IG / Messenger** | Webhooks + Cloud API | Verify token + app secret | webhook + WA env |
| **Anthropic / OpenAI** | LLM completions | API keys | `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` |
| **OpenRouter** (optional) | LLM gateway | API key | aiProviderConfig |
| **Postgres** | WA, transportista, traktime, RAG | `DATABASE_URL` | migrations |
| **GCS** | ML token store | ADC | `ML_TOKEN_GCS_BUCKET` |
| **Shopify** | Webhooks / store | HMAC webhook | shopify router |
| **Chatwoot** (optional) | Email/inbox bridge | REST + webhook secret | `CHATWOOT_*` |
| **Doppler** (local SoT secrets) | Dev/ops | CLI | projects `bmc-frontend/prd`, `bmc-backend/prd` |

## Sheets semantic convention

Documented in AGENTS.md: 503 when Sheets down. Mapper canon in `docs/google-sheets-module/`.
