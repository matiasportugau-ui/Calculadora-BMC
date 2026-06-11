#!/usr/bin/env node
/**
 * Panelin BMC Platform v1 — Sync precios desde MATRIZ de COSTOS y VENTAS 2026 → PostgreSQL
 *
 * Uso:
 *   doppler run -- node scripts/panelin-sync-precios.mjs --dry-run
 *   doppler run -- node scripts/panelin-sync-precios.mjs
 *   doppler run -- node scripts/panelin-sync-precios.mjs --tab "BROMYROS" --limit 50
 *
 * Columnas especificadas por el usuario (G/J/K/R/S):
 *   G = Costo m² USD ex IVA
 *   J = Venta local USD ex IVA
 *   K = Ref. consumidor c/IVA
 *   R = Venta web USD ex IVA
 *   S = Venta web USD c/IVA
 *
 * SKU siempre desde col D (estándar MATRIZ).
 * Nombre/descripción desde col E ("Producto").
 *
 * Escribe en:
 *   - products (upsert vía panelin_upsert_product)
 *   - product_prices (directo para venta_local y venta_web, source='matriz')
 *
 * Idempotente. Soporta --dry-run. Logging claro.
 */

import "dotenv/config";
import { google } from "googleapis";
import path from "node:path";
import fs from "node:fs";
import { getPanelinPool } from "../server/lib/panelinDb.js";
import { config as appConfig } from "../server/config.js";

const DEFAULT_MATRIZ_ID = "1oDMkBgWxX7cu7TpSvuO30tCTUWl68IBDhC4cQTP79Xo";
const TABS_TO_SYNC = ["BROMYROS", "R y C Tornillos"]; // ampliable

// 0-based indices para las columnas pedidas (G=6, J=9, K=10, R=17, S=18)
const COL = {
  sku: 3,           // D
  descripcion: 4,   // E
  costo: 6,         // G
  ventaLocal: 9,    // J
  refConsumidor: 10,// K
  ventaWeb: 17,     // R
  ventaWebIva: 18,  // S
};

