# Carmen (fila 13) — Corrida manual por etapas

> Primera iteración del loop multi-etapa (`TRAINING-LOOP-PLAN.md`).
> Worked example: Carmen pasada a mano por Stages 1→4. Sirve como base
> para automatizar el harness en iteraciones siguientes (i1+).

**Fuente:** `evals/fixtures/carmen-fila-13.json` + `evals/runs/2026-05-22T19-24-37-273Z/`
**Golden output:** no disponible (PDF no enviado todavía). Las etapas 1-3 se
puntúan vs `parsed_inputs` ya documentado. Stage 4 queda dormido.

---

## STAGE 1 — NLU

**Input:** `"Isodec 100 y 150 mm // 5p de 4.2 mts // completo"`

**Extracción esperada (`parsed_inputs.opciones_solicitadas`):**

| Campo | Esperado | Comentario |
|---|---|---|
| opción 1.familia | `ISODEC_EPS` | `Isodec` → ISODEC_EPS por defecto (vs ISODEC_PIR) |
| opción 1.espesor | `100` | mm |
| opción 1.cantPaneles | `5` | "5p" |
| opción 1.largo | `4.2` | "4.2 mts" |
| opción 2 | mismo, espesor `150` | "y 150 mm" implica segunda opción |
| alcance | `completo` | literal del texto |

**Findings que un agente NLU enfrenta:**

1. **`ambiguity` — familia ISODEC**: "Isodec" puede ser ISODEC_EPS o ISODEC_PIR.
   En BMC, default operativo es EPS (más barato, residencial). Convención no
   declarada en código.
   → Fix: entrada KB `category: "panel-defaults", question: "Cliente dice 'isodec' sin aclarar"`
2. **`nlu-miss` — ancho del techo**: "5p de 4.2 mts" indica largo del panel,
   pero NO el ancho del techo. Carmen no lo dijo. El motor necesita ancho.
   → Esto es entrada de Stage 2 (asunción), no de Stage 1.
3. **`ambiguity` — "completo"**: ¿incluye fijaciones? ¿selladores? ¿perfilería
   de borde? En BMC, `completo` = paneles + accesorios + sellador + fijación.
   → Fix: entrada KB `category: "alcance", question: "Qué incluye 'completo'"`.

**NLU score Carmen (vs parsed_inputs):**

| Campo | Detectado | Score |
|---|---|---|
| 2 opciones distintas | ✓ | 1/1 |
| familia ISODEC_EPS | con asunción (default) | 0.5/1 |
| espesores 100, 150 | ✓ | 2/2 |
| cantPaneles=5 c/u | ✓ | 1/1 |
| largo=4.2 | ✓ | 1/1 |
| alcance "completo" | ✓ | 1/1 |
| **Subtotal NLU** | | **6.5/7 = 0.93** |

---

## STAGE 2 — Asunciones

**Input:** output de Stage 1 + contexto (zona "Mvdeo Colón", canal WA, cliente "Carmen").

**Asunciones esperadas (`parsed_inputs.opciones[*].techo`):**

| Campo | Asumido | Justificación | Status |
|---|---|---|---|
| `ancho` | `5.6` m | inferido de área 23.52 m² / 5 paneles × 4.2 m (cuenta hacia atrás) | **WEAK** — falta golden |
| `tipoEst` | `metal` | Mvdeo residencial, asunción operativa | **WEAK** — falta golden |
| `color` | `Blanco` | default casa, sin especificación | OK |
| `borders.frente` | `gotero` | techo simple, default | **WEAK** |
| `borders.fondo` | `gotero_sup` | default ISODEC para fondo | **WEAK** |
| `borders.latIzq/Der` | `gotero_lat` | dos laterales | **WEAK** |
| `inclSell` | `true` | "completo" lo incluye | OK |
| `inclGotSup` | `true` | "completo" lo incluye | OK |
| `inclCanalon` | `false` | no mencionado y techo chico | **WEAK** |

**Findings:**

1. **`assumption-missing` — ancho del techo**: el motor lo necesita; Carmen
   no lo dio. El agente debería preguntar: "¿Cuál es el ancho total del techo
   (perpendicular al largo del panel)?" antes de cotizar. Cotizar con asunción
   ciega es riesgo de error.
   → Fix: regla en system prompt + KB `category: "missing-input", action: "ask-clarification"`.
2. **`conv-tacita` — estructura por zona**: "Mvdeo Colón residencial → metal"
   no está codificado en ningún lado. Es conocimiento operativo de TIN.
   → Fix: KB `category: "estructura-default-por-zona"`.
