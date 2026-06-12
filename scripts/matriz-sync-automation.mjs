#!/usr/bin/env node
/**
 * Matriz Sync Automation — CI/Cron Wrapper (WOLF-2026-0004)
 * ─────────────────────────────────────────────────────────────────────────
 * Automatiza la sincronización de precios entre la MATRIZ (Google Sheets)
 * y la base de código (`constants.js`), aplicando umbrales de seguridad
 * para evitar que errores de formato decimal u orden de magnitud rompan
 * los precios en producción.
 *
 * Uso:
 *   npm run matriz:sync-auto
 *   MAX_CHANGE_PCT=0.25 npm run matriz:sync-auto
 *
 * Flujo:
 *   1. Descarga el CSV más reciente de la MATRIZ (`npm run matriz:pull-csv`).
 *   2. Parsea el CSV y compara los valores numéricos contra `getPricingItemsFlat()`.
 *   3. Valida cambios:
 *      - Rechaza valores negativos o inválidos.
 *      - Si la diferencia porcentual > MAX_CHANGE_PCT (default 25%), aborta.
 *   4. Si todo es válido y hay cambios, ejecuta `matriz:bake` para actualizar
 *      `constants.js` de forma segura.
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsvRows } from "../src/utils/csvPricingImport.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outDir = path.join(repoRoot, ".runtime");
const latestCsvFile = path.join(outDir, "matriz-precios-latest.csv");

// Umbral máximo de cambio permitido (25% por defecto)
const MAX_CHANGE_PCT = Number(process.env.MAX_CHANGE_PCT || 0.25);
const MIN_ABS_DIFF = 0.05; // Ignorar ruidos de punto flotante < 5 centavos

async function main() {
  console.log("🚀 Iniciando automatización de sincronización MATRIZ...");

  // 1. Descargar CSV de Matriz
  console.log("\n📥 Descargando CSV de MATRIZ...");
  try {
    // Si no está corriendo el server local, apunta a prod para el cron.
    const apiBase = process.env.BMC_API_BASE || "https://calculadora-bmc.vercel.app";
    execSync(`BMC_API_BASE=${apiBase} npm run matriz:pull-csv`, { stdio: "inherit", cwd: repoRoot });
  } catch (error) {
    console.error("❌ Falló la descarga del CSV MATRIZ.");
    process.exit(1);
  }

  if (!fs.existsSync(latestCsvFile)) {
    console.error(`❌ El archivo ${latestCsvFile} no existe tras la descarga.`);
    process.exit(1);
  }

  // 2. Obtener precios actuales (calculadora)
  console.log("⚙️  Cargando motor de precios actual...");
  // Import dinámico para asegurar que toma la versión compilada/actual de constants
  const { getPricingItemsFlat } = await import(`file://${path.join(repoRoot, "src/data/pricing.js")}`);
  const calcItems = getPricingItemsFlat();
  const calcByPath = new Map(calcItems.map(i => [i.path, i]));

  // 3. Parsear CSV y comparar
  console.log("🔍 Validando umbrales de magnitud (límite de cambio: " + (MAX_CHANGE_PCT * 100).toFixed(1) + "%)...");
  const rows = parseCsvRows(fs.readFileSync(latestCsvFile, "utf8"));
  const headers = rows[0].map((h) => String(h || "").trim().toLowerCase().replace(/^﻿/, ""));
  
  const colIdx = (...names) => { 
    for (const x of names) { 
      const i = headers.indexOf(x); 
      if (i >= 0) return i; 
    } 
    return -1; 
  };
  
  const iPath = colIdx("path");
  const iVenta = colIdx("venta_local", "venta_bmc_local", "venta_bmc", "venta");
  const iWeb = colIdx("venta_web");
  const iCosto = colIdx("costo");

  if (iPath < 0) {
    console.error("❌ CSV sin columna 'path'. Formato inválido.");
    process.exit(2);
  }

  const num = (v) => {
    if (v == null) return null;
    let s = String(v).replace(/["\s]/g, "").trim();
    if (!s) return null;
    if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
    else if (s.includes(",")) s = s.replace(",", ".");
    const n = parseFloat(s);
    return Number.isNaN(n) ? null : n;
  };

  const anomalies = [];
  let validChangesCount = 0;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const p = (row[iPath] || "").trim();
    if (!p) continue;

    const c = calcByPath.get(p);
    if (!c) continue; // Si no existe en calc, se ignora aquí (el bake también lo ignora).

    const checkField = (csvVal, calcVal, fieldName) => {
      if (csvVal == null || calcVal == null) return;
      if (csvVal < 0) {
        anomalies.push({ path: p, field: fieldName, error: "Valor negativo", val: csvVal });
        return;
      }

      const diff = Math.abs(csvVal - calcVal);
      if (diff > MIN_ABS_DIFF) {
        const pct = calcVal > 0 ? diff / calcVal : Infinity;
        
        if (pct > MAX_CHANGE_PCT || (calcVal === 0 && csvVal > 0)) {
          anomalies.push({
            path: p,
            field: fieldName,
            oldVal: calcVal,
            newVal: csvVal,
            pctChange: pct === Infinity ? "Infinity" : (pct * 100).toFixed(1) + "%",
            error: "Magnitud excedida"
          });
        } else {
          validChangesCount++;
        }
      }
    };

    if (iVenta >= 0) checkField(num(row[iVenta]), c.venta, "venta");
    if (iWeb >= 0) checkField(num(row[iWeb]), c.web, "web");
    if (iCosto >= 0) checkField(num(row[iCosto]), c.costo, "costo");
  }

  // 4. Reporte y Decisión
  if (anomalies.length > 0) {
    console.error(`\n🚨 ¡PELIGRO! Se detectaron ${anomalies.length} anomalías que exceden los límites de seguridad.`);
    console.table(anomalies);
    console.error("❌ ABORTANDO SINCRONIZACIÓN. Revise la MATRIZ por errores de coma decimal o datos fuera de rango.");
    process.exit(1);
  }

  if (validChangesCount === 0) {
    console.log("\n✅ MATRIZ y Base de Código están sincronizados. No hay cambios numéricos que aplicar.");
    process.exit(0);
  }

  console.log(`\n✅ Validaciones exitosas. ${validChangesCount} precios cambiaron dentro del umbral permitido (<${MAX_CHANGE_PCT * 100}%).`);
  console.log("🔥 Ejecutando bake en constantes de código...");

  try {
    execSync(`node scripts/bake-matriz-to-constants.mjs ${latestCsvFile}`, { stdio: "inherit", cwd: repoRoot });
    console.log("\n🎉 Sincronización completada exitosamente. Recuerda hacer commit de src/data/constants.js");
  } catch (err) {
    console.error("❌ Fallo durante la ejecución de bake-matriz-to-constants.mjs");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error en matriz-sync-automation:", err);
  process.exit(1);
});
