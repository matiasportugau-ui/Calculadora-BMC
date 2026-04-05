# LIVE-DEVTOOLS-NARRATIVE-REPORT — transcripción: presets wizard + Enter

Skill: `.cursor/skills/live-devtools-transcript-action-plan/SKILL.md` + narrativa MCP (evidencia MCP no disponible en esta corrida).

---

## 1. Metadatos

| Campo | Valor |
|--------|--------|
| Fecha (ISO) | 2026-04-04 |
| Base URL | `https://calculadora-bmc.vercel.app` (validación lógica en código; MCP prod no ejecutado) |
| Entorno | implementación en `src/` — verificar en local `http://localhost:5173/` |
| Navegador / MCP | `project-0-Calculadora-BMC-chrome-devtools` → `navigate_page` falló: perfil `chrome-devtools-mcp` ya en uso |
| Participantes | Matías (voz/transcripción), agente Cursor |

## 2. Objetivo de la sesión

- **Goal:** En modo vendedor **Solo techo**, dejar **lista de precios**, **familia** y **color** ya elegidos para poder **Enter → siguiente paso** sin clic extra.
- **Criterios de éxito:** Pasos 3 (lista), 4 (familia), 6 (color) cumplen `isWizardStepValid` al llegar; color **Blanco** en líneas ISODEC y **Gris** en ISOROOF cuando el catálogo lo ofrece.

## 3. Tabla narrativa (`U-xx`)

| ID | Orden | ACTION | EXPECT | Notas audio |
|----|-------|--------|--------|-------------|
| U-01 | 1 | Avanzar el asistente con Enter | Lista de precios ya resuelta sin elegir cada vez | “PSUVMC” → interpretado como **Precio BMC** = estado `venta` vía `getListaDefault()` / config |
| U-02 | 2 | Paso familia | **ISODEC EPS** preseleccionado | “isodec_eps” → `ISODEC_EPS` |
| U-03 | 3 | Paso 6/13 color | **Blanco** en ISODEC; **Gris** en IsoRoof | Colonial solo tiene variante única → primer color del catálogo (sin Gris) |

## 4. Evidencia MCP (`E-xx`)

| ID | Tool / fuente | Hallazgo |
|----|----------------|----------|
| E-01 | `navigate_page` (chrome-devtools MCP) | Error real: *The browser is already running for `~/.cache/chrome-devtools-mcp/chrome-profile`…* — sin snapshot/consola/red en esta pasada. |

## 5. Cruce narrativa ↔ evidencia

| User ID | Evidence IDs | ¿Coincide? | Notas |
|---------|--------------|------------|--------|
| U-01–U-03 | E-01 | parcial | Implementación verificada por `npm run lint` + `npm test`; repetir MCP tras cerrar instancia duplicada de Chrome MCP. |

## 6. Plan de acción (ejecutado)

| Fase | Acción | Estado |
|------|--------|--------|
| Investigación | `SCENARIOS_DEF` solo_techo: pasos 3=`lista`, 4=`familia`, 6=`color`; validación en `isWizardStepValid` | OK |
| Datos / UI | `TECHO_INITIAL_VENDEDOR`: `ISODEC_EPS`, primer espesor de matriz, `Blanco`; `listaPrecios` inicial y reset con `getListaDefault()`; botón **Vendedor** y **Limpiar** alineados | OK |
| Comportamiento | `defaultTechoColorForPanelFamilia` + `setTechoFamilia`: ISOROOF* → `Gris` si existe en `pd.col` | OK |
| Verificación | `npm run lint`, `npm test` | OK |

## 7. Hallazgos

| ID | Severidad | Título | Resumen |
|----|-----------|--------|---------|
| LDN-2026-04-04-14 | P2 | MCP chrome-devtools bloqueado por perfil | Misma causa que sesión previa; no afecta el cambio de producto. |
| LDN-2026-04-04-15 | P3 | ISOROOF_COLONIAL sin Gris | Default de color sigue siendo la primera opción del catálogo (`Simil teja / Blanco`). |

## 8. Archivos tocados

- [`src/components/PanelinCalculadoraV3_backup.jsx`](../../src/components/PanelinCalculadoraV3_backup.jsx): presets vendedor, helper color, `setTechoFamilia`, control segmentado paso lista.

## 9. Checklist verificación

- [x] Lint / tests locales
- [ ] MCP otra pasada (lista → familia → color → Enter) cuando el servidor MCP tenga un solo perfil activo
- [x] Criterios U-01 a U-03 cubiertos en código (salvo nota Colonial)
