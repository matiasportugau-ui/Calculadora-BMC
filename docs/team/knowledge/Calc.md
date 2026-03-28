# Knowledge — Calc (Calculadora Specialist)

Rol: Calculadora Specialist. Skill: `bmc-calculadora-specialist`.

---

## Entradas (leer antes de trabajar)

- `docs/team/PROJECT-STATE.md` — cambios recientes, pendientes.
- `docs/team/knowledge/MATRIZ-CALCULADORA.md` — **MATRIZ → SKU→path → CSV → precios en UI** (obligatorio si tocás precios o planilla BROMYROS).
- `docs/team/knowledge/CALCULATOR-ENGINE-MATH-SPEC.md` — **fórmulas y variables del motor** (techo, pared, IVA, merge); úsalo para cambios de lógica o auditoría matemática.
- `docs/google-sheets-module/planilla-inventory.md` — Master_Cotizaciones, CRM_Operativo.
- `src/utils/calculations.js`, `helpers.js`, constants — lógica de cálculo.
- Si existe: `tests/validation.js`.

---

## Salidas (qué produce)

- **Cambios en precios, BOM, paneles** (techo, pared).
- **Integración Drive** — guardar/cargar presupuestos.
- **PDF, export WhatsApp** — flujo de cotización.
- **Tests** — ejecutar `tests/validation.js` tras cambios en cálculos.

---

## Convenciones

- **Puerto 5173** — Calculadora canónica.
- **Coordinar con Mapping** si hay cambios en Sheets para cotizaciones.
- **Coordinar con Design** si hay cambios de UI en la Calculadora.

---

## Criterios de cotización (canónico — persistente)

Fuente complementaria: `.cursor/skills/bmc-calculadora-specialist/SKILL.md` (paneles: autoportancia vs `lmin`/`lmax`; cantidad de paneles en ancho).

### 1. Ancho útil (`au`) y competencia

- Cada familia tiene **`au`** en `src/data/constants.js` (ej. ISODEC PIR **1,12 m**). **No** asumir el mismo ancho que otro proveedor (ej. 1,14 m).
- Para comparar con un presupuesto ajeno: **recalcular** cantidad de paneles y **m² de chapa** con **tu** `au`, no reutilizar el m² del otro sin despiece.

### 2. Cantidad de paneles en ancho: no forzar un panel más sin decisión

- El motor puede usar `ceil(ancho / au)` en `calcPanelesTecho` para **cubrir** todo el ancho; en **cotización asistida** (agente + Matias/cliente) **no** presentar solo el caso “sube un panel” como única opción implícita.
- **Mostrar siempre:**
  - **Opción A:** **N** paneles → ancho cubrible **N × au** (cuando aplica, contrastar con “bajar” cantidad).
  - **Opción B:** **N+1** paneles → **(N+1) × au**.
- Si el ancho pedido **no** es múltiplo de `au`, **consultar** explícitamente: ¿un panel más (más costo) o quedarse con menor ancho cubierto / criterio de obra (remate, solape, etc.)?

### 3. Contenido mínimo del presupuesto (visualización cliente)

Por zona o paño, donde aplique:

- **Cantidad de paneles**, **largo** (m), **superficie de chapa** (m²), **precio por m²** (lista venta o web según política), **subtotal** línea.
- Opcional y recomendable: **superficie geométrica del techo** vs **m² de chapa** y **descarte** cuando difieran.

### 4. IVA

- Precios en `constants.js` están **sin IVA**; el producto puede aplicar **IVA una vez al final** (ver comentarios en código). Ser explícito en la cotización si el total mostrado incluye o no IVA.
- **Presupuestos de terceros / competencia:** **no asumir** que los importes van **con IVA** o **sin IVA** si eso **no** consta **por escrito** en el documento (leyenda, pie, columna explícita) o **Matias** no lo confirma. Antes de comparar u homogeneizar con BMC: **consultar**. Si se muestra una comparación provisional, etiquetarla como **hipótesis** (ej. «si estos USD fueran con IVA incluido») y no como hecho.

