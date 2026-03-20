# 📝 Changelog — Panelin Calculadora BMC

## [3.1.2] — 2026-03-19

### Git — PR #33 merge a `main` (2026-03-20)
- **Merged:** [PR #33](https://github.com/matiasportugau-ui/Calculadora-BMC/pull/33) — rama `sheets-verify-config-b29b9` → `main` (merge `5f9855d`). Incluye capabilities, presupuesto libre, docs equipo (autopilot, run31), MCP, contratos ampliados.
- **Estado:** `Run32+` items repo/gitignore y merge documentados en `PROJECT-STATE.md` / `PROMPT-FOR-EQUIPO-COMPLETO.md`.

### Agente IA — capacidades, contratos, MCP (2026-03-20)
- **`GET /capabilities`:** manifiesto único (Calculadora `/calc/*` + Dashboard `/api/*` + punteros UI); `server/agentCapabilitiesManifest.js`.
- **`server/gptActions.js`:** `GPT_ACTIONS` centralizado (usado por `/calc/gpt-entry-point` y manifiesto).
- **Contratos:** `scripts/validate-api-contracts.js` — añade `GET /capabilities`, `GET /calc/gpt-entry-point`, `POST /calc/cotizar`, `POST /calc/cotizar/presupuesto-libre`.
- **Docs:** `docs/AGENT-UI-VS-API.md`, `docs/api/AGENT-CAPABILITIES.json` (snapshot).
- **MCP (opcional):** `@modelcontextprotocol/sdk` (devDependency), `npm run mcp:panelin` → `scripts/mcp-panelin-http.mjs` (stdio, `BMC_API_BASE`).

### UI — Wizard dimensiones / vista previa techo (2026-03-20)
- **`RoofPreview.jsx`:** Etiquetas **largo × ancho** en el SVG alineadas al rectángulo dibujado (en **dos aguas**, ancho = **faldón**); nota aclaratoria bajo instrucciones de arrastre; en el desglose **Por zona**, segunda línea con medidas en planta y fila **Suma zonas** que coincide con el total.
- **`PanelinCalculadoraV3_backup.jsx`:** Botón **Siguiente** con mejor contraste en estado deshabilitado; helper **`wizardPrimaryActionStyle(enabled)`** para reutilizar en futuros wizards (techo+fachada, etc.). **Anterior** con `type="button"`.

### Presupuesto libre — backup + API (2026-03-19)
- **Módulo:** `src/utils/presupuestoLibreCatalogo.js` — catálogo acordeón (paneles m², perfiles, tornillería/herrajes, selladores, flete, extraordinarios).
- **UI canónica:** `PanelinCalculadoraV3_backup.jsx` — escenario `presupuesto_libre`, `groups` sin duplicar flete; categorías BOM (`EXTRAORDINARIOS`, `TORNILLERÍA` vía `FIJACIONES`); snapshots / Drive / `projectFile`.
- **V3 standalone:** `PanelinCalculadoraV3.jsx` — llama al mismo motor con catálogo inline.
- **API:** `POST /calc/cotizar/presupuesto-libre`; `buildGptResponse` evita segundo flete si `presupuestoLibre`; `docs/openapi-calc.yaml` + `GPT_ACTIONS`.
- **Tests:** suite 16b en `tests/validation.js` (**119 passed**).

### Equipo — Pista 2 smoke producción (2026-03-20)
- **E2E checklist:** `docs/team/E2E-VALIDATION-CHECKLIST.md` — tabla de códigos HTTP Cloud Run + Vercel (health/SPAs 200; API Sheets 503 coherente).
- **Plan:** `docs/team/plans/SOLUCIONES-UNO-POR-UNO-2026-03-20.md` — Pista 2 ✅; siguiente Pista 3 (Sheets manual).

### Equipo — Autopilot full team Runs 24–30 (2026-03-20)
- **Reporter:** `docs/team/reports/AUTOPILOT-FULL-TEAM-RUNS-24-30.md` (índice + tabla ⬜/✓ + enlaces Judge formal por sección).
- **MATPROMT:** `docs/team/matprompt/MATPROMT-RUN-AUTOPILOT-24-30.md`.
- **Parallel/Serial:** `docs/team/parallel-serial/PARALLEL-SERIAL-AUTOPILOT-24-30.md`.
- **Judge:** agregado `docs/team/judge/JUDGE-REPORT-AUTOPILOT-RUN24-30.md`; **formal por run** `JUDGE-REPORT-RUN-2026-03-20-run24.md` … `run30.md` (índice en run30); `JUDGE-REPORT-HISTORICO.md` — filas run23 + run24–30.
- **Guía:** `MATPROMT-FULL-RUN-PROMPTS.md` — bundle AUTOPILOT 24–30; `PROJECT-STATE` / `PROMPT-FOR-EQUIPO-COMPLETO` enlazados.

### Equipo — Full team run 31 (2026-03-19)
- **Invoque full team** 0→9 post-autopilot: **MATPROMT** `docs/team/matprompt/MATPROMT-RUN-2026-03-19-run31.md`; **Parallel/Serial** `docs/team/parallel-serial/PARALLEL-SERIAL-PLAN-2026-03-19-run31.md`; **Reporter** `docs/team/reports/REPORT-SOLUTION-CODING-2026-03-19-run31.md`; **Judge** `docs/team/judge/JUDGE-REPORT-RUN-2026-03-19-run31.md`; **Repo Sync** `docs/team/reports/REPO-SYNC-REPORT-2026-03-19-run31.md`.
- **Guía:** `MATPROMT-FULL-RUN-PROMPTS.md` — Bundle run31; `PROMPT-FOR-EQUIPO-COMPLETO.md` — run31 ✓ + agenda **run32+**; `JUDGE-REPORT-HISTORICO.md` fila run31; `service-map.md` fecha run31; AUTOPILOT índice — enlace Judge formal Run 26.
- **CI:** `npm test` **119 passed**; `npm run lint` 0 errores (warnings en backup / calculatorConfig).

### Equipo — Run 23 fusión (2026-03-20)
- **Judge:** `docs/team/judge/JUDGE-REPORT-RUN-2026-03-20-run23.md` (run22 documental + Presupuesto libre V3).
- **MATPROMT:** `docs/team/matprompt/MATPROMT-RUN-2026-03-20-run23.md`; guía `MATPROMT-FULL-RUN-PROMPTS.md` — sección Bundle run23.
- **Parallel/Serial:** `docs/team/parallel-serial/PARALLEL-SERIAL-PLAN-2026-03-20-run23.md`.
- **HISTORICO Judge:** promedio global run23 ~4.7/5; `PROMPT-FOR-EQUIPO-COMPLETO` y `PROJECT-STATE` enlazados.

### Equipo / deps (2026-03-20 — Run 23 next steps)
- **Plan:** `docs/team/plans/NEXT-STEPS-RUN-23-2026-03-20.md` — lint, tests, `npm audit fix` (sin `--force`), pendientes humanos.
- **`npm audit fix`:** 4 packages actualizados; quedan **7** vulnerabilidades; `--force` pendiente aprobación (breaking).
- **E2E:** `docs/team/E2E-VALIDATION-CHECKLIST.md` — tabla URLs producción (Cloud Run / Vercel).
- **PROJECT-STATE** / **PROMPT** actualizados.

### Sync motor / UI — Fijaciones unitarias (2026-03-20)
- **Motor:** `calcFijacionesCaballete` / `calcPerfileriaTecho` / `calcFijacionesPared` usan cantidades reales y `p()` **sin** paquetes ×100/×1000 (alineado a `constants.js`).
- **Nuevo:** `calcPresupuestoLibre(lineas)` en `calculations.js` (`FIJACIONES` / `HERRAMIENTAS`).
- **BOM:** `bomToGroups` agrupa resultado presupuesto libre en **PRESUPUESTO LIBRE**.
- **UI datos:** `PanelinCalculadoraV3.jsx` importa `FIJACIONES` y `HERRAMIENTAS` desde `constants.js`; fórmulas locales igual que el motor.
- **MATRIZ:** `matrizPreciosMapping.js` — filas catálogo (SKUs placeholder; confirmar con planilla).
- **Tests:** `validation.js` — casos T1/aguja unitarios + integración `calcPresupuestoLibre` / `bomToGroups`.

### Calculadora — Fachada (BOM)
- **T2:** Cotización por **unidad**; precio lista = **unitario** en `constants` (sin `unidades_por_paquete` en costeo).
- **Cinta butilo:** Inclusión **opcional** (`inclCintaButilo`, default `false`); toggles en UI cuando hay pared y selladores activos.
- **Silicona 300 ml neutra:** Nuevo producto `SELLADORES.silicona_300_neutra` (precios placeholder); opcional `inclSilicona300Neutra`; MATRIZ SKU `SIL300N`.
- **API:** `calcSelladorPared(perimetro, cantPaneles, alto, opts?)`; `calcParedCompleto` acepta flags opcionales.
- **Tests:** `tests/validation.js` ampliados (113 assertions con suite vista previa).

### Calculadora — Vista previa del techo
- **Nuevo** `src/components/RoofPreview.jsx`: rejilla según ancho útil del panel (`au`), arrastre de zonas en planta (`techo.zonas[].preview.x/y`), doble clic / doble toque para ciclar indicador visual de pendiente (`slopeMark`); botón «Alinear zonas». No modifica el BOM. Persistencia vía `.bmc.json` existente.
- **Tests:** suite 19 en `validation.js` (deserialize `preview`).

### Equipo / docs
- Full team **run 22 (2026-03-20):** propagate & synchronize — `MATPROMT-RUN-PROPAGATE-SYNC-2026-03-20.md`, `PARALLEL-SERIAL-PLAN-2026-03-20-run22.md`, REPORT / REPO-SYNC / Judge run22; `PROJECT-STATE`, `PROMPT-FOR-EQUIPO-COMPLETO`, `JUDGE-REPORT-HISTORICO`, `service-map.md` (fecha); `IMPROVEMENT-BACKLOG-BY-AGENT` fila **MATPROMT**; `docs/team/knowledge/MATPROMT.md` + README; agenda siguiente run + checklist push repos hermanos.
- Full team **run 21:** MATPROMT bundle, PARALLEL-SERIAL plan, REPORT, Judge; `PROJECT-STATE` / `PROMPT-FOR-EQUIPO-COMPLETO` actualizados.

### Precios (planilla usuario — Mar 2022 María G. Fleurquin)
- Valores de columnas **con IVA** convertidos a **sin IVA** (÷ 1,22): silicona neutra premium, membrana, PU gris, T1 y punta aguja (T1/aguja: fila como **unidad** ×100 para paquete `x100`).

## [3.1.1] — 2026-03-17

### 📦 Dependencias
- FIX: `npm audit fix` — vulnerabilidad crítica jspdf corregida (HTML Injection, PDF Object Injection)
- Pendiente: 7 vulns restantes (5 low @tootallnate/once, 2 moderate esbuild/vite) requieren `npm audit fix --force` (breaking)

### 📄 Documentación e infra
- Full team run 13: PARALLEL-SERIAL-PLAN, Judge report, PROJECT-STATE actualizado
- service-map.md fecha 2026-03-17
- Contract 4/4 PASS (kpi-financiero, proximas-entregas, audit, kpi-report)

---

## [3.1.0] — 2026-03-10

### 🟢 Nuevas Funcionalidades

#### A) Motor de Pendiente de Techo
- NUEVO: `calcFactorPendiente()` — factor por grados (cos⁻¹)
- NUEVO: `calcLargoReal()` — largo proyectado × factor
- NUEVO: Presets de pendiente: 3°, 10°, 15°, 25°
- `calcTechoCompleto()` acepta parámetro `pendiente` (default 0)
- Largo real ajustado en paneles, fijaciones y perfilería

#### B) Zonas Múltiples de Techo
- NUEVO: Soporte para múltiples zonas (`zonas[]`) en vez de largo/ancho único
- Cada zona calcula independiente, resultados combinados
- Botón "Agregar zona" / "Eliminar zona" en UI

#### C) Tipo de Aguas
- NUEVO: Selector 1 Agua / 2 Aguas / 4 Aguas (en proceso)
- 2 Aguas: divide ancho en 2 faldones, cumbrera automática
- Ilustraciones SVG para cada tipo

#### D) Cálculo de Descarte
- NUEVO: `calcPanelesTecho()` devuelve `descarte.anchoM`, `descarte.areaM2`, `descarte.porcentaje`
- Alerta visual de descarte en panel derecho y PDF

#### E) Categorías BOM Configurables
- NUEVO: Toggles por categoría: Paneles, Fijaciones, Perfilería, Selladores, Servicios
- NUEVO: Exclusión individual de items con botón ✕ y panel de restauración

#### F) Informe Interno
- NUEVO: `generateInternalHTML()` — PDF interno con inputs, fórmulas, items excluidos
- Botón "Interno" en acciones

#### G) Canalón como Opción de Borde
- Canalón movido de toggle a opción de borde "Frente Inf"
- Soporte canalón se calcula automáticamente al seleccionar

#### H) Selector Visual de Bordes
- NUEVO: `RoofBorderSelector` — SVG interactivo reemplaza lista de botones
- Click en borde abre popover con opciones
- Bordes filtrados por familia de panel

### ♻️ Refactorizaciones
- Navegación por pasos (`STEP_SECTIONS`) eliminada — todas las secciones en panel scrollable
- Labels de bordes: "Frente" → "Frente Inf", "Fondo" → "Frente Sup"
- `normalizarMedida()` para conversión paneles↔metros
- `mergeZonaResults()` centraliza combinación de resultados por zona

### 🎨 UI
- Layout responsive con `MobileBottomBar` sticky para móvil
- Auto-scroll a secciones via refs
- PDF incluye sección de dimensiones, descarte y lista de precios
- Filtro de opciones de borde por familia de panel (ej: gotero greca solo ISOROOF)

### 🔧 Correcciones
- FIX: Acceso null-safe a autoportancia con operador `??`

---

## [3.0.0] — 2026-03-04

### 🔴 Cambios Críticos

#### A) Motor de Precios Migrado a SIN IVA
- Todos los precios ahora son SIN IVA en el motor de cálculo
- IVA 22% se aplica UNA SOLA VEZ al total final via `calcTotalesSinIVA()`
- Nueva fuente de verdad: `PANELIN_PRECIOS_V3_UNIFICADO`
- Doble lista de precios: `venta` (BMC directo) y `web` (Shopify)
- Función `p(item)` resuelve precio según `LISTA_ACTIVA` global

#### B) Fijaciones de Pared REESCRITAS
- ELIMINADO: varilla, tuerca, arandela carrocero, tortuga PVC (solo techo)
- NUEVO: Kit anclaje H° (cada 0.30m en perímetro inferior)
- NUEVO: Tornillo T2 fachada (5.5/m² para metal/mixto)
- NUEVO: Remaches POP (2 por panel)

#### C) Perfilería de Pared NUEVOS PERFILES
- NUEVO: Perfil K2 — junta interior entre paneles
- NUEVO: Perfil G2 — tapajunta exterior
- NUEVO: Perfil 5852 aluminio — opcional, toggle en UI

#### D) Selladores Pared AMPLIADOS
- NUEVO: Membrana autoadhesiva (rollos de 10m)
- NUEVO: Espuma PU (2 por rollo de membrana)

#### E) Soporte Canalón CORREGIDO
- ANTES: `ceil(anchoTotal / 1.5)` — incorrecto
- AHORA: `(cantP + 1) × 0.30 / largo_barra` — correcto

#### F) Selector de Lista de Precios
- NUEVO: SegmentedControl [Precio BMC | Precio Web] al inicio del formulario
- Recalcula todos los precios automáticamente al cambiar

### Nuevos Espesores
- ISOROOF 3G: +40mm, +100mm
- ISOROOF PLUS: +50mm
- ISOWALL PIR: +100mm

### UI
- 13 componentes React inline-styled
- Layout responsive left/right
- Header sticky con branding BMC
- KPI cards animados
- Tabla BOM colapsable por grupo
- Panel de transparencia con valores y reglas
- Botón WhatsApp copy + PDF print

---

## [2.x] — 2025–2026 (versiones anteriores)

### Motor de Techo
- Sistema varilla+tuerca para ISODEC
- Sistema caballete+tornillo para ISOROOF
- Perfilería de bordes con resolveSKU
- Autoportancia por espesor

### Motor de Pared
- Paneles con descuento de aberturas
- Perfiles U base y coronación
- Esquineros exteriores e interiores
- ⚠️ Fijaciones usaban varilla/tuerca (incorrecto para pared)

### PDF
- Generador HTML para impresión A4
- Datos bancarios METALOG SAS

---

## [1.x] — 2025 (Panelin original)

- Calculadora en LibreOffice Calc
- 31 presupuestos reales validados
- Precios hardcodeados CON IVA
- Sin doble lista de precios
