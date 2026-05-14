import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const srcRoot = path.join(repoRoot, "src");
const stubs = path.join(__dirname, "stubs");

export default defineConfig({
  root: path.join(__dirname, "entry"),
  base: "./",
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: [
      // Hard stubs: anything backend-coupled is replaced with an offline
      // equivalent that preserves the export surface.
      {
        find: /^.*\/hooks\/useBmcAuth\.js$/,
        replacement: path.join(stubs, "useBmcAuth.js"),
      },
      {
        find: /^.*\/auth\/AuthGateModal\.jsx$/,
        replacement: path.join(stubs, "AuthGateModal.jsx"),
      },
      {
        find: /^.*\/hooks\/useChat\.js$/,
        replacement: path.join(stubs, "useChat.js"),
      },
      {
        find: /^.*\/utils\/googleDrive\.js$/,
        replacement: path.join(stubs, "googleDrive.js"),
      },
      {
        find: /^.*\/utils\/pdfGenerator\.js$/,
        replacement: path.join(stubs, "pdfGenerator.js"),
      },
    ],
  },
  define: {
    "import.meta.env.VITE_ARTIFACT_MODE": JSON.stringify("true"),
  },
  build: {
    outDir: path.join(repoRoot, "artifact-build"),
    emptyOutDir: true,
    target: "es2020",
    minify: "esbuild",
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    sourcemap: false,
    chunkSizeWarningLimit: 8_000,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  server: {
    fs: {
      allow: [repoRoot],
    },
  },
  // The artifact is its own root; do not let any other root pick up `src/`.
  envDir: repoRoot,
  publicDir: false,
  cacheDir: path.join(repoRoot, "node_modules/.vite-artifact"),
  esbuild: {
    legalComments: "none",
  },
  // Help Vite locate src/ files imported relatively from artifact/entry/.
  optimizeDeps: {
    entries: [path.join(__dirname, "entry/main.jsx")],
  },
  // Expose srcRoot to logs (no functional effect).
  _srcRoot: srcRoot,
});
