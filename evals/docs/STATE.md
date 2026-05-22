# Evals — State

Bitácora viva del sistema de evaluación. Actualizar al cerrar cada corrida.

## Componentes implementados

- [x] Scaffolding del runner (CLI + lib/)
- [x] Fixture format definido (`evals/fixtures/<case-id>.json`)
- [x] Motor de cálculo invocado in-process (sin HTTP loopback todavía)
- [x] Comparador con tolerancias ±1% total / qty exacta
- [x] Reporte markdown por caso + run summary
- [x] **Doc de arquitectura multi-etapa** (`TRAINING-LOOP-PLAN.md`) — NLU + Asunciones + Motor + Presentación
- [x] **Worked example Carmen por etapas** (`CARMEN-RUN-MANUAL.md`) — 8 findings priorizados con canal de fix
- [x] **Reader Sheets API** (`evals/lib/sheetsClient.js` + `readEnviados.js`) — auth multi-source (file / inline / JSON env)
- [x] **Schema configurable** (`evals/lib/enviadosSchema.js`) — mapeo columnas → campos, ajustable por planilla
- [x] **Ingest automático** — fila Enviados → fixture con NLU heurística y defaults
- [x] **CLI con subcomandos**: `discover` / `ingest` / `run` / `batch` con `--resume`
- [x] **Runbook operativo** (`RUNBOOK.md`) — pre-requisitos, flujo paso a paso, troubleshooting
- [x] **Extracción de findings** — `runs/*/findings-candidates.json` por corrida
- [x] **Cloud Run proxy** (`server/routes/evalsRead.js`) — `/api/admin-cot/enviados/discover` + `/api/admin-cot/enviados?from=N&to=M`. Auth via `Bearer BMC_EVALS_API_TOKEN`. Permite correr el harness desde contenedores efímeros sin SA mounted.
- [x] **Fetcher abstraction** (`evals/lib/enviadosFetcher.js`) — auto-decide entre Sheets directo vs proxy según `BMC_EVALS_API_BASE` env
- [x] **PDF parser** (`evals/lib/parsePdfGolden.js`) — descarga PDFs (Drive shared incluido) y extrae total sin/con IVA + líneas BOM. Flag `--parse-pdfs` en ingest. Falla a status semántico (`no_text`, `no_total`, `download_error`) sin crashear.
- [ ] NLU agent probe LLM-based (Claude Haiku reemplaza regex heurística) — i4 pendiente
- [ ] Assumption agent probe + KB de convenciones inicializada — i5 pendiente
- [ ] Auto-injection al KB via `/api/ai-training/save-correction` — i6 pendiente
- [ ] Regression set en CI que bloquee merges si baja el score global — i7 pendiente
- [ ] Loopback HTTP a /calc/cotizar — paridad con runtime de Panelin — i8 pendiente

## Fixtures cargadas

| case_id | fila | cliente | golden disponible | notas |
|---|---|---|---|---|
| carmen-fila-13 | 13 | Carmen | ❌ pendiente | Oferta dual ISODEC EPS 100mm + 150mm |

## Casos golden externos pendientes de cargar

Mencionados en el zip externo pero sin JSON aún en `evals/fixtures/`:

- Leonardo Gularte
- Miguel Rodríguez
- Cristian
- Gregorio Campos (×2)
- María Maries Cudera (×2)

## Tolerancias actuales

- Total USD (sin/con IVA): ±1%
- Cantidades por línea: exactas

Configurable en `evals/lib/compareGolden.js`.

## Última corrida — 2026-05-22 (smoke Carmen)

**Casos:** `carmen-fila-13` (input-only, sin golden).

**Resultado del motor:**

| Opción | Subtotal sin IVA | Total con IVA |
|---|---|---|
| ISODEC EPS 100mm — 23.52 m² metal | USD 1.076,89 | USD 1.313,81 |
| ISODEC EPS 150mm — 23.52 m² metal | USD 1.194,98 | USD 1.457,88 |

**Findings:**

1. **`gap-input` — normalización de color**: el motor exige `"Blanco"` capitalizado;
   pasar `"blanco"` minúscula dispara warning `Color "blanco" no disponible para
   ISODEC_EPS`. Panelin debería normalizar entrada del usuario antes de pasar al motor.
   → Acción sugerida: agregar normalización `color.charAt(0).toUpperCase() + color.slice(1)`
   o equivalente en el cliente del motor; alternativamente case-insensitive en `panel.col.includes`.

2. **`gap-data` candidato — precio ISODEC EPS 100mm**: el doc externo (`carmen-fila-13.json`
   del zip) calculó 23.52 m² × 41.17 USD/m² = USD 968.08, pero el motor con lista `venta`
   devuelve 23.52 × 38.82 = USD 913.14. Diferencia ≈ 6%. **Verificar cuál es el precio
   vigente** (`venta` vs `web` vs `MATRIZ`) antes de marcar como bug.

3. **BUG-001 candidato no reproducido**: el zip predijo que ISODEC 150mm con largo 4.20m
   dispararía warning `lmin` espurio. En la corrida actual `lmin=2.3`, `lmax=14` para
   ISODEC_EPS, y 4.2 está dentro de rango → **no warning**. Posibles explicaciones:
   (a) bug ya corregido en código actual; (b) solo se reproduce con otros parámetros.
   Mantener candidato para retest cuando llegue el golden.

4. **`gap-input` — bordes asumidos**: Carmen no especificó bordes. El fixture asume
   `gotero frontal + gotero_sup fondo + gotero_lat × 2`. Confirmar convención de la casa
   cuando el cliente no aclara (probable entrada de KB).

