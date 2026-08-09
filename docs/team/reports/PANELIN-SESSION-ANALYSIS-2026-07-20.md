# Panelin — Análisis sesión operador (2026-07-20)

> **Status:** implementado 2026-07-22 · Wave 1–3 del plan de mejoras  
> **Sesión:** Calculadora v3.1.5 · Co-Work Live ON · DEV · Gemini  
> **Objetivo operador:** WhatsApp Web → extraer leads → Admin cotizaciones → borradores

## Resumen ejecutivo

El operador esperaba que Panelin **controlara** WhatsApp Web y **creara filas** en Admin. Co-Work solo entrega **JPEG read-only** de pestaña + tools Sheets/Wolfboard. El modelo alucinó acceso DOM, aprendizaje Google, y pidió filas Wolfboard inexistentes.

## Gap arquitectónico

| Esperado | Real |
|----------|------|
| Abrir/leer chats WA Web | Visión OCR sobre captura; no click |
| Agregar contacto en WA | No hay automatización WA Web |
| Crear fila Admin desde lead | Existía `POST /api/wolfboard/row-create` pero **sin tool agent** |
| Enviar a chat Ventas BMC | Solo `enviar_whatsapp_link` (Cloud API, confirm) |

## Problemas → causa → código

| # | Síntoma | Causa | Ubicación |
|---|---------|-------|-----------|
| 1 | Respuesta duplicada | Failover SSE concatena en mismo bubble | `agentChat.js`, `useChat.js` |
| 2 | Spam `_Se truncó…_` | `info` SSE en `content` → reenviado al historial | `useChat.js`, `chatSummarizer.js` |
| 3 | Co-Work info cada turno | Live ON + vision chain | `useScreenCoWork.js`, `agentChat.js` |
| 4 | Aprendizaje contradictorio | Prompt sin Training KB | `chatPrompts.js`, `trainingKB.js` |
| 5 | “Tengo acceso WA Web” | Prompt sin límites DOM | `chatPrompts.js` |
| 6 | No lee imagen babeta | OCR + sidebar vs bubble abierto | `liveAssistCore.js`, prompts |
| 7 | Pide fila Wolfboard | Sin tool crear fila | `agentTools.js` → **fix: `wa_lead_to_admin`** |
| 8 | “Sin acceso” sheets | Auth/alucinación post-fallo | `coworkSheets.js` |
| 9 | Pregunta largo babeta | Confunde desarrollo 16 cm vs largo pieza ~3 m | `constants.js`, prompts |
| 10 | Error 400 | `messages.length > 60`; UI genérica | `agentChat.js`, `chatErrors.js` |
| 11 | No escribe en Ventas BMC | Co-Work no tipea en WA Web | diseño |
| 12 | “Falta conexión Admin” | Parcial: `sheets_*` + `wolfboard_*` sí existen | gap UX + crear fila |

## Mejoras implementadas (2026-07-22)

### Wave 1 — Honestidad + higiene
- `coworkVisionBlock` + bloque aprendizaje BMC + babeta 16 cm / largo ~3 m
- `info` SSE → `infoNotes` (no en historial); strip al request
- Error 400 historial >60 accionable
- `operatorContext.defaults` (lista venta, 1 agua, plantilla falta-info)

### Wave 2 — WA → Admin
- Tool agent `wa_lead_to_admin` → `POST /api/wolfboard/row-create`

### Wave 3 — Failover
- SSE `provider_reset` + client clear bubble on provider switch

## Backlog restante (post-implementación)

| Item | Prioridad |
|------|-----------|
| Outbound feature flags (`PANELIN_WA_OUTBOUND_*`) | P1 |
| Modos semi/auto en UI | P1 |
| Allowlist Co-Work: ventas, matriz RO, pagos, calendario | P2 |
| Auto upsert contacto en path agent (Omni) | P2 |
| Tests E2E Co-Work + WA captura real | UAT humano |

## Referencias

- SDD: [`../SDD-PANELIN-COWORK.md`](../SDD-PANELIN-COWORK.md)
- SEC: [`../PANELIN-CHAT-AGENT-SEC.md`](../PANELIN-CHAT-AGENT-SEC.md)
- Transcript: sesión operador 2026-07-20 (chat Panelin + capturas WA Web)
