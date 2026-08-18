# AI context stack (WhatsApp)

Tres caminos alimentan “contexto WA”. Ninguno lee Drive hoy.

## A) Webhook / CRM (legacy)

`processWaConversation` → `callAgentOnce(waMessages, { channel: "wa" })`.

- System: `chatPrompts.buildSystemPromptParts` + `CHANNEL_RULES.wa`.
- Training KB: `findRelevantExamples` + `renderExamplesBlock` (prefiere `goodAnswerWA`).
- `maxTokens` default **400**.
- **Sin tool loop.**
- Resultado → columnas AF/AG en `CRM_Operativo`, no al teléfono.

## B) Cockpit enricher

`waEnricher.js` + bloque “3 opciones” (`buildWaCockpitSuggestionsBlock`) → `wa_suggestions`. Paste-back humano.

## C) Omni AI worker (canonical)

Jobs `classify` + `suggest`. `kbBridge.buildOmniRetrievalContext`:

- Últimos **5** `omni_messages`.
- RAG `retrieveSimilarQuotes` si `RAG_ENABLED` y embeddings reales (no stub).

## Stores

| Store | Path / flag | Rol WA |
|-------|-------------|--------|
| Training KB | `data/training-kb.json` + GCS | Q→A operativo; `responses.whatsapp` / `goodAnswerWA` |
| Surface | `kbSurface` `whatsapp` | Truncate **700** chars |
| Static product docs | `data/knowledge/*.md` | Inyectados en **todo** chat vía `knowledgeLoader.js` — no usar este pack ahí |
| brainKB | GCS/local, flag | Lecciones de política, no por canal |
| Auto-learn | `autoLearnExtractor` `source:"wa"` | Extrae pares; aprobación humana antes de active |
| Archive training | `docs/team/panelsim/knowledge/WA-ARCHIVE-TRAINING-MODE.md` | Export offline → `panelin:train:import` (PII) |
| RAG | `rag.js` + pgvector | Cotizaciones similares; a menudo OFF |

## Tools

| Superficie | Tools |
|------------|--------|
| Inbound webhook / enricher / Omni suggest | **No** |
| Panelin chat / MCP (`agentChat`, surface `whatsapp`) | **Sí** — `AGENT_TOOLS` |

WA-adjacent: `enviar_whatsapp_link`, `wa_lead_to_admin` (ambos con confirmación). Manifest: `docs/sdd/panelin-ai-agent-platform/evidence/tools-manifest.md`.

## Cómo debe usar este pack un conector

File-read según `CONTEXT-RECIPE.md`. No mezclar con `data/knowledge/` (prompt global). Un loader futuro puede importar `MANIFEST.json` y concatenar `layers.always` + layer del turno.
