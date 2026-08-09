# TARGET — Grok Voice Agent option

| Field | Value |
|-------|--------|
| **Slug** | `grok-voice-agent` |
| **Need** | Option to run Panelin voice with **Grok Voice Agent** (xAI), not only OpenAI Realtime |
| **API** | Grok Speech-to-Speech / Voice Agent API — OpenAI Realtime-compatible (`wss://api.x.ai/v1/realtime`, ephemeral `client_secrets`) |
| **Key** | Existing `GROK_API_KEY` / `XAI_API_KEY` |
| **Models** | `grok-voice-latest`, `grok-voice-think-fast-1.0` |
| **UI** | Selecting **Grok** in chat selector drives Live + documents chat-voice text path |

Related: `docs/sdd/panelin-voice-agent/SDD.md`, `docs/sdd/panelin-agent-selector/SDD.md`
