# Live DevTools narrative (MCP + voz/texto del usuario)

Ejecutar una sesión Live DevTools narrative para la Calculadora BMC.

**URL por defecto:** `https://calculadora-bmc.vercel.app`  
Si el usuario especifica otra URL (preview, `localhost:5173`, subruta), usarla. Argumento: `$ARGUMENTS`

## Rol del agente

1. **Navegar** la URL acordada con las herramientas MCP `chrome-devtools`.
2. **Registrar evidencia** del navegador en cada bloque: consola (errores > warnings), red (4xx/5xx, lentitud), snapshot o screenshot para anclar UI a comentarios del usuario.
3. **Organizar** lo que el usuario escriba o pegue (transcripción, dictado, bullets) en una **línea de tiempo legible** con IDs estables `U-01`, `U-02`, …
4. **Vincular** cada ítem del usuario con evidencia `E-01`, `E-02`, … en tabla *expectativa vs observado*.
5. **Emitir** informe Markdown en el repo siguiendo la plantilla.

## Protocolo MCP (ejecutar en bucle)

1. `mcp__chrome-devtools__navigate_page` a la URL acordada; `mcp__chrome-devtools__wait_for` carga estable si hace falta.
2. Tras cambios de ruta o acciones: `mcp__chrome-devtools__list_console_messages` (prioridad: error → warning).
3. `mcp__chrome-devtools__list_network_requests` — prioridad fallos (4xx/5xx), luego lentitud si el usuario lo menciona.
4. `mcp__chrome-devtools__take_snapshot` o `mcp__chrome-devtools__take_screenshot` para anclar UI a `U-xx`.
5. Si el usuario describe lentitud: `mcp__chrome-devtools__performance_start_trace` / `mcp__chrome-devtools__performance_stop_trace` o `mcp__chrome-devtools__performance_analyze_insight`.

**No inventar** mensajes de consola, URLs ni status HTTP — solo lo devuelto por las tools o pegado por el usuario.

## Formato tabla narrativa (U-xx)

| ID | ACTION | EXPECT | Nota audio/texto |
|----|--------|--------|-----------------|
| U-01 | … | … | homófonos corregidos |

## Formato tabla evidencia (E-xx)

| ID | Tool MCP | Hallazgo | Linked U-IDs |
|----|----------|----------|--------------|
| E-01 | list_console_messages | … | U-01 |

## Cruce

Tabla `User ID → Evidence IDs` con columna "¿coincide?".

## Salida (artefactos)

1. **Informe principal:** `docs/team/ux-feedback/LIVE-DEVTOOLS-NARRATIVE-REPORT-YYYY-MM-DD-<slug>.md`  
   Seguir plantilla: `docs/team/ux-feedback/TEMPLATE-LIVE-DEVTOOLS-NARRATIVE-REPORT.md`
2. **JSON opcional** (si hay muchos ítems o el usuario pide trazabilidad máquina-legible):  
   `docs/team/ux-feedback/LIVE-DEVTOOLS-NARRATIVE-EVIDENCE-YYYY-MM-DD-<slug>.json`  
   Array de objetos `{ "id": "E-01", "tool": "...", "summary": "...", "linkedUserIds": ["U-01"] }` + `userBeats` espejo.
3. IDs de hallazgos mixtos UX/técnico: `LDN-YYYY-MM-DD-01`, `LDN-YYYY-MM-DD-02`, …

## Después de la sesión

- Si el informe cierra trabajo sustantivo: añadir línea en `docs/team/PROJECT-STATE.md` bajo **Cambios recientes** con enlace al informe.
- **Human gates** (cm-0 / cm-1 / cm-2): si un hallazgo los implica, referenciar `docs/team/HUMAN-GATES-ONE-BY-ONE.md`; no marcar corregido sin evidencia.

## Si el MCP no está disponible

Indicar que sin `chrome-devtools` no hay evidencia en vivo. Ofrecer continuar solo con texto/transcripción del usuario usando el skill `navigation-user-feedback` o la plantilla de informe manual.

## Anti-patrones

- No afirmar que MCP vio algo si no hubo tool output en el hilo.
- No mezclar hallazgos de **prod** y **local** en la misma tabla sin etiquetar entorno.

## Referencias repo

- Plantilla: `docs/team/ux-feedback/TEMPLATE-LIVE-DEVTOOLS-NARRATIVE-REPORT.md`
- Índice: `docs/team/ux-feedback/README.md`
