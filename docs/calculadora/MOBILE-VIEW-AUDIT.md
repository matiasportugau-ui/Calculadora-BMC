# Auditoría — vista móvil Calculadora BMC

Documento de entrega para el plan de arquitectura/diagnóstico móvil. **Congelado** según el estado del repo al generarse; las versiones exactas están en `package.json` y `package-lock.json`.

**App version (package.json):** 3.1.5  
**Fuente de breakpoints compartida:** [src/constants/viewportBreakpoints.js](../../src/constants/viewportBreakpoints.js) (JS) y [src/styles/bmc-mobile.css](../../src/styles/bmc-mobile.css) (CSS).

---

## 1. Inventario de dependencias y build (UI móvil / PWA)

| Área | Paquete | Versión declarada (`package.json`) | Notas |
|------|---------|--------------------------------------|--------|
| Framework | `react`, `react-dom` | ^18.2.0 | SPA, sin SSR |
| Router | `react-router-dom` | ^6.30.3 | `basename` vía `import.meta.env.BASE_URL` → [src/utils/routerBasename.js](../../src/utils/routerBasename.js) |
| Build | `vite` | ^7.0.0 | `base`: `process.env.VITE_BASE ?? "/"` en [vite.config.js](../../vite.config.js) |
| PWA | `vite-plugin-pwa` | ^1.2.0 (devDep) | Workbox, `registerType: 'autoUpdate'` |
| PDF | `html2pdf.js` | ^0.14.0 | Chunk `vendor-pdf` |
| Paneles | `react-resizable-panels` | ^2.1.9 | Arrastre vs touch en flujos complejos |
| 3D | `three`, `@react-three/fiber`, `@react-three/drei` | ver lockfile | Chunk `vendor-three` |
| Iconos | `lucide-react` | ^0.263.1 | — |
| Métricas | `web-vitals` | ^5.2.0 | LCP/INP/CLS → `sendBeacon` `/api/vitals` en [src/App.jsx](../../src/App.jsx) |

**Chunks manuales:** `vendor-three`, `vendor-pdf`, `vendor-react` ([vite.config.js](../../vite.config.js)).

**Ausente:** Tailwind, shadcn; responsividad = CSS global + inline + helpers JS.

---

## 2. Mapa de breakpoints (CSS ↔ JS)

Los umbrales en píxeles están **documentados en código** para evitar divergencias accidentales.

| Umbral (px) | CSS (`bmc-mobile.css`) | JS (`viewportBreakpoints.js` / uso) |
|-------------|------------------------|--------------------------------------|
| 639 | `@media (max-width: 639px)` — oculta `.bmc-desktop-actions` | `VIEWPORT.PHONE_MAX_PX`, `isPhoneViewportWidth` |
| 640–1023 | Tablet (acciones envueltas), compact layout | `isTabletViewportWidth` |
| 759 | `@media (max-width: 759px)` — `.bmc-pdf-modal-compact` | `VIEWPORT.PDF_COMPACT_MODAL_MAX_PX`, `mqCompactPdfModal()` en `PDFPreviewModal` |
| 1023 | `@media (max-width: 1023px)` — rejilla móvil, `.bmc-mobile-bar`, visor carousel | `VIEWPORT.MOBILE_LAYOUT_MAX_PX`, `isCompactMainLayoutWidth` |
| 1024 | Desktop — oculta `.bmc-mobile-bar` | `VIEWPORT.DESKTOP_MIN_PX` |

**Componentes tocados por ancho:**

- [src/components/PanelinCalculadoraV3.jsx](../../src/components/PanelinCalculadoraV3.jsx): rejillas (`twoCol`, `threeCol`, …), `PDFPreviewModal` (compact = mismo umbral que CSS PDF).
- [src/components/RoofPreview.jsx](../../src/components/RoofPreview.jsx): `innerWidth` para geometría 2D/3D (revisar rendimiento en móvil real).
- [src/components/PanelinChatPanel.jsx](../../src/components/PanelinChatPanel.jsx): pointer/touch, `window.innerWidth` para tamaño del panel.

**Nota:** 759px aplica solo al **modal PDF** (alineado con `.bmc-pdf-modal-compact`); el layout principal compacto usa **1023px**. No es un bug: son dos bandas distintas.

