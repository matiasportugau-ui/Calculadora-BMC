# Calculadora BMC — Claude Artifact

Build self-contenido (single-file HTML) de la calculadora para usarlo como **entorno de diseño** dentro de Claude Artifacts (claude.ai).

El archivo `calculadora-bmc.html` es la calculadora real (`src/components/PanelinCalculadoraV3_backup.jsx`) buildeada con Vite y todos los assets inlineados — sin backend, sin Node, sin `npm install`.

## Uso

1. Subí `artifact/calculadora-bmc.html` como artifact `text/html` en un chat de claude.ai, o abrilo directo en el browser (`file://...`).
2. Iterá la UI con Claude editando los archivos en `src/` y `artifact/stubs/` del repo, luego regenerá con `npm run build:artifact`.
3. El archivo `calculadora-bmc.html` se commitea al repo — pull/push/stage normal.

## Regenerar

```bash
npm run build:artifact
```

Salida: `artifact/calculadora-bmc.html`. Banner con commit SHA y fecha al inicio del archivo.

## Diferencias vs. producción

El artifact corre en sandbox del browser sin servidor. Algunas features están **stubbeadas** (export surface conservado, sin red):

| Feature | Stub | Comportamiento |
|---|---|---|
| Autenticación (`useBmcAuth`) | `artifact/stubs/useBmcAuth.js` | Identidad fija `design@bmc.local` con role `superadmin` |
| AuthGate Modal | `artifact/stubs/AuthGateModal.jsx` | No-op |
| Panelin Chat (`useChat`) | `artifact/stubs/useChat.js` | Mensaje de aviso, sin red |
| Google Drive (save/load) | `artifact/stubs/googleDrive.js` | Persistencia en `localStorage` |
| PDF Generator | `artifact/stubs/pdfGenerator.js` | Solo `html2pdf.js` (client-side, raster) |

**Funciona idéntico a prod:**

- Cotizaciones BMC (techo, pared, techo+fachada, cámara)
- BOM, totales, IVA, perfiles, fijaciones
- Plano 2D (RoofPreview) y escena 3D (`@react-three/fiber`)
- Export WhatsApp text
- Save/load proyectos a `localStorage` (en lugar de Drive)

## Smoke test

```bash
node scripts/smoke-artifact.mjs
```

Levanta chromium headless contra `file://artifact/calculadora-bmc.html` y verifica que monta sin errores fatales.
