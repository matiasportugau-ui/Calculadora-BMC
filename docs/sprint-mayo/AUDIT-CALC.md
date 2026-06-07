# Auditoría Calculadora BMC — Sprint Mayo 2026

**Fecha:** 2026-05-09
**Auditor:** bmc-calc-specialist
**Alcance:** Flujo de cotización desde el punto de vista del vendedor en llamada con cliente.

---

## 1. Resumen ejecutivo

- La lógica de cálculo central (`calcTechoCompleto`, `calcParedCompleto`) produce números correctos y todos los tests pasan (384 passed, 0 failed). El motor no está roto.
- El mayor riesgo operativo es **la variable global `LISTA_ACTIVA`**: se sincroniza dentro de un `useMemo` (línea 3300 de `PanelinCalculadoraV3_backup.jsx`), lo que crea una ventana donde una lista de precios queda activa entre renders y puede contaminar cotizaciones concurrentes en el mismo tab o si el estado se recalcula fuera de orden.
- **ISOROOF PLUS** tiene una restricción de mínimo 800 m² documentada en `colNotes._all` pero `colMinArea` está vacío (`{}`), por lo que la calculadora nunca muestra advertencia cuando el área cotizada es menor — el vendedor puede cotizar cantidades que el proveedor rechazará.
- **Perfil U 250 mm** usa el SKU y precio de 200 mm (`PU200MM`) — puede ser correcto (mismo perfil comercial) pero no hay comentario que lo confirme; si hay una diferencia de precio real, el presupuesto es incorrecto en silencio.
- No existe un smoke test de UI automatizado que cubra el flujo completo "seleccionar panel → ingresar medidas → ver total" antes de cada deploy a producción.

---

## 2. Bugs bloqueantes (P0)

### P0-1 — LISTA_ACTIVA como variable global mutable sincronizada dentro de useMemo

**Síntoma:** En condiciones de re-render rápido (cambio de escenario, cambio de lista de precios, hydration SSR/cache), los precios en pantalla pueden pertenecer a la lista anterior (`web` o `venta`) durante un ciclo. Si el vendedor imprime o copia el precio en ese instante, el número es incorrecto.

**Reproducción:**
1. Abrir la calculadora en modo Vendedor.
2. Cambiar la lista de precios de "Web" a "BMC directo" (lista `venta`).
3. Cambiar el escenario de "Solo Techo" a "Techo + Pared" inmediatamente después.
4. Observar el `grandTotal` en el primer render del nuevo escenario: puede mostrar precios web hasta que el `useMemo` de `results` vuelva a correr.

**Causa probable:** `src/components/PanelinCalculadoraV3_backup.jsx` línea 3300:
```
setListaPrecios(listaPrecios || "web"); // sync global LISTA_ACTIVA before any p() call
```
`LISTA_ACTIVA` es un `let` exportado en `src/data/constants.js` línea 30. Mutar estado global dentro de un `useMemo` es un efecto secundario fuera de ciclo de React.

**Esfuerzo:** M (refactorizar para pasar `lista` como parámetro explícito a `p()` en lugar de leer la variable global, o al menos mover la sincronización a un `useEffect` separado que corra antes del memo con una guardia de orden).

---

### P0-2 — ISOROOF PLUS no valida mínimo de 800 m²

**Síntoma:** El vendedor cotiza 200 m² de ISOROOF PLUS, la calculadora acepta sin advertencia, el vendedor envía precio al cliente, el proveedor rechaza el pedido por no alcanzar el mínimo. La cotización queda sin efecto a mitad de proceso.

**Reproducción:**
1. Seleccionar escenario "Solo Techo", familia ISOROOF PLUS 3G.
2. Ingresar ancho 5 m, largo 8 m (área = 40 m², muy por debajo de 800 m²).
3. Observar: no aparece ninguna advertencia de mínimo de área.

