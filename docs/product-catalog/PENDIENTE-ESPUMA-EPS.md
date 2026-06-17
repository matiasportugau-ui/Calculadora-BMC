# Pendiente: categoría "Espuma EPS" (planchas EPS sueltas)

> Estado: **DOCUMENTADO, sin implementar** (puesto de lado a pedido del usuario, 2026-06-17).
> Cuando se retome, esta es la spec completa para cargarlo de una.

## Qué es

Planchas de EPS (poliestireno expandido) sueltas, vendidas por **unidad**.
Producto de **otro proveedor** (no entra al BOM automático de techo/pared).
Debe quedar **seleccionable por unidad en Presupuesto libre**, en un grupo/categoría
propio llamado **"Espuma EPS"**.

## Origen de datos (planilla)

- Sheet: `1oDMkBgWxX7cu7TpSvuO30tCTUWl68IBDhC4cQTP79Xo`, pestaña con la sección EPS (`EPS, Cat. II`).
- **Los precios crudos están en pesos uruguayos (UYU) y NO incluyen IVA.**
- La planilla **ya trae columnas convertidas a USD** (`C. unit usd` / `Vta unit USD`),
  calculadas a ~40 UYU/USD. **Decisión del usuario: usar esas columnas USD directamente.**
- **Precio web = venta × 1.15** (15 % más caro que la venta local). No hay columna web propia.

## SKUs y precios (USD sin IVA)

| SKU | Descripción | Empaque | costo (USD) | venta (USD) | web = venta×1.15 (USD) |
|-----|-------------|---------|-------------|-------------|------------------------|
| EPS1X1X1 | Plancha EPS 1m × 1m × 1cm | paquete 60 u | 1.15 | 1.495 | 1.72 |
| EPS1X1X2 | Plancha EPS 1m × 1m × 2cm | paquete 30 u | 2.08 | 2.6975 | 3.10 |
| EPS1X1X3 | Plancha EPS 1m × 1m × 3cm | paquete 20 u | 3.08 | 3.9975 | 4.60 |
| EPS1X1X5 | Plancha EPS 1m × 1m × 5cm | paquete 12 u | 5.18 | 6.7275 | 7.74 |
| EPS3X1X5 | Plancha EPS 3m × 1m × 5cm | paquete 12 u | 21.38 | 27.7875 | 31.96 |
| EPSAUTO  | EPS autotrabante | paquete 12 u | 13.83 | 17.9725 | 20.67 |

> `web` redondeado a 2 decimales; el implementador puede preferir guardar el valor exacto
> (`venta * 1.15`) y redondear sólo en la vista.
> El **empaque** (paquetes de N u.) es informativo; la venta en la calc es **por unidad**.

## Implementación sugerida (cuando se retome)

A diferencia del Embudo/Vaina (que cayeron en `PERFIL_TECHO` y aparecen solos en el
picker vía `flattenPerfilesLibre`), "Espuma EPS" **no encaja** en las 8 categorías
actuales → requiere wiring nuevo (no es sólo data). Pasos:

1. **`src/data/constants.js`** — nuevo export, p.ej.:
   ```js
   export const ESPUMA_EPS = {
     EPS1X1X1: { label: "Plancha EPS 1m×1m×1cm", venta: 1.495, web: 1.72, costo: 1.15, unidad: "unid" },
     // … los 6 SKUs
   };
   ```
2. **`src/utils/presupuestoLibreCatalogo.js`** — aceptar nuevo input `libreEpsQty`
   (análogo a `libreSellQty`), resolver contra `ESPUMA_EPS`, y emitir un grupo nuevo
   `"ESPUMA EPS"` en `grouped` + en el array de `libreGroups`.
3. **`server/routes/calc.js`** — pasar `libreEpsQty` al endpoint
   `POST /calc/cotizar/presupuesto-libre`.
4. **UI (`PanelinCalculadoraV3_backup.jsx`)** — acordeón nuevo "Espuma EPS" en el
   Presupuesto libre, con inputs de cantidad por SKU (igual que Selladores/Tornillería).
5. **Tests** — extender `tests/validation.js` / agregar caso al picker; correr `catalogDiff`.
6. **catalog-diff / mapping** — los EPS son de proveedor externo (UYU), probablemente
   queden como `catalog-only` (WARN, no bloquea). Decidir si se mapean a la MATRIZ.

## Decisiones ya tomadas por el usuario

- Categoría: **"Espuma EPS"** (grupo propio).
- Moneda: **columnas USD del sheet** (ya convertidas ~40 UYU/USD).
- Web: **venta × 1.15**.
- Origen: UYU sin IVA (sólo como referencia; se cargan los USD).
