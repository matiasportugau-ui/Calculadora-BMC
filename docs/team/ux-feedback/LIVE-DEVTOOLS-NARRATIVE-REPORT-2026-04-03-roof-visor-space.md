# LIVE-DEVTOOLS-NARRATIVE-REPORT — visor 3D cubierta / espacio

Skill: `.cursor/skills/live-devtools-narrative-mcp/SKILL.md`.

## 1. Metadatos


| Campo           | Valor                                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Fecha (ISO)     | 2026-04-03                                                                                                                                 |
| Base URL        | `https://calculadora-bmc.vercel.app` (referencia; fix validado en código local)                                                            |
| Entorno         | prod (captura usuario) + local tras cambio                                                                                                 |
| Navegador / MCP | chrome-devtools MCP: intento `navigate_page` → error *browser already running* para el perfil MCP (sin consola/red nuevas en esta corrida) |
| Participantes   | Matías (narrativa + captura)                                                                                                               |


## 2. Objetivo de la sesión

- **Goal (una frase):** Usar todo el espacio disponible del visor visual para que el render 3D de cubierta sea más grande, no se vea recortado y sea más fácil de interactuar.
- **Criterios de éxito del usuario:** Visualización aprovechando ~el doble del área útil respecto al estado previo; menos sensación de “miniatura” y de contenido cortado.

## 3. Línea de tiempo — narrativa del usuario (`U-xx`)


| ID   | Orden / tiempo | ACTION (hecho)                                                                                                          | EXPECT (esperado)                                         |
| ---- | -------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| U-01 | Paso 1         | Uso del flujo **Live DevTools narrative** + descripción del problema en el visor “VISOR VISUAL · PANELES PARA CUBIERTA” | Evidencia de consola/red anclada al problema; tabla cruce |
| U-02 | Paso 2         | Observación: el render 3D ocupa poca fracción del área celeste; hay mucho espacio vacío debajo; scroll en la tarjeta    | El lienzo 3D debería expandirse para interacción cómoda   |


## 4. Evidencia del agente — DevTools / MCP (`E-xx`)


| ID   | Momento (relativo)  | Tool / fuente                                                                                                             | Hallazgo                                                                                                                                                                                                                   |
| ---- | ------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E-01 | Tras solicitud      | `navigate_page` → `https://calculadora-bmc.vercel.app/calculadora`                                                        | MCP respondió: perfil Chrome DevTools ya en uso (*browser is already running*). No se listaron mensajes de consola ni red en esta sesión.                                                                                  |
| E-02 | Análisis de código  | `QuoteVisualVisor.jsx` + `PanelinCalculadoraV3_backup.jsx` (`RoofBorderCanvas`, portal)                                   | El host `[data-bmc-roof-3d-host]` solo tenía `**minHeight*`*, sin `**height**` definida. Los portales usaban `height: "100%"` sobre un padre sin altura resuelta → el contenedor WebGL no crecía como el usuario esperaba. |
| E-03 | Captura de pantalla | `assets/Captura_de_pantalla_2026-04-03_a_la_s__12.35.25_a._m.-0b1cd9bc-1017-4187-90c5-3deddedd13c4.png` (proyecto Cursor) | Panel 3D pequeño en la parte superior del área del visor, gran margen vacío inferior — coherente con U-02.                                                                                                                 |


## 5. Cruce narrativa ↔ evidencia


| User ID | Evidence IDs | ¿Coincide expectativa? | Brecha / notas                                                                  |
| ------- | ------------ | ---------------------- | ------------------------------------------------------------------------------- |
| U-01    | E-01         | parcial                | MCP no entregó consola/red por bloqueo de perfil; se completó con E-02–E-03.    |
| U-02    | E-02, E-03   | sí (causa raíz)        | Corregido en código: altura explícita del host + cadena flex portal → shell 3D. |


## 6. Hallazgos priorizados


| ID                | Severidad | Título                      | Resumen                                                                                           | Área probable (`src/` / `server/` / env / deploy)                        |
| ----------------- | --------- | --------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| LDN-2026-04-03-01 | P1        | Host 3D sin altura resuelta | `minHeight` sin `height` → porcentajes de hijos no expandían el `<Canvas />` en el visor derecho. | `src/components/QuoteVisualVisor.jsx`, `PanelinCalculadoraV3_backup.jsx` |
| LDN-2026-04-03-02 | P2        | Vista 2D techo muy chata    | `RoofPreview` limitaba el SVG a 280×200 px; se amplió con `clamp` y flex para pantallas grandes.  | `src/components/RoofPreview.jsx`                                         |


## 7. Recomendaciones y siguientes pasos

1. Desplegar frontend (Vercel) para que producción refleje el host con `height: clamp(360px, min(72vh, 820px), 900px)` y el portal flex.
2. Si hace falta evidencia DevTools en otra corrida: cerrar la instancia previa de Chrome DevTools MCP o usar `--isolated` según doc del paquete, y repetir `list_console_messages` / `list_network_requests` tras navegar al paso dimensiones + techo.

## 8. Verificación (checklist)

- Reproducible en URL indicada (síntoma en prod antes del deploy)
- Consola: no evaluada en esta corrida (MCP bloqueado)
- Red: no evaluada en esta corrida (MCP bloqueado)
- Criterios de éxito del usuario cubiertos en **producción** tras deploy (pendiente push/deploy)

## 9. Anexos

- Cambios aplicados (resumen): `QuoteVisualVisor.jsx` (altura explícita del host 3D); portal en `RoofBorderSelector` (`display: flex`, `minHeight: 0`); `RoofBorderCanvas` modo `fillContainer` con `flex: 1 1 auto` y `minHeight: 0`; `RoofPreview.jsx` área SVG más alta y flexible.

