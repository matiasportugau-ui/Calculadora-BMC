// ═══════════════════════════════════════════════════════════════════════════
// Unit test for resolveListenHost() — the host `server/index.js` passes to
// app.listen. Run: node tests/listenHost.test.js
// Offline: injects env; does not boot Express; does not reimplement the helper.
// ═══════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { resolveListenHost } from "../server/lib/listenHost.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const indexSrc = fs.readFileSync(path.join(here, "../server/index.js"), "utf8");

let passed = 0;
let failed = 0;
function assert(name, cond, actual, expected) {
  if (cond) {
    console.log(`  ✅ ${name}`);
    passed += 1;
    return;
  }
  console.log(`  ❌ ${name} — got: ${JSON.stringify(actual)}, expected: ${JSON.stringify(expected)}`);
  failed += 1;
}

console.log("\n═══ listenHost: local loopback vs Cloud Run all-interfaces ═══");

const localHost = resolveListenHost({});
assert(
  "without K_SERVICE, host is loopback",
  localHost === "127.0.0.1",
  localHost,
  "127.0.0.1",
);

const localWithNoise = resolveListenHost({ PATH: "/usr/bin", PORT: "3001", NODE_ENV: "development" });
assert(
  "local env without K_SERVICE stays loopback",
  localWithNoise === "127.0.0.1",
  localWithNoise,
  "127.0.0.1",
);

const cloudHost = resolveListenHost({ K_SERVICE: "panelin-calc" });
assert(
  "with K_SERVICE, host is not forced to loopback",
  cloudHost !== "127.0.0.1" && cloudHost !== "localhost" && cloudHost !== "::1",
  cloudHost,
  "undefined (all interfaces)",
);
assert(
  "with K_SERVICE, host is omitted (all interfaces)",
  cloudHost === undefined,
  cloudHost,
  undefined,
);

const cloudBlank = resolveListenHost({ K_SERVICE: "   " });
assert(
  "whitespace-only K_SERVICE is treated as unset (loopback)",
  cloudBlank === "127.0.0.1",
  cloudBlank,
  "127.0.0.1",
);

assert(
  "index.js imports resolveListenHost from the shipped module",
  /from\s+["']\.\/lib\/listenHost\.js["']/.test(indexSrc) &&
    indexSrc.includes("resolveListenHost"),
  indexSrc.includes("resolveListenHost"),
  true,
);

assert(
  "index.js binds app.listen with the resolved host (or omits it on Cloud Run)",
  /app\.listen\(\s*config\.port\s*,\s*listenHost/.test(indexSrc) ||
    /listenHost\s*\?\s*app\.listen\(config\.port,\s*listenHost/.test(indexSrc),
  /app\.listen\(config\.port/.test(indexSrc),
  "app.listen(config.port, listenHost, …) or ternary omit-host",
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
