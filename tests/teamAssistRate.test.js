// Offline tests for team-assist rate limit config (S5 Phase A) + Bug DP key hardening.
// Run: node tests/teamAssistRate.test.js
import assert from "node:assert/strict";
import express from "express";
import rateLimit from "express-rate-limit";
import {
  TEAM_ASSIST_CHAT_RATE,
  teamAssistClientKey,
} from "../server/routes/teamAssist.js";
import { clientIpKey } from "../server/lib/rateLimitKeys.js";

let pass = 0;
let fail = 0;
function t(name, fn) {
  try {
    const out = fn();
    if (out && typeof out.then === "function") {
      return out
        .then(() => {
          pass++;
          console.log(`  ✅ ${name}`);
        })
        .catch((err) => {
          fail++;
          console.error(`  ❌ ${name}\n     ${err.message}`);
        });
    }
    pass++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    fail++;
    console.error(`  ❌ ${name}\n     ${err.message}`);
  }
}

console.log("teamAssist — rate limit config");

await t("TEAM_ASSIST_CHAT_RATE has positive window and max", () => {
  assert.ok(TEAM_ASSIST_CHAT_RATE.windowMs >= 60_000);
  assert.ok(TEAM_ASSIST_CHAT_RATE.max >= 1);
});

await t("default window is 15 minutes", () => {
  assert.equal(TEAM_ASSIST_CHAT_RATE.windowMs, 15 * 60 * 1000);
});

await t("default max is 20 requests per window", () => {
  assert.equal(TEAM_ASSIST_CHAT_RATE.max, 20);
});

await t("clientIpKey prefers Express req.ip over spoofed XFF prefix", () => {
  const a = clientIpKey({
    ip: "203.0.113.9",
    headers: { "x-forwarded-for": "198.51.100.1, 203.0.113.9" },
    socket: { remoteAddress: "10.0.0.1" },
  });
  const b = clientIpKey({
    ip: "203.0.113.9",
    headers: { "x-forwarded-for": "198.51.100.99, 203.0.113.9" },
    socket: { remoteAddress: "10.0.0.1" },
  });
  assert.equal(a, "203.0.113.9");
  assert.equal(b, "203.0.113.9");
  assert.equal(a, b);
});

await t("teamAssistClientKey ignores rotated XFF spoof prefixes", () => {
  const k1 = teamAssistClientKey({
    ip: "203.0.113.50",
    headers: { "x-forwarded-for": "1.1.1.1, 203.0.113.50" },
    socket: { remoteAddress: "127.0.0.1" },
  });
  const k2 = teamAssistClientKey({
    ip: "203.0.113.50",
    headers: { "x-forwarded-for": "2.2.2.2, 203.0.113.50" },
    socket: { remoteAddress: "127.0.0.1" },
  });
  assert.equal(k1, k2);
  assert.equal(k1, "203.0.113.50");
});

await t("clientIpKey falls back to socket when req.ip missing", () => {
  assert.equal(
    clientIpKey({
      headers: { "x-forwarded-for": "8.8.8.8" },
      socket: { remoteAddress: "192.0.2.10" },
    }),
    "192.0.2.10",
  );
});

await t("live limiter: spoofed XFF prefixes share one bucket (Bug DP)", async () => {
  const app = express();
  app.set("trust proxy", 1);
  app.use(
    rateLimit({
      windowMs: 60_000,
      max: 2,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: clientIpKey,
      validate: { keyGeneratorIpFallback: false },
      message: { ok: false, error: "rate_limited" },
    }),
  );
  app.post("/probe", (_req, res) => res.status(503).json({ ok: false, error: "no_ai" }));

  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const { port } = server.address();

  async function hit(xff) {
    const res = await fetch(`http://127.0.0.1:${port}/probe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": xff,
      },
      body: "{}",
    });
    return res.status;
  }

  try {
    // With trust proxy=1, Express req.ip is the rightmost client hop before the
    // trusted proxy. Spoofed prefixes must not mint fresh buckets.
    const s1 = await hit("198.51.100.1, 203.0.113.77");
    const s2 = await hit("198.51.100.2, 203.0.113.77");
    const s3 = await hit("198.51.100.3, 203.0.113.77");
    assert.equal(s1, 503);
    assert.equal(s2, 503);
    assert.equal(s3, 429);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

console.log(
  `\n════════════════════════════════════════\nRESULTADOS: ${pass} passed, ${fail} failed, ${pass + fail} total\n════════════════════════════════════════`,
);
process.exit(fail === 0 ? 0 : 1);
