# Parallel / serial — Presupuesto libre (UI calculadora)

**Fecha:** 2026-03-19  
**Objetivo:** Menús desplegables estilo «Datos del proyecto» por categoría (Paneles, Perfilería, Tornillería, Selladores, Servicios, Extraordinarios) bajo escenario **Presupuesto libre**.

## En serie (dependen entre sí)

1. **Solution / Calc** — Definir shape de datos (líneas por categoría, extraordinarios opcionales) y cómo arma BOM + totales.
2. **Coding** — Implementar en `PanelinCalculadoraV3.jsx` (escenario, estado, `calcPresupuestoLibre`, UI acordeones).
3. **Design** — Alinear barra acordeón (mayúsculas, gris, bordes) con cards existentes.

## En paralelo (sin bloqueo cruzado)

- **Reporter** — Nota en `PROJECT-STATE` + changelog breve.
- **Tests** — `npm run lint` + `npm test` tras tocar `src/`.

## Combinación recomendada

Un solo agente Coding ejecuta 1→2 con criterio Design embebido; Reporter/Tests al cierre.
