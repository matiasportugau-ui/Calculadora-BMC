# Simulación en ciego + mejora iterativa (tandas de 10) — Mercado Libre / BMC

**Propósito:** Construir **experticia reproducible** comparando, cada **10 consultas**, respuestas generadas **solo con entrenamiento + KB** (sin mirar primero la respuesta humana) contra las respuestas **reales de los agentes humanos** del historial ML. Al cerrar todas las tandas sobre el corpus, se obtiene un **paquete de mejora** (prompts, reglas, checklist) validado por iteración.

**No sustituye** [`../knowledge/ML-RESPUESTAS-KB-BMC.md`](../knowledge/ML-RESPUESTAS-KB-BMC.md); lo **alimenta** con evidencia por lote.

**Audiencia:** Matias, PANELSIM, rol Integrations, SIM-REV.

---

## 1. Principios

| Principio | Significado |
|-----------|-------------|
| **Ciego primero** | Quien redacta la respuesta simulada **no** debe ver el texto de la respuesta humana hasta **después** de fijar la versión “modelo/KB”. |
| **Tanda fija = 10** | Cada ciclo completo (simular → documentar → comparar → concluir → mejorar) usa **exactamente 10** preguntas, salvo que el corpus final tenga menos de 10 en la última tanda. |
| **Un documento por tanda** | Cada lote tiene su **informe** (tablas + conclusiones). Opcional: un **índice** al final que enlace `batch-01.md` … `batch-N.md`. |
| **Mejora antes de la siguiente tanda** | Tras la tanda *k*, se **incorporan** cambios (KB, prompt del asistente, reglas CRM/ML) y se **vuelve a correr** la tanda *k+1* con las mismas reglas nuevas. |
| **Sin publicar en ML** | La simulación es **offline** (documento + repo). Publicar en ML sigue el flujo operativo y modo aprobación. |

---

## 2. Fases por tanda (checklist)

### Fase A — Selección de las 10 consultas

1. Definir **orden estable** del corpus (p. ej. por `date_created` ascendente, o por `id` ascendente). Documentar la regla en el encabezado de la tanda.
2. Calcular **offset** = `(número_de_tanda - 1) × 10`.
3. Exportar **solo preguntas** para la ronda ciega (ver §5 script `npm run ml:sim-batch` modo `blind`).

### Fase B — Respuestas “solo entrenamiento” (simulación)

1. Instrucción explícita al modelo (o al operador humano que juega “IA”):

   > Olvidá las respuestas históricas de BMC en este hilo. Respondé como vendedor BMC Uruguay usando: política comercial vigente, [`ML-RESPUESTAS-KB-BMC.md`](../knowledge/ML-RESPUESTAS-KB-BMC.md), `docs/team/knowledge/Calc.md` si aplica, y datos verificables (MATRIZ/API) si están disponibles. **No inventes precios.**

2. Para cada una de las 10: pegar **pregunta del comprador** + contexto mínimo (`item_id` si se va a cotizar desde publicación).
3. Registrar la respuesta simulada en la tabla **antes** de abrir el gold standard humano.

### Fase C — Incorporar respuestas humanas (gold)

1. Exportar el mismo lote en modo **`gold`** (incluye texto de respuesta publicada si existe) — §5.
2. Copiar al documento de la tanda la columna **Respuesta humana (ML)**.

### Fase D — Comparación (matriz)

Para cada ítem, evaluar (0–2 o ✓/△/✗) al menos:

| Criterio | Qué mide |
|----------|----------|
| **Exactitud comercial** | Precios, inclusiones/exclusiones, política de envío/instalación. |
| **Alcance** | Si pidió aclaraciones cuando faltaban datos. |
| **Tono BMC** | Saludo, cierre, marca, cordialidad sin exagerar. |
| **Cumplimiento ML** | Claridad, sin datos prohibidos, longitud razonable. |
| **Honestidad** | No inventar; decir “no tengo dato” o pedir verificación. |

### Fase E — Conclusiones e mejoras (obligatorio)

1. **Lista corta** (máx. 5) de fallos recurrentes en la tanda.
2. **Acciones** clasificadas:
   - **KB** → editar `ML-RESPUESTAS-KB-BMC.md`
   - **Prompt** → texto para `suggest-response` / system prompt
   - **Código** → reglas en `server/` o scripts ML→CRM
   - **Operación** → capacitación humana
