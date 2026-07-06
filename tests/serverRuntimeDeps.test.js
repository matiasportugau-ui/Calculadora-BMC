// tests/serverRuntimeDeps.test.js - API image must include server runtime deps.
//
// Cloud Run builds server/Dockerfile with `npm ci --omit=dev`. Any package that
// a server route loads in production must be in dependencies, or that route can
// crash only after deploy even when local dev and CI have devDependencies.

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
    `${name} is loaded by ${importer}; it must be in dependencies, not devDependencies`,
  );
  assert.ok(
    !packageJson.devDependencies?.[name],
    `${name} should not be duplicated in devDependencies because server/Dockerfile omits dev deps`,
  );
}

console.log("serverRuntimeDeps: production runtime dependencies OK");