**Causa probable:** `src/data/constants.js` línea 121–122:
```js
colNotes: { _all: "PLUS: Mínimo 800 m²" },
colMinArea: {}, colMax: {},
```
`colMinArea` está vacío. La validación en `calcTechoCompleto` (`calculations.js` línea 780) solo dispara si `panel.colMinArea[color]` existe. Como `colMinArea` es `{}`, nunca dispara.

Además la restricción aplica a toda la familia (no solo a un color), pero la arquitectura actual de `colMinArea` es por color. Se necesita un campo nuevo tipo `areaMinFamilia` o llenar `colMinArea` con todos los colores disponibles.

**Esfuerzo:** S (llenar `colMinArea` con los tres colores del PLUS en `constants.js` + agregar test en `validation.js`).

---

### P0-3 — Error de total undefined cuando autoportancia falla y hay perfilería

**Síntoma:** Cuando se ingresa un largo que excede la autoportancia máxima (por ejemplo, ISODEC EPS 100mm, largo 6m > ap 5.5m), `r.totales` devuelve un objeto con `subtotalSinIVA` y `totalFinal` calculados correctamente — pero el mensaje de advertencia aparece aunque el número se muestra. En otros contextos (escenario camara), si `rT.error` está presente, `allItems` queda como `[]` y el total es $0 sin informar al vendedor que algo falló.

**Reproducción (escenario camara con error en techo):**
1. Seleccionar escenario "Cámara frigorífica".
2. Forzar un error en el techo (familia inválida o largo fuera de rango extremo).
3. El total de la cámara muestra $0 sin mensaje de error visible en la UI principal.

**Causa probable:** `src/utils/scenarioOrchestrator.js` líneas 248–249: si `rT.error`, los items del techo se descartan silenciosamente. El error se agrega a `extraW` (warnings) pero no bloquea la UI ni muestra un banner rojo.

**Esfuerzo:** S (propagar el error como estado de error visible, no solo como warning oculto en el array).

---

## 3. Bugs molestos (P1)

### P1-1 — Perfil U 250 mm usa SKU y precio de 200 mm sin nota explicativa

`src/data/constants.js` líneas 353–354: `PERFIL_PARED.perfil_u.ISOPANEL[250]` tiene `sku: "PU200MM"` y exactamente el mismo precio que el de 200 mm. Si es el mismo perfil comercial, hay que agregar un comentario; si es un error, el presupuesto es incorrecto para paredes de 250 mm.

**Esfuerzo:** S (verificar con planilla MATRIZ y agregar comentario o corregir).

---

### P1-2 — ISODEC_PIR 50 mm aparece como opción seleccionable sin bloqueo

`src/data/constants.js` línea 74: `notas: { 50: "EVITAR ESTE ESPESOR (fuente: Matriz)" }`. Esta nota no se traduce en ninguna validación en `calcTechoCompleto` ni en la UI (no hay grep de esa clave en el componente principal). El vendedor puede cotizar 50mm PIR, que el proveedor no fabrica o no recomienda, sin ninguna advertencia visible.

**Esfuerzo:** S (leer `panel.notas[espesor]` en `calcTechoCompleto` y agregar a `warnings`, + mostrar warning en el selector de espesor).

---

### P1-3 — Estado del selector de color no se resetea al cambiar de familia

Al cambiar de familia (p. ej. de ISODEC EPS a ISOROOF 3G), el color previo seleccionado permanece. Si el color anterior no existe en la nueva familia, la validación en `calcTechoCompleto` agrega un warning pero el campo queda con valor inválido. El vendedor tiene que recordar cambiar el color manualmente.

**Esfuerzo:** S (resetear `techo.color` al primer color disponible de la nueva familia cuando se cambia `familia`).

---

### P1-4 — La lista de precios no persiste entre recargas de página

`getListaDefault()` lee de algún mecanismo (no de `localStorage`), por lo que al recargar la página la lista vuelve a `"web"`. Un vendedor interno que siempre usa lista `venta` tiene que volver a seleccionarla en cada sesión.

**Esfuerzo:** S (persistir `listaPrecios` en `localStorage`, leer al inicializar).

---

