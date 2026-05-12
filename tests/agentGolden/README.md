# Panelin agent goldens

Versioned regression suite for `/api/agent/chat`. Asserts on the SSE
trajectory (tool calls, `verified_quote` payloads, `kb_match.surface`,
text predicates) — not on free text.

Companion of:
- [`docs/team/panelsim/PANELIN-IA-PREFLIGHT-DOSSIER.md`](../../docs/team/panelsim/PANELIN-IA-PREFLIGHT-DOSSIER.md) — épica D.
- [`docs/team/runbooks/PANELIN-IA-OPS.md`](../../docs/team/runbooks/PANELIN-IA-OPS.md) — checklist pre-release.

## Cómo correr

Pre-requisito: API arriba en `:3001` con al menos una key de proveedor IA.

```bash
# Con dev:full (API + Vite)
npm run dev:full
# … en otra terminal:
npm run test:agent-golden                    # corre todos
npm run test:agent-golden 01-quote-techo     # solo uno
GOLDEN_REQUIRED=1 npm run test:agent-golden  # falla si la API no está
API_BASE=https://panelin-calc-q74zutv7dq-uc.a.run.app npm run test:agent-golden
```

**Skip-friendly por default**: si la API no responde o no hay keys de
proveedor, el runner sale con código 0 y un aviso. CI sin secrets
nunca rompe. Antes de un release, exportá `GOLDEN_REQUIRED=1` para
volver el skip en fallo.

## Estructura de un caso

`tests/agentGolden/cases/<id>.json`:

```json
{
  "id": "01-quote-techo",
  "description": "qué se valida, en una línea.",
  "calcState": "solo-techo",
  "surface": "panelin_chat",
  "request": {
    "messages": [{ "role": "user", "content": "..." }],
    "aiProvider": "auto",
    "aiModel": ""
  },
  "asserts": [
    { "type": "tool_called", "name": "calcular_cotizacion" },
    { "type": "verified_quote_field_eq", "field": "kind", "value": "single" }
  ],
  "timeoutMs": 60000
}
```

`calcState` apunta a un fixture en `fixtures/calc-states/`; alternativamente
se puede embeber un objeto en `request.calcState`.

## Tipos de assert soportados

| Tipo | Args | Verifica |
|---|---|---|
| `tool_called` | `name` | algún `tool_call` con ese nombre |
| `tool_not_called` | `name` | ningún `tool_call` con ese nombre |
| `verified_quote_emitted` | — | ≥1 `verified_quote` en la traza |
| `verified_quote_not_emitted` | — | 0 `verified_quote` en la traza |
| `verified_quote_field_eq` | `field`, `value` | igualdad exacta sobre el primer payload |
| `verified_quote_field_gt` | `field`, `value` | `> value` (numérico) |
| `verified_quote_field_gte` | `field`, `value` | `>= value` |
| `text_contains` | `value`, `caseSensitive?` | el texto del asistente contiene |
| `text_not_contains` | `value`, `caseSensitive?` | el texto NO contiene |
| `text_max_chars` | `value` | longitud máx (útil para canal ML/WA) |
| `kb_match_surface` | `value` | el evento `kb_match` reporta ese surface |

## Cuándo agregar un caso

- Cambiaste un prompt en `chatPrompts.js` y querés bloquear la regresión.
- Agregaste una tool nueva a `agentTools.js` que el modelo debería elegir.
- Cambiaste la elegibilidad de `verified_quote` en `verifiedQuotePayload.js`.
- Cambiaste la cadena de fallback de `resolveTrainingAnswer` o `kbSurface`.
- Apareció un bug en producción que querés que nunca vuelva.

## Sin write tools en este pase

`guardar_en_crm`, `enviar_whatsapp_link`, `escribir_crm_taxonomia` y
follow-ups requieren auth + side-effects reales. Quedan fuera de este
runner por ahora; se cubren con `tests/agentTools.test.js` (gate por
intent) y `tests/userIntentClassifier.test.js` (parsing). Una próxima
iteración puede agregarlos con un mock de Sheets/WA.

## Migración a Promptfoo (opcional)

El dataset JSON es portable a [Promptfoo](https://promptfoo.dev) si el
equipo quiere matrices visuales y CI dashboards. La traducción 1:1
es:

| este runner | Promptfoo |
|---|---|
| `tool_called` | `trajectory:tool-used` |
| `tool_not_called` | custom `javascript:` que inspecciona `output.toolCalls` |
| `verified_quote_field_eq` | `equals` sobre extractor JS |
| `text_contains` | `contains` |

No urge migrar — el runner zero-deps cumple el SLA y el dataset queda
versionado bajo `cases/`.
