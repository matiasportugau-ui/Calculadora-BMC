# Commit fd9c93a

- Fecha: 2026-04-19
- Hora: 04:44:48
- Autor: matiasportugau-ui
- Email: matias.portugau@gmail.com
- Branch: main
- Tipo: other
- Scope: -
- Commit: Update documentation and tests for AUTOTRACE and add new reference materials

## Resumen
Update documentation and tests for AUTOTRACE and add new reference materials

## Descripción
Este cambio registra el commit `Update documentation and tests for AUTOTRACE and add new reference materials` dentro del sistema de trazabilidad del proyecto. Se modificaron 50 archivos: .cursor/skills/sketchup-sketchfab-docs-architecture/SKILL.md, .cursor/skills/sketchup-sketchfab-docs-architecture/reference.md, .env.example, docs/dev-trace/AUTOTRACE-CHANGELOG.md, docs/dev-trace/AUTOTRACE-STATUS.md y 45 más.

Contexto del commit:
- Added allowed origins for the Cockpit token in `.env.example`.
- Updated test command in `package.json` to include `cockpitTokenOrigin.js`.
- Introduced new documentation for Sketchfab and Quantifier Pro in `SKILL.md` and `reference.md`.
- Added a comprehensive mirror of the Green Retreats visualiser, including HTML, CSS, and JavaScript files, along with associated assets.

This commit enhances the project's documentation and testing framework, ensuring better integration and usability.

## Señales automáticas (QA / release)
- Posible regresión (heurística): **no**
- Tests / validación tocados: **sí**
- Breaking mencionado: **no**
- Impacto release sugerido: **low**
- Áreas (prefijos): .cursor, docs, server, src, tests

## Archivos modificados
- .cursor/skills/sketchup-sketchfab-docs-architecture/SKILL.md
- .cursor/skills/sketchup-sketchfab-docs-architecture/reference.md
- .env.example
- docs/dev-trace/AUTOTRACE-CHANGELOG.md
- docs/dev-trace/AUTOTRACE-STATUS.md
- docs/dev-trace/AUTOTRACE-UNRELEASED.md
- docs/dev-trace/commits/2026/04/bc5c1fc.md
- docs/dev-trace/commits/index.json
- docs/dev-trace/worklog/2026/04/2026-04-18.md
- docs/reference/green-retreats-visualiser/README.md
- docs/reference/green-retreats-visualiser/mirror/Cedar_D.jpg
- docs/reference/green-retreats-visualiser/mirror/Cedar_D_V_Tile.jpg
- docs/reference/green-retreats-visualiser/mirror/Cedar_N.jpg
- docs/reference/green-retreats-visualiser/mirror/Cedar_N_V_Tile.jpg
- docs/reference/green-retreats-visualiser/mirror/Composite_Cedar_D.jpg
- docs/reference/green-retreats-visualiser/mirror/Composite_D_V_Tile.jpg
- docs/reference/green-retreats-visualiser/mirror/Composite_Grey_D.jpg
- docs/reference/green-retreats-visualiser/mirror/Composite_N_V_Tile.jpg
- docs/reference/green-retreats-visualiser/mirror/Composite_Oak_D.jpg
- docs/reference/green-retreats-visualiser/mirror/Composite_Oak_N.jpg
- docs/reference/green-retreats-visualiser/mirror/Graphite_D_V_Tile.jpg
- docs/reference/green-retreats-visualiser/mirror/Honey_D.jpg
- docs/reference/green-retreats-visualiser/mirror/Redwood_D.jpg
- docs/reference/green-retreats-visualiser/mirror/Redwood_D_V_Tile.jpg
- docs/reference/green-retreats-visualiser/mirror/Redwood_N.jpg
- docs/reference/green-retreats-visualiser/mirror/Redwood_N_V_Tile.jpg
- docs/reference/green-retreats-visualiser/mirror/app.css
- docs/reference/green-retreats-visualiser/mirror/ar-image.png
- docs/reference/green-retreats-visualiser/mirror/css/grvisualiserv2.webflow.css
- docs/reference/green-retreats-visualiser/mirror/css/normalize.css
- docs/reference/green-retreats-visualiser/mirror/css/webflow.css
- docs/reference/green-retreats-visualiser/mirror/gr_visualiser_v2_code.bin
- docs/reference/green-retreats-visualiser/mirror/gr_visualiser_v2_code.gltf
- docs/reference/green-retreats-visualiser/mirror/gr_visualiser_v2_code.gltf.xz
- docs/reference/green-retreats-visualiser/mirror/gr_visualiser_v2_code.html
- docs/reference/green-retreats-visualiser/mirror/gr_visualiser_v2_code.js
- docs/reference/green-retreats-visualiser/mirror/green-retreats-logo-2019.png
- docs/reference/green-retreats-visualiser/mirror/images/favicon.ico
- docs/reference/green-retreats-visualiser/mirror/images/right-thin-chevron-svgrepo-com.svg
- docs/reference/green-retreats-visualiser/mirror/images/webclip.png
- docs/reference/green-retreats-visualiser/mirror/index.html
- docs/reference/green-retreats-visualiser/mirror/js/webflow.js
- docs/reference/green-retreats-visualiser/mirror/pricing.json.sample
- docs/reference/green-retreats-visualiser/mirror/v3d.js
- package.json
- server/lib/cockpitTokenOrigin.js
- server/routes/bmcDashboard.js
- src/components/BmcWaOperativoModule.jsx
- src/data/calculatorDataVersion.js
- tests/cockpitTokenOrigin.js