---

## 3. Trazabilidad con [BROWSER-QA-CHECKLIST.md](BROWSER-QA-CHECKLIST.md)

| Sección checklist | Relación con móvil / viewport |
|-------------------|-------------------------------|
| A — Carga y shell | A1–A5 en viewport ≤390px o preset iPhone; consola sin errores críticos |
| B–F — Escenarios | Flujos en ancho estrecho; teclado virtual en inputs del wizard |
| G — Vendedor | Targets táctiles (CSS `.bmc-wizard-dots`, `.bmc-stepper-btn`) |
| **H — PDF y WhatsApp** | **H4** explícito: barra inferior WA/PDF visible y usable en móvil → coherente con `.bmc-mobile-bar` + acciones |
| I — Historial | localStorage; mismo origen |
| J+ — Drive / API | Red móvil; Workbox `/api/` NetworkFirst puede enmascarar latencia |

---

## 4. Rutas runtime (basename, deploy, PWA)

| Tema | Ubicación | Comportamiento esperado |
|------|-----------|-------------------------|
| Basename | [src/utils/routerBasename.js](../../src/utils/routerBasename.js) | Si `VITE_BASE` ≠ `/`, rutas y assets deben coincidir con el deploy |
| Vercel SPA | [vercel.json](../../vercel.json) | `rewrites` → `/index.html` para rutas del router |
| PWA manifest | [vite.config.js](../../vite.config.js) | `start_url: '/calculadora'`, `display: 'standalone'`, `orientation: 'portrait'` |
| Workbox | [vite.config.js](../../vite.config.js) `workbox.runtimeCaching` | Shopify CDN CacheFirst; `/api/` NetworkFirst (5s timeout) |
| Dev proxy | [vite.config.js](../../vite.config.js) `server.proxy` | `/api`, `/calc` → `localhost:3001` (solo desarrollo) |
| HTML shell | [index.html](../../index.html) | `viewport`, meta PWA; `min-height: 100vh` en `body`/`#root` (posible interacción con barras del navegador en iOS) |

---

## 5. Criterios de aceptación medibles (“móvil OK”)

**Mínimo producto verificable:**

1. **Carga:** Checklist A1–A5 OK en dispositivo real o emulado (≤390px de ancho lógico).
2. **Cotización:** Al menos “Solo techo” + Cliente (B1–B7) sin bloqueos.
3. **Salida:** H1–H4, incluido **H4** (barra inferior WA/PDF usable).
4. **Rendimiento:** Si hay quejas de lentitud, revisar INP (instrumentado) y chunk `vendor-three` en hardware real.
5. **Regresión PDF:** Abrir vista previa PDF; por debajo de 759px el modal debe comportarse como pantalla completa (CSS + clase `bmc-pdf-modal-compact` + estado compact en JS).

**Evidencia si no se reproduce el bug:** URL (prod/local), navegador y modelo, pasos, captura o video; indicar si ocurre solo como PWA instalada o también en navegador normal; clasificar síntoma en layout vs API vs rendimiento.

---

## 6. Orden de verificación recomendado

1. Revisar [src/constants/viewportBreakpoints.js](../../src/constants/viewportBreakpoints.js) y reglas en [src/styles/bmc-mobile.css](../../src/styles/bmc-mobile.css).
2. DevTools: anchos 360, 390, 700, 800, 1024 (comprobar transición barra móvil / desktop y modal PDF).
3. Red: throttling 4G; observar `/api/*` y fallos de CORS según origen.
4. `npm run build && npm run preview` o URL de producción; probar PWA “Añadir a inicio” si el fallo es solo instalada.

---

## 7. Backlog de seguimiento (prioridades del plan)

| Prioridad | Ítem |
|-----------|------|
| P0 | Checklist H4 + matriz breakpoints en dispositivo real |
| P0 | Regresión PDF/modal y barra inferior &lt;768px |
| P1 | RoofPreview + three en móvil |
| P1 | PanelinChatPanel touch vs scroll |
| P2 | Workbox / caché API tras releases |
| P2 | Alinear narrativa de [docs/ARCHITECTURE.md](../ARCHITECTURE.md) con app multipágina actual |
