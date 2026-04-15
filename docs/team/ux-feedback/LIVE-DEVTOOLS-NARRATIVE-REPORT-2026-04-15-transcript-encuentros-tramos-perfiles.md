# LIVE-DEVTOOLS-NARRATIVE-REPORT — encuentros multizona: tramos selectables y perfiles

## 1. Metadatos

| Campo | Valor |
|--------|--------|
| Fecha (ISO) | 2026-04-15 |
| Base URL | `https://calculadora-bmc.vercel.app` (referencia verificación futura) |
| Entorno | no verificado en esta sesión (sin navegación MCP en el hilo) |
| Navegador / MCP | chrome-devtools MCP configurado en [`.cursor/mcp.json`](../../.cursor/mcp.json); **no se invocaron herramientas MCP en este hilo** |
| Participantes | Matías (requisito por chat) |

## 2. Objetivo de la sesión

- **Goal (una frase):** En el flujo multizona (referencia “paso 10 de 13”), permitir que cada **tramo** generado en **encuentros compartidos** entre zonas sea **seleccionable**, con posibilidad de **incluir o no** el encuentro en la cotización **por tramo**, independientemente del **tramo que sobresale** (perímetro libre colineal), el cual debe poder recibir **perfiles asignados de forma independiente**.
- **Criterios de éxito del usuario:** (1) Selección explícita por tramo en la UI de planta o equivalente; (2) toggle o equivalente “incluir encuentro / excluir del BOM” **por tramo**, no solo a nivel par de zonas; (3) el tramo sobresaliente tiene **perfil propio** desacoplado del perfil del tramo compartido contiguo.

## 3. Línea de tiempo — narrativa del usuario (`U-xx`)

| ID | Orden | ACTION (hecho) | EXPECT (intención) | Notas |
|----|-------|----------------|-------------------|--------|
| U-01 | 1 | Requisito verbal: “en paso 10 de 13” | Ubicar el paso del asistente y el contexto UI/BOM | “Paso 10” en **Solo techo** (`SCENARIOS_DEF`) = **Accesorios perimetrales** (`bordes`, índice 9 en 0-based). Si el usuario omite **Pendiente** con varias zonas, la numeración visible del wizard se desplaza (12 pasos); conviene confirmar en UI. |
| U-02 | 2 | Pedir tramos de encuentros compartidos **seleccionables** | Poder elegir y editar cada sub-tramo del encuentro, no solo el par ZA–ZB completo | Hoy la configuración por par está en `preview.encounterByPair[pk]` (un objeto por clave `min-max`). |
| U-03 | 3 | Poder **agregar o no** encuentros **independientemente** por tramo | Control fino de qué tramos entran al BOM (encuentro) | El motor de encuentros en BOM usa `buildEdgeBOM` + `junctionListForZonaGi` ([`scenarioOrchestrator.js`](../../src/utils/scenarioOrchestrator.js)): una fila por segmento geométrico de `findEncounters`, con **un** perfil derivado del par. |
| U-04 | 4 | El tramo que **sobresale** debe tener **perfiles independientes** | El tramo libre colineal (no solape) no hereda obligatoriamente el mismo tratamiento que el encuentro | Geometría: solape → `findEncounters`; no solape → `buildExteriorSegments` ([`roofPlanGeometry.js`](../../src/utils/roofPlanGeometry.js)). En lados `fullySide` compartidos, la UI deshabilita franjas de borde en planta; en parcial, el usuario espera aún más granularidad entre “encuentro” y “sobresaliente”. |

## 4. Evidencia del agente — DevTools / MCP (`E-xx`)

| ID | Momento | Tool / fuente | Hallazgo |
|----|---------|---------------|----------|
| E-01 | Análisis estático | Lectura repo `src/utils/scenarioOrchestrator.js`, `roofEncounterModel.js`, `roofPlanGeometry.js`, `RoofPreview.jsx`, `PanelinCalculadoraV3_backup.jsx` | Un **solo** `encounterByPair` normalizado por `encounterPairKey`; `junctionListForZonaGi` emite líneas de encuentro con `encounterBorderPerfil(raw)` único por par; modo **desnivel** ya distingue texto UI “Tramo inferior / superior” pero el comentario en código indica **MVP BOM usa primero el inferior** (`encounterBorderPerfil`). |
| E-02 | — | **MCP chrome-devtools** (`list_console_messages`, `take_snapshot`, etc.) | **No ejecutado en este hilo** — sin salida de herramienta; no se afirma estado de consola/red en prod/local. |

## 5. Cruce narrativa ↔ evidencia

| User ID | Evidence IDs | ¿Coincide expectativa? | Brecha / notas |
|---------|--------------|-------------------------|----------------|
| U-02 | E-01 | **no** | No hay modelo de sub-tramos por par; solo configuración agregada por `pairKey`. |
| U-03 | E-01 | **no** | No hay flag “incluir/excluir” por subintervalo; `encounterEsContinuo` aplica al objeto completo. |
| U-04 | E-01 | **parcial** | El perímetro libre ya es geometría distinta (`exterior`), pero si `fullySide` el borde perimetral en planta puede quedar deshabilitado como bloque; no hay UI dedicada “perfil del tramo sobresaliente vs tramo compartido” en el mismo eje con granularidad de intervalo. |

