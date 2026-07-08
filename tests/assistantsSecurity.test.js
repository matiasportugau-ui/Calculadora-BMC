// Guardrails for the AI assistant control-plane routes.
import fs from "node:fs";
import assert from "node:assert/strict";

const source = fs.readFileSync(new URL("../server/index.js", import.meta.url), "utf8");

assert(
  !/app\.use\(\s*cookieParser\(\)\s*\)/.test(source),
  "cookieParser must not be mounted globally before non-cookie API mutators",
);

assert(
  /app\.use\("\/api",\s*cookieParser\(\),\s*authGoogleRouter\)/.test(source),
  "cookieParser stays scoped to the identity auth router that reads refresh cookies",
);

console.log("✅ assistantsSecurity: cookie parser is scoped to auth router");
