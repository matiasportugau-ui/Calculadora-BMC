# Parallel / Serial — RUN 2026-03-19 / run21

**Objetivo del run:** Full team + **implementación** calculadora fachada: T2 por unidad, cinta butilo opcional (default off), silicona 300 ml neutra opcional; MATPROMT bundle 0a; tests `validation.js`.

**Estrategia:** **Serie** en pasos 1–8 (cambio de dominio calculadora toca Calc + Contract mentalmente; Mapping/MATRIZ solo si se confirma SKU en planilla). Implementación **antes** de Reporter/Judge para que el reporte cite código verde.

| Fase | Roles | Modo |
|------|--------|------|
| 0–0a | Orchestrator + MATPROMT | Serie |
| 0b | Parallel/Serial | Serie (este doc) |
| Implementación | Calc (+ tests) | Serie |
| 3–8 | Resto §2 | Serie corta / N/A donde no hay drift |

**Handoff Calc → Judge:** `npm test` 111 passed; toggles UI en `PanelinCalculadoraV3.jsx` bajo “Selladores” para fachada.
