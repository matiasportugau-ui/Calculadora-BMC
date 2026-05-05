import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
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
