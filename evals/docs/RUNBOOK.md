# Evals Runbook — Operación del harness batch

Cómo correr el harness contra la planilla `Enviados` de forma autónoma,
batch largo, caso por caso en detalle.

## Pre-requisitos

### 1. Credenciales — dos modos

**Modo recomendado (proxy via Cloud Run API):** el server desplegado ya tiene
la SA mounted desde Secret Manager. El harness le pega por HTTPS y no necesita
credenciales locales. Setear en `.env`:

```
BMC_EVALS_API_BASE=https://panelin-calc-q74zutv7dq-uc.a.run.app
BMC_EVALS_API_TOKEN=<token random — el mismo que en el server>
```

En el server (Cloud Run env vars o `.env`), setear el mismo token:

```
BMC_EVALS_API_TOKEN=<token random>
```

Si `BMC_EVALS_API_TOKEN` no está set en el server, el endpoint `/api/admin-cot/enviados*`
responde 404 (política conservadora — no se expone la planilla por accidente).

**Modo directo (cuando corrés local con tus credenciales):** el harness habla
directo con Sheets API. Setear UNA de estas opciones:

**Opción A — archivo (más simple en local):**
```
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
WOLFB_ADMIN_SHEET_ID=1Ie0KCpgWhrGaAKGAS1giLo7xpqblOUOIHEg1QbOQuu0
```

**Opción B — inline (Cloud Run / GitHub Actions / contenedores efímeros):**
```
GOOGLE_CLIENT_EMAIL=panelin-sa@<project>.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
WOLFB_ADMIN_SHEET_ID=1Ie0KCpgWhrGaAKGAS1giLo7xpqblOUOIHEg1QbOQuu0
```

**Opción C — JSON inline (Vercel-style):**
```
GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
```

La SA debe tener **lectura** sobre la planilla (compartila con el email
de la SA si todavía no lo está).

### 2. Dependencias

```bash
npm install
```

### 3. Opcional — clave LLM para etapas NLU/Asunciones (i4+)

```
ANTHROPIC_API_KEY=sk-ant-...
```

Hoy las etapas 1-2 son heurísticas (regex). Con la key, futuras versiones
las correrán con Claude Haiku para extracción + asunciones más ricas.

## Flujo operativo recomendado

### Paso 1 — verificar mapeo de columnas (una sola vez por planilla)

```bash
npm run evals:discover
```

Imprime headers detectados y 4 filas de muestra. Si una columna esperada
(por ej. `MONTO TOTAL`) aparece en `col X` pero no está mapeada, editá
`evals/lib/enviadosSchema.js` agregando una entrada al array `SCHEMA`:

```js
{ col: "X", field: "monto_total", transform: num },
```

### Paso 2 — ingest (rango de filas)

```bash
npm run evals:ingest -- --rows 14-50
```

Lee filas 14..50 de `Enviados`. Por cada una con `cliente` o `consulta`
no vacíos, escribe un fixture en `evals/fixtures/<cliente>-fila-N.json`.
Skipea las ya existentes a menos que pases `--force`.

#### Con extracción automática de PDFs (recomendado)

```bash
npm run evals:ingest -- --rows 14-50 --parse-pdfs
```

Para cada fila con `link_pdf`, descarga el PDF (resuelve Drive shared links),
extrae texto con `pdf-parse` y completa `expected_output.monto_total_sin_iva_usd`
+ `monto_total_con_iva_usd` + `bom` cuando puede. Status posibles del parser:

- `parsed` — todo OK
- `no_total` — texto extraído pero no encontró pattern de total
- `no_text` — PDF es escaneo/imagen sin OCR
- `download_error` — falló descarga (link roto o restringido)
- `invalid_url` — URL no parseable
- `dep_missing` — falta `npm install pdf-parse`

El fixture queda igual escrito; los goldens fallidos se completan a mano.

### Paso 3 — corrida del motor + reporte por caso

```bash
npm run evals:all                  # corre todos los fixtures presentes
# o uno específico:
npm run evals -- run carmen-fila-13
```

