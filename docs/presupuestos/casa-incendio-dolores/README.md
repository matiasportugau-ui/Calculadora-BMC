# Casa incendio — Dolores (reconstrucción)

Caso de presupuesto: reconstrucción de vivienda destruida por incendio, sobre platea
elevada + pilotes. Incluye módulo tiny house temporal y salón de degustación.
Cerramientos en chapa / panel sándwich (~160 m² de techos en total).

## Archivos

- `plano-vivienda.svg` / `plano-vivienda.png` — **Lám. 01 · Planta general** (Esc. 1:100).
  Interpretación profesional del croquis a mano del cliente. **Borrador para revisión.**
- Generador: `scripts/plano-vivienda-reconstruccion.mjs` (`node scripts/plano-vivienda-reconstruccion.mjs`
  regenera el SVG; ver comentario al pie para rasterizar a PNG con `@resvg/resvg-js`).

## Interpretación del croquis

- **Cuerpo principal 14,00 × 6,00 m (84 m²):** Dormitorio 2 + Baño 2 + Placard · Cocina-Comedor-Living ·
  núcleo Baño 1 + Vestidor (WIC) · Dorm. 1 · Dorm. Principal (suite).
- **Extensión en T 6,00 × 3,00 m (18 m²):** Escalera de acceso (vivienda elevada) · Hall ·
  Dorm. 3 / Estudio · acceso principal por la pata de la T.

## Pendiente de confirmar (afecta plano y presupuesto)

1. Pata en T: croquis **6×3 = 18 m²** vs. audio previo **9×3 = 27 m²**.
2. Lado derecho: marcas "2 / 1 / 4" del croquis sin descifrar (¿anchos de dormitorios o galería/alero?).
3. Programa y nombres de ambientes (validar usos y ubicación).

## Presupuesto preliminar asociado (suministro, lista venta BMC, USD sin IVA + IVA 22%)

Motor de cálculo de la calculadora (ISODEC EPS 100 mm cubierta, ISOPANEL EPS 100 mm cerramiento):

- **A — Cubiertas + flete:** ~USD 9.850 sin IVA → **~USD 12.017 con IVA**.
- **B — Cubiertas + cerramiento lateral + flete:** ~USD 17.383 sin IVA → **~USD 21.208 con IVA**.

No incluye mano de obra/montaje, estructura metálica nueva ni refuerzo de la existente.
Recalcular al confirmar superficies firmes.
