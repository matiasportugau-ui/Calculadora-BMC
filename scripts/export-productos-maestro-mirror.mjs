#!/usr/bin/env node
/**
 * Export espejo read-only Productos_Maestro → CSV en .runtime (copiar manual a Sheets).
 *
 * Uso:
 *   npm run productos-maestro:mirror
 *   BMC_API_BASE=... API_AUTH_TOKEN=... npm run productos-maestro:mirror
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const base = (process.env.BMC_API_BASE || "http://localhost:3001").replace(/\/$/, "");
const token = process.env.API_AUTH_TOKEN || process.env.BMC_API_AUTH_TOKEN || "";

async function main() {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${base}/api/productos-maestro`, { headers });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt.slice(0, 400)}`);
  }
  const data = await res.json();
  const items = data.items || [];

  const cols = [
    "path",
    "sku",
    "nombre",
    "costo",
    "venta_local",
    "venta_web",
    "stock",
    "codigo_stock",
    "estado",
    "warnings",
  ];
  const esc = (s) => {
    const str = String(s ?? "");
    return str.includes(",") || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const lines = [cols.join(",")];
  for (const i of items) {
    lines.push(
      [
        i.path,
        i.sku,
        i.nombre,
        i.costo,
        i.venta_local,
        i.venta_web,
        i.stock,
        i.codigo_stock,
        i.estado,
        (i.warnings || []).join("; "),
      ]
        .map(esc)
        .join(","),
    );
  }

  const runtimeDir = path.join(repoRoot, ".runtime");
  fs.mkdirSync(runtimeDir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const csvPath = path.join(runtimeDir, `productos-maestro-mirror-${date}.csv`);
  fs.writeFileSync(csvPath, "\uFEFF" + lines.join("\n"), "utf8");
  console.log(`OK mirror ${items.length} filas → ${csvPath}`);
  console.log("Pegar en tab Productos_Maestro (MATRIZ) como espejo read-only.");
}

main().catch((e) => {
  console.error(e.message || String(e));
  process.exit(1);
});