3. Asignar **owner** y si aplica **PR/commit**.

### Fase F — Cierre de tanda

1. Marcar la tanda como **DONE** en el índice (§7).
2. **No** avanzar a la tanda siguiente hasta tener Fase E cerrada (o explícitamente “defer” con motivo).

---

## 3. Número de tandas

Si el corpus tiene **N** preguntas (p. ej. 484):

\[
\text{tandas} = \lceil N / 10 \rceil
\]

Ejemplo: **49** tandas de 10 (la última puede traer 4 ítems si N=484).

---

## 4. Plantilla de documento por tanda

**Nombre sugerido:** `docs/team/panelsim/reports/ml-sim-runs/BATCH-NN-YYYY-MM-DD.md`  
**NN** = 01, 02, … con padding.

Copiar y rellenar:

```markdown
# ML sim — Tanda NN — YYYY-MM-DD

## Metadatos
- Orden del corpus: [p. ej. date_created ASC]
- Offset API: [ (NN-1)*10 ]
- Participantes: [quién simuló / qué modelo]
- KB / prompt version: [commit o fecha]

## Tabla (10 filas)

| # | question_id | item_id | Pregunta (comprador) | Respuesta simulada (ciego) | Respuesta humana (ML) | Notas comparación | Score global ✓/△/✗ |
|---|-------------|---------|------------------------|----------------------------|-------------------------|-------------------|---------------------|
| 1 | | | | | | | |
| … | | | | | | | |

## Resumen cuantitativo
- ✓ / △ / ✗ por criterio (tabla resumen).

## Conclusiones (máx. 5 bullets)

## Mejoras implementadas antes de tanda NN+1
- [ ] KB
- [ ] Prompt
- [ ] Código
- [ ] Ops

## Sign-off
- Revisó: [nombre] — Fecha
```

---

## 5. Herramienta: export de tanda (API local)

**Script:** `scripts/ml-simulation-batch-export.mjs`  
**npm:** `npm run ml:sim-batch -- --help`

**Requisitos:** API en marcha (`npm run start:api`), OAuth ML válido.

**Ejemplos:**

```bash
# Solo preguntas (ciego) — tanda 1 (offset 0)
npm run ml:sim-batch -- --offset 0 --size 10 --mode blind

# Incluir respuestas humanas para fase C — misma tanda
npm run ml:sim-batch -- --offset 0 --size 10 --mode gold

# Guardar a archivo
npm run ml:sim-batch -- --offset 0 --size 10 --mode blind --out docs/team/panelsim/reports/ml-sim-runs/tanda-01-blind.json
```

Variables opcionales:

- `BMC_API_BASE` — si la API no está en `http://127.0.0.1:3001`.

---

## 6. Al finalizar todas las tandas (run completo)

1. **Informe de síntesis** (un solo `.md`): top 10 lecciones + diff de prompts/KB entre inicio y fin.
2. **“Expertise pack”** sugerido para pegar en asistentes:
   - 1 párrafo de **identidad**
   - 10 **reglas duras**
   - 5 **anti‑patrones** detectados en simulación
3. **SIM-REV:** abrir issue o sección en `SIM-REV-REVIEW-*.md` citando tandas con mayor tasa de △/✗.

---

## 7. Índice de tandas (mantener a mano)

| Tanda | Archivo | Estado | Notas |
|-------|---------|--------|-------|
| 01 | `ml-sim-runs/BATCH-01-*.md` | ⬜ | |
| 02 | … | ⬜ | |
| … | | | |

*(Rellenar a medida que se ejecute el proceso.)*

---

## 8. Relación con PANELSIM

- **Modo aprobación:** la simulación **no** dispara `POST /ml/questions/:id/answer`.
- **Datos:** si se usa precio, priorizar **ítem ML** + **MATRIZ** verificada; alineado a reglas ya documentadas en PROJECT-STATE (sync CRM / verificación precio).

---

*Proceso diseñado para iteración continua; la calidad sube si cada tanda cierra Fase E antes de pasar a la siguiente.*
