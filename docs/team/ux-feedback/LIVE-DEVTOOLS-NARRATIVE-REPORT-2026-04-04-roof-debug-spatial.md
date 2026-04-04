# LIVE-DEVTOOLS-NARRATIVE-REPORT — roof debug + posición en espacio

Skill: `.cursor/skills/live-devtools-narrative-mcp/SKILL.md`. Invocación: **Live DevTools narrative** + CSV `roof-debug-2026-04-04T15-01-25.713Z.csv` + captura de pantalla (visor 3D + 2D).

---

## 1. Metadatos

| Campo | Valor |
|--------|--------|
| Fecha (ISO) | 2026-04-04 |
| Base URL | `https://calculadora-bmc.vercel.app` |
| Entorno | prod (MCP) + datos locales CSV / captura usuario |
| Navegador / MCP | `project-0-Calculadora-BMC-chrome-devtools` — `navigate_page`, `list_console_messages`, `list_network_requests` |
| Participantes | Matías (captura + CSV) |

## 2. Objetivo de la sesión

- **Goal (una frase):** Entender cómo las **cuatro zonas** del techo están **posicionadas en espacio** (2D planta vs 3D) y cómo lo refleja el **export ROOF DEBUG CSV**.
- **Criterios de éxito del usuario:** Cruzar **encuentros**, **contactos** y **frente anclado** del CSV con lo que se ve en el visor y el esquema 2D.

## 3. Línea de tiempo — narrativa del usuario (`U-xx`)

| ID | Orden / tiempo | ACTION (hecho) | EXPECT (esperado) |
|----|----------------|----------------|-------------------|
| U-01 | — | Exportar ROOF DEBUG CSV (`15-01-25`) con 4 zonas y encuentros configurados (p. ej. **Encuentro zonas 0-1** en **Continuo**). | El CSV debe ser coherente con geometría (contactos) y con la unión de componentes en 3D. |
| U-02 | — | Captura: visor 3D con **IZQ** / pastilla **Frente**, panel **Encuentro 0-1**, mini-planta 2D con tramos ZONA 0–3. | 2D y 3D deben leerse con la misma convención de **frente** y orden de zonas. |

## 4. Evidencia del agente — DevTools / MCP (`E-xx`)

| ID | Momento (relativo) | Tool / fuente | Hallazgo |
|----|--------------------|-----------------|----------|
| E-01 | Tras abrir prod | `navigate_page` → `https://calculadora-bmc.vercel.app` | Carga OK; pestaña seleccionada en la URL canónica. |
| E-02 | Misma sesión | `list_console_messages` (`error`, `warn`) | **Sin mensajes** (home inicial; no se reprodujo el flujo completo de cotización en el MCP). |
| E-03 | Misma sesión | `list_network_requests` (primeras 17) | Documento y chunks **200**; assets **200/304**; sin 4xx/5xx en carga inicial. |
| E-04 | Adjunto usuario | CSV `roof-debug-2026-04-04T15-01-25.713Z.csv` | Ver §5.1 (parse estructurado). |
| E-05 | Adjunto usuario | PNG `assets/image-dc15b37f-fd92-4be1-8158-9ddbbaaec608.png` | Visor 3D multizona + 2D al pie; **Encuentro zonas 0-1** visible; etiqueta **Frente** en el marco del visor. |

## 5. Análisis del CSV ↔ posición en espacio

### 5.1 Snapshot global

| Métrica | Valor | Lectura |
|---------|-------|---------|
| `zonas_count` | 4 | Cuatro rectángulos cotizables. |
| `encounters_count` | 3 | Tres pares con encuentro modelado (cadena o T/L típico). |
| `contact_len_geom_m` / `contact_len_logical_m` | **15.5548** | Geometría y lógica de contacto **coinciden** (`delta 0`) — buen signo de consistencia. |
| `tipo_aguas` | `una_agua` | Un solo plano de faldón por zona en convención ancho/largo habitual. |

### 5.2 Una sola componente conectada

| Campo | Valor |
|-------|--------|
| `component_label` | C1 |
| `zone_gis` | `0\|1\|2\|3` |
| `front_min_m` | 0.0000 |
| `front_max_m` | 13.0452 |
| `front_spread_m` | **13.0452** |

**Interpretación:** Las cuatro zonas pertenecen al **mismo componente** para el cálculo del **frente 3D**: el motor toma el frente “global” del grupo y reparte **deltas** por zona para alinear la cubierta en un plano lógico común. Un **spread ~13 m** indica que en planta los bordes que actúan como “frente” (convención app: borde inferior del rect en 2D = **Frente**) están muy separados entre zonas — típico de una forma **en L** o con un tramo muy “atrás” respecto a otro, no de un solo rectángulo compacto.

### 5.3 Por zona (anclaje de frente y encuentros)

Índice = `zone_gi` (0-based). Etiquetas CSV = `Z1`…`Z4` (ordinal 1-based en el export).

| zone_gi | label CSV | area_m2 | front_raw_m | front_anchor_m | front_delta_m | encounter_len_m | shared_intervals |
|---------|-----------|---------|-------------|----------------|---------------|-----------------|------------------|
| 0 | Z1 | 135.52 | 11.0000 | 13.0452 | 2.0452 | **15.5548** | **3** |
| 1 | Z2 | 33.60 | 13.0452 | 13.0452 | 0.0000 | 3.9548 | 1 |
| 2 | Z3 | 33.60 | **0.0000** | 13.0452 | **13.0452** | 5.6000 | 1 |
| 3 | Z4 | 33.60 | 6.0000 | 13.0452 | 7.0452 | 6.0000 | 1 |

