// Productos Maestro auth regression test.
// Ensures product-link writes cannot mutate the local mapping without API_AUTH_TOKEN.
//
// Run: node tests/productosMaestroAuth.test.js

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import express from "express";
import createBmcDashboardRouter from "../server/routes/bmcDashboard.js";

const LINKS_FILE = path.resolve(process.cwd(), ".runtime/product-links.json");
const TOKEN = "test-productos-maestro-token";

let passed = 0;
let failed = 0;

function assert(name, cond, detail = "") {
  if (cond) {
    console.log(`  ✅ ${name}`);
    passed += 1;
  } else {
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
    failed += 1;
  }
}

function readLinksFile() {
  try {
    return fs.readFileSync(LINKS_FILE, "utf8");
  } catch {
    return null;
  }
}

function requestJson(port, method, route, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        method,
        path: route,
        headers: {
          "Content-Type": "application/json",
          ...headers,
          ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let chunks = "";
        res.on("data", (d) => (chunks += d));
        res.on("end", () => {
          let parsed = null;
          try {
            parsed = chunks ? JSON.parse(chunks) : null;
          } catch {
            parsed = { raw: chunks };
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      },
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function withServer(routerConfig, fn) {
  const app = express();
  app.use(express.json());
  app.use("/api", createBmcDashboardRouter(routerConfig));

  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  // Productos Maestro routes are registered from an async import inside the router factory.
  await new Promise((resolve) => setTimeout(resolve, 25));
  try {
    return await fn(server.address().port);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function main() {
  console.log("\n═══ Productos Maestro · auth regression ═══");

  const before = readLinksFile();

  try {
    await withServer({ apiAuthToken: "" }, async (port) => {
      const r = await requestJson(port, "PUT", "/api/productos-maestro/links", {
        links: { SHOULD_NOT_WRITE: "NO_TOKEN" },
      });
      assert("PUT links without configured token → 503", r.status === 503, `status=${r.status}`);
      assert(
        "missing token does not write links file",
        readLinksFile() === before,
        "file content changed",
      );
    });

    await withServer({ apiAuthToken: TOKEN }, async (port) => {
      const r = await requestJson(port, "PUT", "/api/productos-maestro/links", {
        links: { SHOULD_NOT_WRITE: "NO_BEARER" },
      });
      assert("PUT links without bearer → 401", r.status === 401, `status=${r.status}`);
      assert(
        "unauthorized request does not write links file",
        readLinksFile() === before,
        "file content changed",
      );

      const ok = await requestJson(
        port,
        "PUT",
        "/api/productos-maestro/links",
        { links: { TEST_SKU_AUTH: "TEST_STOCK_AUTH" } },
        { Authorization: `Bearer ${TOKEN}` },
      );
      assert("PUT links with valid bearer → 200", ok.status === 200, `status=${ok.status}`);
      assert("authorized write succeeds", ok.body?.ok === true, JSON.stringify(ok.body));
    });
  } finally {
    if (before === null) {
      fs.rmSync(LINKS_FILE, { force: true });
    } else {
      fs.mkdirSync(path.dirname(LINKS_FILE), { recursive: true });
      fs.writeFileSync(LINKS_FILE, before, "utf8");
    }
  }

  console.log(`\nProductos Maestro auth: ${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
