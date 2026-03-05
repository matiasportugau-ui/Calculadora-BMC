# 🚀 Guía de Deployment

## Opción 1: Claude.ai Artifact (Recomendado)

1. Abrir [claude.ai](https://claude.ai)
2. Adjuntar `PanelinCalculadoraV3.jsx` como archivo
3. Pedir "Renderizá este componente React como artifact"
4. Se renderiza directamente en el panel de artifacts

**Ventajas:** Sin setup, sin build, actualización inmediata.

## Opción 2: Vite + React

```bash
# Crear proyecto
npm create vite@latest calculadora-bmc -- --template react
cd calculadora-bmc

# Instalar dependencia
npm install lucide-react

# Copiar componente
cp PanelinCalculadoraV3.jsx src/

# Editar src/App.jsx
cat > src/App.jsx << 'EOF'
import PanelinCalculadora from './PanelinCalculadoraV3'
export default function App() {
  return <PanelinCalculadora />
}
EOF

# Dev server
npm run dev

# Build producción
npm run build
```

## Opción 3: Next.js

```bash
npx create-next-app@latest calculadora-bmc
cd calculadora-bmc
npm install lucide-react

# Copiar a app/page.jsx (o pages/index.jsx)
# Importar como componente client:
```

```jsx
// app/page.jsx
'use client';
import PanelinCalculadora from '../components/PanelinCalculadoraV3';
export default function Home() {
  return <PanelinCalculadora />;
}
```

## Opción 4: Embed en Shopify (bmcuruguay.com.uy)

1. Build con Vite: `npm run build`
2. Subir `dist/` a hosting (Vercel, Cloudflare Pages, etc.)
3. Embed via iframe en página de Shopify:

```html
<iframe src="https://calculadora.bmcuruguay.com.uy"
  width="100%" height="900" frameborder="0"
  style="border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.1);">
</iframe>
```

## Opción 5: Deploy a Vercel

```bash
# Desde el directorio del proyecto Vite
npm i -g vercel
vercel --prod
```

## Actualización de Precios

1. Editar sección §2 del `.jsx` (constantes `PANELS_TECHO`, `PANELS_PARED`, etc.)
2. Los precios se toman de la **Matriz de Costos y Ventas 2026** de BROMYROS
3. Cambiar valores `venta` y `web` en el espesor correspondiente
4. Rebuild y redeploy

**No es necesario** cambiar ninguna función de cálculo — todo usa `p(item)`.

## Variables de Entorno

No se requieren variables de entorno. Todo es hardcodeado y client-side.

## Requisitos del Sistema

- Node.js 18+ (solo para build)
- React 18+
- lucide-react 0.263+
- Navegador moderno (Chrome, Firefox, Safari, Edge)