function parseNum(v) {
  if (v == null || v === "") return null;
  let s = String(v).trim().replace(/\s/g, "");
  if (!s) return null;
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function getAuth() {
  const credsRaw = process.env.GOOGLE_APPLICATION_CREDENTIALS || appConfig.googleApplicationCredentials || "";
  if (credsRaw.trim().startsWith("{")) {
    const creds = JSON.parse(credsRaw);
    return new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
  }
  const resolved = path.isAbsolute(credsRaw) ? credsRaw : path.resolve(process.cwd(), credsRaw);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Credenciales Google no encontradas en ${resolved}`);
  }
  return new google.auth.GoogleAuth({
    keyFile: resolved,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

async function syncTab(sheets, matrizId, tabName, client, dryRun, limit) {
  console.log(`\n→ Leyendo tab "${tabName}" (columnas G/J/K/R/S + D/E)...`);

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: matrizId,
    range: `'${tabName}'!A1:Z600`, // suficiente para la MATRIZ actual
  });

  const allRows = res.data.values || [];
  if (allRows.length < 2) {
    console.log(`  (sin filas de datos en ${tabName})`);
    return { processed: 0, upserts: 0, priceUpdates: 0 };
  }

  const dataRows = allRows.slice(1);
  let processed = 0;
  let upserts = 0;
  let priceUpdates = 0;

  for (const row of dataRows) {
    if (limit && processed >= limit) break;

    let sku = (row[COL.sku] || "").toString().trim().toUpperCase().replace(/\s+/g, "");
    if (!sku || sku === "PENDIENTE" || sku.length < 3) continue;
    // Heurística adicional: si no hay al menos un valor de precio útil, saltar filas de relleno
    const hasAnyPrice = parseNum(row[COL.costo]) != null || parseNum(row[COL.ventaLocal]) != null || parseNum(row[COL.ventaWeb]) != null;
    if (!hasAnyPrice) continue;

    const name = row[COL.descripcion] || sku;
    const costo = parseNum(row[COL.costo]);
    const ventaLocal = parseNum(row[COL.ventaLocal]);
    const refIva = parseNum(row[COL.refConsumidor]);
    const ventaWeb = parseNum(row[COL.ventaWeb]);
    const ventaWebIva = parseNum(row[COL.ventaWebIva]);

    processed++;

    if (dryRun) {
      console.log(`  [DRY] ${sku} | costo=${costo} | local=${ventaLocal} | web=${ventaWeb} | name="${String(name).slice(0,40)}"`);
      continue;
    }

    // 1. Upsert producto + costo (usa función robusta de Fase 1)
    // Pasamos explícitamente p_active + p_meta para garantizar que meta nunca sea null
    await client.query(
      `SELECT panelin_upsert_product($1, $2, $3, $4, $5, true, '{}'::jsonb)`,
      [sku, name, costo != null ? costo : 0, "unid", tabName]
    );
    upserts++;

    // 2. Escribir precios exactos desde la MATRIZ en las listas (no usamos recalc aquí)
    // venta_local (código 'venta_local')
    if (ventaLocal != null) {
      await client.query(`
        INSERT INTO product_prices (sku, price_list_id, price_usd, source)
        SELECT $1, pl.id, $2, 'matriz'
        FROM price_lists pl
        WHERE pl.code = 'venta_local'
        ON CONFLICT (sku, price_list_id) DO UPDATE SET
          price_usd = EXCLUDED.price_usd,
          source = 'matriz',
          updated_at = now()
      `, [sku, ventaLocal]);
      priceUpdates++;
    }

    // venta_web (código 'venta_web')
    if (ventaWeb != null) {
      await client.query(`
        INSERT INTO product_prices (sku, price_list_id, price_usd, source)
        SELECT $1, pl.id, $2, 'matriz'
        FROM price_lists pl
        WHERE pl.code = 'venta_web'
        ON CONFLICT (sku, price_list_id) DO UPDATE SET
          price_usd = EXCLUDED.price_usd,
          source = 'matriz',
          updated_at = now()
      `, [sku, ventaWeb]);
      priceUpdates++;
    }

    // Opcional: guardar ref consumidor y web c/IVA en meta del producto (útil para dashboard)
    if (refIva != null || ventaWebIva != null) {
      await client.query(`
        UPDATE products
        SET meta = jsonb_set(
          jsonb_set(
            coalesce(meta, '{}'::jsonb),
            '{ref_consumidor_iva_inc}',
            to_jsonb($2::numeric)
          ),
          '{venta_web_iva_inc}',
          to_jsonb($3::numeric)
        )
        WHERE sku = $1
      `, [sku, refIva, ventaWebIva]);
    }
  }

  return { processed, upserts, priceUpdates };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const limitArg = args.find(a => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : null;
  let onlyTab = null;
  const tabEq = args.find(a => a.startsWith("--tab="));
  if (tabEq) onlyTab = tabEq.split("=")[1];
  else {
    const tabIdx = args.indexOf("--tab");
    if (tabIdx !== -1 && args[tabIdx + 1]) onlyTab = args[tabIdx + 1];
  }

  console.log("=== Panelin Sync Precios desde MATRIZ (G/J/K/R/S) ===");
  console.log(`Dry-run: ${dryRun}`);
  if (limit) console.log(`Limit: ${limit} filas por tab`);
  if (onlyTab) console.log(`Solo tab: ${onlyTab}`);

  const matrizId = process.env.BMC_MATRIZ_SHEET_ID || appConfig.bmcMatrizSheetId || DEFAULT_MATRIZ_ID;
  const databaseUrl = process.env.DATABASE_URL || appConfig.databaseUrl;
  if (!databaseUrl) {
    console.error("ERROR: DATABASE_URL requerido (usa doppler run --)");
    process.exit(1);
  }

  const pool = getPanelinPool(databaseUrl);
  if (!pool) {
    console.error("ERROR: No se pudo inicializar pool de Panelin DB");
    process.exit(1);
  }

  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth: await auth.getClient() });

  const tabs = onlyTab ? [onlyTab] : TABS_TO_SYNC;

  const client = await pool.connect();

  try {
    let grandProcessed = 0;
    let grandUpserts = 0;
    let grandPrices = 0;

    for (const tab of tabs) {
      const stats = await syncTab(sheets, matrizId, tab, client, dryRun, limit);
      grandProcessed += stats.processed;
      grandUpserts += stats.upserts;
      grandPrices += stats.priceUpdates;
    }

    console.log(`\n=== RESUMEN ===`);
    console.log(`Filas procesadas: ${grandProcessed}`);
    if (!dryRun) {
      console.log(`Productos upsert: ${grandUpserts}`);
      console.log(`Actualizaciones de precios (venta_local + venta_web): ${grandPrices}`);
      console.log(`\nSync completado. Los productos ya están en la DB de Panelin con precios de la MATRIZ.`);
    } else {
      console.log(`(Dry-run: nada escrito. Quita --dry-run para aplicar.)`);
    }
  } catch (err) {
    console.error("ERROR en sync:", err);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

main();
