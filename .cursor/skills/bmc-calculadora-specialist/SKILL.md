---
name: bmc-calculadora-specialist
description: >
  Specialist for the Panelin Calculadora (port 5173): BOM, pricing, panels,
  Drive integration, PDF, WhatsApp export. Knows constants, calculations,
  helpers. Use when working on the quote builder, pricing logic, or
  Calculadora-Cotizaciones flow.
---

# BMC Calculadora Specialist

**Before working:** Read `docs/team/knowledge/Calc.md` if it exists.

Especialista en la **Calculadora Panelin** (puerto 5173): cotizador de paneles, BOM, precios, Drive, PDF, export WhatsApp. Conoce la lógica de cálculo y el flujo Cotizaciones.

---

## When to Use

- Cambios en precios, paneles (techo, pared), listas (web, venta)
- Cambios en BOM, PDF, export WhatsApp
- Integración Calculadora ↔ Drive (guardar/cargar presupuestos)
- Flujo Cotizaciones → Master_Cotizaciones / CRM_Operativo
- Tests de validación (calculations, helpers)
- Budget Log, PDFPreviewModal

---

## Scope

### Componentes

- **PanelinCalculadoraV3_backup** — Componente canónico (App.jsx)
- **PanelinCalculadoraV3** — Build alternativo single-file
- **GoogleDrivePanel** — Guardar/cargar en Drive
- **Budget Log Panel** — Historial de presupuestos
- **PDFPreviewModal** — Vista previa PDF

### Archivos clave

| Archivo | Rol |
|---------|-----|
| `src/components/PanelinCalculadoraV3_backup.jsx` | Componente principal |
| `src/utils/calculations.js` | calcTechoCompleto, calcParedCompleto, etc. |
| `src/utils/helpers.js` | bomToGroups, applyOverrides, createLineId |
| `src/utils/googleDrive.js` | Save/Load Drive |
| `tests/validation.js` | Tests de pricing y cálculos |

### Constantes y precios

- PANELS_TECHO, PANELS_PARED (o equivalente en constants)
- Listas: web, venta
- IVA, factor pendiente, largo real

---

## Workflow

1. **Read** IA.md, DASHBOARD-VISUAL-MAP (Calculadora en 5173).
2. **Understand** flow: usuario ingresa zonas → cálculos → BOM → PDF/WhatsApp.
3. **Coordinate** con Mapa si hay cambios que afectan Master_Cotizaciones o CRM.
4. **Coordinate** con Vista si hay cambios de UI en la Calculadora.
5. **Run** `node tests/validation.js` después de cambios en calculations/helpers.

---

## Handoff

- **To Mapa:** Si nueva columna o tab en Sheets para cotizaciones.
- **To Vista:** Si cambio de UI en Calculadora (layout, estados).
- **To Integra:** Si flujo de envío a Shopify/ML desde cotización.

---

## Reference

- IA.md: Calculadora = Cotizaciones section
- tests/validation.js: Pricing engine, panel calculations, BOM
- docs/openapi-calc.yaml: Cloud Run calc API (si aplica)
