/**
 * PEA routes smoke (offline, no DB).
 * Run: node tests/peaRoutes.test.js
 */
import express from "express";
import createPeaRouter from "../server/routes/pea.js";

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

const config = {
  databaseUrl: "",
  peaEnabled: false,
  peaWorkerEnabled: false,
  peaAutoDiagnose: false,
  peaWorkerBatchSize: 2,
  peaMaxConcurrency: 2,
};

async function run() {
  const app = express();
  app.use(express.json());
  app.use("/api", createPeaRouter(config, console));

  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}/api`;

  try {
    const healthRes = await fetch(`${base}/pea/health`);
    const health = await healthRes.json();
    assert(healthRes.status === 200, "health 200");
    assert(health.pea_enabled === false, "pea disabled");
    assert(health.schema_version === "pea-002", "schema version");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  console.log(`\npeaRoutes: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
