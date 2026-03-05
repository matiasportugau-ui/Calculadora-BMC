# 📝 Changelog — Panelin Calculadora BMC

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
