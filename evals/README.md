# Evals — Alineación del motor con cotizaciones reales

Sistema para auditar la calidad del motor de cálculo de Calculadora BMC contra
cotizaciones reales históricas de la planilla **2.0 Administrador de
Cotizaciones** (`Enviados`). Cada gap detectado se vuelve un fix propuesto
(código, datos o KB de Panelin).

## Para qué sirve

1. Tomar una fila de la planilla `Enviados` (cotización que ya salió al cliente).
2. Normalizar los inputs (panel, espesor, dimensiones, accesorios, scope).
3. Correr el motor (`calcTechoCompleto` / `calcParedCompleto`).
4. Comparar BOM + totales contra el golden output (PDF enviado + desglose de la
   planilla).
5. Producir un reporte por caso + reporte global de la corrida.
6. Alimentar dos canales:
   - **`evals/runs/`** — bitácora versionada de cada corrida.
   - **KB de Panelin** (`data/training-kb.json`) — aprendizajes que el agente de
     la calculadora consume en runtime.

## Estructura

```
evals/
├── cli.js                          orquestador (CLI)
├── lib/
│   ├── loadCase.js                 lee fixture JSON
│   ├── parseCase.js                normaliza a input de /calc/cotizar
│   ├── runQuote.js                 corre el motor (in-process)
│   ├── compareGolden.js            diff con tolerancias ±1% total, exact qty
│   └── report.js                   markdown por caso + run summary
├── fixtures/                       casos golden (uno por archivo)
│   └── carmen-fila-13.json
├── runs/                           outputs por corrida (gitignored salvo .gitkeep)
└── docs/                           notas de metodología (opcional)
```

## Uso

```bash
# Corre un caso por id (sin tolerar HTTP — invoca motor en proceso)
npm run evals -- carmen-fila-13

# Corre todos los casos en fixtures/
npm run evals -- --all

# Output va a evals/runs/<timestamp>/
```

Cada corrida produce:
- `evals/runs/<timestamp>/<case-id>.report.md` — reporte por caso.
- `evals/runs/<timestamp>/run-report.md` — resumen global.

## Tolerancias

- **Total USD (sin/con IVA)**: ±1%.
- **Cantidades por línea de BOM**: exactas.
- **Precios unitarios**: exactos (los toma del catálogo, no del golden).

Configurable en `evals/lib/compareGolden.js` (`TOLERANCES`).

## Formato de fixture

Ver `evals/fixtures/carmen-fila-13.json`. Campos clave:

- `case_id`, `fila_planilla`, `fuente.url`
- `inputs_raw` — copia textual de la fila (debug, no usado por el motor).
- `parsed_inputs` — input normalizado (lo que consume el motor):
  - `opciones_solicitadas[]` — una por escenario/opción (techo, pared, etc.).
  - `alcance` — `solo_paneles` | `completo`.
  - `flete`, `destino`.
- `expected_output` — golden:
  - `total_sin_iva_usd`, `total_con_iva_usd`
  - `bom[]` — items con `desc`, `qty`, `unit`, `precio_unit_usd?`
  - `pdf_path` o `pdf_url`
- `assumptions`, `gaps_pendientes` — texto libre.

## Gaps actuales

Ver `evals/docs/STATE.md` para el listado vivo.

- **Sheets API reader** — no implementado. Por ahora los casos viven como
  fixtures JSON. Cuando el contenedor tenga el `service-account.json`
  montado, agregar `evals/lib/readEnviados.js`.
- **PDF parser** — no implementado. El golden se carga a mano en el fixture
  hasta tener un parser confiable.
- **Carmen (fila 13)** — golden output pendiente (PDF no enviado todavía).

## Loop hacia Panelin

Cada finding del reporte se clasifica:

| Tipo | Acción |
|---|---|
| `OK` | nada |
| `gap-input` | revisar mapeo de columnas / parseo |
| `gap-rule` | regla de negocio faltante en motor → propuesta de fix |
| `gap-data` | constante / precio desactualizado → PR a `src/data/constants.js` |
| `bug` | bug en motor → PR a `src/utils/calculations.js` con repro |
| `convencion` | aprendizaje comercial → entrada en `data/training-kb.json` |

Los `convencion` se vuelcan al KB con el formato existente
(`{ id, category, question, badAnswer, goodAnswer, context, source }`) para que
Panelin los consuma en runtime sin redeploy del modelo.
