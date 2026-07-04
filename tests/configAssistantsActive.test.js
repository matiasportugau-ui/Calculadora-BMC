// ASSISTANTS_ACTIVE config parsing — offline regression coverage.
// The Cloud Run deploy action splits env_vars on commas, so production uses
// semicolon-separated repo Variables such as `canales;ml;panelin`.
// Run: node tests/configAssistantsActive.test.js

import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

const configUrl = pathToFileURL(new URL("../server/config.js", import.meta.url).pathname).href;
const cleanCwd = mkdtempSync(`${tmpdir()}/bmc-config-test-`);

let passed = 0;
let failed = 0;

function assertEqual(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`  ✅ ${name}`);
    passed += 1;
  } else {
    console.error(`  ❌ ${name}`);
    console.error(`     expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failed += 1;
  }
}

function loadAssistantsActive(envOverrides = {}) {
  const env = { ...process.env, ...envOverrides };
  for (const key of ["ASSISTANTS_ACTIVE", "APP_ENV", "NODE_ENV"]) {
    if (envOverrides[key] === undefined) delete env[key];
  }

  const output = execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import { config } from ${JSON.stringify(configUrl)}; process.stdout.write(JSON.stringify(config.assistantsActive));`,
    ],
    {
      cwd: cleanCwd,
      env,
      encoding: "utf8",
    },
  );
  return JSON.parse(output);
}

assertEqual(
  "semicolon-separated production variable preserves all assistants",
  loadAssistantsActive({ APP_ENV: "production", ASSISTANTS_ACTIVE: "canales;ml;panelin" }),
  ["canales", "ml", "panelin"],
);

assertEqual(
  "mixed separators trim blanks and normalize case",
  loadAssistantsActive({ APP_ENV: "production", ASSISTANTS_ACTIVE: " Canales, ML ; Panelin ; " }),
  ["canales", "ml", "panelin"],
);

assertEqual(
  "production default remains canales-only",
  loadAssistantsActive({ APP_ENV: "production" }),
  ["canales"],
);

assertEqual(
  "development default enables the local assistant suite",
  loadAssistantsActive({ APP_ENV: "development" }),
  ["canales", "panelin", "email", "wa", "ml", "wolfboard"],
);

console.log(`\nconfigAssistantsActive: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
