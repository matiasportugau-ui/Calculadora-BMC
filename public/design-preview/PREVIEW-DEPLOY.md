# Design preview — live SPA theme switcher (sin tocar producción)

Cloná el **mismo código** en un **Vercel Preview** y cambiá entre los 6 estudios del design competition **dentro de la app real** (Calculadora, Wolfboard, nav, etc.).

## Regla de oro

| Entorno | Selector de diseño |
|---------|-------------------|
| **calculadora-bmc.vercel.app** (production) | **OFF** — sin barra, sin CSS glass extra |
| **Vercel Preview** (cualquier branch/PR) | **ON** automático |
| **Local** | `?designPreview=1` o `VITE_BMC_DESIGN_PREVIEW=1` |

Producción no cambia hasta merge explícito a `main` + promote.

## Estudios disponibles (barra inferior)

1. **Producción (actual)** — baseline sin overrides  
2. **Studio Tahoe** — liquid glass chrome  
3. **Operativo Dense** — densidad operativa  
4. **Warm Commerce** — paleta cálida  
5. **Field Industrial** — tablet/obra  
6. **Responsive Lab** — glass solo desktop  
7. **BMC Glass Premium** — tokens `bmc-glass.css`

Incluye toggle **día/noche** y enlace a mockups HTML estáticos.

## Local

```bash
# Opción A — query param (sin .env)
open 'http://localhost:5173/?designPreview=1'

# Opción B — env persistente
echo 'VITE_BMC_DESIGN_PREVIEW=1' >> .env
npm run dev

# Mockups estáticos en /design-preview (opcional)
npm run design-preview:sync-static
```

## Vercel Preview (recomendado)

1. Push branch `feat/design-preview` (o cualquier PR).
2. Vercel genera URL `*.vercel.app` — el selector aparece solo ahí.
3. **No** setear `VITE_BMC_DESIGN_PREVIEW` en Production en el dashboard.

Para incluir mockups HTML en el preview deploy:

```bash
npm run design-preview:sync-static
git add public/design-preview
```

## Archivos clave

| Archivo | Rol |
|---------|-----|
| `src/lib/designPreviewMode.js` | Gate producción vs preview |
| `src/components/preview/DesignPreviewGate.jsx` | Providers + CSS lazy |
| `src/components/preview/DesignPreviewBar.jsx` | Selector flotante |
| `src/contexts/BmcStudioThemeProvider.jsx` | `data-studio` en `<html>` |
| `src/styles/bmc-studio-themes.css` | Overrides por estudio |
| `/preview/design-mockups` | Índice mockups HTML |

## Próximo paso (cuando elijan ganador)

1. Jury elige estudio en preview URL.  
2. Port tokens a `bmc-glass.css` / componentes.  
3. Quitar gate o dejar solo en admin `/hub/design-system/glass`.  
4. Merge a `main` + smoke prod.
