# Evals — State

Bitácora viva del sistema de evaluación. Actualizar al cerrar cada corrida.

## Componentes implementados

- [x] Scaffolding del runner (CLI + lib/)
- [x] Fixture format definido (`evals/fixtures/<case-id>.json`)
- [x] Motor de cálculo invocado in-process (sin HTTP loopback todavía)
- [x] Comparador con tolerancias ±1% total / qty exacta
- [x] Reporte markdown por caso + run summary
- [ ] **Reader Sheets API** (`Enviados`) — requiere `service-account.json` en el contenedor
- [ ] **PDF parser** — golden se carga a mano en el fixture
- [ ] **Loopback HTTP a /calc/cotizar** — para alinear 100% con cómo Panelin invoca al motor
- [ ] **Inyección automática a `data/training-kb.json`** — los findings `convencion` hoy se anotan en el reporte md y se trasladan a mano

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

