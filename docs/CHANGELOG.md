# 📝 Changelog — Panelin Calculadora BMC

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
