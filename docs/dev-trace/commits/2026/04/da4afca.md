# Commit da4afca

- Fecha: 2026-04-29
- Hora: 03:58:20
- Autor: matiasportugau-ui
- Email: matias.portugau@gmail.com
- Branch: main
- Tipo: fix
- Scope: security
- Commit: fix(security): require API_AUTH_TOKEN on interaction-log + voice-session

## Resumen
require API_AUTH_TOKEN on interaction-log + voice-session

## Descripción
Este cambio registra el commit `fix(security): require API_AUTH_TOKEN on interaction-log + voice-session` dentro del sistema de trazabilidad del proyecto. Se modificaron 8 archivos: package.json, server/middleware/requireAuth.js, server/routes/agentFeedback.js, server/routes/agentVoice.js, server/routes/calc.js y 3 más.

Contexto del commit:
Three gaps surfaced when reviewing the d8f0421→01b2da0 commit chain:

- /calc/interaction-log/list and /file/:name (added in d8f0421) had no
  auth and exposed user prompts + calculator state.
- /api/agent/voice/session only enforced auth when devMode=true, so the
  default flow could mint OpenAI Realtime client_secrets unauthenticated
  (3/60s rate limit + CORS were the only barriers).
- The "always-mounted" voice panel from 7b6ff61 kept WebRTC + mic alive
  when voiceMode toggled off — no stop() was wired up.

Changes:
- server/middleware/requireAuth.js: extracted shared middleware (was
  inlined in agentFeedback.js).
- calc.js: requireAuth on the two interaction-log GET routes.
- agentVoice.js: requireAuth always on /agent/voice/session, dead
  isDevAuthorized helper removed.
- PanelinVoicePanel: accept voiceMode prop, stop() when it flips false
  and status !== idle.
- PanelinChatPanel: pass voiceMode down.
- tests/auth-routes.test.js (new, wired into test:api): 6 assertions
  covering 401 without auth, 200 with x-api-key, 200 with Bearer.

Deferred to a follow-up: Cloud Run secrets migration to Secret Manager
and ML_USE_PROD_REDIRECT conditional on SERVICE_NAME.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

## Señales automáticas (QA / release)
- Posible regresión (heurística): **sí**
- Tests / validación tocados: **sí**
- Breaking mencionado: **no**
- Impacto release sugerido: **med**
- Áreas (prefijos): server, src, tests

## Archivos modificados
- package.json
- server/middleware/requireAuth.js
- server/routes/agentFeedback.js
- server/routes/agentVoice.js
- server/routes/calc.js
- src/components/PanelinChatPanel.jsx
- src/components/PanelinVoicePanel.jsx
- tests/auth-routes.test.js

## Diff summary
```text
package.json                         |   2 +-
 server/middleware/requireAuth.js     |  10 +++
 server/routes/agentFeedback.js       |  11 +---
 server/routes/agentVoice.js          |  19 +-----
 server/routes/calc.js                |   5 +-
 src/components/PanelinChatPanel.jsx  |   3 +-
 src/components/PanelinVoicePanel.jsx |   6 ++
 tests/auth-routes.test.js            | 122 +++++++++++++++++++++++++++++++++++
 8 files changed, 147 insertions(+), 31 deletions(-)
```

## Riesgo de cambio (tamaño / extensiones)
Verde
