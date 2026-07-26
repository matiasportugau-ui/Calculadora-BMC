/**
 * CodeQL js/missing-rate-limiting — GET /api/agent/obs-summary is auth-gated
 * and must stay rate-limited (bounds API_AUTH_TOKEN guessing).
 * Run: node tests/obsSummaryRate.test.js
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { OBS_SUMMARY_RATE } from "../server/routes/agentChat.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, "../server/routes/agentChat.js"), "utf8");

assert.ok(OBS_SUMMARY_RATE.windowMs >= 60_000, "windowMs >= 1 min");
assert.ok(OBS_SUMMARY_RATE.max >= 1 && OBS_SUMMARY_RATE.max <= 120, "max in 1..120");

// Route must mount limiter before auth middleware (order matters for brute-force).
const routeSnippet = src.match(
  /router\.get\(\s*["']\/agent\/obs-summary["']\s*,([\s\S]*?),\s*\(req,\s*res\)/,
);
assert.ok(routeSnippet, "obs-summary route registered");
const middlewareChain = routeSnippet[1];
assert.match(middlewareChain, /obsSummaryLimiter/, "obsSummaryLimiter on route");
assert.match(middlewareChain, /requireDevModeAuthMiddleware/, "auth middleware on route");
assert.ok(
  middlewareChain.indexOf("obsSummaryLimiter") <
    middlewareChain.indexOf("requireDevModeAuthMiddleware"),
  "limiter before auth",
);

console.log("obsSummaryRate.test.js: ok");
