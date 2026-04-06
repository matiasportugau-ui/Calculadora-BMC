# Panelin-Gym — referencia rápida

## Stack local

| Objetivo | Comando |
|----------|---------|
| API | `npm run start:api` (default `:3001`) |
| UI + API | `npm run dev:full` o `./run_full_stack.sh` |
| `.env` base | `npm run env:ensure` |

## Autenticación dev (KB / prompts)

- Variable: `API_AUTH_TOKEN` (servidor y cliente deben coincidir).
- Header: `Authorization: Bearer <token>` o `X-Api-key` (rutas bajo `/api/agent/*`).

## Archivos en disco

| Artefacto | Ruta |
|-----------|------|
| KB entrenamiento | `data/training-kb.json` |
| Eventos sesión (JSONL) | `data/training-sessions/SESSION-YYYY-MM-DD.jsonl` |
| System prompt (secciones editables) | `server/lib/chatPrompts.js` |
| Historial chat en navegador (opcional) | `localStorage` key `panelin-chat-history` (solo si `persistHistory: true`; últimos 40 mensajes) |

## API (Express)

| Método | Ruta | Uso |
|--------|------|-----|
| POST | `/api/agent/train` | Alta entrada KB |
| PUT | `/api/agent/train/:id` | Editar entrada |
| DELETE | `/api/agent/train/:id` | Borrar entrada |
| GET | `/api/agent/training-kb` | Listar + stats |
| GET | `/api/agent/training-kb/match?q=` | Ejemplos relevantes |
| GET | `/api/agent/dev-config` | Leer secciones IDENTITY/CATALOG/WORKFLOW/ACTIONS_DOC |
| POST | `/api/agent/dev-config` | Guardar una sección |
| POST | `/api/agent/prompt-preview` | Preview del system prompt |
| POST | `/api/agent/training/log-event` | Evento custom JSONL |

Código: [`server/routes/agentTraining.js`](../../../server/routes/agentTraining.js).

## npm — calculadora / KB

| Script | Descripción |
|--------|-------------|
| `npm run panelin:train:import` | JSON → `POST /api/agent/train` |
| `npm run training:report` | Agrega eventos en `data/training-sessions/` |

## npm — Mercado Libre (API + OAuth)

| Script | Descripción |
|--------|-------------|
| `npm run ml:verify` | Health + OAuth ML |
| `npm run ml:corpus-export` | Corpus completo preguntas/respuestas → JSON (privado; ver doc) |
| `npm run ml:sim-batch` | Tanda blind/gold (`--offset`, `--size`, `--mode`) |
| `npm run ml:ai-audit` | Auditoría + informe MD (IA opcional; `--dry-run`) |
| `npm run ml:pending-workup` | UNANSWERED + checklist (`--json`) |

## Docs hub

- [`docs/team/panelsim/knowledge/ML-TRAINING-SYSTEM.md`](../../../docs/team/panelsim/knowledge/ML-TRAINING-SYSTEM.md)
- [`docs/team/panelsim/knowledge/ML-RESPUESTAS-KB-BMC.md`](../../../docs/team/panelsim/knowledge/ML-RESPUESTAS-KB-BMC.md)
- Skill ML: [`bmc-mercadolibre-api/SKILL.md`](../bmc-mercadolibre-api/SKILL.md)

## UI

- Modo desarrollador en chat: **Ctrl/Cmd+Shift+D** + token.
- Panel: [`src/components/PanelinDevPanel.jsx`](../../../src/components/PanelinDevPanel.jsx) (tabs Train / KB / Prompt).
