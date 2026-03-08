# 🚀 Guía de Deployment

## Contexto online listo para deploy

Este repositorio ahora incluye un contexto estándar de aplicación web para desplegar en línea sin pasos extra:

- `index.html` + `src/main.jsx` + `src/App.jsx` para bootstrapping React.
- `vite.config.js` configurado para ejecutar en `0.0.0.0`.
- `Dockerfile` multi-stage (Node build + Nginx runtime).
- `.dockerignore` para builds más livianos.
- `vercel.json` para deploy directo en Vercel.

Con esto, podés desplegar en Vercel, Render, Railway, Fly.io, Cloud Run o cualquier host con Docker/Nginx.

## Opción 1: Deploy rápido en Vercel

```bash
npm install
npm run build
npx vercel --prod
```

## Opción 2: Deploy con Docker (genérico)

```bash
# Build de imagen
docker build -t calculadora-bmc:latest .

# Ejecutar local para validar

docker run --rm -p 8080:80 calculadora-bmc:latest
```

Luego abrí `http://localhost:8080`.

## Opción 3: Deploy en cualquier servidor Linux con Node

```bash
npm install
npm run build
npm run preview -- --host 0.0.0.0 --port 4173
```

Esto sirve para validar pre-release o exponer una instancia temporal.

## Variables de entorno

No se requieren variables de entorno. Todo el motor de cálculo es client-side y está hardcodeado.

## Actualización de precios

1. Editar sección §2 del `src/PanelinCalculadoraV3.jsx`.
2. Cambiar valores `venta` y `web` según la matriz vigente.
3. Ejecutar `npm run build`.
4. Redeploy.

No es necesario modificar funciones de cálculo.
