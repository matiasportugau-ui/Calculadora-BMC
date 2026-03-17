# 📖 Referencia de Funciones — API Reference

## Funciones de Precio

### `p(item) → number`
Devuelve precio SIN IVA según `LISTA_ACTIVA`.
- **item**: `{ venta: number, web: number }`
- **Fallback**: Si el campo de la lista activa no existe, usa el otro

### `pIVA(item) → number`
Devuelve precio CON IVA: `p(item) * 1.22`

### `setListaPrecios(lista)`
Setea `LISTA_ACTIVA` global. `lista`: `"venta"` | `"web"`

### `calcTotalesSinIVA(allItems) → { subtotalSinIVA, iva, totalFinal }`
Suma todos los `item.total`, aplica IVA 22%.

---

## Motor de Techo

### `resolveSKU_techo(tipo, familiaP, espesor) → { sku, venta, web, largo } | null`
Busca perfil en `PERFIL_TECHO` por tipo → familia → espesor.

### `calcPanelesTecho(panel, espesor, largo, ancho) → { cantPaneles, areaTotal, anchoTotal, costoPaneles, precioM2 }`

### `calcAutoportancia(panel, espesor, largo) → { ok, apoyos, maxSpan, largoMinOK, largoMaxOK }`

### `calcFijacionesVarilla(cantP, apoyos, largo, tipoEst, ptsHorm) → { items, total, puntosFijacion }`

### `calcFijacionesCaballete(cantP, largo) → { items, total, puntosFijacion }`

### `calcPerfileriaTecho(borders, cantP, largo, anchoTotal, familiaP, espesor, opciones) → { items, total, totalML }`

### `calcSelladoresTecho(cantP) → { items, total }`

### `calcTechoCompleto(inputs) → { paneles, autoportancia, fijaciones, perfileria, selladores, totales, warnings, allItems }`
Orquestador principal. Recibe objeto `inputs` con todos los campos.

---

## Motor de Pared

### `resolvePerfilPared(tipo, familia, espesor) → { sku, venta, web, largo } | null`
Busca perfil en `PERFIL_PARED`.

### `calcPanelesPared(panel, espesor, alto, perimetro, aberturas) → { cantPaneles, areaBruta, areaAberturas, areaNeta, costoPaneles, precioM2 }`

### `calcPerfilesU(panel, espesor, perimetro) → { items, total }`

### `calcEsquineros(alto, numExt, numInt) → { items, total }`

### `calcFijacionesPared(panel, espesor, cantP, alto, perimetro, tipoEst) → { items, total }`
**v3 REESCRITA**: Anclaje H° + T2 + remaches.

### `calcPerfilesParedExtra(panel, espesor, cantP, alto, perimetro, opts) → { items, total }`
**v3 NUEVA**: K2 + G2 + 5852.

### `calcSelladorPared(perimetro, cantPaneles, alto) → { items, total, mlJuntas }`
**v3 AMPLIADA**: + membrana + espuma PU.

### `calcParedCompleto(inputs) → { paneles, perfilesU, esquineros, perfilesExtra, fijaciones, sellador, totales, warnings, allItems }`

---

## Overrides

### `createLineId(groupTitle, idx) → string`
Genera ID único: `"GRUPO_TITULO-idx"`

### `applyOverrides(groups, overrides) → groups`
Aplica ediciones manuales sobre los grupos BOM.

### `bomToGroups(result) → groups[]`
Convierte resultado de cálculo en array de grupos para la tabla.

---

## PDF & WhatsApp

### `generatePrintHTML(data) → string`
Genera HTML completo para impresión A4.

**data:**
```javascript
{
  client: { nombre, rut, telefono, direccion },
  project: { fecha, descripcion, refInterna },
  scenario: string,
  panel: { label, espesor, color },
  autoportancia: { ok, apoyos, maxSpan },
  groups: [{ title, items, subtotal }],
  totals: { subtotalSinIVA, iva, totalFinal },
  warnings: string[]
}
```

### `openPrintWindow(html)`
Abre popup y dispara `window.print()`.

### `buildWhatsAppText(data) → string`
Genera texto formateado con asteriscos para WhatsApp.

### `fmtPrice(n) → string`
Formatea número como precio: `1,234.56`

---

## Estructuras de Datos

### Item BOM
```typescript
{
  label: string,      // "Varilla roscada 3/8\""
  sku: string,        // "varilla_38"
  cant: number,       // 9
  unidad: string,     // "unid" | "m²" | "x100" | "x1000" | "rollo" | "servicio"
  pu: number,         // 3.64  (precio unitario SIN IVA)
  total: number,      // 32.76 (cant × pu, SIN IVA)
  tipo?: string,      // Para perfilería: "gotero_frontal", etc.
  ml?: number,        // Metros lineales (solo perfilería)
  isOverridden?: boolean
}
```

### Grupo BOM
```typescript
{
  title: string,      // "FIJACIONES"
  items: Item[]
}
```

### Totales
```typescript
{
  subtotalSinIVA: number,  // Suma de todos los items
  iva: number,             // subtotal × 0.22
  totalFinal: number       // subtotal + IVA
}
```
