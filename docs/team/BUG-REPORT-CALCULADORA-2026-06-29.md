# Bug Report — Calculadora BMC

- **Fecha:** 2026-06-29
- **Branch:** `claude/debug-report-impact-yrxcdh`
- **Versión auditada:** `calculadora-bmc@3.1.5`
- **Alcance:** núcleo de la app calculadora — motor de cálculo + precios, frontend +
  exportación PDF, y backend API / auth / integraciones.
- **Tipo de entrega:** **reporte únicamente — no se aplicó ningún cambio de código.**
- **Metodología:** auditoría de solo lectura con 3 agentes en paralelo (calc/precios,
  frontend/PDF, backend/API), seguida de **verificación manual de los hallazgos de mayor
  severidad** contra el código fuente. Tres hallazgos resultaron **falsos positivos** y se
  documentan al final para que el reporte sea confiable y no propague bugs inexistentes.

> Este documento es un retrospectivo/diagnóstico. Cada hallazgo incluye ubicación exacta
> (`archivo:línea`), qué está mal y por qué importa. **No se corrigió nada** — las
> recomendaciones son sugerencias, no acciones realizadas.

---

## Resumen ejecutivo

| Severidad | Cantidad |
|-----------|----------|
| Critical  | 1 |
| High      | 4 |
| Medium    | 6 |
| Low       | 5 |
| **Total** | **16** |

**Atención inmediata recomendada:**

- **B1 (Critical)** — IDs de Google Sheet / Todoist hardcodeados como fallback en
  `server/config.js`. Riesgo de secreto en código.
- **C1 (High, datos)** — precio web de `silicona_300_neutra` (4.2) por **debajo** del de
  venta (7.11): anomalía única en todo el catálogo de selladores. Verificar contra MATRIZ.
- **B2 (High)** — rutas respaldadas por Sheets devuelven **500** en vez de **503** ante
  fallo del backend, violando la convención documentada del proyecto.
- **B3 (High)** — secreto JWT de fallback hardcodeado en el login de desarrollo.

---

## Hallazgos por área

### Backend / API e integraciones

#### B1 — IDs de Sheet y Todoist hardcodeados en config · **Critical**
- **Ubicación:** `server/config.js:85` (Sheet ID de WolfBoard Admin), `server/config.js:230`
  (project ID de Todoist).
- **Qué está mal:** valores de infraestructura embebidos como fallback string literal
  (p. ej. `process.env.WOLFB_ADMIN_SHEET_ID || "1Ie0KC…"`).
- **Por qué importa:** viola la regla del proyecto — IDs/tokens/URLs sensibles deben venir
  de `config.*`/`process.env.*`, nunca de defaults en código. Si el repo se filtra, se
  expone acceso directo al workbook administrativo.

#### B2 — Rutas de Sheets devuelven 500 en lugar de 503 · **High**
- **Ubicación:** `server/routes/bmcDashboard.js` (múltiples `catch`, p. ej. ~1755, 2311,
  3075+ con `res.status(500)`).
- **Qué está mal:** la convención del proyecto (y `quotes.js`, que la implementa bien con su
  chequeo `isDbUnavailable`) exige `503` cuando el backend de Sheets no está disponible, y
  `200` + payload vacío cuando no hay datos — **nunca 500**.
- **Por qué importa:** el frontend depende de esta semántica. Un `500` hace que el cliente
  diagnostique un bug de la API en vez de una indisponibilidad temporal del backend.

#### B3 — Secreto JWT de fallback hardcodeado en dev-login · **High**
- **Ubicación:** `server/routes/authGoogle.js:250`
  (`process.env.IDENTITY_JWT_SECRET || "dev-secret-change-me-in-production"`).
- **Qué está mal:** si la env var no está seteada, se firman JWT con un string conocido.
- **Por qué importa:** seguridad de auth. La ruta está protegida por `!isProd()`, pero el
  fallback estático permite forjar tokens si el secreto no se configura. Debería no existir
  o ser un nonce aleatorio por runtime.

#### B4 — dev-login emite JWT sin fila de usuario en DB · **Medium**
- **Ubicación:** `server/routes/authGoogle.js:237-271`.
- **Qué está mal:** mintea un token con `sub: "dev-user-" + Date.now()` sin persistir el
  usuario. Llamadas posteriores a `/auth/me` pueden fallar o devolver datos parciales.
- **Por qué importa:** estado de sesión incompleto; patrón riesgoso de defensa en profundidad.

#### B5 — `console.log` en rutas de producción · **Medium**
- **Ubicación:** `server/routes/agentChat.js:1028,1045`; `server/routes/bmcDashboard.js:55,2791`.
- **Qué está mal:** logs sin estructura en paths de fallback; la regla exige `pino`.
- **Por qué importa:** rompe la correlación en Cloud Logging y escapa del sistema de logging.

