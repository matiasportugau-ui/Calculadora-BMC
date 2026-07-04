import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createAiGenerationLimiter } from "../server/middleware/aiGenerationLimiter.js";

let server;
let port;

before(async () => {
  const app = express();
  app.set("trust proxy", 1);
  app.get(
    "/limited",
    createAiGenerationLimiter({
      windowMs: 60 * 1000,
      max: 2,
    }),
    (req, res) => res.json({ ok: true, ip: req.ip }),
  );
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
      port = server.address().port;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

const url = () => `http://127.0.0.1:${port}/limited`;

function xff(spoofedFirstHop, trustedClientIp = "203.0.113.9") {
  return { "X-Forwarded-For": `${spoofedFirstHop}, ${trustedClientIp}` };
}

describe("suggest-response AI generation rate limiter", () => {
  it("does not let callers bypass the bucket by rotating the first X-Forwarded-For value", async () => {
    const first = await fetch(url(), { headers: xff("198.51.100.1") });
    assert.equal(first.status, 200);
    assert.equal((await first.json()).ip, "203.0.113.9");

    const second = await fetch(url(), { headers: xff("198.51.100.2") });
    assert.equal(second.status, 200);

    const third = await fetch(url(), { headers: xff("198.51.100.3") });
    assert.equal(third.status, 429);
  });
});