### 5. Marca y fabricante (productos de terceros)

- **No asumir** marca ni fabricante de paneles o accesorios si el PDF, captura o briefing **no** lo indican. Declarar **desconocido** hasta nueva información; **consultar** a Matias/cliente si hace falta para la oferta técnica o comercial.

### 6. Implementación futura en UI (pendiente de producto)

- Hasta que la Calculadora pida en pantalla la **elección N vs N+1**, el criterio anterior aplica a **agentes** y a **proceso comercial**; cambios en `PanelinCalculadoraV3_*` / `calculations.js` se coordinan con este documento.

### 7. Trazabilidad de fuentes (obligatorio en presupuestos asistidos)

En **cada** presupuesto o tabla de cotización que arme un agente en chat, debe incluirse una sección **«Fuentes de datos»** (o equivalente) donde **cada cifra o regla** usada tenga:

| Tipo de origen | Qué indicar |
|----------------|-------------|
| **Código** (`constants.js`, `calculations.js`, etc.) | Ruta del repo + **rango de líneas** (ej. `src/data/constants.js` líneas 65–74). Opcional: enlace GitHub `blob/<rama>/ruta#L65-L74` si el remoto está disponible. |
| **Precio / `venta` / `web` / `costo`** | Objeto y path lógico (ej. `PANELS_TECHO.ISODEC_PIR.esp.50.venta`) **y** línea en `constants.js` o valor tras `getPricing()`. |
| **Fórmula o parámetro** (espaciados, factores) | `dimensioningFormulas.js` — entrada en `FORMULA_FACTORS` (path) **y** línea; o `getDimensioningParam` usado en `calculations.js` con línea de llamada. |
| **Google Sheets / MATRIZ** | **No** inventar celdas: usar documentación canónica (`docs/google-sheets-module/MAPPER-PRECISO-PLANILLAS-CODIGO.md`, `planilla-inventory.md`) o lo que indique Matias. Indicar **hoja**, **celda o columna** (notación A1 / nombre de columna) y **enlace** al workbook si se proporciona en docs (IDs no van hardcoded en código; en fuentes de presupuesto se puede citar el enlace que ya esté en la documentación del equipo). |
| **PDF, mail o dato del cliente** | Texto explícito: «dato provisto por el cliente / archivo X» **sin** fila/columna de repo. |
| **Cálculo derivado** | Indicar la operación y las fuentes anteriores de la que depende (ej. «m² chapa = cantPaneles × au × largo; `au` según fuente X»). |

Si no se puede ubicar fila/columna en una planilla (acceso no documentado), declarar **«no mapeado en repo — pendiente Mapping»** en lugar de inventar.

---

## Handoffs

| Cuando | A quién | Formato |
|--------|---------|---------|
| Cambios en planilla cotizaciones | Mapping | Log for Mapping. |
| Cambios en UI Calculadora | Design | Log for Design. |

---

## Modificaciones en tiempo real

- **Describe** en lenguaje natural: "Cambiar precio ISODEC 100mm web a 48.50" o "Cambiar color primario a #0066CC"
- **El agente** edita `src/data/constants.js` o `src/utils/calculations.js`
- **Vite HMR** recarga el navegador en ~1s (si `npm run dev` está corriendo)
- **Revisar** → commit cuando estés listo

Ver `docs/team/CALCULATOR-REAL-TIME-CONTROL-PLAN.md` para el plan completo.

---

## Referencias

- MATRIZ y paths: `docs/team/knowledge/MATRIZ-CALCULADORA.md`
- Criterios del Juez: `docs/team/judge/JUDGE-CRITERIA-POR-AGENTE.md` (sección Calc)
- Propagación: `docs/team/PROJECT-TEAM-FULL-COVERAGE.md` §4
- Skill: `.cursor/skills/bmc-calculadora-specialist/SKILL.md`