### P1-5 — Modo Wizard en "Solo Techo" no valida que el largo esté dentro del rango de fabricación antes de avanzar al siguiente paso

El wizard permite avanzar con `largo < panel.lmin` (p. ej. 1.5m en ISODEC EPS cuyo mínimo es 2.3m). El warning aparece solo en el resumen final, no en el paso de dimensiones. El vendedor cotiza un panel que no se puede fabricar.

**Causa:** `isWizardStepValid` (línea ~2741) no parece verificar `largoMinOK` / `largoMaxOK` de `calcAutoportancia`.

**Esfuerzo:** S.

---

## 4. Precios desactualizados

La fuente de precios es `src/data/constants.js`. El hash de versión (`calculatorDataVersion.js`) se regenera automáticamente con cada build/dev, por lo que la fecha `2026-05-09T07:39:34.621Z` indica cuándo se corrió el script, no cuándo se actualizaron los precios manualmente.

### Discrepancias identificadas

| Ítem | Campo en código | Valor en código | Observación |
|------|----------------|-----------------|-------------|
| `FIJACIONES.anclaje_h` | `costo` | 0.90 USD | Costo notablemente bajo vs precio web (5.96) — ratio costo/web = 15%, cuando el promedio del catálogo es ~60–70%. Verificar si el costo está en UYU en lugar de USD, o si es un placeholder. |
| `ISOROOF_FOIL.silicona_300_neutra.venta` | `venta` | 7.00 USD | `costo: 3.00`, ratio ~43%. Sin fecha de actualización. |
| `SERVICIOS.flete` | `venta` | 240.00 USD | Precio de flete fijo sin variación por distancia ni zona. Si el equipo de ventas negocia el flete según la obra, este valor fijo genera discrepancias. |
| `ISOROOF_FOIL` esp 50 | `web` | 46.00 USD | El único precio redondo en todo el catálogo (todos los demás tienen decimales). Posible aproximación manual no actualizada. |
| `PERFIL_PARED.perfil_u.ISOPANEL[250]` | `sku`, `venta`, `web` | `PU200MM`, 17.43, 21.26 | Idéntico a 200mm. Sin nota que confirme que es intencional. |

**No es posible hacer un cross-check completo contra la MATRIZ de precios sin acceso a la planilla.** Lo que sí se puede afirmar: el script `csvPricingImport.js` existe y tiene funciones para importar precios desde CSV de la MATRIZ, pero no hay evidencia en el `git log` reciente de que se haya ejecutado un import masivo de precios en los últimos 30 días.

**Recomendación:** Ejecutar `npm run panelsim:env` para verificar conectividad con la MATRIZ, luego comparar manualmente los 5 ítems de la tabla anterior.

---

## 5. Friccion para uso interno del equipo de ventas

### 5-A — El wizard de "Solo Techo" tiene demasiados pasos para una cotización rápida

El flujo actual (modo Vendedor, escenario Solo Techo) tiene 6+ pasos: escenario → panel → dimensiones → estructura → bordes → resumen. Para dar un precio por teléfono en 90 segundos, el vendedor necesita llegar al total en menos de 3 interacciones. Actualmente los pasos de "estructura" (tipo de apoyo: metal/madera/hormigón) y "bordes" (goteros, canalones) bloquean el avance aunque el cliente solo quiera un precio de referencia.

**Sugerencia:** Agregar un botón "Precio rápido" que salte estructura (default metal) y bordes (default gotero frontal solamente) y muestre el total inmediatamente.

### 5-B — El selector de espesor no muestra el precio por m² junto al espesor

El vendedor tiene que seleccionar el espesor, esperar el recalculo, y luego buscar el precio en la tabla. No puede comparar "¿cuánto más cuesta 150mm vs 100mm?" sin ir y volver. Agregar precio/m² al lado de cada opción de espesor en el selector haría la comparación instantánea.

### 5-C — No hay forma de copiar el precio total con un clic

El total final con IVA requiere que el vendedor seleccione el texto manualmente. Un botón "Copiar precio" ($X.XXX c/IVA) reduciría el tiempo y los errores al trasladar el número a WhatsApp o email.

