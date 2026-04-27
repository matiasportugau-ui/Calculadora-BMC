# Commit ffa578f

- Fecha: 2026-04-27
- Hora: 05:09:40
- Autor: matiasportugau-ui
- Email: matias.portugau@gmail.com
- Branch: main
- Tipo: feat
- Scope: agent
- Commit: feat(agent): auto-evolutionary learning pipeline

## Resumen
auto-evolutionary learning pipeline

## Descripción
Este cambio registra el commit `feat(agent): auto-evolutionary learning pipeline` dentro del sistema de trazabilidad del proyecto. Se modificaron 4 archivos: server/lib/autoLearnExtractor.js, server/lib/trainingKB.js, server/routes/agentTraining.js, src/components/AgentAdminModule.jsx.

Contexto del commit:
- trainingKB.js: status (active/pending/rejected), confidence, convId
  fields on entries; approveTrainingEntry(), rejectTrainingEntry(),
  listPendingEntries(); findRelevantExamples() skips non-active entries
- autoLearnExtractor.js: Claude Haiku extracts Q→A pairs from conv turns;
  confidence filter (≥0.70), dedup check vs existing KB (scoreThreshold=4),
  max 8 pairs per conversation
- agentTraining.js: POST /api/agent/autolearn (convId or raw turns),
  GET /api/agent/autolearn/pending, POST /api/agent/autolearn/:id/approve|reject;
  confidence ≥0.92 auto-approves, lower goes to review queue
- AgentAdminModule.jsx: "Cola IA" tab — approve/reject UI with confidence
  badge, category label, full answer preview

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

## Señales automáticas (QA / release)
- Posible regresión (heurística): **no**
- Tests / validación tocados: **no**
- Breaking mencionado: **no**
- Impacto release sugerido: **med**
- Áreas (prefijos): server, src

## Archivos modificados
- server/lib/autoLearnExtractor.js
- server/lib/trainingKB.js
- server/routes/agentTraining.js
- src/components/AgentAdminModule.jsx

## Diff summary
```text
server/lib/autoLearnExtractor.js    | 75 +++++++++++++++++++++++++++++
 server/lib/trainingKB.js            | 24 +++++++++-
 server/routes/agentTraining.js      | 68 +++++++++++++++++++++++++++
 src/components/AgentAdminModule.jsx | 94 +++++++++++++++++++++++++++++++++++++
 4 files changed, 260 insertions(+), 1 deletion(-)
```

## Riesgo de cambio (tamaño / extensiones)
Verde