3. **`assumption-wrong` candidato — bordes "gotero_sup" en fondo**: en techos
   de 1 agua con frente bajo, el fondo lleva babeta de pared, no gotero
   superior. Sin saber si es 1 agua o 2 aguas no se puede decidir bien.
   → Fix: regla "preguntar config aguas antes de cotizar bordes".

**Asunciones score Carmen (vs `assumptions` declaradas):**

| Asunción | Coincide con declarada | Score |
|---|---|---|
| color Blanco | ✓ | 1/1 |
| tipoEst metal | con caveat | 0.5/1 |
| borders config | con caveat (config aguas no preguntada) | 0.5/1 |
| inclSell+inclGotSup="completo" | ✓ | 1/1 |
| ancho inferido | calculó hacia atrás | 0.5/1 |
| **Subtotal Asunciones** | | **3.5/5 = 0.70** |

---

## STAGE 3 — Motor

**Input:** `completed_inputs` de Stage 2 → invocación a `calcTechoCompleto`.

**Output del motor** (smoke ya ejecutado en `evals/runs/2026-05-22T19-24-37-273Z/`):

| Opción | Subtotal s/IVA | Total c/IVA | Items BOM |
|---|---|---|---|
| ISODEC EPS 100mm | USD 1.076,89 | USD 1.313,81 | 9 |
| ISODEC EPS 150mm | USD 1.194,98 | USD 1.457,88 | 9 |

**Findings:**

1. **`gap-data` candidato — precio ISODEC EPS 100mm**: doc externo del zip dice
   USD 41,17/m² (lista venta); motor devuelve USD 38,82/m². Δ ≈ 6%. Verificar
   cuál es vigente.
2. **BUG-001 no reproducido**: zip predijo warning `lmin` espurio con 4.20m +
   ISODEC 150mm. No ocurre con `lmin=2.3, lmax=14` del catálogo actual.
   → Posible: ya fixeado en commits posteriores al snapshot del zip.

**Engine score Carmen:** dormido hasta tener golden total.
Una vez con golden:
- match ±1% subtotal/total → `1.0`
- diff >1% → `0.0`
- match parcial (BOM correcto pero total off) → `0.5`

---

## STAGE 4 — Presentación

Dormido. Requiere golden PDF/WhatsApp para comparar.

Cuando llegue:
- comparar líneas BOM presentes en mensaje vs golden
- tone check (rioplatense informal vs formal)
- presencia de disclaimers obligatorios
- longitud vs límite del canal (WA 800c, ML 350c, chat ilimitado)

---

## Score global Carmen (proxy, sin Stages 3-4)

```
RunScore = 0.20·0.93 + 0.30·0.70 + 0.35·NaN + 0.15·NaN
        ≈ 0.39 sobre 0.50 alcanzable (78% de lo medible)
```

Equivale a "fila parseada razonablemente, pero faltó preguntar 2 datos clave
(ancho techo, config aguas) antes de cotizar".

## Findings priorizados para fix (esta corrida)

| # | Finding | Stage | Canal | Esfuerzo | Impacto |
|---|---|---|---|---|---|
| 1 | "isodec" → ISODEC_EPS default | 1 | KB | XS | alto (todo caso ISODEC) |
| 2 | Pedir ancho techo si falta | 2 | system prompt | S | crítico (evita cotizaciones ciegas) |
| 3 | Pedir config aguas si bordes ambiguos | 2 | system prompt | S | alto |
| 4 | KB: "completo" incluye accesorios + sellador + fijación | 1 | KB | XS | medio |
| 5 | KB: estructura metal default residencial Mvdeo | 2 | KB | XS | medio |
| 6 | Verificar precio ISODEC EPS 100mm (USD 38,82 vs 41,17) | 3 | constants | XS | crítico (revenue) |
| 7 | Normalización case-insensitive de `color` | 1/2 | code | S | bajo (ya capturado UX) |
| 8 | Re-test BUG-001 con todos los espesores ISODEC | 3 | test | S | medio |

## Próxima corrida — qué cambia

Cuando llegue el golden de Carmen (PDF + monto):

1. Actualizar `evals/fixtures/carmen-fila-13.json` con `expected_output.monto_total_sin_iva_usd`, etc.
2. Re-correr `npm run evals -- carmen-fila-13`.
3. Comparar contra `runs/2026-05-22T19-24-37-273Z/` (este reporte) para ver delta.
4. Si finding #6 (precio) se confirma, abrir PR a `src/data/constants.js` y re-correr.
5. Si finding #2 (pedir ancho) se confirma necesario, abrir PR a `server/lib/chatPrompts.js` con la regla.

Cada fix-canal se ejercita en al menos un caso antes de promoverlo al
regression set.
