import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import express from "express";

process.env.API_AUTH_TOKEN = "static_service_token_xyz";

function dockerCopySources(dockerfileText) {
  const sources = [];
  for (const rawLine of dockerfileText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith("COPY ")) continue;
    const parts = line.split(/\s+/).slice(1);
    if (parts.some((part) => part.startsWith("--from="))) continue;
    while (parts[0]?.startsWith("--")) parts.shift();
    if (parts.length < 2) continue;
    sources.push(...parts.slice(0, -1));
  }
  return sources;
}

function dockerignoreTopLevelExcludes(text) {
  return new Set(
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && !line.startsWith("!") && !line.includes("*"))
      .map((line) => line.replace(/\/+$/, "")),
  );
}

describe("deploy and sensitive-route guards", () => {
  it("server Dockerfile only COPYs repo paths that exist and are in the build context", () => {
    const dockerfile = readFileSync("server/Dockerfile", "utf8");
    const ignoredTopLevels = dockerignoreTopLevelExcludes(readFileSync(".dockerignore", "utf8"));

    for (const source of dockerCopySources(dockerfile)) {
      if (source.includes("*") || source.startsWith("/") || source.startsWith("$")) continue;
      const normalized = source.replace(/\/+$/, "");
      const topLevel = normalized.split("/")[0];

      assert.ok(existsSync(normalized), `Dockerfile COPY source must exist: ${source}`);
      assert.ok(
        !ignoredTopLevels.has(topLevel),
        `Dockerfile COPY source is excluded by .dockerignore top-level rule: ${source}`,
      );
    }
  });

  it("financial KPIs require an admin principal", () => {
    const source = readFileSync("server/routes/bmcDashboard.js", "utf8");
    assert.match(source, /requireServiceOrUser\(\{\s*role:\s*["']admin["']\s*\}\)/);
    assert.match(source, /router\.get\(["']\/kpi-financiero["'],\s*requireAdminRead,/);
  });

  it("PDF metrics require an admin principal", () => {
    const source = readFileSync("server/routes/pdf.js", "utf8");
    assert.match(source, /import \{ requireServiceOrUser \} from "\.\.\/middleware\/requireServiceOrUser\.js";/);
    assert.match(source, /router\.get\(["']\/metrics["'],\s*requireServiceOrUser\(\{\s*role:\s*["']admin["']\s*\}\),/);
  });

  it("rejects anonymous callers before serving financial KPIs", async () => {
    const { default: createBmcDashboardRouter } = await import("../server/routes/bmcDashboard.js");
    const app = express();
    app.use("/api", createBmcDashboardRouter({ bmcSheetId: "", bmcPagosSheetId: "" }));
    const server = await new Promise((resolve) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });

    try {
      const baseUrl = `http://127.0.0.1:${server.address().port}`;
      const anonymous = await fetch(`${baseUrl}/api/kpi-financiero`);
      assert.equal(anonymous.status, 401);

      const authenticated = await fetch(`${baseUrl}/api/kpi-financiero`, {
        headers: { Authorization: "Bearer static_service_token_xyz" },
      });
      assert.notEqual(authenticated.status, 401);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it("rejects anonymous callers before serving PDF metrics", async () => {
    const { createPdfRouter } = await import("../server/routes/pdf.js");
    const app = express();
    app.use("/api/pdf", createPdfRouter());
    const server = await new Promise((resolve) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });

    try {
      const baseUrl = `http://127.0.0.1:${server.address().port}`;
      const anonymous = await fetch(`${baseUrl}/api/pdf/metrics`);
      assert.equal(anonymous.status, 401);

      const authenticated = await fetch(`${baseUrl}/api/pdf/metrics`, {
        headers: { Authorization: "Bearer static_service_token_xyz" },
      });
      assert.equal(authenticated.status, 200);
      assert.equal((await authenticated.json()).ok, true);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
