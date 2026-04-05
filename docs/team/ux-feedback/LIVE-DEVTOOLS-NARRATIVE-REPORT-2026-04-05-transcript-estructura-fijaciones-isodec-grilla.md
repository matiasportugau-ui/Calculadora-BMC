# LIVE-DEVTOOLS-NARRATIVE-REPORT — Estructura paso 9: fijaciones Isodec (grilla vs presupuesto)

Skill: `.cursor/skills/live-devtools-transcript-action-plan/SKILL.md`. **MCP chrome-devtools no se ejecutó** en esta corrida (implementación directa desde requisito + imagen).

---

## 1. Metadatos

| Campo | Valor |
|--------|--------|
| Fecha (ISO) | 2026-04-05 |
| Base URL | `https://calculadora-bmc.vercel.app` / local `http://localhost:5173/` |
| Entorno | implementación en repo (verificación `npm run lint` + `npm test`) |
| Imagen de referencia | `.cursor/projects/.../assets/image-f05ce986-05cf-494e-a026-48c6721aa1b4.png` |

## 2. Objetivo de la sesión

- **Goal:** Alinear **cantidad** de fijaciones del presupuesto con la **visualización** en paso **Estructura (9/13)** para paneles Isodec: **2** fijaciones por panel en **apoyos perimetrales** (aprox. **30 cm** del borde del panel, repartidas), **1** fijación **centrada** por panel en **apoyos intermedios**.
- **Criterios de éxito:** Misma regla en motor (`calcFijacionesVarilla`) y en SVG (`RoofPreview`); tooltip honesto si el total BOM incluye término extra por largo.

## 3. Línea de tiempo — narrativa del usuario (`U-xx`)

| ID | Orden | ACTION (hecho) | EXPECT (esperado) |
|----|-------|----------------|-------------------|
| U-01 | 1 | Revisión paso 9 Estructura | Cantidad y dibujo de fijaciones coherentes |
| U-02 | 2 | Criterio Isodec explicado | Perímetro: 2/panel/apoyo; intermedio: 1/panel centrado |
| U-03 | 3 | Ubicación | Perimetrales ~30 cm del borde, sin cruzar línea exterior; intermedios al centro |

## 4. Evidencia — DevTools / MCP (`E-xx`)

| ID | Fuente | Hallazgo |
|----|--------|----------|
| E-01 | (no MCP) | Sin `list_console_messages` / `take_snapshot` en este hilo |

## 5. Cruce narrativa ↔ evidencia

| User ID | Evidence IDs | ¿Coincide? | Notas |
|---------|--------------|------------|--------|
| U-01–U-03 | — | parcial | Implementado en código; falta corrida MCP opcional en prod/local |

## 6. Implementación realizada

| Área | Cambio |
|------|--------|
| `src/utils/calculations.js` | `countPuntosFijacionVarillaGrilla(cantP, apoyos)`; `calcFijacionesVarilla` usa `ceil(grilla + largo×2/espPerim)`; retorno `puntosFijacionGrilla`; `computeRoofEstructuraHintsByGi` añade `puntosFijacionGrilla` y `fijacionDotsMode` (`isodec_grid` vs `distribute`); merge de `puntosFijacionGrilla` en `mergeZonaResults` |
| `src/components/RoofPreview.jsx` | `fijacionDotsLayoutIsodecGrid`: 2 puntos por panel en filas 0 y N−1 con inset nominal **0,3 m** (acotado si el panel es angosto); 1 punto centrado en filas intermedias; modo `distribute` para caballete / override / combinada |
| `server/routes/calc.js` | Texto de fórmula `formulasCalculo.fijaciones_varilla` actualizado |
| `src/components/PanelinCalculadoraV3_legacy_inline.jsx` | Misma fórmula de grilla + perímetro |
| `tests/validation.js` | Casos 24.7b para grilla y total |

## 7. Verificación

- [x] `npm run lint`
- [x] `npm test`
- [ ] MCP opcional: paso `estructura` en prod/local con consola/red limpias

## 8. Nota de producto

El **total** `puntosFijacion` del BOM puede ser **mayor** que los puntos dibujados en las líneas de apoyo porque se mantiene el término **`largo × 2 / espaciado_perimetro`** (refuerzo según largo). El tooltip indica **puntos dibujados**, **total presupuesto** y **grilla base**.