## 6. Hallazgos priorizados

| ID | Severidad | Título | Resumen | Área probable |
|----|-----------|--------|---------|----------------|
| LDN-2026-04-15-01 | P1 | Modelo de datos encuentro = 1 blob por par | Impide selección y BOM distintos por sub-tramo a lo largo de la misma arista compartida. | `PanelinCalculadoraV3_backup.jsx` (persistencia `preview.encounterByPair`), `roofEncounterModel.js` |
| LDN-2026-04-15-02 | P1 | BOM encuentros | `junctionListForZonaGi` y `encounterBorderPerfil` asumen un perfil efectivo por encuentro geométrico. | `scenarioOrchestrator.js`, `calculations.js` (consumo `encounterJunctions`) |
| LDN-2026-04-15-03 | P2 | Geometría `findEncounters` | Un contacto recta–recta genera **un** intervalo fusionado; subdivisión adicional requiere reglas de negocio (particiones manuales o auto-split). | `roofPlanGeometry.js` |
| LDN-2026-04-15-04 | P2 | Aclaración “paso 10” | Canónico hoy: paso **10/13** = `bordes`; encuentros también en planta antes (p. ej. **Estructura** / arrastre). | `constants.js` `SCENARIOS_DEF`, copys en `RoofPreview.jsx` |

## 7. Plan de acción por fases

### Fase A — Investigación y diseño (sin código o spike aislado)

1. **Confirmar UX:** mapa de pasos con/sin salto de Pendiente multizona; dónde vive la interacción deseada (solo `bordes`, o también **Estructura** / planta siempre visible).
2. **Definir “tramo”:** ID estable = `encounterId` geométrico (`enc-…` de `findEncounters`) + **subíndice** opcional `[0..n)` si se permite partir manualmente un segmento; o partición automática solo en cambios de solape.
3. **Especificar persistencia:** evolución de `preview.encounterByPair` hacia p. ej. `encounterSegmentsByPair: { [pairKey]: [ { segmentKey, enabled, modo, perfil, perfilVecino?, desnivel? } ] }` con migración: ausencia de lista → un segmento que refleja el objeto actual.
4. **BOM:** para cada segmento habilitado, longitud = fracción de `e.length` (o longitud almacenada) × perfil; deshabilitado = 0 ml en `encounterJunctions` y comportamiento coherente en `effectiveBorders` para trozos colineales (riesgo: lados parcialmente compartidos ya complejos en `getSharedSidesPerZona`).

### Fase B — Datos y geometría

1. Extender `normalizeEncounter` / tipos a **lista de tramos** o mantener objeto global + overrides por `segmentKey`.
2. Ajustar `junctionListForZonaGi` (y cualquier consumidor en `calculations.js`) para **N** filas por encuentro geométrico cuando haya partición.
3. Para **tramo sobresaliente:** asegurar que los segmentos de `buildExteriorSegments` en el mismo lado semántico puedan llevar `borders` de zona sin quedar bloqueados por `fullySide` cuando solo una fracción del lado es encuentro; puede requerir pasar de `fullySide` booleano a **cobertura fraccional** en UI.

### Fase C — UI (`RoofPreview.jsx`, popover en `PanelinCalculadoraV3_backup.jsx`)

1. Dibujar **handles** o sub-rayas clickeables sobre la línea de encuentro (SVG) mapeadas a `segmentKey`.
2. Panel: checkbox “Incluir en presupuesto”, selectores de perfil por tramo; para desnivel, decidir si se replica el patrón bajo/alto **por sub-tramo** o se simplifica.
3. Leyenda / hint: actualizar copy que hoy dice “tocá la línea del encuentro para reabrir” para reflejar multi-tramo.

### Fase D — Verificación

1. **MCP (próxima corrida):** `https://calculadora-bmc.vercel.app` o local `http://localhost:5173/`, flujo multizona → consola/red + snapshot en encuentro.
2. `npm run lint`, `npm test`; casos nuevos en `tests/validation.js` para migración de estado y suma de ml en BOM con tramos desactivados.

## 8. Verificación (checklist)

- [ ] Reproducible en URL indicada tras implementación
- [ ] Consola sin errores P0 en flujo multizona / encuentro (pendiente MCP)
- [ ] Red sin 4xx/5xx inesperados (pendiente MCP)
- [ ] Criterios de éxito §2 cubiertos o ticket abierto con diseño aprobado

## 9. Anexos

- Taxonomía previa: [`ROOF-ENCOUNTER-LOGIC-SPEC.md`](./ROOF-ENCOUNTER-LOGIC-SPEC.md)
- Agente recomendado: **bmc-roof-2d-viewer-specialist** + **calculo-especialist** para cotas vs BOM
