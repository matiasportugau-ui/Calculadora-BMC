# 🤝 Guía de Contribución — Calculadora BMC

## Estructura del Proyecto

El proyecto consiste en **un solo archivo JSX** (`PanelinCalculadoraV3.jsx`) organizado en 8 secciones claramente delimitadas. Mantener esta estructura es fundamental.

## Reglas de Desarrollo

### Precios
- **NUNCA** hardcodear precios directamente en funciones de cálculo
- **SIEMPRE** usar `p(item)` para resolver precios
- Precios SIN IVA en todo el motor
- IVA se aplica solo en `calcTotalesSinIVA()`

### Cantidades
- **SIEMPRE** `Math.ceil()` para cantidades de materiales
- **NUNCA** `Math.round()` ni `Math.floor()`

### Formato de Precios
- `toFixed(2)` para todos los montos
- `+` prefix para evitar strings: `+(valor).toFixed(2)`

### Estilo
- Inline styles only — no Tailwind, no CSS modules
- Usar tokens de `C` (colores) y `FONT` (tipografía)
- Componentes como funciones (no arrow en nivel superior)

### Estado
- NO localStorage / sessionStorage
- NO fetch / APIs externas
- Estado 100% en React useState

## Actualización de Precios

Cuando BROMYROS actualiza la Matriz de Costos:

1. Editar sección §2 del JSX
2. Actualizar campos `venta`, `web`, `costo` del producto afectado
3. Si hay nuevos espesores, agregarlos al objeto `esp` del panel
4. Ejecutar `npm test` para verificar que no se rompe nada
5. Commit con mensaje: `prices: actualizar Matriz BROMYROS [fecha]`

## Agregar Nuevo Panel

1. Agregar entrada en `PANELS_TECHO` o `PANELS_PARED`
2. Agregar perfilería correspondiente en `PERFIL_TECHO` o `PERFIL_PARED`
3. Agregar a `SCENARIOS_DEF[].familias` del escenario correcto
4. Verificar que `resolveSKU` resuelve correctamente
5. Ejecutar tests

## Agregar Nuevo Perfil

1. Agregar datos en `PERFIL_TECHO` o `PERFIL_PARED`
2. Si es borde de techo, agregar opción en `BORDER_OPTIONS`
3. Si es perfil de pared, agregar lógica en `calcPerfilesParedExtra`
4. Verificar que `p()` resuelve el precio correctamente

## Convenciones de Commit

```
feat: nueva funcionalidad
fix: corrección de bug
prices: actualización de precios
docs: documentación
style: cambios de estilo UI (no CSS)
refactor: refactorización sin cambio de funcionalidad
test: agregar o corregir tests
```

## Testing

```bash
npm test
```

Verificar manualmente con los 6 casos de prueba documentados en los motores de techo y pared.
