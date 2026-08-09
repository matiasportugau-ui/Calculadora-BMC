# KB — Integrations (Panelin Chat Agent)

| Integration | Direction | Used by | Failure semantics |
|-------------|-----------|---------|-------------------|
| Anthropic Claude | → HTTPS | Primary chat SSE | Failover next provider |
| xAI Grok | → HTTPS | Fallback | Failover |
| Google Gemini | → HTTPS | Fallback + vision/Co-Work | Prefer on attachments |
| OpenAI Chat | → HTTPS | Fallback | Failover |
| OpenAI Realtime | → WebRTC (browser) + mint API | `/panelin/live` | Ephemeral token; health/errors gated |
| OpenAI Whisper | → HTTPS | Transcribe fallback | Dictation prefers Web Speech |
| Postgres + pgvector | ↔ SQL | RAG quotes | Empty matches if down |
| Google Sheets | → API | CRM tools | **503** not 500 |
| WhatsApp Cloud API | → HTTPS | `enviar_whatsapp_link` | Tool error to model |
| Calc loopback | → `127.0.0.1:${port}/calc` | Cotización tools | Provenance `ae_agent` |
| Vercel SPA | ← users | UI | Proxies API via `getCalcApiBase()` |
| Cloud Run API | ← SPA / channels | All `/api/agent/*` | Secrets from GSM/Doppler |

Secrets: names only in `docs/team/runbooks/PANELIN-IA-OPS.md`.
