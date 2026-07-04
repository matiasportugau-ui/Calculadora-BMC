// tests/serverRuntimeDeps.test.js - API image must include statically imported server deps
//
// Cloud Run builds server/Dockerfile with `npm ci --omit=dev`. Any package that
// is statically imported by server/index.js or its route graph must be available
// in production dependencies, or the API image can crash before /health exists.

import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const serverDockerfile = readFileSync(new URL("../server/Dockerfile", import.meta.url), "utf8");

assert.match(
  serverDockerfile,
  /npm (ci|install) --omit=dev/,
  "server/Dockerfile should keep using a production-only install for the API image",
);

const runtimeImports = [
  {
    name: "playwright",
    importer: "server/lib/marketIntel/keywordSerpPlaywright.js",
  },
];

for (const { name, importer } of runtimeImports) {
  assert.ok(
    packageJson.dependencies?.[name],
    `${name} is statically imported by ${importer}; it must be in dependencies, not devDependencies`,
  );
}

console.log("serverRuntimeDeps: production runtime dependencies OK");