Output en `evals/runs/<timestamp>/`:
- `<case-id>.report.md` — reporte detallado por caso
- `<case-id>.generated.json` — output del motor + comparación
- `run-report.md` — resumen global con tabla de status
- `progress.json` — estado por caso (para reanudar)
- `findings-candidates.json` — findings sugeridos por canal de fix

### Paso 4 — batch end-to-end (ingest + run en un comando)

```bash
npm run evals:batch -- --rows 14-50 --resume
```

`--resume` salta filas que ya tienen una corrida exitosa registrada en
`runs/*/progress.json`. Útil para batch largos que se interrumpen.

### Paso 5 — triage de findings

Abrir `evals/runs/<timestamp>/findings-candidates.json`. Cada entry tiene
`{ case_id, stage, type, detail, suggested_channel }`. Procesar:

- `stage: engine` con `type: gap-data | bug` → revisar `src/utils/calculations.js`
  o `src/data/constants.js`; abrir PR draft con el fix
- `stage: nlu | assumptions` → entrada al KB de Panelin via dev panel
  (POST `/api/ai-training/save-correction` con `{ category, question,
  goodAnswer, source: "evals-<case-id>" }`)
- `stage: presentation` → ajustar `src/utils/helpers.js` o `server/lib/chatPrompts.js`

### Paso 6 — re-correr y confirmar mejora

```bash
npm run evals:all
```

Comparar score global del nuevo run vs el anterior. Promover casos
`match` al regression set (i7).

## Batch largo — recomendaciones operativas

- **Rate limit**: Sheets API permite ~60 reads/min. Para batches >100 filas,
  considerar `--rows 1-50`, `--rows 51-100`, ... en sesiones separadas.
- **PDF parser**: hoy no extrae goldens de los PDFs automáticamente. Los
  fixtures se generan con `expected_output.status: "pdf_disponible_sin_monto"`
  cuando hay link pero no parseamos. Iteración i3 agrega `pdf-parse`.
- **Resumibilidad**: `--resume` lee `runs/*/progress.json` y salta casos
  con status `match | diff | no_golden`. Para forzar re-corrida total,
  borrar los progress.json o usar `--rows` explícito.
- **Concurrencia**: el runner es serial. Para acelerar batches grandes
  considerar correr varias instancias con rangos disjuntos.

## Troubleshooting

| Síntoma | Causa probable | Acción |
|---|---|---|
| `Credenciales de Google no disponibles` | Falta SA en env | Setear una de las 3 opciones de arriba |
| `Falta WOLFB_ADMIN_SHEET_ID` | env incompleto | Agregar `WOLFB_ADMIN_SHEET_ID=...` a `.env` |
| `403 PERMISSION_DENIED` al leer | SA sin acceso a la planilla | Compartir planilla con `client_email` de la SA |
| `Rango inválido: 0-10` | Filas <2 son header | Usar `--rows 2-10` (fila 2 es la primera de datos) |
| Fixture creado sin `opciones_solicitadas` | NLU heurística no detectó panel/dimensiones | Ver `nlu_baseline.missing` en el fixture; editar a mano o esperar i4 |
| `expected_output.status: pdf_disponible_sin_monto` | Falta parseo de PDF | Completar `monto_total_sin_iva_usd` a mano o esperar i3 |
| `engine_error` en run-report | Motor falló (ej. familia desconocida) | Ver `<case-id>.generated.json` → `opciones_resultados[].result.error` |

## Mapa de iteraciones (ver TRAINING-LOOP-PLAN.md)

- **i0**: motor + fixture format ✓
- **i1**: docs multi-etapa + worked example Carmen ✓
- **i2**: reader Sheets API + ingest + batch ✓
- **i2.5**: Cloud Run proxy `/api/admin-cot/enviados*` ✓
- **i3**: PDF parser (pdf-parse) — extracción automática de goldens ✓ ← **acá estamos**
- **i4**: NLU probe con Claude Haiku (reemplaza regex heurística)
- **i5**: Assumption probe + KB de convenciones inicializada
- **i6**: Auto-injection de findings al KB via /api/ai-training/save-correction
- **i7**: Regression set en CI
- **i8**: Loopback HTTP /calc/cotizar (paridad con runtime de Panelin)
