# Calculadora BMC — Comparativo V3 vs backup, evolución y plan de unificación

**Objetivo:** una sola calculadora en producción, sin perder capacidades de `PanelinCalculadoraV3.jsx` ni de `PanelinCalculadoraV3.jsx`.

**Entrada canónica actual:** `src/App.jsx` importa **`PanelinCalculadoraV3.jsx`** (no el archivo `PanelinCalculadoraV3.jsx`).

**Última actualización de este documento:** 2026-03-26 (contenido de inventario según análisis de repo).

---

## 1. Resumen ejecutivo

| Métrica | `PanelinCalculadoraV3.jsx` | `PanelinCalculadoraV3.jsx` |
|--------|----------------------------|-----------------------------------|
| Líneas totales (`wc -l`) | **2 314** | **2 846** |
| Líneas no vacías (aprox.) | ~2 167 | ~2 666 |
| ¿Lo monta `App.jsx` hoy? | **No** | **Sí** |
| Último commit git que tocó el archivo (referencia) | `20e61d0` · 2026-03-20 | `4f2c68c` · 2026-03-20 |

> Si hay cambios **sin commitear** en `PanelinCalculadoraV3.jsx`, la fecha real de modificación puede ser más reciente que la de `git log`.

---

## 2. Cuadro comparativo de capacidades

Leyenda: **Sí** = presente de forma clara en código; **Parcial** = existe con alcance distinto; **No** = no localizado en ese archivo.

| Capacidad | `PanelinCalculadoraV3.jsx` | `PanelinCalculadoraV3.jsx` |
|-----------|----------------------------|-------------------------------------|
| Precios MATRIZ / overrides (`getPricing`) | **No** (catálogo inline) | **Sí** |
| Motor único `calculations.js` (alineado a tests) | **No** (`calcTechoCompleto` inline) | **Sí** |
| Techo multi-zona, pendiente, dos aguas, `mergeZonaResults` | **Parcial** / simplificado | **Sí** |
| BOM comercial ISODEC PIR (`bomComercial`) | Inline (riesgo de deriva vs tests) | **Sí** |
| Presupuesto libre + catálogo | **Sí** | **Sí** |
| Vista previa techo (`RoofPreview`) | **Sí** | **Sí** |
| Plano / `FloorPlanEditor` | **No** | **Sí** |
| Google Drive (PDF + `.bmc.json`) | **No** | **Sí** |
| Config + fórmulas dimensionamiento (`ConfigPanel`) | **No** | **Sí** |
| Historial / logs (`budgetLog`, interacción) | **No** | **Sí** |
| PDF | `downloadPdf` + HTML propio | `htmlToPdfBlob` + `generatePrintHTML` / helpers |
| Capturas DOM PDF (`captureDomToPng`) | **Sí** | **No** (típico) |
| Hoja visual Cliente + Costeo + `buildCostingReport` | **Sí** | **No** (típico) |
| Costo flete interno + avisos margen | **Sí** | **No** (típico) |
| WhatsApp / Sheets / impresión | **Sí** (flujo propio) | **Sí** (helpers) |

---

## 3. Análisis por producto

### 3.1 `PanelinCalculadoraV3.jsx` (producto “compacto”)

**Fortalezas**

- Flujos recientes de comunicación al cliente y costeo interno.
- Integración con utilidades: `bomCosting`, `captureDomToPng`, `downloadPdf`.
- Mucha UI y datos en un solo archivo (rápido de iterar en aislamiento).

**Debilidad estructural**

- **Duplica** lógica de techo/BOM frente a `calculations.js`.
- **No** usa `getPricing()` → riesgo de desalineación con MATRIZ y con mejoras futuras del motor probado por tests.

### 3.2 `PanelinCalculadoraV3.jsx` (producto “plataforma”)

**Fortalezas**

- **Fuente de verdad** con el resto del repo: `getPricing()`, `calculations.js`, dimensionamiento.
- **Operación:** Drive, historial, plano, paneles de configuración e interacción.
- Techo avanzado (zonas, pendiente, merge).

**Debilidad**

- Aún no incorpora de forma nativa la capa **Cliente / Costeo / capturas / margen / flete interno** que sí está en V3 (salvo que se haya portado después de redactar este doc; verificar en código).

### 3.3 Sinergia recomendada

