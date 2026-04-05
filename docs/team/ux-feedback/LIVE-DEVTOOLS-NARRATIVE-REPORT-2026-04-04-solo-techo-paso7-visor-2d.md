# LIVE-DEVTOOLS-NARRATIVE-REPORT — Solo techo paso 7: visor 2D + 3D «Próximamente»

Skill: [`.cursor/skills/live-devtools-transcript-action-plan/SKILL.md`](../../.cursor/skills/live-devtools-transcript-action-plan/SKILL.md). Invocación: plan desde transcripción + localhost.

---

## 1. Metadatos

| Campo | Valor |
|--------|--------|
| Fecha (ISO) | 2026-04-04 |
| Base URL | `http://localhost:5173/` |
| Entorno | local |
| Navegador / MCP | No se ejecutó MCP chrome-devtools en esta corrida de implementación |
| Participantes | Matías (intención UX), agente implementación |

## 2. Objetivo de la sesión

- **Goal (una frase):** En el paso 7 de 13 del asistente **Solo techo** (`dimensiones`), priorizar la **vista previa 2D** en el panel derecho, marcar la **visualización 3D** como **Próximamente**, y dejar la 3D en un bloque **colapsado por defecto** (expandible al clic).
- **Criterios de éxito del usuario:** Cartel «Próximamente» sobre la 3D; acordeón principal del visor cerrado al entrar al paso cuando hay slot 2D; área principal muestra la misma vista 2D interactiva (`RoofPreview`) que antes estaba solo a la izquierda (en layout no compacto con host 3D).

## 3. Línea de tiempo — narrativa del usuario (`U-xx`)

| ID | Orden / tiempo | ACTION (hecho) | EXPECT (esperado) |
|----|----------------|----------------|-------------------|
| U-01 | 1 | Pedido de cambio en paso 7 (localhost) | Sustituir confianza en 3D por 2D dominante |
| U-02 | 2 | «Próximamente» en visualización 3D | Etiqueta clara de estado no definitivo |
| U-03 | 3 | Visor 3D cerrado por defecto; abrir con clic | Menos ruido visual al entrar al paso |
| U-04 | 4 | Mover «Vista previa del techo 2D» al área del visor derecho | Coherencia con referencia visual (planta rejilla) |

## 4. Evidencia del agente — DevTools / MCP (`E-xx`)

| ID | Momento (relativo) | Tool / fuente | Hallazgo |
|----|--------------------|-----------------|----------|
| E-01 | Implementación | Código | `SCENARIOS_DEF.solo_techo.wizardSteps[6].id === "dimensiones"` → paso 7 de 13 |
| E-02 | Verificación | `npm run lint` | OK |
| E-03 | Verificación | `npm test` | OK (262 + roofVisualQuoteConsistency) |

_No hay captura MCP en este hilo; no se inventan mensajes de consola ni requests._

## 5. Cruce narrativa ↔ evidencia

| User ID | Evidence IDs | ¿Coincide expectativa? | Brecha / notas |
|---------|--------------|-------------------------|----------------|
| U-01 | E-01, E-02, E-03 | parcial | Falta validación manual en navegador en esta corrida |
| U-02 | E-01 | sí | Badge + overlay «Próximamente» al expandir 3D |
| U-03 | E-01 | sí | `open` y `roof3dOpen` inician cerrados al entrar a `dimensiones` con slot 2D |
| U-04 | E-01 | sí | `RoofPreview` vía `roof2DPreview` en `QuoteVisualVisor`; oculto en columna izquierda cuando aplica |

## 6. Hallazgos priorizados

| ID | Severidad | Título | Resumen | Área probable |
|----|-----------|--------|---------|----------------|
| LDN-2026-04-04-11 | P2 | Layout compacto | Sin host 3D (`showRoof3DHost === false`) el 2D sigue en la columna izquierda | `PanelinCalculadoraV3_backup.jsx` |

## 7. Recomendaciones y siguientes pasos

1. Verificar en `http://localhost:5173/`: flujo Solo techo hasta **Dimensiones**, chevron del visor principal, bloque 3D anidado y overlay.
2. Opcional: segunda pasada con **Live DevTools narrative** (MCP) para consola/red en local.

## 8. Verificación (checklist)

- [ ] Reproducible en URL indicada (pendiente humana)
- [x] `npm run lint` sin errores
- [x] `npm test` OK
- [x] Criterios de implementación alineados a §2 (código)

## 9. Anexos — archivos tocados

- [`src/components/QuoteVisualVisor.jsx`](../../src/components/QuoteVisualVisor.jsx): prop `roof2DPreview`, bloque «Vista previa del techo (2D)», subacordeón 3D + «Próximamente», sincronización de estado al cambiar de paso.
- [`src/components/PanelinCalculadoraV3_backup.jsx`](../../src/components/PanelinCalculadoraV3_backup.jsx): `roof2DPreviewForVisor` (`useMemo`), `roof2DPreview` en `QuoteVisualVisor`, `RoofPreview` condicional en paso `dimensiones`.