### 5-D — El campo "Cliente / Proyecto" no es obligatorio y no se recuerda

El vendedor puede generar y guardar un PDF sin nombre de cliente. Luego no puede identificar la cotización en el historial. El campo debería ser requerido o al menos sugerido antes de descargar el PDF.

### 5-E — La lista de precios ("Web" / "BMC directo") no es visible de forma prominente

El toggle está en la barra superior pero sin color diferenciador fuerte. Un vendedor distraído puede enviar precios web a un cliente interno o viceversa. Agregar un badge de color en el total (verde = venta, azul = web) daría confirmación visual inmediata.

### 5-F — No existe un preset de "obra típica" para agilizar inputs frecuentes

El array `OBRA_PRESETS` existe (`constants.js` línea 524) con 12 tipos de obra, pero no hay presets de dimensiones asociados. Un preset como "Galpón 10×20m, ISODEC 100mm, metal" permitiría empezar desde un punto de partida realista en vez de inputs en cero.

---

## 6. Tests / smoke checks

### Estado actual

- **Tests unitarios de cálculo:** 384 tests pasan (`npm test`). Cubren bien `calcTechoCompleto`, `calcParedCompleto`, `calcFijacionesVarilla`, `calcFijacionesCaballete`, `calcPerfileriaTecho`, `calcSelladoresTecho`, y el módulo de roofVisualQuoteConsistency.
- **Tests de API backend:** existen (`tests/calc-routes.validation.js`, `tests/calcLoopbackClient.test.js`), cubren el endpoint `/calc/cotizar`.
- **Tests de UI / flujo completo:** hay scripts Playwright (`scripts/playwright-calculator-wizard.mjs`, `scripts/playwright-route-audit-smoke.mjs`) pero no se ejecutan automáticamente en CI para el flujo de cotización paso a paso.

### Qué falta antes de que el equipo de ventas pueda confiar

1. **Test de smoke de cotización completa** (no solo cálculo unitario): verificar que dado familia + espesor + largo + ancho, el total final en pantalla coincide con el total calculado por `calcTechoCompleto`. Actualmente no existe este test end-to-end en el suite `npm test`.
2. **Test de validación de warnings visibles**: verificar que cuando `calcTechoCompleto` devuelve `warnings.length > 0`, la UI los muestra. Esto cubriría P0-2 y P1-2.
3. **Test de lista de precios**: verificar que cambiar de `web` a `venta` cambia el total visible, y que el total no queda en el valor anterior durante el siguiente render.

### Smoke test mínimo sugerido antes de cada deploy

```
1. npm run gate:local       — lint + tests unitarios
2. node scripts/playwright-calculator-wizard.mjs
   Verificar:
   - Escenario "Solo Techo", ISODEC EPS 100mm, 6×5m, metal → total visible con IVA > 0
   - Escenario "Solo Pared", ISOPANEL EPS 100mm, 4×10m, metal → total visible con IVA > 0
   - Cambio de lista web → venta → total cambia
   - Warning visible cuando largo > ap (ej. 6m > 5.5m en ISODEC EPS 100mm)
3. npm run smoke:prod       — health + API básica
```

---

## 7. Plan de ataque sugerido (7 días)

**Principio:** cada día termina con `npm run gate:local:full` verde + deploy a producción (Vercel preview o producción según impacto).

### Día 1 — Bugs críticos de datos (P0-2 + P1-2)
- Corregir `colMinArea` en ISOROOF PLUS (`constants.js`): llenar los tres colores con `800`.
- Agregar lectura de `panel.notas[espesor]` en `calcTechoCompleto` y emitir como warning.
- Agregar tests en `validation.js` para ambos.
- **Deploy:** Vercel preview. Verificar con ISOROOF PLUS 200 m² y ISODEC PIR 50mm.