## Diff summary
```text
.../sketchup-sketchfab-docs-architecture/SKILL.md  |  119 +
 .../reference.md                                   |   44 +
 .env.example                                       |    4 +
 docs/dev-trace/AUTOTRACE-CHANGELOG.md              |    1 +
 docs/dev-trace/AUTOTRACE-STATUS.md                 |    8 +-
 docs/dev-trace/AUTOTRACE-UNRELEASED.md             |    1 +
 docs/dev-trace/commits/2026/04/bc5c1fc.md          |   45 +
 docs/dev-trace/commits/index.json                  |   32 +
 docs/dev-trace/worklog/2026/04/2026-04-18.md       |   13 +
 docs/reference/green-retreats-visualiser/README.md |   51 +
 .../green-retreats-visualiser/mirror/Cedar_D.jpg   |  Bin 0 -> 382492 bytes
 .../mirror/Cedar_D_V_Tile.jpg                      |  Bin 0 -> 389989 bytes
 .../green-retreats-visualiser/mirror/Cedar_N.jpg   |  Bin 0 -> 183840 bytes
 .../mirror/Cedar_N_V_Tile.jpg                      |  Bin 0 -> 227270 bytes
 .../mirror/Composite_Cedar_D.jpg                   |  Bin 0 -> 391096 bytes
 .../mirror/Composite_D_V_Tile.jpg                  |  Bin 0 -> 11265 bytes
 .../mirror/Composite_Grey_D.jpg                    |  Bin 0 -> 335390 bytes
 .../mirror/Composite_N_V_Tile.jpg                  |  Bin 0 -> 11257 bytes
 .../mirror/Composite_Oak_D.jpg                     |  Bin 0 -> 388694 bytes
 .../mirror/Composite_Oak_N.jpg                     |  Bin 0 -> 95640 bytes
 .../mirror/Graphite_D_V_Tile.jpg                   |  Bin 0 -> 11297 bytes
 .../green-retreats-visualiser/mirror/Honey_D.jpg   |  Bin 0 -> 245775 bytes
 .../green-retreats-visualiser/mirror/Redwood_D.jpg |  Bin 0 -> 289895 bytes
 .../mirror/Redwood_D_V_Tile.jpg                    |  Bin 0 -> 256400 bytes
 .../green-retreats-visualiser/mirror/Redwood_N.jpg |  Bin 0 -> 113772 bytes
 .../mirror/Redwood_N_V_Tile.jpg                    |  Bin 0 -> 147270 bytes
 .../green-retreats-visualiser/mirror/app.css       |   63 +
 .../green-retreats-visualiser/mirror/ar-image.png  |  Bin 0 -> 30570 bytes
 .../mirror/css/grvisualiserv2.webflow.css          | 3235 ++++++++++++
 .../mirror/css/normalize.css                       |  355 ++
 .../mirror/css/webflow.css                         | 1820 +++++++
 .../mirror/gr_visualiser_v2_code.bin               |  Bin 0 -> 9066480 bytes
 .../mirror/gr_visualiser_v2_code.gltf              |    1 +
 .../mirror/gr_visualiser_v2_code.gltf.xz           |  Bin 0 -> 183272 bytes
 .../mirror/gr_visualiser_v2_code.html              |   99 +
 .../mirror/gr_visualiser_v2_code.js                | 5356 ++++++++++++++++++++
 .../mirror/green-retreats-logo-2019.png            |  Bin 0 -> 10582 bytes
 .../mirror/images/favicon.ico                      |  Bin 0 -> 15086 bytes
 .../images/right-thin-chevron-svgrepo-com.svg      |   42 +
 .../mirror/images/webclip.png                      |  Bin 0 -> 4807 bytes
 .../green-retreats-visualiser/mirror/index.html    |  562 ++
 .../green-retreats-visualiser/mirror/js/webflow.js |   55 +
 .../mirror/pricing.json.sample                     |    1 +
 .../green-retreats-visualiser/mirror/v3d.js        |  352 ++
 package.json                                       |    2 +-
 server/lib/cockpitTokenOrigin.js                   |  105 +
 server/routes/bmcDashboard.js                      |   15 +
 src/components/BmcWaOperativoModule.jsx            |   55 +
 src/data/calculatorDataVersion.js                  |    2 +-
 tests/cockpitTokenOrigin.js                        |   32 +
 50 files changed, 12464 insertions(+), 6 deletions(-)
```

## Riesgo de cambio (tamaño / extensiones)
Rojo
