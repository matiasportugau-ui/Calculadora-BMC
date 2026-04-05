# LIVE-DEVTOOLS-NARRATIVE-REPORT — transcripción (techo / aguas / familias / colonial)

Skill narrativa: `.cursor/skills/live-devtools-narrative-mcp/SKILL.md`.  
Skill repetible transcript→plan: `.cursor/skills/live-devtools-transcript-action-plan/SKILL.md`.

**Base URL sesión referencia MCP:** `http://localhost:5173/` (corrida agente previa + esta organización).

---

## 1. Metadatos

| Campo | Valor |
|--------|--------|
| Fecha (ISO) | 2026-04-05 |
| Base URL | `http://localhost:5173/` (validación); prod opcional `https://calculadora-bmc.vercel.app` |
| Fuente comentarios | Transcripción voz usuario (EN con ruido) |
| Asset usuario | `public/images/isoroof-colonial-texas-panel.png` (teja colonial / Texas panel) |

## 2. Objetivo

Convertir la narración en **beats ordenados**, cruzar con **evidencia DevTools** donde existió corrida MCP, y **implementar** ajustes de medios/layout alineados a la intención (familia FOIL, colonial, color “Simil teja / Blanco”, diagramas una/dos aguas sin tapar cabecera BMC).

## 3. Línea de tiempo — narrativa normalizada (`U-xx`)

| ID | Orden | ACTION (hecho / intención) | EXPECT | Notas audio |
|----|-------|-----------------------------|--------|--------------|
| U-01 | 1 | Elegir **techo** (escenario cubierta) | Flujo techo coherente | “chose the roof” |
| U-02 | 2 | Ir a **tipo de aguas** (una / dos) | Selector claro | “Agua o aguas” |
| U-03 | 3 | Observar **visor** al avanzar / pulsar | Diagramas **completos** visibles; **no** invaden cabecera con marca **BMC** | “Paralim…” → **Panelin** o **pretil** descartado: encaja **diagrama aguas** que “sube” y tapa zona superior |
| U-04 | 4 | Confirmar al pulsar botón | Imagen **demasiado grande** / recorte vertical | “oversized… see BMC logo” |
| U-05 | 5 | Paso **familia techo** | Todo OK salvo **ISOROOF FOIL 3G** — miniatura **fea** (asset sitio) | Pedido: imagen **previa** / más limpia |
| U-06 | 6 | Revisar **“exterior weave, white yarn”** | Miniatura **correcta** para terminación / color | Correlato producto: **`Simil teja / Blanco`** (Isoroof Colonial) |
| U-07 | 7 | **Colonial / Texas panel** | Imagen **profesional** en selector + pasos color / 3D | Usuario aporta PNG teja colonial |

## 4. Evidencia MCP (`E-xx`) — línea base disponible en hilo

_Estas filas provienen de ejecución real de tools en `http://localhost:5173/` (no inferidas)._

| ID | Tool | Hallazgo |
|----|------|----------|
| E-01 | `take_snapshot` | Wizard paso 1; visor derecho con carrusel (ej. ISOROOF PLUS); modal Panelin; layout 3 columnas |
| E-02 | `list_console_messages` | Solo warnings React Router v7 (sin error funcional en esa carga) |
| E-03 | Inspección código | Paso **tipoAguas** en `QuoteVisualVisor.jsx`: imágenes `1-agua.png` / `2-aguas.png` con `maxHeight: min(36vh, 240px)` → riesgo de **altura** en viewports bajos respecto a cabecera |

## 5. Cruce narrativa ↔ evidencia / código