**Lectura espacial:**

1. **`front_anchor_m` constante (13.0452)** en todas las filas: el **mismo plano de frente** ancla el conjunto en 3D (coherente con la regla de “componente conectado” del debug).
2. **`front_raw_m`** es la posición del borde de frente **en planta antes de unificar**; quien tiene `front_raw` más bajo (aquí **gi=2 → 0 m**) queda más “al fondo” en Y; por eso su **`front_delta_m` es el mayor (13.05 m)** — es la pieza que más hay que “traer” hacia el frente visual para alinear con el resto.
3. **Zona índice 0** concentra **`encounter_len_m` 15.55** y **3 intervalos**: actúa como **nodo central** (más metros de borde compartido con vecinos); encaja con un esquema tipo **cruz / L** donde un tramo grande une varios encuentros.
4. Las otras tres zonas tienen **un intervalo** cada una y longitudes de encuentro menores — típico de **un solo lado** de contacto fuerte con el hub.

### 5.4 Cruce con la captura (2D + 3D)

- La **mini-planta 2D** de la captura muestra un tramo largo central, uno a la izquierda y dos más chicos arriba y abajo-derecha — compatible con **un hub + tres extensiones** y con **3 encuentros** declarados en el CSV.
- El panel **Encuentro zonas 0-1** en la UI usa **índices 0-based** (`0-1`); en el CSV, eso es **`zone_gi` 0 y 1** (etiquetados **Z1** y **Z2** en la columna `zone_label`). Si en el lienzo 3D leés **“ZONA 0”**, suele ser el **índice de array**, no el ordinal del CSV: conviene **no mezclar** “Z1 del CSV” con “zona 1 en UI” sin mirar la leyenda.
- La pastilla **Frente** en el visor (E-05) coincide con la convención documentada: **frente = borde inferior del rectángulo en 2D**; el CSV `front_*` está alineado a esa semántica de debug.

## 6. Cruce narrativa ↔ evidencia

| User ID | Evidence IDs | ¿Coincide expectativa? | Brecha / notas |
|---------|--------------|-------------------------|----------------|
| U-01 | E-04 | **Parcial / sí a nivel motor** | CSV muestra **3 encuentros** y contacto geom = lógico; no validamos en MCP el mismo estado de proyecto (no se cargó la misma cotización en el navegador automatizado). |
| U-02 | E-04, E-05 | **Parcial** | 2D y 3D encajan cualitativamente con **un componente** y un **hub**; posibles **saltos visuales** percibidos en 3D pueden deberse a **deltas de frente** grandes (p. ej. gi=2) o a perspectiva — revisar con DEBUG ON y otra exportación tras mover una zona. |

## 7. Hallazgos priorizados

| ID | Severidad | Título | Resumen | Área probable |
|----|-----------|--------|---------|----------------|
| LDN-2026-04-04-01 | P2 | Nomenclatura zona CSV vs lienzo | Export usa `Z1`…`Z4` por `zone_gi`; UI 3D puede mostrar **ZONA 0**…**3**. Riesgo de confusión al leer “encuentro 0-1”. | `PanelinCalculadoraV3_backup.jsx` (debug export + labels Html) |
| LDN-2026-04-04-02 | P2 | `front_spread` alto en L | Spread **13 m** refleja layout L/ramificado; es **esperable** si un tramo tiene `front_raw` ~0 y otro ~13. Documentar en ayuda DEBUG para usuarios avanzados. | Docs UX / overlay DEBUG |
| LDN-2026-04-04-03 | P3 | MCP sin reproducción de escena | Carga prod sin errores; **no** se replicó en MCP la cotización de 4 zonas — evidencia de consola/red es solo **home**. | Sesión MCP |

## 8. Recomendaciones y siguientes pasos

1. En el panel **ROOF DEBUG**, añadir (si no existe) una fila **“gi → etiqueta UI”** o unificar criterio **siempre índice 0-based** en CSV y en el canvas.
2. Si la duda es **“por qué se ve un escalón”** entre zonas: comparar **`front_delta_m`** por zona con la vista 3D; valores altos (p. ej. 13 m) indican corrección fuerte para coplanar el frente del componente.
3. Repetir **export CSV** después de **Alinear zonas** y tras marcar **Continuo** en todos los pares, y verificar que `contact_len_*` se mantiene estable.

## 9. Verificación (checklist)

- [x] URL prod alcanzable (MCP)
- [x] Consola: sin error/warn en carga inicial (MCP)
- [x] Red: sin 4xx/5xx en carga inicial (MCP)
- [ ] Misma escena 4 zonas reproducida en MCP con captura de consola en flujo techo (pendiente si se quiere cierre P0)

## 10. Anexos

- CSV analizado: `/Users/matias/Downloads/roof-debug-2026-04-04T15-01-25.713Z.csv`
- Captura: `assets/image-dc15b37f-fd92-4be1-8158-9ddbbaaec608.png` (workspace Cursor)
