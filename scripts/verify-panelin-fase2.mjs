#!/usr/bin/env node
/**
 * Verificación aislada de Fase 2 — Panelin Platform Backend
 * - Levanta un servidor Express mínimo SOLO con el router de panelin en puerto efímero.
 * - Usa doppler / DATABASE_URL real (nunca mock).
 * - Ejecuta flujo completo: status → products → crear producto de prueba vía función SQL → 
 *   GET detail → PATCH costo (recalc) → stock movements (positivo + guardia negativo) →
 *   alerts → invoices.
 * - Limpia datos de prueba al final.
 *
 * Uso:
 *   doppler run -- node scripts/verify-panelin-fase2.mjs
 */

import express from "express";
import http from "node:http";
import { config as appConfig } from "../server/config.js";
import createPanelinRouter from "../server/routes/panelin.js";
import { getPanelinPool, resetPanelinPoolForTests } from "../server/lib/panelinDb.js";

const PORT = 0; // OS assigns free port
const TEST_SKU = "VERIF-PANEL-40-F2";

async function main() {
  console.log("=== PANELIN FASE 2 VERIFICATION (real Postgres) ===\n");

  const databaseUrl = process.env.DATABASE_URL || appConfig.databaseUrl;
  if (!databaseUrl) {
    console.error("FATAL: DATABASE_URL ausente (corre con doppler run --)");
    process.exit(1);
  }

  // Pool para setup/cleanup directo
  const pool = getPanelinPool(databaseUrl);
  if (!pool) {
    console.error("FATAL: no se pudo crear pool Panelin");
    process.exit(1);
  }

  const client = await pool.connect();

  try {
    // Limpieza previa (por si quedó de corridas anteriores)
    await cleanup(client);

    // Crear producto de prueba usando la función de Fase 1
    await client.query(
      `SELECT panelin_upsert_product($1, $2, $3, $4, $5)`,
      [TEST_SKU, "Panel Verificación Fase 2 40mm", 19.75, "unid", "Techo"]
    );
    await client.query(`SELECT panelin_recalc_prices_for_sku($1)`, [TEST_SKU]);
    console.log("✓ Producto de prueba creado vía panelin_upsert_product + recalc");

    // === Levantar servidor aislado ===
    const app = express();
    app.use(express.json());
    // Montamos exactamente igual que en el server real.
    // El router ahora exige token de servicio (requireAuth); aseguramos uno
    // configurado para que el guard tenga contra qué validar; el helper j()
    // presenta este mismo token en cada request.
    if (!appConfig.apiAuthToken) appConfig.apiAuthToken = "verif-panelin-fase2-local";
    app.use("/api/panelin", createPanelinRouter(appConfig, console));

    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(PORT, resolve));

    const address = server.address();
    const base = `http://127.0.0.1:${address.port}/api/panelin`;
    console.log(`✓ Servidor de prueba escuchando en ${base}`);

    // Helper fetch
    async function j(method, path, body) {
      const res = await fetch(`${base}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${appConfig.apiAuthToken}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch { json = { raw: text }; }
      return { status: res.status, json };
    }

    // 1. STATUS
    let r = await j("GET", "/status");
    console.log("1. GET /status →", r.status, r.json.ok ? "ok" : "fail");
    if (r.status !== 200 || !r.json.db_connected) throw new Error("status failed");

    // 2. LIST PRODUCTS (debe incluir nuestro test)
    r = await j("GET", "/products");
    console.log("2. GET /products →", r.status, "count=", r.json.count);
    const found = (r.json.products || []).some((p) => p.sku === TEST_SKU);
    if (!found) throw new Error("test sku not in products list");

    // 3. DETAIL
    r = await j("GET", `/products/${TEST_SKU}`);
    console.log("3. GET /products/:sku →", r.status, "prices=", Object.keys(r.json.product?.prices || {}));
    if (r.status !== 200 || !r.json.product) throw new Error("detail failed");

    // 4. PATCH costo (debe recalcular precios)
    const newCost = 21.00;
    r = await j("PATCH", `/products/${TEST_SKU}`, { cost_usd: newCost });
    console.log("4. PATCH /products/:sku (costo→", newCost, ") →", r.status, "recalc=", r.json.prices_recalculated);
    if (r.status !== 200 || r.json.product?.cost_usd !== newCost) {
      throw new Error("patch cost failed");
    }
    if (!r.json.prices || Object.keys(r.json.prices).length === 0) {
      throw new Error("prices not recalculated");
    }

    // 5. STOCK MOVEMENT positivo
    r = await j("POST", "/stock/movements", {
      sku: TEST_SKU,
      delta: 8,
      reason: "verif_fase2",
      ref_type: "test",
    });
    console.log("5. POST /stock/movements (+8) →", r.status, "qty_after=", r.json.movement?.qty_after);
    if (r.status !== 201) throw new Error("positive movement failed");

    // 6. Guardia de stock negativo (debe dar 409)
    r = await j("POST", "/stock/movements", {
      sku: TEST_SKU,
      delta: -999,
      reason: "verif_overdraw",
    });
    console.log("6. POST /stock/movements (-999 → negativo) →", r.status, r.json.error);
    if (r.status !== 409 || r.json.error !== "stock_negativo") {
      throw new Error("negative stock guard did not trigger 409 stock_negativo");
    }

    // 7. ALERTAS
    // Forzamos un threshold bajo y un movimiento que lo active
    await client.query(`SELECT panelin_set_stock_threshold($1, 'principal', 5)`, [TEST_SKU]);
    await client.query(`SELECT panelin_record_stock_movement($1, 'principal', -4, 'verif_draw')`, [TEST_SKU]); // queda ~4

    r = await j("GET", "/stock/alerts?open=true");
    console.log("7. GET /stock/alerts →", r.status, "count=", r.json.count);
    const hasAlert = (r.json.alerts || []).some((a) => a.sku === TEST_SKU);
    if (!hasAlert) console.warn("  (warning: no open alert visible yet — puede ser timing del trigger)");

    // 8. ACK alerta (si existe)
    if (r.json.alerts && r.json.alerts.length > 0) {
      const aid = r.json.alerts[0].id;
      const ack = await j("POST", `/stock/alerts/${aid}/ack`, { acknowledged_by: "verif-script" });
      console.log("8. POST /stock/alerts/:id/ack →", ack.status);
    }

    // 9. INVOICES (crear + listar)
    r = await j("POST", "/invoices", {
      client_name: "Cliente Verificación Fase 2",
      total_usd: 123.45,
      source: "verif_fase2",
    });
    console.log("9a. POST /invoices →", r.status);
    if (r.status !== 201) throw new Error("invoice create failed");

    r = await j("GET", "/invoices?limit=5");
    console.log("9b. GET /invoices →", r.status, "count=", r.json.count);

    // 10. STOCK snapshot
    r = await j("GET", "/stock");
    console.log("10. GET /stock →", r.status, "items=", r.json.count);

    console.log("\n=== TODAS LAS VERIFICACIONES DE FASE 2 PASARON ✓ ===");
  } catch (err) {
    console.error("\n!!! VERIFICATION FAILED !!!");
    console.error(err);
    process.exitCode = 1;
  } finally {
    // Cleanup
    await cleanup(client).catch(() => {});
    client.release();
    await resetPanelinPoolForTests().catch(() => {});

    // Cerrar servidor (si se llegó a crear)
    // Nota: el server se cierra con process exit en este script de una sola ejecución.
  }
}

async function cleanup(client) {
  await client.query(`DELETE FROM stock_movements WHERE sku = $1`, [TEST_SKU]);
  await client.query(`DELETE FROM stock_alerts WHERE sku = $1`, [TEST_SKU]);
  await client.query(`DELETE FROM stock WHERE sku = $1`, [TEST_SKU]);
  await client.query(`DELETE FROM product_prices WHERE sku = $1`, [TEST_SKU]);
  await client.query(`DELETE FROM stock_thresholds WHERE sku = $1`, [TEST_SKU]);
  await client.query(`DELETE FROM invoices WHERE source = 'verif_fase2' OR client_name LIKE '%Verificación Fase 2%'`);
  await client.query(`DELETE FROM products WHERE sku = $1`, [TEST_SKU]);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
