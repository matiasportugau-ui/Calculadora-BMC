# Commit cdeef3c

- Fecha: 2026-04-27
- Hora: 15:33:42
- Autor: matiasportugau-ui
- Email: matias.portugau@gmail.com
- Branch: main
- Tipo: feat
- Scope: agent
- Commit: feat(agent): unified KB brain for Chat, WA and ML channels

## Resumen
unified KB brain for Chat, WA and ML channels

## Descripción
Este cambio registra el commit `feat(agent): unified KB brain for Chat, WA and ML channels` dentro del sistema de trazabilidad del proyecto. Se modificaron 3 archivos: server/index.js, server/lib/agentCore.js, server/lib/suggestResponse.js.

Contexto del commit:
agentCore.js — new shared entry point callAgentOnce(messages, {channel})
  - Loads KB via findRelevantExamples() (same store for all channels)
  - Builds system prompt via buildSystemPrompt() + per-channel rules
  - Channel rules: ml (350 chars, no markdown, no URLs, formal),
    wa (800 chars, friendly, emoji ok), chat (unlimited, markdown, tools)
  - Provider chain: claude → openai → grok → gemini

suggestResponse.js — now delegates entirely to callAgentOnce()
  - Detects channel from origen field (ML/mercado → "ml", else "wa")
  - Same KB, same system prompt, channel-appropriate response

index.js processWaConversation — replaces suggest-response HTTP fetch
  - Calls callAgentOnce directly with channel:"wa"
  - Adds autolearn setImmediate: WA exchanges now feed the unified KB
  - Extracts Q→A pairs, stores with source:"autolearned", convId=chatId

All three channels now share one KB, one system prompt base, one
provider chain. Channel differences are rules only, not separate brains.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

## Señales automáticas (QA / release)
- Posible regresión (heurística): **no**
- Tests / validación tocados: **no**
- Breaking mencionado: **no**
- Impacto release sugerido: **med**
- Áreas (prefijos): server

## Archivos modificados
- server/index.js
- server/lib/agentCore.js
- server/lib/suggestResponse.js

## Diff summary
```text
server/index.js               |  45 +++++++++++---
 server/lib/agentCore.js       | 139 ++++++++++++++++++++++++++++++++++++++++++
 server/lib/suggestResponse.js | 102 +++++--------------------------
 3 files changed, 189 insertions(+), 97 deletions(-)
```

## Riesgo de cambio (tamaño / extensiones)
Verde
