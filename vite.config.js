import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Calculadora BMC - Cotizador',
        short_name: 'BMC Cotizar',
        description: 'Cotizador de paneles de aislamiento — BMC Uruguay',
        theme_color: '#1a1a2e',
        background_color: '#F5F5F7',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/calculadora',
        icons: [
          { src: '/pwa-192x192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
          { src: '/pwa-512x512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,svg}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // Force the new SW to skip waiting and immediately claim all open tabs,
        // so users on long-lived sessions (PWA installed, tab kept open) pick up
        // hotfixes without manual cache clear. Pairs with registerType:'autoUpdate'.
        skipWaiting: true,
        clientsClaim: true,
        // Always go to network for navigations — prevents serving a stale shell
        // while a deploy is in flight (also avoids the "TDZ-y" surprise of an
        // old index.html pointing to assets that no longer exist on edge).
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdn\.shopify\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'shopify-images',
              expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 3600 },
            },
          },
          {
            urlPattern: /\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 5,
            },
          },
        ],
      },
    }),
  ],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
    'import.meta.env.VITE_GIT_BRANCH': JSON.stringify(process.env.VITE_GIT_BRANCH || process.env.GITHUB_REF_NAME || ''),
  },
  base: process.env.VITE_BASE ?? "/",
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/calc': { target: 'http://localhost:3001', changeOrigin: true },
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    // Hidden sourcemaps: emitted to dist/ but no //# sourceMappingURL pointer in JS,
    // so they are NOT served by Vercel rewrites. Lets us map prod stacks offline
    // without exposing source publicly. Trade-off: dist/ ~+8 MB.
    sourcemap: 'hidden',
    // vendor-pdf (~975 KB) and vendor-three (~870 KB) are intentionally large,
    // pre-split, and lazy-loaded. Silence false-positive warning at 500 KB default.
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-three': ['three', '@react-three/fiber', '@react-three/drei'],
          'vendor-pdf': ['html2pdf.js'],
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
