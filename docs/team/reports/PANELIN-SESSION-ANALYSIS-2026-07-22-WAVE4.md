# Panelin — Session gaps Wave 4 (2026-07-22)

> Follow-up to [`PANELIN-SESSION-ANALYSIS-2026-07-20.md`](./PANELIN-SESSION-ANALYSIS-2026-07-20.md) after Wave 1–3 shipped to prod.

## Operator transcript symptoms

- Confirmed Admin via OCR + `wolfboard_pendientes`, then mixed Gmail vs Admin.
- `ACTION_JSON:aplicar_estado_calc` leaked as text.
- Routine SSE noise (truncado / Usando gemini / Co-Work…) still visible.
- “Cargar al Admin” → offered quote_batch.
- “Julio” → asked for client name / claimed no CRM.
- Email send attempted; tool missing / hallucinated.

## Wave 4 fixes

| Fix | Location |
|-----|----------|
| Remap `aplicar_estado_calc` ACTION_JSON; drop unknown types | `agentChat.js` + `buildAplicarActions` |
| `normalizeTipoAguas` + defaults | `agentTools.js`, `coworkFrames.js` |
| Surface-intent prompts | `chatPrompts.js` |
| `desde` / `hasta` on quote list | `quoteRegistry.js`, tool schema |
| Routine infoNotes filter | `useChat.js` `isRoutineInfoNote` |
| Email draft + PANELSIM summary tools | `agentTools.js` (no send) |
| Skills | `panelin-cowork`, `bmc-panelin-chat`, `panelin-gym`, SKILL-INDEX |

## Skills

Canonical: [`.cursor/skills/panelin-cowork/SKILL.md`](../../../.cursor/skills/panelin-cowork/SKILL.md)
