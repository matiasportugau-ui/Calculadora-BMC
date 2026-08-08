/**
 * Pins DEFAULT_CORS_ORIGINS for Logística+Store / panelin-workspace local e2e (#875).
 * Pure constant — independent of process.env.CORS_ORIGIN at runtime.
 *
 * Run: node tests/defaultCorsOrigins.test.js
 */
import assert from "node:assert/strict";
import { DEFAULT_CORS_ORIGINS } from "../server/config.js";

let passed = 0;
let failed = 0;
function ok(cond, msg) {
  if (cond) {
    passed += 1;
    console.log("  ✓", msg);
  } else {
    failed += 1;
    console.error("  ✗", msg);
  }
}

console.log("defaultCorsOrigins");

ok(Array.isArray(DEFAULT_CORS_ORIGINS), "is array");
ok(DEFAULT_CORS_ORIGINS.includes("https://calculadora-bmc.vercel.app"), "prod calculadora");
ok(DEFAULT_CORS_ORIGINS.includes("https://panelin-workspace.vercel.app"), "prod panelin-workspace");
ok(DEFAULT_CORS_ORIGINS.includes("http://localhost:5173"), "vite localhost");
ok(DEFAULT_CORS_ORIGINS.includes("http://127.0.0.1:5173"), "vite loopback");
ok(DEFAULT_CORS_ORIGINS.includes("http://localhost:3100"), "workspace e2e :3100");
ok(DEFAULT_CORS_ORIGINS.includes("http://127.0.0.1:3100"), "workspace e2e loopback :3100");
ok(DEFAULT_CORS_ORIGINS.includes("http://localhost:3000"), "workspace Next :3000");
ok(Object.isFrozen(DEFAULT_CORS_ORIGINS), "frozen allow-list");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
