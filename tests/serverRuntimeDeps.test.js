// Guard production-only installs used by server/Dockerfile (npm ci --omit=dev).
// Server code must not import packages that are available only as devDependencies.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

function assertRuntimeDependency(name) {
  assert.ok(
    pkg.dependencies?.[name],
    `${name} is imported by server runtime code and must be listed in dependencies`
  );
  assert.equal(
    pkg.devDependencies?.[name],
    undefined,
    `${name} must not be dev-only because server/Dockerfile installs with --omit=dev`
  );
}

assertRuntimeDependency('playwright');