| User | Evidence / anclaje | Resultado |
|------|---------------------|-----------|
| U-03–U-04 | E-03 + bloque `showAguaStep` | **Parcial antes del fix:** límites en vh podían empujar contenido; **ajuste aplicado** (`maxHeight` con `dvh` y tope px) |
| U-05 | `techoFamilyCardMedia` + `SLIDES_SOLO_TECHO[4]` | FOIL usaba PNG Shopify poco atractivo en tarjeta; **tarjeta** ahora reutiliza **src 3G** con texto FOIL |
| U-06 | `FAMILIA_COLOR_GALLERY.ISOROOF_COLONIAL["Simil teja / Blanco"]` usaba `file.jpg` | **Corregido** a asset colonial local |
| U-07 | `FAMILIA_TECHO_SLIDE`, `ROOF_CATALOG_MAP_URL_BY_FAMILIA`, `public/images/…` | **Colonial** enlazado a PNG usuario |

## 6. Hallazgos (`LDN-…`)

| ID | Severidad | Título | Estado |
|----|-----------|--------|--------|
| LDN-2026-04-05-03 | P2 | Diagramas tipo aguas demasiado altos vs cabecera BMC | **Mitigado** (QuoteVisualVisor) |
| LDN-2026-04-05-04 | P2 | Miniatura **ISOROOF FOIL 3G** en selector familia | **Mitigado** (tarjeta usa imagen 3G, copy FOIL) |
| LDN-2026-04-05-05 | P2 | Color **Simil teja / Blanco** mostraba `file.jpg` incorrecto | **Mitigado** |
| LDN-2026-04-05-06 | P2 | Colonial sin asset dedicado (reuso 3G / genérico) | **Mitigado** (PNG + mapas) |

## 7. Plan de acción profesional (100/100 criterios)

### Fase A — Verificación humana (vos)

- [ ] Local: `npm run dev:full` → `http://localhost:5173/`, modo vendedor, **Solo techo**.
- [ ] Paso **tipo aguas:** confirmar que **ambos** diagramas se ven **enteros** y la barra **BMC Uruguay** sigue legible en laptop 13" y mobile 390px.
- [ ] Paso **familia:** comparar miniaturas **FOIL 3G**, **3G**, **Colonial** (no deben ser clones salvo decisión explícita FOIL=referencia 3G).
- [ ] Paso **color** con **Isoroof Colonial** + **Simil teja / Blanco:** imagen = teja colonial entregada.

### Fase B — Técnica completada en repo (esta corrida)

- Asset: `public/images/isoroof-colonial-texas-panel.png`
- `src/data/roofPanelCatalogMapUrls.js` — `ISOROOF_COLONIAL` → PNG local (textura 3D)
- `src/data/quoteVisorMedia.js` — `FAMILIA_TECHO_SLIDE`, galería colonial, color `Simil teja / Blanco`
- `src/components/PanelinCalculadoraV3_backup.jsx` — `techoFamilyCardMedia` FOIL + COLONIAL
- `src/components/QuoteVisualVisor.jsx` — tope visual diagramas aguas

### Fase C — Post-deploy

- [ ] `npm run gate:local:full` antes de commit (ya `lint` + `test` OK en sesión).
- [ ] Tras deploy Vercel: MCP prod en pasos **tipoAguas** + **familia** + **color colonial**.

## 8. Verificación automática

- `npm run lint` ✅  
- `npm test` ✅ (incl. SUITE 32f `getRoofPanelMapUrl`)

## 9. Siguiente iteración sugerida

- Si FOIL debe tener **foto foil real** distinta de 3G: reemplazar `ISOROOF_FOIL` en `SLIDES_SOLO_TECHO` con asset Shopify/BMC aprobado (no `file.jpg`).
- Opcional: future flags React Router para silenciar warnings v7 (`E-02` histórico).

## 10. Fondo blanco puro (colonial / Texas panel)

- **Hecho:** `public/images/isoroof-colonial-texas-panel.png` procesado con `scripts/whiten-png-background.py` (flood desde bordes + tope de **croma** para no comerse la teja).
- **Reproducir:** `python3 scripts/whiten-png-background.py --in public/images/isoroof-colonial-texas-panel.png --out public/images/isoroof-colonial-texas-panel.png --step-tol 16 --chroma-max 30`
- Si necesitás **bordes perfectos** sin halos: conviene re-export desde el programa de render o enviar PNG ya recortado en blanco; el script prioriza no destruir el producto.
