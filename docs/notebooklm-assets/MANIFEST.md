# Capturas Calculadora BMC — Manifest para NotebookLM

Generado: 2026-05-08T22:37:10.635Z
PDF maestro: `capturas-calculadora-bmc.pdf`
Producción: https://calculadora-bmc.vercel.app

| # | Archivo | Caption sugerido |
|---|---------|------------------|
| 01 | `01-home-wizard-paso1.png` | Pantalla inicial — Wizard Paso 1 con los 5 escenarios (Solo Techo, Solo Fachada, Techo + Fachada, Cámara Frigorífica, Presupuesto libre) y header completo (Hub, Logística, Vendedor/Cliente, Config, Plano, Drive, Presupuestos, Guardar, Limpiar, Imprimir). |
| 02 | `02-selector-escenario.png` | Selector de escenario activo (Solo Techo seleccionado) con visor visual del panel ISODEC PIR a la derecha. |
| 03 | `03-familia-espesor-panel.png` | Wizard Paso 2 — Familia panel techo: ISODEC EPS, ISODEC PIR, ISOROOF 3G, ISOROOF FOIL 3G, ISOROOF Colonial, ISOROOF PLUS 3G. |
| 04 | `04-dimensiones-techo.png` | Catálogo extendido de paneles con cards visuales (techos y cubiertas, livianos, premium). |
| 05 | `05-plano-2d-cotas.png` | Catálogo y selector con KPIs de área y paneles en cabecera derecha. |
| 06 | `06-bom-grupos.png` | Familia panel techo con bottom-sheet de Más acciones / Diseño PDF (BMC PDF — Blueprint Técnico). |
| 07 | `07-pricing-totales.png` | Vista detallada con totales y selector de lista de precios (Precio BMC vs Precio Web). |
| 08 | `08-acciones-export.png` | Acciones de export desplegadas: PDF, WhatsApp, Drive, Guardar. |
| 09 | `09-hub-modulos.png` | Hub operativo (/hub) — landing de módulos. |
| 10 | `10-hub-wa.png` | Hub WhatsApp (/hub/wa) — cockpit de canal. |
| 11 | `11-hub-canales.png` | Hub canales (/hub/canales) — vista consolidada. |
| 12 | `12-hub-admin.png` | Hub admin (/hub/admin) — panel administrativo. |
| 13 | `13-panelin-chat.png` | Calculadora con la barra del chat Panelín visible en el header. |
| 14 | `14-matrix-presentation.png` | Presentación Matrix (/matrix-presentation.html) — datos vivos: paquete calculadora-bmc 3.1.5, Git 0bd4d7f, CALCULATOR_DATA_VERSION 45e744c8db, tests validation 384 / roof 10, stack React 18 · Vite 7 · Express 5. |
| 15 | `deep-02-familia-panel.png` | Wizard Paso 2 (después de elegir Solo Techo) — selector de familia de panel con cards. |
| 16 | `deep-03-espesor.png` | Wizard Paso 3 — selector de espesor (mm) según familia elegida. |
| 17 | `deep-04-color.png` | Wizard Paso 4 — selector de color del panel. |
| 18 | `deep-05-dimensiones.png` | Wizard Paso 5 — Dimensiones cargadas (largo 6.5 m × ancho 5.6 m). Área calculada en KPI superior. |
| 19 | `deep-06-plano-2d-cotas.png` | Vista previa del techo (2D) — Plano con cadena de cotas, perímetro 26.44 m, 43.7 m² total. Panel derecho con encuentros y zonas. |
| 20 | `deep-06b-plano-2d-zoom.png` | Crop del SVG del plano 2D — cadena de paneles con cotas en metros y altura 6.5 m. |
| 21 | `deep-07-bordes-asignados.png` | Plano 2D con bordes asignados (perfiles perimetrales tipo gotero/cumbrera/babeta). |
| 22 | `deep-08-bom-completo.png` | BOM por grupos — Selladores con Silicona Bromplast, Silicona neutra, Cinta Butilo. Subtotal selladores U$S 133.95 s/IVA. |
| 23 | `deep-09-totales-usd.png` | Totales y precios USD por línea (cantidad, P. unit, Total) con plano 2D y panel de área (43.7 m²). |
| 24 | `deep-10-preview-pdf.png` | Vista previa de cotización (PDF) abierta en overlay. Diseño activo: BMC PDF — Blueprint Técnico. Cabecera Imprimir / PDF / Cerrar. |
| 25 | `deep-11-panelin-chat-abierto.png` | Chat Panelín abierto (drawer derecho) con saludo del agente y quick actions (¿qué puede hacer?, ¿qué te recomiendo?). |

## Cómo subirlo a NotebookLM

1. Crear notebook "Calculadora BMC — Video Instructivo".
2. Add source → Upload → `capturas-calculadora-bmc.pdf`.
3. Add source → Paste text → pegar el bloque del input one-shot (docs/NOTEBOOKLM-VIDEO-ONESHOT si existe, o el bloque del chat).
4. Studio → Video Overview → Customize → pegar la misma directiva.
5. Generate.

## Re-generar capturas

```bash
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node scripts/notebooklm-capture.mjs
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node scripts/notebooklm-capture-deep.mjs
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node scripts/notebooklm-build-pdf.mjs
```
