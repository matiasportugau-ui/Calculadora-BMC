# Casa incendio — Dolores (reconstrucción)

Caso de presupuesto: reconstrucción de vivienda destruida por incendio, sobre platea
elevada + pilotes. Incluye módulo tiny house temporal y salón de degustación.
Cerramientos en chapa / panel sándwich (~160 m² de techos en total).

## Archivos

- `plano-vivienda.svg` / `plano-vivienda.png` — **Lám. 01 · Planta de perímetro y cubierta** (Esc. 1:100).
  **Interior vacío** (sin subdivisiones): solo el perímetro de la vivienda para computar la cubierta.
  **Borrador para revisión.**
- Generador: `scripts/plano-vivienda-reconstruccion.mjs` (`node scripts/plano-vivienda-reconstruccion.mjs`
  regenera el SVG; ver comentario al pie para rasterizar a PNG con `@resvg/resvg-js`).

## Geometría (perímetro)

- **Cuerpo principal:** 14,00 × 6,00 m = **84,0 m²**.
- **Extensión en T (centrada, retiro 2,50 m por lado):** 9,00 × 3,00 m = **27,0 m²**.
- **Total superficie de cubierta de la vivienda: 111,0 m².**

Por decisión del cliente, el interior se deja sin subdividir: lo que importa es el perímetro y la
superficie de techo. Vivienda elevada sobre platea + pilotes.

## Pendiente de confirmar

1. Medidas exactas del perímetro a verificar en obra (planos acotados).
2. Tipo/pendiente de cubierta y sentido de escurrimiento por módulo.

## Presupuesto preliminar asociado (suministro, lista venta BMC, USD sin IVA + IVA 22%)

Motor de cálculo de la calculadora (ISODEC EPS 100 mm cubierta, ISOPANEL EPS 100 mm cerramiento):

- **A — Cubiertas + flete:** ~USD 9.850 sin IVA → **~USD 12.017 con IVA**.
- **B — Cubiertas + cerramiento lateral + flete:** ~USD 17.383 sin IVA → **~USD 21.208 con IVA**.

No incluye mano de obra/montaje, estructura metálica nueva ni refuerzo de la existente.
Recalcular al confirmar superficies firmes.
