# Evidence — Data model (R2)

## Client state

| Store | Key / shape | Citation |
|-------|-------------|----------|
| React messages | `{ id, role, content, toolCalls?, actions?, verifiedQuote?, … }` | `useChat.js` |
| `conversationId` | persisted per tab | `useChat.js` load/save helpers |
| `localStorage` | `bmc.pdfLayout`, AI selection, chat layout | Panelin UI utilities |
| Calc state | Full calculator state blob in chat requests | `buildAgentChatRequestBody` |

## Server / persistence

| Store | Purpose | Tag |
|-------|---------|-----|
| Postgres `quote_embeddings` | RAG cosine search | CONFIRMED `rag.js:73-79` |
| Training KB (file/GCS) | Operator corrections / KB entries | CONFIRMED via training routes + PROJECT-STATE |
| `data/conversations/` | Optional turn logs when `CHAT_LOG_CONVERSATIONS=true` | CONFIRMED config + conversationLog |
| In-memory `toolStats` | Ring buffer ≤1000 | CONFIRMED toolStats + PANELIN-IA-OPS |
| In-memory `voiceErrorLog` | Voice mint failures | CONFIRMED agentVoice routes |
| Google Sheets CRM | Tools `guardar_en_crm`, taxonomía | CONFIRMED agentTools + 503 convention |

## Pricing truth

List prices USD sin IVA; IVA 22% at total — project CLAUDE.md / `calcTotalesSinIVA`. Agent must not invent prices; tools call calc loopback.
