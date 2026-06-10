// Offline tests for team-assist rate limiting (S5 Phase A).
// Run: node tests/teamAssistRate.test.js
import assert from "node:assert/strict";
import express from "express";
import http from "node:http";

process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "test-openai-key";

delete process.env.TEAM_ASSIST_RATE_WINDOW_MS;
delete process.env.TEAM_ASSIST_RATE_MAX;

const defaultsModule = await import("../server/routes/teamAssist.js?defaults");

let pass = 0;
let fail = 0;
async function t(name, fn) {
  try {
    await fn();
    pass++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    fail++;
    console.error(`  ❌ ${name}\n     ${err.message}`);
  }
}

console.log("teamAssist — rate limit config");

await t("TEAM_ASSIST_CHAT_RATE has positive window and max", () => {
  assert.ok(defaultsModule.TEAM_ASSIST_CHAT_RATE.windowMs >= 60_000);
  assert.ok(defaultsModule.TEAM_ASSIST_CHAT_RATE.max >= 1);
});

await t("default window is 15 minutes", () => {
  assert.equal(defaultsModule.TEAM_ASSIST_CHAT_RATE.windowMs, 15 * 60 * 1000);
});

await t("default max is 20 requests per window", () => {
  assert.equal(defaultsModule.TEAM_ASSIST_CHAT_RATE.max, 20);
});

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

function postChat(port, xForwardedFor) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      agentId: "orchestrator",
      messages: [{ role: "user", content: "hola" }],
    });
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: "/api/team-assist/chat",
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body),
          "x-forwarded-for": xForwardedFor,
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => { raw += chunk; });
        res.on("end", () => resolve({ status: res.statusCode, raw }));
      }
    );
    req.on("error", reject);
    req.end(body);
  });
}

await t("spoofed first X-Forwarded-For entries do not bypass the proxy-aware limit", async () => {
  process.env.TEAM_ASSIST_RATE_WINDOW_MS = "60000";
  process.env.TEAM_ASSIST_RATE_MAX = "2";
  const { default: teamAssistRouter } = await import("../server/routes/teamAssist.js?limited");

  let openaiCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    openaiCalls++;
    return new Response(
      JSON.stringify({ choices: [{ message: { content: "ok" } }], model: "mock" }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  };

  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use("/api/team-assist", teamAssistRouter);
  const server = await listen(app);
  const port = server.address().port;

  try {
    const statuses = [];
    for (const spoofed of ["198.51.100.1", "198.51.100.2", "198.51.100.3"]) {
      const res = await postChat(port, `${spoofed}, 203.0.113.10`);
      statuses.push(res.status);
    }

    assert.deepEqual(statuses, [200, 200, 429]);
    assert.equal(openaiCalls, 2);
  } finally {
    globalThis.fetch = originalFetch;
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
});

console.log(
  `\n════════════════════════════════════════\nRESULTADOS: ${pass} passed, ${fail} failed, ${pass + fail} total\n════════════════════════════════════════`
);
process.exit(fail === 0 ? 0 : 1);