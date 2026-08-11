// Bug DP — trusted client IP keys for public/paid AI rate limiters.
// Run: node --test tests/aiRateLimitClientKey.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { clientIpKey } from "../server/lib/rateLimitKeys.js";

describe("clientIpKey (Bug DP)", () => {
  it("uses req.ip and ignores spoofed leading X-Forwarded-For", () => {
    assert.equal(
      clientIpKey({
        ip: "203.0.113.9",
        headers: { "x-forwarded-for": "198.51.100.1, 203.0.113.9" },
        socket: { remoteAddress: "10.0.0.2" },
      }),
      "203.0.113.9",
    );
  });

  it("stable identity across rotated spoof prefixes", () => {
    const base = {
      ip: "203.0.113.9",
      socket: { remoteAddress: "10.0.0.2" },
    };
    assert.equal(
      clientIpKey({ ...base, headers: { "x-forwarded-for": "1.1.1.1, 203.0.113.9" } }),
      clientIpKey({ ...base, headers: { "x-forwarded-for": "9.9.9.9, 203.0.113.9" } }),
    );
  });

  it("falls back to socket.remoteAddress outside Express", () => {
    assert.equal(
      clientIpKey({
        headers: {},
        socket: { remoteAddress: "192.0.2.44" },
      }),
      "192.0.2.44",
    );
  });

  it("returns unknown when no identity is available", () => {
    assert.equal(clientIpKey({ headers: {} }), "unknown");
  });
});
