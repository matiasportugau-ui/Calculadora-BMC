# Training Loop Plan — Alineación del agente Panelin con cotizaciones reales

> Arquitectura completa del bucle de entrenamiento que ejercita **el agente
> Panelin (NLU + asunciones) + motor de cálculo + presentación** contra
> cotizaciones reales de la planilla `Enviados`, y produce fixes por etapa.

## Por qué multi-etapa

La PR #249 (`feat(evals)`) instaló el comparador del motor. Pero el motor es
solo una de las cuatro etapas que separan a un mensaje de cliente del PDF que
se envía. Si solo medimos el motor, perdemos los gaps donde Panelin falla más:
extracción ambigua, asunciones tácitas, presentación.

Cada etapa tiene su propia métrica, su propio finding-type, y su propio canal
de fix.

## Las 4 etapas

```
┌──────────────────────────────────────────────────────────────────────┐
│ FUENTE — Enviados[fila N]                                            │
│   inputs: consulta_raw (texto WhatsApp), cliente, zona, fecha        │
│   golden: PDF enviado + monto sin/con IVA + BOM de la planilla       │
└──────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ STAGE 1 — NLU (extracción estructurada)                              │
│   Probe:  texto consulta → { opciones:[{familia,espesor,cantP,largo}],│
│                              alcance, escenario_tipo }               │
│   Agente: Panelin con prompt de extracción (o regex baseline)        │
│   Score: % de campos detectados correctamente vs parsed_inputs       │
│   Finding-types: nlu-miss, nlu-wrong, ambiguity                      │
│   Fix-channel: KB (ejemplos few-shot) | system prompt | regex helper │
└──────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ STAGE 2 — Asunciones (completar campos faltantes)                    │
│   Probe:  NLU output + contexto → completed_inputs                   │
│            (ancho faltante, color, tipoEst, borders, opciones)       │
│   Agente: Panelin con KB de convenciones de la casa                  │
│   Score: % asunciones que coinciden con golden                       │
│   Finding-types: assumption-wrong, assumption-missing, conv-tacita   │
│   Fix-channel: KB (regla comercial) | default-config table           │
└──────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ STAGE 3 — Motor (deterministic)                                      │
│   Probe:  completed_inputs → BOM + totales sin/con IVA               │
│   Agente: calcTechoCompleto / calcParedCompleto (sin LLM)            │
│   Score: ±1% en totales, exact en cantidades                         │
│   Finding-types: bug, gap-data, gap-rule                             │
│   Fix-channel: src/utils/calculations.js | src/data/constants.js     │
└──────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ STAGE 4 — Presentación (WhatsApp/PDF)                                │
│   Probe:  BOM + cliente → mensaje WhatsApp + HTML/PDF                │
│   Agente: Panelin con channel="wa" + helpers.buildWhatsAppText       │
│   Score: cobertura de líneas + tone + monto coincidente              │
│   Finding-types: format-drift, tone-off, missing-disclaimer          │
│   Fix-channel: src/utils/helpers.js | KB (tono) | template           │
└──────────────────────────────────────────────────────────────────────┘
```

## Métrica global por corrida

```
RunScore = w1·NLU + w2·Assumptions + w3·Engine + w4·Presentation
  (pesos sugeridos iniciales: 0.20, 0.30, 0.35, 0.15)
```

Reportado por caso y global. Tendencia esperada: la curva sube parejo a medida
que aplicamos fixes.

## Stages → Findings → Fix-channels (clasificación)

| Finding-type | Stage | Canal de fix | Ejemplo |
|---|---|---|---|
| `nlu-miss` | 1 | KB (ejemplo) | Cliente dice "ISO 100/150" — el agente no infiere ISODEC |
| `nlu-wrong` | 1 | system prompt | Cliente dice "5p de 4.2 mts" — agente lee 5 paneles de 4.2m² (área) |
| `ambiguity` | 1 | KB (clarification rule) | "completo" — qué incluye |
| `assumption-wrong` | 2 | KB | Default color blanco cuando cliente no especifica |
| `assumption-missing` | 2 | default-config | Estructura no especificada — usar `metal` para residencial Mvdeo |
| `conv-tacita` | 2 | KB | "En techos chicos no cobramos cumbrera" |
| `bug` | 3 | calculations.js | BUG-001 lmin espurio |
| `gap-data` | 3 | constants.js | Precio ISODEC actualizado en lista MATRIZ pero no en `venta` |
| `gap-rule` | 3 | calculations.js | Falta regla de descuento por volumen |
| `format-drift` | 4 | helpers.js | Mensaje WhatsApp >800 chars (límite del canal) |
| `tone-off` | 4 | KB / chatPrompts.js | Agente formal cuando golden es rioplatense |
| `missing-disclaimer` | 4 | template | Falta "presupuesto válido 30 días" |

