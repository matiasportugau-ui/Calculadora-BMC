# Transcripción + DevTools → Plan de acción (repetible)

Convierte una transcripción de navegación (voz/texto pegado) en beats ordenados, cruza con evidencia MCP chrome-devtools, y produce un plan de implementación con criterios de aceptación.

**Entradas del usuario:** `$ARGUMENTS`  
(transcripción cruda, URL base opcional, imágenes/assets opcionales)

## Cuándo usar este skill

- El usuario **pegó o dictó** comentarios mientras usaba la app (local o prod).
- Se quiere **orden cronológico**, cruce con **consola/red/snapshot MCP**, y un **plan de implementación** con criterios de aceptación.

## Entradas que el usuario puede dar

1. **Transcripción cruda** (ES/EN mezclado está bien).
2. **URL base:** default prod `https://calculadora-bmc.vercel.app` o local `http://localhost:5173/`.
3. **Imágenes / assets** opcionales → guardar en `public/images/` y referenciar por ruta estable.

## Protocolo del agente

### Paso 1 — Normalizar transcripción
- Convertir a **beats ordenados** con IDs `U-01`, `U-02`, …
- Corregir homófonos según contexto del proyecto:
  - "paralim" → pretil o Panelin
  - "sabas" → aguas
  - Otros: ajustar según vocabulario BMC/construcción

### Paso 2 — Ejecutar MCP chrome-devtools en la URL acordada
1. `mcp__chrome-devtools__navigate_page` → esperar carga estable con `mcp__chrome-devtools__wait_for`.
2. `mcp__chrome-devtools__list_console_messages` — prioridad: error → warning → issue.
3. `mcp__chrome-devtools__list_network_requests` — prioridad: 4xx/5xx → lentitud.
4. `mcp__chrome-devtools__take_snapshot` en pasos clave si el usuario no detalló IDs de DOM.

### Paso 3 — Mapear beats a archivos del repo
Buscar strings con `Grep` en:
- `src/components/QuoteVisualVisor.jsx`
- `src/data/quoteVisorMedia.js`
- `src/data/roofPanelCatalogMapUrls.js`
- `src/components/PanelinCalculadoraV3_backup.jsx`

No adivinar precios ni IDs de Sheets sin evidencia.

### Paso 4 — Implementar
Solo lo acordado por transcripción + plan; assets en `public/images/`; URLs Shopify solo si el usuario pidió CDN explícitamente.

### Paso 5 — Cerrar con checklist de verificación
- `npm run lint` / `npm test` si aplica.
- Próxima corrida MCP (mismo flujo usuario) programada si hay pendientes.

## Salida obligatoria

1. **Tabla narrativa** `U-01…` con columnas: orden | ACTION (hecho) | EXPECT (intención) | notas audio
2. **Tabla evidencia** `E-01…`: tool MCP + hallazgo **sin inventar**
3. **Cruce** `User ID → Evidence IDs` + columna "¿coincide?"
4. **Plan de acción** por fases:
   - Investigación
   - Cambio de datos (`quoteVisorMedia`, `roofPanelCatalogMapUrls`, UI `QuoteVisualVisor`, tarjetas familia en `PanelinCalculadoraV3_backup`)
   - Verificación (MCP otra pasada + lint/test)
5. **Informe:** `docs/team/ux-feedback/LIVE-DEVTOOLS-NARRATIVE-REPORT-YYYY-MM-DD-<slug>.md`  
   Plantilla: `docs/team/ux-feedback/TEMPLATE-LIVE-DEVTOOLS-NARRATIVE-REPORT.md`
6. Si hubo trabajo sustantivo: línea en `docs/team/PROJECT-STATE.md` → **Cambios recientes**

## Anti-patrones

- No afirmar que MCP vio algo si no hubo tool output en el hilo.
- No mezclar hallazgos de **prod** y **local** sin etiquetar entorno.
- No reemplazar imágenes de catálogo sin dejar **fallback** documentado si Shopify sync las sobrescribe.

## Referencias repo

- Skill narrativa MCP: `.claude/commands/live-devtools-narrative-mcp.md`
- Plantilla informe: `docs/team/ux-feedback/TEMPLATE-LIVE-DEVTOOLS-NARRATIVE-REPORT.md`
- Ejemplo informe: `docs/team/ux-feedback/LIVE-DEVTOOLS-NARRATIVE-REPORT-2026-04-05-transcript-cotas-desde-paso7-dimensiones.md`