### Día 2 — Fix de variables global de lista de precios (P0-1)
- Mover `setListaPrecios()` del interior del `useMemo` a un `useEffect` dedicado con prioridad (o refactorizar `p()` para aceptar lista como parámetro).
- Agregar test de race: cambio de lista + cambio de escenario en el mismo ciclo.
- **Deploy:** Vercel preview.

### Día 3 — Fixes rápidos de UX (P1-1, P1-3, P1-4)
- Verificar perfil U 250mm contra MATRIZ y agregar comentario o corregir precio.
- Resetear `techo.color` al cambiar de familia.
- Persistir `listaPrecios` en `localStorage`.
- **Deploy:** Vercel producción (bajo riesgo, sin cambios de lógica de cálculo).

### Dia 4 — Validación wizard (P1-5) + warning P0-3 visible
- Agregar verificación `largoMinOK` / `largoMaxOK` en `isWizardStepValid`.
- Propagar `rT.error` del escenario cámara como estado de error visible (banner rojo) en vez de solo warning en array.
- **Deploy:** Vercel producción.

### Día 5 — UX de ventas rápidas (Sección 5)
- Botón "Precio rápido" (skip estructura + bordes, usar defaults).
- Precio/m² junto al selector de espesor.
- Botón "Copiar precio" (total c/IVA al portapapeles).
- Badge de color en total según lista activa.
- **Deploy:** Vercel producción.

### Día 6 — Smoke test automatizado de cotización
- Implementar o activar `playwright-calculator-wizard.mjs` para los 3 casos del smoke test sugerido en §6.
- Integrar en `npm run gate:local:full` o como paso pre-deploy.
- **Deploy:** CI pipeline actualizado.

### Día 7 — Validación de precios con equipo + presets
- Revisar los 5 ítems de la tabla de precios contra MATRIZ con alguien del equipo de ventas.
- Si hay discrepancias, ejecutar import desde CSV con `csvPricingImport.js`.
- Agregar al menos 2 presets de obra típica (galpón, local comercial) con dimensiones pre-cargadas.
- **Deploy:** Vercel producción + Cloud Run si hay cambios en `constants.js`.

---

## 8. Riesgos no resueltos

### R1 — No se puede confirmar si los precios de fijaciones (varillas, tornillos) están actualizados
Los precios en `FIJACIONES` tienen decimales que sugieren que fueron importados desde planilla, pero no hay fecha de import ni comentario de "última actualización" en el archivo. El riesgo es bajo en valor absoluto (las fijaciones son ~5–15% del total de una cotización típica) pero puede generar diferencias entre lo cotizado y lo facturado.

### R2 — `LISTA_ACTIVA` es un módulo singleton: si el componente se monta dos veces (SSR + hydration, o dos instancias en la misma página), el estado es compartido
Requiere decisión arquitectónica: contexto React vs prop drilling vs módulo de pricing con instancias. No se puede resolver sin más información sobre el entorno de deploy (Vercel puede hacer SSR con React Server Components dependiendo de la versión del router).

### R3 — El flete está hardcodeado en $240 sin variación por zona
Si el equipo de ventas cobra fletese diferentes según la obra, el vendedor tiene que recordar ajustarlo manualmente. No hay validación ni sugerencia. Requiere definición de negocio: ¿se parametriza por zona geográfica? ¿Por m² de pedido?

### R4 — La restricción de mínimo 500 m² para ISOROOF 3G color Blanco (`colMinArea.Blanco: 500`) SÍ está implementada, pero no está cubierta por ningún test en `validation.js`
Si alguien toca ese dato en `constants.js` sin saberlo, la validación desaparece silenciosamente.

### R5 — No hay información sobre la fecha real de la última actualización masiva de precios
El hash de `calculatorDataVersion.js` refleja la fecha del último build, no la fecha de la última modificación manual de precios. Para saber cuándo se actualizaron los precios por última vez habría que hacer `git log -p src/data/constants.js` y buscar cambios en los campos `venta`/`web`. Esta auditoría no puede determinar si los precios actuales corresponden a la lista vigente del proveedor sin acceso a la MATRIZ de precios.
