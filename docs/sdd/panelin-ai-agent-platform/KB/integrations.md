# KB — Integrations (AI Agent Platform)

**Date:** 2026-07-23

| System | Direction | Auth | Used by | Notes |
|--------|-----------|------|---------|-------|
| Anthropic Claude | → HTTPS | `ANTHROPIC_API_KEY` | agentChat SSE, agentCore, SuperAgent | Primary Spanish+tools |
| xAI Grok | → HTTPS | `GROK_API_KEY` | failover | `grok-3-mini` default |
| Google Gemini | → HTTPS | `GEMINI_API_KEY` | failover + vision path | `gemini-2.5-flash` |
| OpenAI Chat | → HTTPS | `OPENAI_API_KEY` | failover, embeddings, Whisper | `gpt-4o-mini` |
| OpenAI Realtime | Browser↔WebRTC + mint | ephemeral `client_secret` | `/panelin/live` | No long-lived key in browser |
| OpenRouter | → HTTPS | `OPENROUTER_API_KEY` + flag | terminal failover | Off unless enabled |
| Calc `/calc/*` | → HTTP loopback | same process | agentTools | `AE-AGENT-CALC-CONTRACT.md` |
| Postgres pgvector | ↔ SQL | `DATABASE_URL` | rag.js | `quote_embeddings` |
| Google Sheets CRM | → HTTPS | service account JSON | CRM/wolfboard/sheets tools | **503** if down |
| WhatsApp Cloud API | → HTTPS | WA tokens | `enviar_whatsapp_link` | Write gated |
| GCS quotes / KB / brain | → HTTPS | GCP SA | quoteRegistry, trainingKB, brainKB | Optional buckets |
| Chatwoot | → HTTPS | `CHATWOOT_*` | email-agent tools | Separate from Omni email |
| MCP clients | → API | `BMC_API_TOKEN` | Cursor/Claude external | `mcp:panelin` |
| Vercel SPA | → API | cookies/JWT as needed | chat UI | No LLM on Vercel |
| Cloud Run `panelin-calc` | hosts brain | GSM secrets | all server AI | us-central1 |

## Env names (AI-related, values REDACTED)

See SDD §8 and `server/config.js`. Critical: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GROK_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_*`, `RAG_ENABLED`, `ASSISTANTS_ACTIVE`, `BUDGET_*`, `OMNI_AI_*`, `API_AUTH_TOKEN`, `DATABASE_URL`, `CHATWOOT_*`, `BRAIN_*`, `BMC_API_BASE`/`BMC_API_TOKEN` (MCP client).
