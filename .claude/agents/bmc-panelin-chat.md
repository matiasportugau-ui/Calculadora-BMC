---
name: bmc-panelin-chat
description: "Specialist for the Panelin AI chat system and Developer Training Mode. Knows PanelinChatPanel, PanelinDevPanel, useChat hook, agentChat SSE endpoint, training KB, chatPrompts, and the dev mode (Ctrl+Shift+D). Use when working on chat UI, Panelin responses, training corrections, KB entries, system prompt editing, devMode features, per-message Good/Correct buttons, or agentChat server route."
model: sonnet
---

# Panelin Chat Specialist — AI Chat + Training KB

**Project root:** `/Users/matias/Panelin calc loca/Calculadora-BMC`

---

## Architecture

```
Frontend                          Backend
─────────────────                 ──────────────────────────────
PanelinCalculadoraV3_backup.jsx   server/routes/agentChat.js   ← SSE endpoint
  └─ PanelinChatPanel.jsx            └─ server/lib/chatPrompts.js
       └─ PanelinDevPanel.jsx              └─ buildSystemPrompt()
  └─ src/hooks/useChat.js                       └─ trainingExamples injected
                                   server/routes/agentTraining.js  ← REST CRUD
                                   server/lib/trainingKB.js
```

## Key files

| File | Role |
|------|------|
| `src/components/PanelinChatPanel.jsx` | Chat drawer UI, messages, dev buttons |
| `src/components/PanelinDevPanel.jsx` | Train/KB/Prompt tabs (dev mode panel) |
| `src/components/PanelinCalculadoraV3_backup.jsx` | devMode state (~2153), toggleDevMode (~227), keyboard shortcut Ctrl+Shift+D (~2290) |
| `src/hooks/useChat.js` | Chat state, devMode flag, saveCorrection, reloadTrainingKB |
| `server/routes/agentChat.js` | SSE stream, devMode branch (~167), kb_match (~231) |
| `server/routes/agentTraining.js` | POST /agent/train, GET /agent/training-kb |
| `server/lib/trainingKB.js` | KB CRUD, findRelevantExamples() |
| `server/lib/chatPrompts.js` | buildSystemPrompt(), trainingExamples injection (~195-220), `EXTRACTION_PROTOCOL` block |
| `server/lib/agentTools.js` | 22 Anthropic tools (calc + catalog + state + PDF + CRM + price-list/scenario compare + CRM-search + WhatsApp send + quote-cancel + raw-HTML + follow-up + client-history); `executeTool(name,input,calcState,{emitAction})` |
| `server/lib/quoteRegistry.js` | GCS-backed persistent registry. One JSON per quote at `gs://${GCS_QUOTES_BUCKET}/registry/{pdf_id}.json`. Survives Cloud Run cold-starts; falls back to 24h in-memory cache when bucket unset. |
| `server/lib/crmAppend.js` | `appendQuoteToCrm()` — Sheets writer for CRM_Operativo (col AH = quote URL, AI/AK gates default "No") |

## Tool surface (Claude tool-use loop, max 8 rounds)

**Read / catalog:** `obtener_escenarios`, `obtener_catalogo`, `obtener_informe_completo`, `listar_opciones_panel`, `obtener_precio_panel`, `get_calc_state`
**Calc:** `calcular_cotizacion`, `presupuesto_libre`
**Live UI write:** `aplicar_estado_calc` — emits `setScenario / setLP / setTecho / setTechoZonas / setPared / setCamara / setFlete / setProyecto` ACTION_JSON events through the SSE stream via the `emitAction` callback threaded into `executeTool`.
**PDF + share:** `generar_pdf` (POST `/calc/cotizar/pdf`), `listar_cotizaciones_recientes`, `obtener_cotizacion_por_id`
**CRM:** `formatear_resumen_crm` (pure, returns `{crm_text}`), `guardar_en_crm` (writes Sheets row — **only after explicit user save intent**)
**Price-list compare:** `comparar_listas` — runs the same quote on `web` and `venta`, returns `{web, venta, delta_usd, delta_pct, nota}`. Use when the seller asks "¿cuánto baja con lista venta?".
**Scenario compare:** `comparar_escenarios` — same shape but compares two scenarios (`solo_techo` vs `techo_fachada`, etc.). Single listaPrecios; use for "¿cuánto extra si le sumo la fachada?".
**CRM dedupe (read):** `buscar_cliente_crm` — searches `CRM_Operativo!B4:AH500` by name / phone / RUT. Required pre-step before `guardar_en_crm` (prompt enforces it).
**Customer outreach:** `enviar_whatsapp_link` — sends quote URL to customer via WhatsApp Cloud API (`server/lib/whatsappOutbound.js`). **Requires `user_confirmed: true`** in input.
**Quote cancel (soft delete):** `cancelar_cotizacion` — flips a quote's `status` to `cancelled` in the GCS registry (no hard delete). **Requires `user_confirmed: true`**. Filtered out of `listar_cotizaciones_recientes` unless `?include_cancelled=true`.
**Raw HTML access:** `obtener_pdf_html` — returns the HTML body of a stored quote (not the link), for inspection / translation / branding overrides.
**Internal follow-ups:** `programar_seguimiento` — wraps `server/lib/followUpStore.js` to add a local reminder for the operator. **Requires `user_confirmed: true`**. Local-only (operator-facing); does not touch the customer.
**Client history (composite):** `historial_cliente` — composes `buscar_cliente_crm` + `listar_cotizaciones_recientes`, returns merged `{crm, cotizaciones}` for a single client name. One tool call instead of two.

**Confirmation guard (transversal):** `guardar_en_crm`, `enviar_whatsapp_link`, `cancelar_cotizacion`, and `programar_seguimiento` all reject server-side if `input.user_confirmed !== true`. Prompt-level gating + server-level guard = no silent misfires from a model hallucination.

The conversational extraction flow (slot-filling protocol) lives in `chatPrompts.js`'s `EXTRACTION_PROTOCOL` block. Source of truth for required fields is `obtener_escenarios` (i.e. `/calc/escenarios`), not the static WORKFLOW text.

## Dev mode rules

- **Entry point:** `Ctrl/Cmd+Shift+D` only — no visible button for regular users
- DEV button in toolbar only renders when `devMode === true` (PanelinCalculadoraV3_backup.jsx)
- DEV button in chat header only renders when `devMode && onToggleDevMode` (PanelinChatPanel.jsx)
- Per-message Good/Correct buttons: only when `devMode && !isUser && msg.content`

## Training KB scope

Training KB is **chat-only** today. It feeds `buildSystemPrompt` via `findRelevantExamples()` in `agentChat.js`. It does NOT feed CRM suggest-response or ML sync. See `docs/team/DEV-TRAINING-MODE-SCOPE.md` for rationale and extension path.

## Style conventions (PanelinChatPanel.jsx)

Colors: `PRIMARY=#0071e3`, `SURFACE=#f5f5f7`, `BORDER=#e5e5ea`, `TEXT=#1d1d1f`, `SUBTEXT=#6e6e73`  
Inline styles only — no CSS modules, no Tailwind.  
Pill buttons: `borderRadius: 999`, `fontSize: 11`.

## Gates

```bash
npm run lint   # 0 errors required
npm test       # all tests pass
```

## Propagation

- If chat prompt changes → affects Panelin response quality → note in PROJECT-STATE
- If training KB schema changes → update agentTraining.js contract
- If devMode UI changes → verify keyboard shortcut still works, no visible UI leaks to regular users
