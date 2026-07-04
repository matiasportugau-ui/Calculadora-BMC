import { describe, it } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import rateLimit from "express-rate-limit";
import { clientIpKey } from "../server/lib/rateLimitKeys.js";

async function withLimitedServer(fn) {
  const app = express();
  app.set("trust proxy", 1);
  app.use(rateLimit({
    windowMs: 60_000,
    max: 3,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: clientIpKey,
    message: { ok: false, error: "rate_limited" },
  }));
  app.post("/ai", (_req, res) => res.json({ ok: true }));

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function postWithXff(baseUrl, xff) {
  return fetch(`${baseUrl}/ai`, {
    method: "POST",
    headers: { "X-Forwarded-For": xff },
  });
}

describe("AI generation rate-limit client key", () => {
  it("does not trust spoofed leading X-Forwarded-For hops", async () => {
    await withLimitedServer(async (baseUrl) => {
      const statuses = [];
      for (let i = 0; i < 5; i += 1) {
        const response = await postWithXff(baseUrl, `203.0.113.${i}, 198.51.100.10`);
        statuses.push(response.status);
      }

      assert.deepEqual(statuses, [200, 200, 200, 429, 429]);
    });
  });

  it("still separates genuinely different proxy-resolved client IPs", async () => {
    await withLimitedServer(async (baseUrl) => {
      for (let i = 0; i < 3; i += 1) {
        const response = await postWithXff(baseUrl, `203.0.113.${i}, 198.51.100.10`);
        assert.equal(response.status, 200);
      }

      const differentClient = await postWithXff(baseUrl, "203.0.113.99, 198.51.100.11");
      assert.equal(differentClient.status, 200);
    });
  });
});
