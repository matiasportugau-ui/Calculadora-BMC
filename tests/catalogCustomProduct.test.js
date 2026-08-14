/**
 * POST /api/catalog/custom-product — extras HITL notify (#1038).
 * Soft-auth, fail-open: validation + truncation only. Never blocks the quote.
 * Run: node tests/catalogCustomProduct.test.js
 */
import express from "express";
import { createCatalogCustomProductRouter } from "../server/routes/catalogCustomProduct.js";

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

async function run() {
  console.log("\n═══ catalogCustomProduct ═══");

  const logs = [];
  const logger = {
    info(record, msg) {
      logs.push({ record, msg });
    },
  };

  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use((req, _res, next) => {
    if (req.headers["x-test-user"]) {
      req.user = { email: req.headers["x-test-user"] };
    }
    next();
  });
  app.use("/api", createCatalogCustomProductRouter({}, logger));

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const post = async (body, headers = {}) => {
    const resp = await fetch(`${baseUrl}/api/catalog/custom-product`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await resp.json().catch(() => null);
    return { status: resp.status, json };
  };

  try {
    const missing = await post({});
    assert(missing.status === 400 && missing.json?.ok === false, "empty body → 400");
    assert(String(missing.json?.error || "").includes("titulo"), "error names titulo");

    const blank = await post({ titulo: "   " });
    assert(blank.status === 400, "whitespace titulo → 400");

    logs.length = 0;
    const ok = await post({
      titulo: "Andamio",
      descripcion: "alquiler semanal",
      unidades: "sem",
      precio: "80,5",
      cantidad: 2,
      quotationCode: "QA-EX-001",
    });
    assert(ok.status === 202 && ok.json?.ok === true && ok.json?.notified === true, "valid → 202 notified");
    assert(logs.length === 1 && logs[0].msg === "catalog_custom_product", "logger.info once");
    assert(logs[0].record.titulo === "Andamio", "logs titulo");
    assert(logs[0].record.descripcion === "alquiler semanal", "logs descripcion");
    assert(logs[0].record.precio === "80,5" && logs[0].record.cantidad === 2, "precio/cantidad passthrough");
    assert(logs[0].record.quotationCode === "QA-EX-001", "logs quotationCode");
    assert(logs[0].record.user === null, "anon user is null");

    logs.length = 0;
    const withUser = await post({ titulo: "Mano de obra" }, { "x-test-user": "op@bmc.test" });
    assert(withUser.status === 202 && logs[0].record.user === "op@bmc.test", "req.user.email logged");

    const longTitle = "X".repeat(240);
    const longDesc = "D".repeat(2500);
    logs.length = 0;
    const clipped = await post({ titulo: longTitle, descripcion: longDesc, unidades: "u".repeat(80) });
    assert(clipped.status === 202, "oversize fields still 202");
    assert(logs[0].record.titulo.length === 200, "titulo clipped to 200");
    assert(logs[0].record.descripcion.length === 2000, "descripcion clipped to 2000");
    assert(logs[0].record.unidades.length === 40, "unidades clipped to 40");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  console.log(`\ncatalogCustomProduct: ${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

await run();
