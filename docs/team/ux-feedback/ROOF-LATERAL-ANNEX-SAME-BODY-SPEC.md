# Anexos laterales en el mismo cuerpo de techo (misma superficie)

**Objetivo:** describir en lenguaje de obra y de **paneles de techo** qué pide el producto, cómo encaja en la arquitectura actual (zonas rectangulares, planta en metros, encuentros) y qué queda para iteraciones.

---

## 1. Concepto de obra (qué estamos modelando)

- **Un cuerpo de techo** es una **misma superficie** (un mismo plano o la misma “loseta” mental de cubierta), aunque **no sea un solo rectángulo**: puede haber **retiros**, **mudas de ancho de panel** o **paños** que comparten **faldón** y se ven como **continuación lateral** del mismo techo.
- En planta (vista desde arriba, como en el visualizador), el **largo** del rectángulo sigue siendo la **dimensiones en sentido pendiente / correr de agua** y el **ancho en planta** es el **ancho útil acumulado de paneles** (en una agua todo el ancho; en dos aguas la mitad por faldón, coherente con `effAnchoPlanta`).

### 1.1 Qué NO es (para esta historia)

- **No** es “seguir agregando techo **hacia el frente / fondo**” (otro tramo **longitudinal** pegado al **largo** del paño principal) si el usuario define que todo sigue siendo **el mismo objeto**. Eso sería un **encuentro en el borde superior/inferior** del rect en planta (eje del **largo**).  
  **Regla de producto:** los **anexos del mismo cuerpo** solo se acoplan por **laterales izquierdo o derecho** del rect en planta (aristas **verticales** en SVG), es decir encuentros **`orientation: vertical`** en `findEncounters`.

### 1.2 Qué SÍ es

- **Anexo lateral:** otro rectángulo (otra **combinación largo × paneles/m**) que comparte **línea de encuentro** con el **costado** del paño al que se anexa (padre puede ser el **principal** u otro anexo ya colocado en cadena).
- **Cadena en un mismo lateral:** varios anexos en el **mismo lado** (ej. todo a la **derecha** del principal) forman una **cadena** en **X**: primero junto al padre, el siguiente junto al anterior, etc. El **orden** en la cadena es intercambiable (flechas / controles) sin “despegar” el conjunto del mismo plano lógico.

---

## 2. Mapa a la arquitectura actual del código

| Idea de producto | Implementación técnica (actual / prevista) |
|------------------|--------------------------------------------|
| Varios rectángulos cotizables | Sigue existiendo `techo.zonas[]`; cada ítem aporta área y paneles al motor existente (`mergeZonaResults`, etc.). |
| “Mismo cuerpo” vs “otro cuerpo” | **Mismo cuerpo:** `z.preview.attachParentGi` apunta al índice del padre; **otro cuerpo:** sin `attachParentGi` (zona **raíz**). |
| Solo laterales | El layout coloca anexos solo a **izquierda** o **derecha** del rect del padre (`preview.lateralSide`: `izq` \| `der`), **misma cota Y** (alineación superior con el padre en MVP). |
| Orden en la cadena | `preview.lateralRank` (0 = más cercano al padre en ese lateral). Intercambio = permutar ranks entre hermanos mismo padre y mismo lado. |
| Visualizador | `RoofPreview` aplica `applyLateralAnnexLayout` antes de dibujar; los anexos **no** se arrastran libremente (evita “pegado longitudinal” por error); flechas **← / →** cambian lateral; controles de orden (p. ej. `⟨ / ⟩`) intercambian posición en cadena. |
| Encuentros / accesorios | `findEncounters` ya detecta contactos **verticales** entre rectángulos adyacentes en X; la semántica (continuo, pretil, etc.) sigue en bordes como hoy. |

---

## 3. UX: una sola lectura clara (evitar “dos botones iguales”)

1. **Dentro de la tarjeta “Zona N”** (debajo de largo / ancho):  
   **“+ Anexo lateral (otras medidas) — Zona N”**  
   - Crea una **nueva fila** en `zonas` con medidas por defecto.  
   - Marca `preview.attachParentGi = N-1` (índice 0-based), `lateralSide` (p. ej. `der` por defecto), `lateralRank` al final de la cadena en ese lateral.

2. **Pie de lista (global):**  
   **“+ Otro cuerpo de techo (zona independiente)”**  
   - Añade una zona **raíz** (sin `attachParentGi`): otro plano / otro volumen en obra, puede ir a la fila automática y **sí** admite arrastre como hasta ahora.

3. Texto de ayuda corto: los anexos laterales son para **distinto ancho/largo de panel en la misma superficie**; **no** sustituyen un segundo techo desconectado (eso es **zona independiente**).

---

## 4. Fases de implementación

| Fase | Contenido |
|------|-----------|
| **A (esta entrega)** | Spec; `applyLateralAnnexLayout`; datos `attachParentGi`, `lateralSide`, `lateralRank`; botones UX diferenciados; flechas ←/→ en SVG; anexos sin drag libre; `removeZona` sanea huérfanos. |
| **B** | Controles `⟨ / ⟩` para intercambiar orden en cadena; validar solapes y mensajes si el usuario fuerza dimensiones imposibles. |
| **C** | Alineación en Y parcial (anexo más corto que el padre), o anclajes a encuentros reales del BIM manual; reglas automáticas de encuentro. |
| **D** | PDF/BOM: etiquetar “Principal / Anexo lateral” según `attachParentGi` y `zonaPrincipalGi`. |

---

## 5. Referencias

- Geometría planta: [`src/utils/roofPlanGeometry.js`](../../src/utils/roofPlanGeometry.js)  
- Taxonomía previa (principal / tramos): [`ROOF-ZONAS-PRINCIPAL-Y-ENCUENTROS-TAXONOMY.md`](./ROOF-ZONAS-PRINCIPAL-Y-ENCUENTROS-TAXONOMY.md) — la parte de **tramo abajo** queda **supersedida** para el flujo “mismo cuerpo” por **anexos laterales**.  
- Layout anexos: [`src/utils/roofLateralAnnexLayout.js`](../../src/utils/roofLateralAnnexLayout.js)  
- Vista previa: [`src/components/RoofPreview.jsx`](../../src/components/RoofPreview.jsx)