| Capa | Origen |
|------|--------|
| Datos, cálculo, MATRIZ, tests | **backup** (vía `pricing` + `calculations`) |
| Salidas comerciales/internas (cliente, costeo, PDF enriquecido) | **Portar desde V3** hacia el árbol canónico |
| Resultado | **Un solo componente** + **utils** compartidos, **un solo motor** |

---

## 4. Evolución reciente (git, referencia)

- Ambos archivos tienen actividad alrededor de **2026-03-20** (presupuesto libre, techo/planos, API; en backup además pasos wizard `solo_fachada` / `techo_fachada`).
- Historial más antiguo en la línea V3 incluye mucho trabajo de **2026-03-10** (zonas, pendiente, BOM, etc.); el **estado actual** debe verificarse siempre leyendo el archivo, no solo el mensaje de commit.

**Conclusión:** convivieron dos líneas de evolución; el merge no es “copiar CSS”: es **unificar motor + datos** y luego **añadir capa de salida**.

---

## 5. Plan por fases (sin perder capacidades)

### Fase 0 — Inventario y criterios

- Completar checklist manual: cada flujo crítico en backup y en V3 (techo 1 zona / N zonas / dos aguas, fachada, cámara, libre, Drive, config, plano, PDF, WhatsApp, Sheets).
- Definir **Must** vs **Nice** para el corte a producción.

### Fase 1 — Congelar arquitectura canónica

- Cálculo: **solo** `calculations.js`.
- Precios: **`getPricing()`** y overrides existentes.
- Prohibido mantener un segundo `calcTechoCompleto` completo dentro de JSX a largo plazo.

### Fase 2 — Portar de V3 → backup (PRs pequeños)

Orden sugerido (cada uno: `npm test` + prueba manual corta):

1. **Costeo:** `buildCostingReport`, `fleteCosto`, UI, `generateCosteoHTML` (idealmente en `src/utils/` nuevo, p. ej. `quotationViews.js`).
2. **Cliente:** `generateClientVisualHTML`, impresión, reglas “sin datos internos”.
3. **PDF enriquecido:** `capturePdfSnapshotTargets` unificado con la cadena PDF del backup (`htmlToPdfBlob` / `generatePrintHTML`) — **una** pipeline, no dos.
4. **Avisos y margen** en bloque de totales.

### Fase 3 — Cierre

- `App.jsx` importa **solo** el componente unificado.
- Archivo inline legacy: renombrar a `*_legacy_inline.jsx` sin import, o eliminar tras período de gracia.
- Documentar en `AGENTS.md` o README: **ruta canónica del componente calculadora**.

### Fase 4 — Evolución

- Features nuevas solo en el canónico + módulos utils; evitar segundo monolito.

---

## 6. Procedimiento operativo (checklist)

1. Baseline: `npm run gate:local:full` en rama limpia.
2. Rama: `feat/calculadora-unify-backbone` (o nombre acordado).
3. Extraer generadores HTML y lógica pura a `src/utils/` para no inflar un solo JSX.
4. Un PR por capacidad (Costeo, Cliente, PDF, avisos).
5. E2E manual mínimo: techo, pared, libre; Drive si aplica.
6. Tras “Must” completo: actualizar `App.jsx` y archivar V3 inline.

---

## 7. Riesgos si no se unifica bien

| Riesgo | Efecto |
|--------|--------|
| Dos motores (`calculations.js` vs inline) | Bugs corregidos en uno y vigentes en el otro |
| Producción solo backup sin portar V3 | Se pierden Cliente/Costeo/margen/capturas en la app real |
| Producción solo V3 sin portar backup | Se pierden Drive, MATRIZ vía pricing, plano, logs, techo avanzado |

---

## 8. Próximo paso sugerido (implementación)

- **Opción A (recomendada):** empezar por **Costeo** en backup (utils + botón + estado `fleteCosto`).
- **Opción B:** empezar por **Cliente + PDF** si la prioridad es comunicación al cliente antes que margen interno.

---

## Referencias en repo

- `src/App.jsx` — componente montado.
- `src/components/PanelinCalculadoraV3.jsx` — línea inline / salidas recientes.
- `src/components/PanelinCalculadoraV3.jsx` — línea plataforma.
- `src/utils/calculations.js` — motor de BOM.
- `src/data/pricing.js` — `getPricing()` y overrides.
- `src/utils/bomCosting.js` — costeo interno.
- `src/utils/captureDomToPng.js` — capturas para PDF.
