import assert from "node:assert/strict";
import { describe, it } from "node:test";
import express from "express";
import createPanelinRouter from "../server/routes/panelin.js";

async function withPanelinApp(config, fn) {
  const app = express();
  app.use(express.json());
  app.use("/api/panelin", createPanelinRouter(config, { error() {}, warn() {} }));

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  try {
    const { port } = server.address();
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

describe("Panelin route authentication", () => {
  it("rejects mutating requests before touching the database when no token is provided", async () => {
    await withPanelinApp({ apiAuthToken: "secret", databaseUrl: "" }, async (base) => {
      const res = await fetch(`${base}/api/panelin/stock/movements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku: "PANEL-40", delta: 1 }),
      });

      assert.equal(res.status, 401);
      assert.equal((await res.json()).error, "Unauthorized");
    });
  });

  it("allows read requests without the write token", async () => {
    await withPanelinApp({ apiAuthToken: "secret", databaseUrl: "" }, async (base) => {
      const res = await fetch(`${base}/api/panelin/status`);

      assert.equal(res.status, 503);
      assert.equal((await res.json()).error, "panelin_db_unavailable");
    });
  });

  it("lets authenticated mutating requests proceed to the database layer", async () => {
    await withPanelinApp({ apiAuthToken: "secret", databaseUrl: "" }, async (base) => {
      const res = await fetch(`${base}/api/panelin/stock/movements`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer secret",
        },
        body: JSON.stringify({ sku: "PANEL-40", delta: 1 }),
      });

      assert.equal(res.status, 503);
      assert.equal((await res.json()).error, "panelin_db_unavailable");
    });
  });
});
