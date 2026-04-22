# MATPROMT bundle — RUN 2026-04-22 (Opus 4.7 + Realtime voice deploy closeout)

**Objetivo central del run:** Cerrar el ciclo de entrega de PR #88 (chatbot Panelin revision + Opus 4.7 adaptive thinking + OpenAI Realtime voice) a producción Cloud Run, validar contratos/seguridad del nuevo código y dejar PROJECT-STATE + Judge al día.

**Definition of Done:**
1. PR #88 merged a main, Cloud Run con commit merged, `OPENAI_REALTIME_MODEL=gpt-4o-realtime-preview` seteado.
2. Contrato API y seguridad de `agentVoice.js` auditados sin bloqueantes.
3. PROJECT-STATE con entrada 2026-04-22 consolidada; JUDGE-REPORT-RUN-2026-04-22 escrito.

## Run Scope Matrix

| Rol §2 | Modo | Justificación |
|--------|------|---------------|
| Sheets/Mapping | Ligero | No toca tabs/schema; confirmar agentChat changes no tocan bmcDashboard reads |
| Calc Specialist | Ligero | PR no tocó pricing ni BOM; gate:local confirma sin delta |
| Panelin Chat | Profundo | Core del PR: KB/logging/anti-repetition/caching/effort |
| API Contract | Profundo | Nuevo `/api/agent/voice/*` + cambios `/api/agent/chat` |
| Security | Profundo | Ephemeral Realtime token + rate limits |
| Deployment | Profundo | Objetivo del run (handoff al usuario; sandbox sin gcloud) |
| Fiscal | N/A | Sin cambios fiscales |
| Docs Sync | Profundo | PROJECT-STATE + propagación §4 |
| Judge | Profundo | Cierre del run |
| Parallel/Serial | Ligero | Contract + Security en paralelo; Deployment serial tras merge |
| Repo Sync | N/A | Sin cambios en repos hermanos |

## Per-role prompts

### Panelin Chat (Profundo)
- **Objetivo:** Revisar el estado final de `server/routes/agentChat.js`, `server/routes/agentVoice.js`, `server/lib/chatPrompts.js` tras PR #88 + Opus 4.7 upgrade.
- **Lectura obligatoria:** `docs/team/knowledge/PanelinChat.md` si existe; diff desde `240b21c` hasta `a33346a`.
- **Deliverable:** Lista de hot-paths del chat (logging, KB, anti-repetition, token estimation, summarizer, effort tiers), confirmar que `claude-opus-4-7` está en allowlist y que adaptive thinking/caching tienen fallback seguro.
- **Anti-patrón:** No inventar métricas de latencia sin evidencia; no proponer cambios de prompt system sin que el usuario los pida.
- **Handoff → API Contract:** lista de endpoints tocados y shape de respuestas.

### API Contract (Profundo)
- **Objetivo:** Validar que `/api/agent/chat`, `/api/agent/ai-options` y nuevos `/api/agent/voice/*` mantienen contrato estable.
- **Lectura:** `server/index.js` (montaje de rutas), `docs/openapi-calc.yaml` si aplica, `scripts/validate-api-contracts.js`.
- **Deliverable:** Tabla de rutas con método/campos esperados/observaciones; drift report si lo hay.
- **Handoff → Deployment + Docs Sync:** rutas nuevas a documentar; rutas a smoke-testear post-deploy.

### Security (Profundo)
- **Objetivo:** Auditar handling de ephemeral token en Realtime (¿se expone server secret al browser?), rate limiting, CORS, y allowlist de modelos.
- **Lectura:** `server/routes/agentVoice.js`, `src/hooks/useVoiceSession.js`, `src/utils/agentVoice.js` si existe, `server/config.js`.
- **Deliverable:** Findings categorizados (Crítico / Alto / Medio / Informativo). Si hay Crítico: bloquear deploy.
- **Handoff → Deployment:** ok/no-go + mitigations requeridas.

### Deployment (Profundo)
- **Objetivo:** Producir plan de merge + deploy + env var config ejecutable por el usuario (sandbox no tiene gcloud/gh).
- **Deliverable:** Comandos exactos, orden, verificación post-deploy (smoke), rollback plan.

### Docs Sync (Profundo)
- **Objetivo:** Consolidar entrada 2026-04-22 en PROJECT-STATE con TODO lo del run; propagar a §4.
- **Deliverable:** Sección nueva "Cambios recientes" + Pendientes actualizados.

### Judge (Profundo)
- **Objetivo:** JUDGE-REPORT-RUN-2026-04-22.md con ranking por rol, criterios cumplidos/no cumplidos, next-run prompts.

## Preguntas abiertas (para humano si cambia)
- Ninguna bloqueante — el usuario ya autorizó el plan (merge + deploy + env var).
