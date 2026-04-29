# Inventario Área 4 — Chat, KB, observabilidad (Fase 0)

**Fecha:** 2026-04-29 · Repo: Calculadora-BMC  

Resumen técnico de puntos que **Área 4 (KB central + pgvector + admin)** debe absorbere o migrar.

## 1. Streaming chat

| Artefacto | Rol |
|-----------|-----|
| `server/routes/agentChat.js` | `POST /api/agent/chat` SSE; cadena Claude→Grok→Gemini→OpenAI; `buildSystemPrompt`; tools en `ACTION_JSON`; autolearn al cerrar turno prod (≥4 turnos, una vez por `conversationId`) |
| `server/lib/chatPrompts.js` | Secciones `IDENTITY`, `CATALOG`, `WORKFLOW`, `ACTIONS_DOC` |
| `server/lib/agentTools.js` | Ejecución de acciones válidas desde el modelo |

**Superficie relacionada cliente:** [`src/hooks/useChat.js`](../../src/hooks/useChat.js) (nombre puede variar según refactors), componentes Panelin chat / dev panel.

## 2. Knowledge base (hoy)

| Artefacto | Rol |
|-----------|-----|
| `server/lib/trainingKB.js` | `loadTrainingKB` / `saveTrainingKB` (local + **GCS** si `K_SERVICE` + bucket); `addTrainingEntry`, `findRelevantExamples`, scoring `kb-score-config.json`, `getTrainingStats`, `getHealthEntries` |
| `data/training-kb.json` | Copia local; sync desde GCS en Cloud Run |
| `server/lib/autoLearnExtractor.js` | `extractLearnablePairs` (Claude Haiku) → entradas `source: autolearned` |

**Objetivo Área 4:** equivalente en **tablas** + **embeddings** + editor admin; pipeline de ingesta Markdown con versiones.

## 3. Telemetría y sesiones

| Artefacto | Rol |
|-----------|-----|
| `server/lib/conversationLog.js` | JSONL diario `CONV-*.jsonl`: `meta`, `turn`, `action`, `close`; `loadConversations`, `loadConversationById`, `computeResume` — **sin `user_id` hoy** |
| `server/lib/trainingKB.js` → `appendTrainingSessionEvent` | `SESSION-*.jsonl` resúmenes por turno |

**Gap Cloud Run:** filesystem efímero — requiere espejo durable (GCS/Postgres) antes de “cada interacción” en prod.

## 4. Endpoints de utilidad existentes

- `GET /api/agent/ai-options` — modelos permitidos
- `GET /api/agent/stats` — métricas agregadas (widget dev)
- Panel **Agent Admin** en hub (edición KB / prompts según implementación reciente)

## 5. Integraciones canales (fuera de este archivo detallado)

- **Mercado Libre:** `server/routes` ML, `mercadoLibreClient.js`, ML respuestas ↔ CRM.
- **WhatsApp / email / cockpit:** rutas `bmcDashboard`, `suggest-response` — alimentarán **misma KB** en meta-Área 4.

## 6. Próximo paso técnico sugerido

1. Crear proyecto Supabase y tablas esquema mínimo (`profiles`, `quotations`, `system_settings` stub).  
2. Definir job de **sync** `training-kb.json` → staging Postgres **una vez** para validación de contenido.  
3. Contrato JWT: middleware Express que llame `GET /auth/v1/user` con Bearer o verify JWT offline con JWKS.
