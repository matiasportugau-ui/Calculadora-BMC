#!/usr/bin/env node
/**
 * build-matriz-csv-from-raw.mjs — One-off para reconciliación total.
 *
 * Genera el CSV normalizado que consume `bake-matriz-to-constants.mjs`, leyendo
 * el export PÚBLICO del Sheet MATRIZ (no requiere credenciales ni la API live).
 * Aplica el layout REAL del tab BROMYROS con **costo = columna G (Actualizado)**:
 *   D=sku E=producto F=costo_base G=costo_actualizado H=margen I=ganancia
 *   J=venta_local_exIVA K=ref_cIVA  R=venta_web_exIVA S=venta_web_cIVA
 *
 * Dedup determinístico: si varias filas comparten SKU y mapean al mismo path,
 * elige la fila cuyo producto coincide con el espesor del path (evita el
 * "gana la última fila" del importador). Reporta los conflictos.
 *
 * Uso: node scripts/build-matriz-csv-from-raw.mjs [--out .runtime/matriz-precios-latest.csv]
 */
import fs from "node:fs";
import path from "node:path";
import { getPathForMatrizSku } from "../src/data/matrizPreciosMapping.js";

const SHEET_ID = "1oDMkBgWxX7cu7TpSvuO30tCTUWl68IBDhC4cQTP79Xo";
const OUT = process.argv.includes("--out")
  ? process.argv[process.argv.indexOf("--out") + 1]
  : ".runtime/matriz-precios-latest.csv";

// Índices de columna (0-based) del tab BROMYROS — costo desde G.
const C = { sku: 3, prod: 4, costo: 6 /* G */, ventaLocal: 9, ventaIvaInc: 10, web: 17, webIvaInc: 18 };

function parseCSV(s) {
  const rows = []; let row = [], cur = "", q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else { if (c === '"') q = true; else if (c === ",") { row.push(cur); cur = ""; } else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; } else if (c === "\r") { /* skip */ } else cur += c; }
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
const num = (v) => {
  if (v == null) return "";
  let s = String(v).trim().replace(/\s/g, "");
  if (!s || /[^\d.,-]/.test(s)) return "";
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = parseFloat(s);
  return Number.isNaN(n) ? "" : (+n).toFixed(2);
};
const esc = (s) => { const t = String(s ?? ""); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
const espOfPath = (p) => { const m = String(p).match(/\.(\d+)$/); return m ? m[1] : null; };
const categoria = (p) => p.startsWith("PANELS_TECHO") ? "Paneles Techo"
  : p.startsWith("PANELS_PARED") ? "Paneles Pared"
  : p.startsWith("PERFIL_") ? "Perfilería"
  : p.startsWith("SELLADORES") ? "Selladores"
  : p.startsWith("FIJACIONES") ? "Fijaciones"
  : p.startsWith("SERVICIOS") ? "Servicios" : "Otros";

const res = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`, { redirect: "follow" });
if (!res.ok) { console.error("No se pudo bajar el export del Sheet:", res.status); process.exit(2); }
const rows = parseCSV(await res.text()).slice(1);

// Agrupar filas por path resuelto.
const byPath = new Map();
for (const r of rows) {
  const sku = String(r[C.sku] ?? "").trim();
  if (!sku) continue;
  // Estado en columna C: "DISC." → descontinuado, se excluye del mapeo/bake.
  if (/DISC/i.test(String(r[2] ?? ""))) continue;
  const p = getPathForMatrizSku(sku);
  if (!p) continue;
  (byPath.get(p) || byPath.set(p, []).get(p)).push(r);
}

const out = ["sku,path,descripcion,categoria,costo,venta_local,venta_local_iva_inc,venta_web,venta_web_iva_inc,unidad,tab"];
const conflicts = [];
let emitted = 0;
for (const [p, group] of byPath) {
  let row = group[0];
  if (group.length > 1) {
    const esp = espOfPath(p);
    const match = esp ? group.find((g) => new RegExp(`\\b${esp}\\s?mm`, "i").test(String(g[C.prod]))) : null;
    row = match || group[0];
    conflicts.push({ path: p, esp, elegido: String(row[C.prod]).slice(0, 36), total: group.length,
      resuelto: !!match, otros: group.filter((g) => g !== row).map((g) => String(g[C.prod]).slice(0, 30)) });
  }
  const unidad = p.includes("esp.") ? "m²" : "unid";
  // Regla de negocio: los PANELES llevan el mismo precio en ambas listas (web = venta local).
  // Perfiles/accesorios mantienen el web de la matriz (R), que sí tiene markup.
  const esPanel = p.startsWith("PANELS_");
  const vLocal = num(row[C.ventaLocal]);
  const vLocalIva = num(row[C.ventaIvaInc]);
  const vWeb = esPanel ? vLocal : num(row[C.web]);
  const vWebIva = esPanel ? vLocalIva : num(row[C.webIvaInc]);
  out.push([esc(row[C.sku]), p, esc(row[C.prod] || ""), categoria(p),
    num(row[C.costo]), vLocal, vLocalIva, vWeb, vWebIva, unidad, "BROMYROS"].join(","));
  emitted++;
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, "﻿" + out.join("\n") + "\n");

console.log(`✓ ${OUT} — ${emitted} paths (de ${rows.length} filas crudas)`);
console.log(`\nConflictos de SKU duplicado (${conflicts.length}):`);
for (const c of conflicts) {
  console.log(`  ${c.resuelto ? "✓" : "⚠"} ${c.path} (esp ${c.esp ?? "—"}) → "${c.elegido}"${c.resuelto ? "" : "  [SIN MATCH de espesor — revisar]"}`);
  for (const o of c.otros) console.log(`       descartado: ${o}`);
}
