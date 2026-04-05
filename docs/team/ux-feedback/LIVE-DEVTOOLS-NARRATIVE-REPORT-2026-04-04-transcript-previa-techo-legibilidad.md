# LIVE-DEVTOOLS-NARRATIVE-REPORT — Previa del techo: legibilidad (transcripción + plan)

Skill: [`.cursor/skills/live-devtools-transcript-action-plan/SKILL.md`](../../.cursor/skills/live-devtools-transcript-action-plan/SKILL.md).

---

## 1. Metadatos

| Campo | Valor |
|--------|--------|
| Fecha (ISO) | 2026-04-04 |
| Base URL | `https://calculadora-bmc.vercel.app` (referencia); verificación local posible `http://localhost:5173/` |
| Entorno | implementación en repo (no MCP en esta corrida) |
| Navegador / MCP | **No ejecutado** chrome-devtools MCP en este hilo (sin output de consola/red/snapshot) |
| Participantes | Matías (narrativa) |

## 2. Objetivo de la sesión

- **Goal (una frase):** Hacer más legible la información en la vista **Previa del techo** (paso Estructura): chips de apoyos por encima del dibujo, cotas rojas grandes, cotas de suma en filas de bloques y totales de planta.
- **Criterios de éxito del usuario:** Chip “N apoyos” no tapado por panel ni líneas ni cotas; cotas rojas cómodas en móvil; cota combinada además de por tramo; ancho y largo total de la superficie en planta.

## 3. Línea de tiempo — narrativa del usuario (`U-xx`)

| ID | Orden / tiempo | ACTION (hecho) | EXPECT (esperado) | Notas audio |
|----|----------------|----------------|-------------------|-------------|
| U-01 | 1 | Menciona la caja superior con “tres apoyos” o número de apoyos | Debe quedar **por encima** del panel, líneas y cotas rojas, sin solaparse | “supports” = apoyos |
| U-02 | 2 | Pide cotas rojas más grandes | Medidas **mucho más grandes**, legibles en cualquier dispositivo | — |
| U-03 | 3 | Describe frente superior con zona 1 y zona 2 | Además de cotas por bloque, una cota que **sume** ambos para el largo completo de esa fila | “forehead” = frente superior |
| U-04 | 4 | Pide dimensiones totales | **Ancho total** y **largo total** de la superficie (planta) | “Good day” ruido de dictado |

## 4. Evidencia del agente — DevTools / MCP (`E-xx`)

| ID | Momento (relativo) | Tool / fuente | Hallazgo |
|----|--------------------|-----------------|----------|
| E-01 | — | *(no corrido)* | No hay captura MCP en este hilo; no se afirma estado de consola/red en prod/local. |
| E-02 | Cierre | `npm run lint` (repo) | ESLint `src/`: OK. |
| E-03 | Cierre | `npm test` (repo) | 263 tests + `roofVisualQuoteConsistency`: OK. |

## 5. Cruce narrativa ↔ evidencia

| User ID | Evidence IDs | ¿Coincide expectativa? | Brecha / notas |
|---------|--------------|-------------------------|----------------|
| U-01 | E-02, E-03 (código) | parcial hasta QA visual | Verificar en navegador: z-order chip después del overlay global. |
| U-02 | E-02, E-03 | parcial hasta QA visual | Tamaños ya elevados en constantes `ARCH_DIM_*`; validar en pantalla chica. |
| U-03 | E-02, E-03 | sí (lógica) | `horizontalExteriorChains` / `verticalExteriorChains` + nota “Suma tramo”. |
| U-04 | E-02, E-03 | sí (lógica) | `roofEnvelope` + cotas “Ancho total planta” / “Largo total planta”. |

## 6. Hallazgos priorizados

| ID | Severidad | Título | Resumen | Área |
|----|-----------|--------|---------|------|
| LDN-2026-04-04-PT-01 | P2 | Sin MCP en sesión | Falta evidencia en vivo; próxima pasada MCP recomendada en paso Estructura. | proceso |
| LDN-2026-04-04-PT-02 | P3 | `viewBox` vs muchas cotas | Si se cortan márgenes en layouts extremos, subir pads en `svgViewBox` useMemo. | `RoofPreview.jsx` |

## 7. Implementación realizada (repo)

- **`EstructuraZonaChipsLayer`:** chip apoyos / pts fij. con `CHIP_CLEAR_ABOVE_ROOF_M`, render **después** de `EstructuraGlobalExteriorOverlay` para z-order superior.
- **`roofEnvelope`:** bbox desde `layout.entries`; prop `envelope` al overlay.
- **`svgViewBox`:** márgenes ampliados según cantidad de segmentos por lado y apilado de cotas.
- **`EstructuraGlobalExteriorOverlay`:** ya incluía segmentos, cadenas “Suma tramo” y envolvente con notas; quedó cableado `envelope`.

Archivo principal: [`src/components/RoofPreview.jsx`](../../src/components/RoofPreview.jsx).

## 8. Verificación (checklist)

- [ ] Reproducible en URL local/prod: paso **Estructura**, multizona con fila de dos bloques.
- [ ] Chip visible por encima de líneas violetas y cotas.
- [ ] Cotas “Suma tramo” y envolvente visibles sin recorte (ajustar `viewBox` si hiciera falta).
- [x] `npm run lint` OK
- [x] `npm test` OK

## 9. Próxima corrida MCP

Con **chrome-devtools** (perfil aislado si aplica): navegar a Estructura, snapshot + consola, confirmar ausencia de solapes y legibilidad en viewport móvil emulado.