## Loop iterativo (corrida → fix → re-corrida)

```
1. Pickear 5-10 casos de Enviados con golden completo
2. Correr harness multi-etapa
3. Generar reporte global con score + findings
4. Triage:
   - findings tipo bug/gap-data/gap-rule → PR draft (autor: humano + Claude)
   - findings tipo nlu-*/assumption-*/conv-tacita → entrada KB via
     /api/ai-training/save-correction (queda pending si confidence <0.92,
     active si ≥0.92) — opcionalmente bypass humano con el dev panel
   - findings tipo format-drift/tone-off → ajuste helpers.js o chatPrompts.js
5. Re-correr el mismo batch → diff de score → confirmar mejora
6. Promover batch a "regression set" (los casos green entran al set fijo
   que se chequea en CI antes de merges de motor o prompts)
7. Volver a 1 con el siguiente batch
```

## Implementación incremental

| Iteración | Entregable | Estado |
|---|---|---|
| **i0** | Scaffold runner + Stage 3 (motor) + Carmen como fixture | **DONE** (PR #249) |
| **i1** | Multi-stage report; Carmen anotado manualmente; mediciones por etapa | **NEXT** |
| **i2** | Reader Sheets API de la tab `Enviados` (cuando haya credenciales) | pendiente |
| **i3** | Parser PDF golden (`pdf-parse`) | pendiente |
| **i4** | NLU agent probe automatizado (llama agentChat con `surface=eval`) | pendiente |
| **i5** | Assumption agent probe + KB de convenciones inicializada | pendiente |
| **i6** | Auto-injection de findings a `/api/ai-training/save-correction` | pendiente |
| **i7** | Regression set en CI (bloquea merges si baja el score global) | pendiente |
| **i8** | Loopback HTTP a `/calc/cotizar` (paridad con runtime de Panelin) | pendiente |

## Seams existentes que reusa cada etapa

| Stage | Reusa | Path |
|---|---|---|
| 1 | agentChat SSE | `server/routes/agentChat.js` |
| 1 | system prompt builder | `server/lib/chatPrompts.js#buildSystemPrompt` |
| 1 | KB retrieval | `server/lib/trainingKB.js#findRelevantExamples` |
| 2 | KB retrieval (mismo) | idem |
| 2 | autolearn | `server/lib/autoLearnExtractor.js` |
| 3 | motor | `src/utils/calculations.js` (`calcTechoCompleto`, `calcParedCompleto`, `calcTotalesSinIVA`) |
| 3 | loopback HTTP (paridad) | `server/lib/calcLoopbackClient.js` |
| 4 | WhatsApp text | `src/utils/helpers.js#buildWhatsAppText` |
| 4 | PDF generator | `server/routes/pdf.js` |

## Riesgos / decisiones abiertas

- **NLU determinista**: el LLM puede dar respuestas distintas en cada corrida.
  Mitigación: temperature=0, seed fijo si el provider lo soporta, y aceptamos
  ruido como un quinto componente del score (`nlu-stability`).
- **Costo**: cada caso = ~4 calls a LLM (NLU + assumptions + presentation +
  judge). Con 30 casos × 5 corridas/mes = 600 calls/mes. Usar Haiku para NLU
  y judge (ya lo hace autolearn), Sonnet para presentation.
- **Acoplamiento a runtime**: medir contra `agentChat` real implica spin-up del
  server. Mitigación: una `eval-fixture` mode que importe `buildSystemPrompt`
  directamente sin SSE.
- **Goldens incompletos**: Carmen no tiene PDF aún. La planilla a veces tiene
  monto pero no BOM. Definir granularidad mínima de golden: monto sin IVA
  + lista de paneles principales como mínimo viable.

## Definition of Done — Loop completo en producción

- [ ] 30 casos golden cargados (i2+i3 cubren ingestión)
- [ ] 4 stages instrumentadas, todas con score
- [ ] Score global ≥ 0.85 en regression set
- [ ] CI bloquea merges a `src/utils/calculations.js`, `src/data/constants.js`,
      `server/lib/chatPrompts.js` si score baja >2pts
- [ ] Auto-injection KB activa para findings con confidence ≥ 0.92
- [ ] Doc operativo para que un humano (TIN) revise/apruebe entries pending
