import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE ?? "/",
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/calc': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
  build: { outDir: 'dist' },
});
