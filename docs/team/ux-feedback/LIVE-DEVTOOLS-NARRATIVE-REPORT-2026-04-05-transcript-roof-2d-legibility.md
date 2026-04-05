# LIVE-DEVTOOLS-NARRATIVE-REPORT — techo 2D legibilidad (transcripción + plan)

Skill: `.cursor/skills/live-devtools-transcript-action-plan/SKILL.md`. Relacionado: **Live DevTools narrative** (MCP no re-ejecutado en este cierre; evidencia = captura + código).

---

## 1. Metadatos

| Campo | Valor |
|--------|--------|
| Fecha (ISO) | 2026-04-05 |
| Base URL | (cualquiera: prod / local) — componente `RoofPreview` |
| Entorno | implementación en `src/components/RoofPreview.jsx` |
| Evidencia visual | Captura usuario (workspace): `assets/Captura_de_pantalla_2026-04-05_a_la_s__6.38.10_a._m.-832ab0e9-f149-4460-a3ee-bc042902c72e.png` |

## 2. Objetivo

- **Goal:** Que las **cotas rojas**, etiquetas de encuentro, chip de estructura y texto dentro de zonas en la **vista previa 2D del techo** se lean bien en **móvil, tablet y desktop**.
- **Criterios de aceptación:** Cotas y números perceptibles sin zoom manual; proporción estable al cambiar tamaño de ventana; sin solapes críticos en layouts típicos multizona.

## 3. Línea de tiempo — narrativa del usuario (`U-xx`)

| ID | Orden | ACTION (hecho) | EXPECT (intención) |
|----|-------|----------------|---------------------|
| U-01 | 1 | Revisar vista “Zonas del techo” / tooltip “Vista previa 2D techo (planta, rejilla au)” | Entender medidas del plano |
| U-02 | 2 | (Implícito por imagen) Multizona con cotas exteriores rojas | Números y líneas legibles |
| U-03 | 3 | Pedido explícito: “not possible to read anything” / “improve the size of all for all devices” | Tipografía y trazos más grandes y responsivos |

## 4. Evidencia (`E-xx`) — sin inventar salida MCP

| ID | Fuente | Hallazgo |
|----|--------|----------|
| E-01 | Captura de pantalla (descripción + archivo en workspace) | Cotas y números en líneas rojas **muy pequeños**; mucho blanco alrededor del SVG |
| E-02 | Código previo `RoofPreview.jsx` | `fontSize` de cotas en **unidades SVG ≈ metros** (`ARCH_DIM_FONT = 0.13`); en planos con **viewBox grande** eso se traduce a **pocos píxeles** en pantalla |
| E-03 | Código previo | Contenedor SVG con `height: clamp(...)` relativamente bajo en modo Estructura → menos px para el mismo `viewBox` |

## 5. Cruce narrativa ↔ evidencia

| User ID | Evidence IDs | ¿Coincide? | Notas |
|---------|--------------|------------|--------|
| U-01–U-03 | E-01–E-03 | sí | Causa raíz: tamaño de texto en coords SVG fijo vs span del plano + altura del contenedor |

## 6. Plan de acción ejecutado

1. **Investigación:** Localizar strings “Vista previa 2D”, “Zonas del techo” → `RoofPreview.jsx`; cotas en `ArchDim*`, `EstructuraGlobalExteriorOverlay`, `EstructuraZonaOverlay`.
2. **Cambio:** Introducir `buildRoofPlanSvgTypography(viewMetrics)` — `dimFont ≈ clamp(span×2.4%, 0.19, 0.5)` y escala `m = dimFont/0.13` para trazos, ticks, separación de líneas de cota, etiquetas de encuentro, chip apoyos/fijación, rejilla, flechas de pendiente.
3. **ViewBox:** Padding extra del `svgViewBox` en paso Estructura multiplicado por `m` para que cotas ampliadas no queden fuera.
4. **Layout:** Aumentar `minHeight` / `clamp` del contenedor del SVG (Estructura y modo normal) para dar más altura útil en viewport chicos.
5. **Verificación:** `npm run lint`, `npm test` OK.

## 7. Hallazgos / seguimiento

| ID | Severidad | Título | Nota |
|----|-----------|--------|------|
| LDN-2026-04-05-05 | P2 | Legibilidad 2D techo | Mitigado con tipografía proporcional al span del viewBox + más altura del panel |
| — | P3 | MCP otra pasada | Opcional: repetir **chrome-devtools** en local con el mismo flujo multizona para validar visualmente |

## 8. Checklist

- [x] Archivos tocados acotados a `RoofPreview.jsx`
- [x] Lint y tests pasan
- [ ] Validación humana en dispositivo real (recomendado)
