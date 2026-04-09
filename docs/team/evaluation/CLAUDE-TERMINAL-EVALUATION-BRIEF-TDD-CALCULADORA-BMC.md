# Brief de evaluación — TDD / testing en Calculadora BMC (Claude en terminal / Cursor)

**Uso:** copiar este archivo completo al chat de Claude (terminal o Cursor) y pedir explícitamente la evaluación según la sección «Instrucciones para el evaluador».

**Repo:** `Calculadora-BMC` (Panelin v3.x) — front en Vite/React, despliegue típico Vercel (`calculadora-bmc.vercel.app`), API Express en `server/`.

**Versión del brief:** 1.0  
**Fecha de referencia:** 2026-04-05

---

## 1. Rol del modelo evaluador

Actuás como **revisor senior** (ingeniería de software, calidad, arquitectura frontend, estrategia de tests). Tu trabajo es **evaluar críticamente** (no evangelizar) las propuestas y hallazgos que figuran abajo, señalar errores, omisiones y sesgos, y producir un **veredicto accionable**.

No ejecutes cambios en el código salvo que el usuario te lo pida aparte; esta tarea es **evaluación y recomendación**.

---

## 2. Contexto factual del repositorio (asumí esto como baseline)

| Tema | Dato |
|------|------|
| Stack front | React 18, Vite 7, ESM (`"type": "module"`) |
| Motor de cotización | `src/utils/calculations.js` (muchas exportaciones; comentarios de dominio en código) |
| Precios / lista | `src/data/constants.js`: `LISTA_ACTIVA`, `setListaPrecios`, `p()` |
| IVA en totales | `calcTotalesSinIVA` usa `getIVA()` desde `src/utils/calculatorConfig.js` (default 0.22; persistencia vía `localStorage` en browser) |
| UI principal | `src/PanelinCalculadoraV3.jsx` reexporta `src/components/PanelinCalculadoraV3_backup.jsx` |
| Tests actuales | `npm test` ejecuta **dos** scripts: `node tests/validation.js` y `node tests/roofVisualQuoteConsistency.js` |
| CI (GitHub Actions) | Job `validate` corre `node tests/validation.js` + `npm run build`; **no** ejecuta `roofVisualQuoteConsistency.js` en ese job (posible desalineación con `npm test` local) |
| Playwright | Presente en `devDependencies` |
| Runner “unitario” tipo Jest/Vitest | **No** configurado en `package.json` al momento del brief |

### 2.1 Comportamiento verificado (simulación previa)

- `npm test` en entorno sano: **282** asserts pasan en `validation.js` + **10** en `roofVisualQuoteConsistency.js`; tiempo del orden de **sub-segundo a ~1 s** en máquina dev típica.
- Import Node de `calcTotalesSinIVA` sin browser: funciona; IVA cae en default si no hay `localStorage`.
- `calcAutoportancia` devuelve `largoMinOK` / `largoMaxOK` como **booleanos**, no como valores numéricos de límite; rangos fabricación en `panel.lmin` / `panel.lmax`.

---

## 3. Artefacto A — Propuesta de piloto TDD (resumen para evaluar)

Objetivo: introducir **Vitest** + `@vitest/coverage-v8`, scripts `test:unit` / `coverage:unit`, **sin reemplazar** `npm test` actual.

Ámbito inicial sugerido: tests unitarios sobre funciones puras del motor:

- `calcTotalesSinIVA(allItems)`
- `calcPanelesTecho(panel, espesor, largo, ancho)`
- `calcAutoportancia(panel, espesor, largo)`

Prácticas sugeridas: `toBeCloseTo` para floats; `setListaPrecios('venta')` en `beforeEach`; factory que obtiene panel real desde catálogo (`PANELS_TECHO` vía `getPricing()` / constants según implementación); CI: ejecutar `npm run test:unit` antes del build.

**Nota explícita de desalineación con código real:** alguna documentación externa asumió `largoMaxOK` numérico (~8.5); el código usa booleanos. Los tests deben alinearse al contrato real o proponer cambio de API.

---

## 4. Artefacto B — Investigación / estrategia (preguntas que debe resolver el evaluador)

1. ¿Tiene sentido añadir Vitest si ya existe una suite Node grande y rápida? ¿Cuándo sí / cuándo no?
2. ¿Riesgo de duplicación de asserts entre `validation.js` y tests Vitest? ¿Cómo mitigarlo?
3. ¿`getIVA()` + `localStorage` es un riesgo real para determinismo en CI? ¿Qué política recomendás?
4. ¿La brecha CI (`validation.js` only vs `npm test` con dos scripts) es un defecto de proceso? ¿Qué harías?
5. ¿Semáforo de adopción TDD: verde / amarillo / rojo para este repo concreto?

---

## 5. Criterios de evaluación (rúbrica)

Calificá cada dimensión con **1–5** (1 = muy deficiente, 5 = excelente) y **una frase de justificación**.

| Dimensión | Qué mirás |
|-----------|-----------|
| **Factualidad** | ¿Las afirmaciones sobre el repo coinciden con el contexto de las secciones 2–2.1? |
| **Coherencia** | ¿El piloto Vitest encaja con ESM/Vite sin contradicciones? |
| **Riesgo / costo** | ¿Se identifican fricción, duplicación, falsos positivos, mantenimiento? |
| **Priorización** | ¿El orden motor → UI y el tamaño del piloto son razonables? |
| **Accionabilidad** | ¿Las recomendaciones son pasos concretos (no solo principios)? |
| **Honestidad** | ¿Evitás hype TDD y marcás trade-offs? |

**Promedio global:** (suma / 6), redondeado a 1 decimal.

---

## 6. Instrucciones para el evaluador (salida obligatoria)

Entregá la respuesta **exactamente** con esta estructura:

1. **Resumen en 5 viñetas** (hallazgos principales).
2. **Tabla rúbrica** (6 filas + promedio global).
3. **Errores o correcciones** al Artefacto A (lista numerada; si no hay, decir «Ninguno sustantivo»).
4. **Respuestas breves** a las 5 preguntas del Artefacto B (una por ítem).
5. **Recomendación ejecutiva** (máx. 120 palabras): qué harías en las próximas 2 semanas.
6. **Semáforo** con una sola etiqueta: **Verde** | **Amarillo** | **Rojo** para “adoptar piloto TDD como se describe”, con **una** frase de justificación.
7. **Riesgos residuales** (máx. 5 bullets).
8. **#ZonaDesconocida** — qué no podés afirmar sin leer el repo en vivo (si aplica).

**Restricciones de tono:** no marketing; no “siempre TDD”; citá trade-offs.

---

## 7. Prompt de una línea (opcional, para pegar en terminal)

```
Leé el archivo docs/team/evaluation/CLAUDE-TERMINAL-EVALUATION-BRIEF-TDD-CALCULADORA-BMC.md y producí la evaluación con la estructura de la sección 6. Sé crítico y accionable.
```

Si no tenés acceso al archivo, pedí que te peguen el contenido completo desde la sección 1 hasta la 6 inclusive.

---

## 8. Checklist post-evaluación (para el humano)

- [ ] ¿El evaluador marcó la desalineación CI vs `npm test`?
- [ ] ¿Mencionó booleanos vs numéricos en `calcAutoportancia`?
- [ ] ¿Distinguió “suite Node actual” vs “Vitest nuevo” sin confundirlos?
- [ ] ¿El semáforo está justificado con riesgos concretos?

---

*Fin del brief.*