#### B6 — Escrituras SSE `setImmediate` sin backpressure · **Medium**
- **Ubicación:** `server/routes/agentChat.js:666-673` (write fire-and-forget) y `1115-1138`
  (extracción autolearn).
- **Qué está mal:** callbacks disparados sin esperar ni controlar la cola; el bloque
  `1115-1138` sí tiene `.catch()` pero no hay mecanismo de backpressure si la cola se llena.
- **Por qué importa:** rechazos no manejados pueden tragarse errores o, según la config,
  desestabilizar el proceso.

#### B7 — Limpieza de heartbeat SSE solo en `req.close` · **Low**
- **Ubicación:** `server/routes/panelin.js:36-78`.
- **Qué está mal:** el `clearInterval`/`unsub` ocurre solo en `req.on("close")`; no hay
  handler de error sobre el stream de respuesta.
- **Por qué importa:** un fallo en un callback de suscripción podría dejar el `setInterval`
  del heartbeat activo (fuga de recursos).

---

### Motor de cálculo y precios

#### C1 — Precio web de `silicona_300_neutra` por debajo del de venta · **High (datos)**
- **Ubicación:** `src/data/constants.js:270` (`venta: 7.11, web: 4.2`).
- **Qué está mal:** en todo el bloque `SELLADORES` el precio `web` es **mayor** que `venta`
  (p. ej. `silicona` 9.64/11.24, `cinta_butilo` 15.77/19.19). Este ítem es el único con
  `web` muy por debajo de `venta` (−69 %).
- **Por qué importa:** con `LISTA_ACTIVA = "web"`, `p(item)` devuelve 4.2 — probable error
  de carga de datos. **Verificar contra la planilla MATRIZ** antes de cualquier cotización.

#### C2 — Sin guarda explícita para `ancho<=0` / `largo<=0` · **Medium**
- **Ubicación:** `src/utils/calculations.js:71-73`, entrada de `calcPanelesTecho()`.
- **Qué está mal:** el cálculo de `descartePct` evita la división por cero solo por el
  ternario `ancho > 0 ? … : 0`; no hay validación que rechace dimensiones `<= 0` en la
  entrada. Un `ancho`/`largo` en 0 produce resultados silenciosamente vacíos sin aviso.
- **Por qué importa:** entradas inválidas se procesan sin error visible, generando un BOM
  potencialmente engañoso.

#### C3 — `%` de descarte multi-zona recalculado sobre valores ya redondeados · **Medium**
- **Ubicación:** `src/utils/calculations.js:1007-1019` (`mergeZonaResults`).
- **Qué está mal:** se redondea `areaM2`/`anchoM` por zona y luego se recalcula el porcentaje
  a partir de esos valores ya redondeados.
- **Por qué importa:** deriva de redondeo acumulada en proyectos con muchas zonas (impacto
  menor, pero es drift de calidad de datos).

#### C4 — Función `pIVA()` huérfana (código muerto) · **Low**
- **Ubicación:** `src/data/constants.js:37`.
- **Qué está mal:** `pIVA()` se exporta pero nunca se llama (0 referencias). El IVA se aplica
  correctamente **una sola vez** al total vía `calcTotalesSinIVA()`.
- **Por qué importa:** trampa para mantenedores futuros (riesgo de doble IVA si alguien la usa).

#### C5 — `fmtPrice()` enmascara NaN/Infinity como "0.00" · **Low**
- **Ubicación:** `src/utils/helpers.js:119-123`.
- **Qué está mal:** ante valores no finitos devuelve `"0.00"` silenciosamente.
- **Por qué importa:** oculta fallos de cálculo upstream — un total corrupto se muestra como
  `$0.00` en lugar de señalar el error.

#### C6 — Precisión de redondeo de descarte inconsistente · **Low**
- **Ubicación:** `src/utils/calculations.js:71-72` (2 vs 1 decimales) frente a `:1017` (siempre 1).
- **Qué está mal:** distintas reglas de precisión según el path de código.
- **Por qué importa:** inconsistencia cosmética en la UX; no es un bug funcional.

---

### Frontend y exportación PDF

#### F1 — `renderPdfLayout()` sin try/catch ni validación de `mod.render` · **Low**
- **Ubicación:** `src/pdf-templates/index.js:180-184`.
- **Qué está mal:** el import dinámico y `mod.render(q)` no están protegidos; si un módulo de
  template falla al cargar o no exporta `render`, la promesa rechaza.
- **Por qué importa:** robustez. El llamador sí captura el rechazo (ver F-nota abajo), pero el
  mensaje resultante es genérico y poco accionable.

