# 💰 Motor de Precios — PANELIN_PRECIOS_V3_UNIFICADO

## Principios

1. **Todos los precios son SIN IVA** — El IVA 22% se aplica una sola vez al total final
2. **Doble lista** — Cada producto tiene precio `venta` (BMC directo) y `web` (Shopify)
3. **Una sola función resolutora** — `p(item)` lee `LISTA_ACTIVA` y devuelve el precio correcto
4. **Fuente de verdad única** — El archivo `PANELIN_PRECIOS_V3_UNIFICADO.js` es la referencia

## Constantes Globales

```javascript
const IVA = 0.22;           // Tasa de IVA
const IVA_MULT = 1.22;      // Multiplicador para precio con IVA
let LISTA_ACTIVA = "web";   // "venta" | "web" — se setea al inicio
```

## Funciones de Precio

### `p(item)` — Precio SIN IVA
```javascript
p({ venta: 37.76, web: 45.97 })
// Si LISTA_ACTIVA === "web"   → 45.97
// Si LISTA_ACTIVA === "venta" → 37.76
```
Fallback: si el campo de la lista activa no existe, usa el otro.

### `pIVA(item)` — Precio CON IVA
```javascript
pIVA({ venta: 37.76, web: 45.97 })
// Si LISTA_ACTIVA === "web" → 45.97 × 1.22 = 56.08
```

### `setListaPrecios(lista)` — Cambiar lista activa
```javascript
setListaPrecios("venta"); // Cambia LISTA_ACTIVA global
```

## Cálculo de Totales

```javascript
function calcTotalesSinIVA(allItems) {
  const sumSinIVA = allItems.reduce((s, i) => s + (i.total || 0), 0);
  const subtotalSinIVA = +sumSinIVA.toFixed(2);
  const iva = +(subtotalSinIVA * 0.22).toFixed(2);
  const totalConIVA = +(subtotalSinIVA + iva).toFixed(2);
  return { subtotalSinIVA, iva, totalFinal: totalConIVA };
}
```

**Flujo:**
```
item1.total (sin IVA) = 1000.00
item2.total (sin IVA) =  500.00
────────────────────────────────
subtotalSinIVA         = 1500.00
IVA 22%                =  330.00
totalFinal             = 1830.00
```

## Estructura de Datos de Precio

### Panel
```javascript
{
  venta: 37.76,   // Precio USD/m² SIN IVA — lista BMC
  web: 45.97,     // Precio USD/m² SIN IVA — lista Shopify
  costo: 33.93,   // Costo interno (para referencia/margen)
  ap: 5.5         // Autoportancia en metros (solo techo)
}
```

### Fijación / Sellador / Servicio
```javascript
{
  label: "Nombre descriptivo",
  venta: 3.12,     // Precio SIN IVA
  web: 3.64,       // Precio SIN IVA
  costo: 2.69,     // Costo
  unidad: "unid"   // unid | x100 | x1000 | rollo | servicio
}
```

### Perfil (Techo o Pared)
```javascript
{
  sku: "6838",
  venta: 15.67,    // Precio por pieza SIN IVA
  web: 19.12,      // Precio por pieza SIN IVA
  largo: 3.03      // Largo en metros (para calcular piezas necesarias)
}
```

## Comparación: Antes vs Ahora

| Aspecto | v2 (antes) | v3 (ahora) |
|---------|-----------|------------|
| Precios | Hardcodeados CON IVA | Centralizados SIN IVA |
| Lista | Una sola | Doble (venta/web) |
| IVA | Incluido en cada precio | Una vez al final |
| Resolución | `item.precio` directo | `p(item)` según lista |
| Flete | Precio fijo | `p(SERVICIOS.flete)` |

## Márgenes de Referencia

Los márgenes se pueden calcular usando el campo `costo`:

```javascript
const margenVenta = ((item.venta - item.costo) / item.venta) * 100;
const margenWeb = ((item.web - item.costo) / item.web) * 100;
```

Ejemplo ISODEC EPS 100mm:
- Costo: $33.93/m²
- Venta: $37.76/m² → margen 10.1%
- Web: $45.97/m² → margen 26.2%

## Notas Importantes

- El campo `costo` no se usa en el cálculo de cotización, solo para análisis de margen
- Los precios de `PERFIL_TECHO` y `PERFIL_PARED` son por pieza, no por metro
- Las cantidades de piezas se calculan como `Math.ceil(dimensión / largo_pieza)`
- El flete tiene precio diferenciado por lista (`venta: 240`, `web: 252`)
