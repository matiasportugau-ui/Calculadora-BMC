# HANDOFF — Agente IA: Gemini ejecuta la calculadora + interpretación de zonas + hardening

**Fecha:** 2026-06-29
**Autor:** Claude Code (sesión background)
**Estado:** ✅ Todo mergeado y LIVE en prod. Sesión cerrada.

---

## Qué se hizo (3 PRs encadenados, todos live)

Contexto: con Claude sin saldo, el agente Panelin cae al fallback **Gemini**. Se descubrió que Gemini **no ejecutaba la calculadora** — solo narraba `<tool_code>` como texto → **precios inventados**. Se arregló de raíz y se endureció.

### PR #472 — Gemini native function-calling
- **`server/lib/geminiTools.js`** (nuevo): adapta `AGENT_TOOLS` (Anthropic) → `functionDeclarations` (Gemini).
  - Whitelist de keys de schema; dropea `default`/`format`/`pattern`/`additionalProperties`.
  - Colapsa tipos-unión (`type:["string","number"]`) → escalar + `nullable`.
  - Omite `parameters` en tools sin args (Gemini rechaza object vacío).
  - `toGeminiResponse()` empaqueta el resultado de `executeTool` como objeto JSON.
- **`server/routes/agentChat.js`** branch `provider === "gemini"`: loop de function-calling de 8 rondas espejando el de Claude — **mismo `executeTool`, mismas auth-gates (`shouldBlockToolForUnauthenticatedChat`), mismos emits `verified_quote`/`suggestions`**.
- **🔑 Gotcha crítico:** `gemini-2.5-flash` tiene "thinking" ON por defecto y eso lo hace **narrar** las tools en texto en vez de emitir `functionCall` reales. Se pasa **`generationConfig.thinkingConfig.thinkingBudget: 0`**. Sin eso, las tools nunca disparan.
- **No usar `toolConfig` mode ANY**: con 42 tools da 400 "too many states for serving". Va en AUTO.
- Test: **`tests/geminiTools.test.js`** (137 asserts) encadenado en `test:agent`.

### PR #475 — Interpretación cantidad → zonas
- "N paneles de L m" se leía como una sola zona `{largo:L, ancho:1}` → misquote (5 m² en vez de 20).
- Nueva **"REGLA DURA — Geometría de zonas"** en `buildSystemPrompt()` (`server/lib/chatPrompts.js`, bloque OBLIGATORIO de tools): una sola costura → los 5 canales y todos los providers.
- Modelo del motor: zona = `{largo, ancho}` en metros; `cant_paneles = ceil(ancho/ancho_útil)`; `area = cant_paneles × largo × ancho_útil`. Ancho útil: **ISOROOF ≈ 1.0 m, ISODEC ≈ 1.12 m**.
- Mapeo: "N paneles de L m" → `{largo:L, ancho:N×ancho_útil}`; "techo de 6×4m" se usa tal cual.

### PR #478 — Hardening post-review (review adversarial de #472 + #475)
- `agentChat.js`: **abort-checks** en el loop gemini (antes de cada ronda y antes de ejecutar tools) → si el cliente se desconecta no quema rondas de API ni ejecuta tools con side-effects. **Log de observabilidad** si ronda-0 no trae functionCalls (detecta regresión de tool-calling).
- `chatPrompts.js`: scope **SOLO TECHO** (pared usa `perimetro`/`alto`, no `zonas`); **ejemplo ISODEC** (au 1.12 → 22.4 m²); **self-check apretado** (para "N paneles" verificar `cant_paneles==N`, no un área que el cliente no dio); pedir datos si faltan en vez de inventar.

---

## Verificado LIVE en prod (Cloud Run rev `00630-zct`, sirviendo 100%)

| Caso (forzando `aiProvider=gemini`) | Resultado |
|---|---|
| "4 paneles de 5m de largo" (sin ambigüedad) | auto → `calcular_cotizacion` → **4 paneles / 20 m² / USD 1702.68** ✅ |
| "4 paneles de 5m × 1m" (ambiguo) | **confirma la interpretación** antes de cotizar (entiende 20 m²) ✅ |
| Tras confirmar dimensiones | aplica largo 5 / ancho 4 y sigue el wizard (pide pendiente) ✅ |

Brain central (`VITE_FEATURE_BRAIN=true`) + modelo `gemini-2.5-flash` confirmados en la rev viva.

---

## Decisión abierta (tunable, no bloqueante)

Sobre la frase **ambigua** "4 paneles de 5m × **1m**" (el "1m" puede ser ancho del panel o del techo), el agente hoy **pregunta para confirmar** (más seguro, +1 turno) en vez de auto-asumir 20 m². Quedó en **confirmar**. Si el negocio prefiere que auto-asuma sin preguntar, es un ablande de una línea en la "REGLA DURA — Geometría de zonas" (`chatPrompts.js`).

---

## Estado de git / próximos pasos

- **Branch actual:** `docs/handoff-2026-06-29` (este doc + PROJECT-STATE) → PR de docs.
- **Mergeado a main:** #472, #475, #478. Ramas de feature borradas.
- **Sin trabajo pendiente bloqueante.** Fase 2 del brain (aprendizaje bidireccional prod→`distill()`) sigue scopeada y sin construir.
- **Follow-up de menor prioridad (decisión del usuario 2026-06-29 = NO hacer):** el path no-streaming `agentCore.js` (`callAgentOnce` — auto-respuestas WhatsApp + CRM "Generar con IA") es text-only por diseño; se mantiene como borrador revisado por operador, no auto-cotiza.

### Prompt para retomar
> "Revisar el agente Panelin en prod (rev Cloud Run `panelin-calc`). Hoy quedó live: Gemini ejecuta la calculadora (PR #472), interpretación N-paneles→zonas (#475) y hardening (#478). Decidir si en la frase ambigua '5m×1m' el agente debe auto-asumir 20 m² o seguir confirmando. Opcional: Fase 2 del brain (bidireccional)."