#### F2 — Acceso a `localStorage` sin try/catch · **Medium**
- **Ubicación:** `src/components/PanelinCalculadoraV3_backup.jsx:2414,7049,7223,7274`
  (clave `bmc.pdfLayout`).
- **Qué está mal:** `getItem`/`setItem` sin guarda. En modo privado o con cuota llena,
  `setItem` lanza `QuotaExceededError`/`SecurityError`.
- **Por qué importa:** la app puede romperse al guardar la preferencia de layout PDF en una
  ventana privada.

#### F3 — Inputs numéricos pueden sembrar `NaN` en el estado · **Medium**
- **Ubicación:** `src/components/PanelinCalculadoraV3_backup.jsx:6856-6859` (aberturas de pared).
- **Qué está mal:** `parseFloat(e.target.value) || 0` mitiga `NaN` a 0, pero no valida rango
  ni distingue input inválido; texto no numérico cae a 0 sin aviso y otros paths similares
  pueden propagar `NaN`.
- **Por qué importa:** entradas inválidas degradan silenciosamente el cálculo/BOM.

#### F4 — Bloques `catch {}` silenciosos sin logging · **Low**
- **Ubicación:** `src/components/PanelinCalculadoraV3_backup.jsx:164,653,1724,2596,2619`.
- **Qué está mal:** capturas intencionales pero sin `console.debug`/log; un error inesperado
  queda totalmente invisible.
- **Por qué importa:** dificulta el diagnóstico en producción.

#### F5 — Campo `techo.tipoAguas` deprecado aún presente en estado · **Low**
- **Ubicación:** `src/utils/quotationViews.js:106-112`.
- **Qué está mal:** el campo está `@deprecated` (se deriva de flags por zona) pero sigue en el
  estado guardado.
- **Por qué importa:** deuda técnica / migración incompleta; riesgo de confusión en refactors.

---

## Falsos positivos verificados (revisados, NO son bugs)

Para transparencia, estos hallazgos surgieron en la auditoría automática y fueron
**descartados tras verificación manual contra el código**:

1. **"Falta `await` en `PanelinCalculadoraV3_backup.jsx:3759`"** — `return renderPdfLayout(…)`
   dentro de una función `async` es correcto: el llamador hace `await buildClientePdfHtml()`
   (línea 3774) y la resolución de promesas aplana el thenable, por lo que `html` es el string
   ya resuelto, **no una Promise**. **No es un bug.**
2. **"Tragado silencioso de errores de PDF (`:3787`)"** — dependía del punto anterior; el
   `catch` es un manejador genérico normal que además registra vía `addErrorToBugLog`.
   **Descartado.**
3. **`anclaje_h` con precios "invertidos" (`constants.js:205`, `web 8.00 > venta 5.96`)** — en
   este catálogo `web > venta` es la norma para tornillos y selladores, por lo que es
   **consistente, no un error.**

---

## Verificado como correcto (controles que pasaron)

- Escape de HTML de input de usuario en `generateClientVisualHTML()` / `generateCosteoHTML()`
  vía la función `esc()`.
- IVA aplicado **una sola vez** (22 % al subtotal) en `calcTotalesSinIVA()`.
- CORS correctamente restringido en producción.
- `JSON.parse` envuelto en try/catch en módulos util (`budgetLog.js`, `pricingOverrides.js`).
- Ruta catch-all (`<Route path="*" … Navigate to="/" />`) presente en `src/App.jsx`.
- Sin `dangerouslySetInnerHTML` en el componente calculadora (solo 1 uso en `BmcPlanosModule`
  para salida SVG controlada).

---

## Recomendaciones priorizadas (solo sugerencias — sin acciones aplicadas)

**Inmediato (antes de la próxima cotización):**
- **C1** — verificar `silicona_300_neutra` contra MATRIZ; corregir el web si está invertido o
  documentar por qué no lo está.
- **B1** — quitar los IDs hardcodeados de `server/config.js`; exigir las env vars.

**Alta prioridad:**
- **B2** — alinear los `catch` de `bmcDashboard.js` a la semántica `503`/`200`-vacío.
- **B3** — eliminar el secreto JWT de fallback estático.

**Media:**
- **C2** — validar `ancho`/`largo` `> 0` en la entrada de `calcPanelesTecho()`.
- **C3** — recalcular el `%` de descarte multi-zona desde subtotales sin redondear.
- **B4/B5/B6**, **F2/F3** — fila de DB en dev-login, migrar a `pino`, backpressure SSE, guardas
  de `localStorage` y validación de inputs numéricos.

**Baja (deuda técnica):**
- **C4** (quitar `pIVA()`), **C5** (loguear no-finitos en `fmtPrice`), **C6** (unificar
  redondeo), **F1/F4/F5**.
