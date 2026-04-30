# Constantes y fórmulas — Calculadora Panelin

**Propósito:** Lista de constantes (precios, márgenes) y fórmulas clave. Evita errores al proponer cambios.

**Ubicación:** src/utils/calculations.js, componentes.

---

## Fórmulas principales

| Función | Archivo | Descripción |
|---------|---------|-------------|
| calcTechoCompleto | calculations.js L194 | Cálculo techo completo (paneles, bordes, opciones) |
| calcParedCompleto | calculations.js L460 | Cálculo pared completa |
| calcTotalesSinIVA | calculations.js | Totales sin IVA |
| bomToGroups | helpers.js | Agrupa BOM |
| applyOverrides | helpers.js | Aplica overrides de precio |

---

## Constantes (referencia)

| Constante | Uso |
|-----------|-----|
| Precios por familia/espesor | En calculations o catálogo |
| Márgenes | En lógica de pricing |
| IVA | 22% Uruguay |

---

## Componentes clave

| Componente | Rol |
|------------|-----|
| PanelinCalculadoraV3.jsx | Componente canónico |
| GoogleDrivePanel | Guardar/cargar en Drive |
| Budget Log Panel | Historial presupuestos |
| PDFPreviewModal | Vista previa PDF |

---

## Referencias

- src/utils/calculations.js
- src/utils/helpers.js
- bmc-calculadora-specialist skill
