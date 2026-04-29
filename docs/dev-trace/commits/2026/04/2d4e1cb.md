# Commit 2d4e1cb

- Fecha: 2026-04-27
- Hora: 05:22:34
- Autor: matiasportugau-ui
- Email: matias.portugau@gmail.com
- Branch: main
- Tipo: fix
- Scope: agent
- Commit: fix(agent): remove stale hardcoded prices from CATALOG section

## Resumen
remove stale hardcoded prices from CATALOG section

## Descripción
Este cambio registra el commit `fix(agent): remove stale hardcoded prices from CATALOG section` dentro del sistema de trazabilidad del proyecto. Se modificó 1 archivo: server/lib/chatPrompts.js.

Contexto del commit:
CATALOG had outdated USD/m² figures that diverged from PRECIOS CANÓNICOS
(e.g. ISODEC EPS 100mm: $45.97 vs real $47.26; ISOROOF FOIL 50mm:
$44.66 vs real $46.00). With tool_use now enforcing price lookups, these
stale numbers caused potential confusion.

Replaced price tables with product-only descriptions: espesores, colores,
restricciones de color, mínimos de pedido. All USD/m² now come exclusively
from buildCanonicalPricingBlock() (dynamic from constants.js) + tools.

Side effect: ~30% CATALOG token reduction.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

## Señales automáticas (QA / release)
- Posible regresión (heurística): **no**
- Tests / validación tocados: **no**
- Breaking mencionado: **no**
- Impacto release sugerido: **med**
- Áreas (prefijos): server

## Archivos modificados
- server/lib/chatPrompts.js

## Diff summary
```text
server/lib/chatPrompts.js | 66 +++++++++++++++++++++--------------------------
 1 file changed, 29 insertions(+), 37 deletions(-)
```

## Riesgo de cambio (tamaño / extensiones)
Verde
