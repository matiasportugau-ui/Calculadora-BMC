// Regression test for scripts/wa-refresh-access-token.sh.
// Run: node --test tests/waRefreshAccessTokenScript.test.js

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, chmodSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function writeExecutable(filePath, contents) {
  writeFileSync(filePath, contents);
  chmodSync(filePath, 0o755);
}

function serviceJson(env) {
  return JSON.stringify({
    spec: {
      template: {
        spec: {
          containers: [{ env }],
        },
      },
    },
  });
}

describe("wa-refresh-access-token.sh", () => {
  it("rolls Cloud Run after writing the new GSM secret version", () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), "wa-refresh-token-"));
    try {
      const binDir = path.join(tmpDir, "bin");
      const logPath = path.join(tmpDir, "calls.jsonl");
      mkdirSync(binDir);

      writeExecutable(
        path.join(binDir, "curl"),
        `#!/usr/bin/env node
import { appendFileSync } from "node:fs";
const args = process.argv.slice(2);
appendFileSync(process.env.STUB_LOG, JSON.stringify({ cmd: "curl", args }) + "\\n");
if (args.some((arg) => arg.includes("graph.facebook.com")) && args.some((arg) => arg.includes("/me?fields=id"))) {
  process.stdout.write('{"id":"meta-test"}');
  process.exit(0);
}
console.error("unexpected curl args", args.join(" "));
process.exit(64);
`
      );

      writeExecutable(
        path.join(binDir, "gcloud"),
        `#!/usr/bin/env node
import { appendFileSync, readFileSync } from "node:fs";
const args = process.argv.slice(2);
const record = { cmd: "gcloud", args };
if (args[0] === "secrets" && args[1] === "versions" && args[2] === "add") {
  record.stdin = readFileSync(0, "utf8");
}
appendFileSync(process.env.STUB_LOG, JSON.stringify(record) + "\\n");

if (args[0] === "secrets" && args[1] === "describe") process.exit(0);
if (args[0] === "secrets" && args[1] === "versions" && args[2] === "add") process.exit(0);

if (args[0] === "run" && args[1] === "services" && args[2] === "describe") {
  const formatArg = args.find((arg) => arg.startsWith("--format=")) || "";
  if (formatArg === "--format=json") {
    process.stdout.write(process.env.STUB_SERVICE_JSON);
    process.exit(0);
  }
  if (formatArg.includes("latestReadyRevisionName")) {
    process.stdout.write("panelin-calc-00042-test\\n");
    process.exit(0);
  }
  if (formatArg.includes("status.url")) {
    process.stdout.write("https://panelin.test\\n");
    process.exit(0);
  }
}

if (args[0] === "run" && args[1] === "services" && args[2] === "update") process.exit(0);

console.error("unexpected gcloud args", args.join(" "));
process.exit(64);
`
      );

      const token = `EAA${"x".repeat(140)}`;
      const result = spawnSync("bash", ["scripts/wa-refresh-access-token.sh", token], {
        cwd: repoRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
          STUB_LOG: logPath,
          STUB_SERVICE_JSON: serviceJson([
            {
              name: "WHATSAPP_ACCESS_TOKEN",
              valueFrom: { secretKeyRef: { name: "WHATSAPP_ACCESS_TOKEN", key: "latest" } },
            },
            { name: "WHATSAPP_PHONE_NUMBER_ID", value: "123456789" },
          ]),
          GCP_PROJECT: "test-project",
          GCP_REGION: "us-central1",
          CLOUD_RUN_SERVICE: "panelin-calc",
        },
      });

      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
      assert.match(result.stdout, /Graph \/me OK/);
      assert.match(result.stdout, /mount actual: secret/);
      assert.match(result.stdout, /Revisi.n activa: panelin-calc-00042-test/);
      assert.match(result.stdout, /123456789/);

      const calls = readFileSync(logPath, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));

      const addIndex = calls.findIndex(
        (call) =>
          call.cmd === "gcloud" &&
          call.args[0] === "secrets" &&
          call.args[1] === "versions" &&
          call.args[2] === "add"
      );
      const updateIndex = calls.findIndex(
        (call) => call.cmd === "gcloud" && call.args.slice(0, 3).join(" ") === "run services update"
      );

      assert.notEqual(addIndex, -1, "expected a GSM secret version add");
      assert.notEqual(updateIndex, -1, "expected a Cloud Run service update");
      assert.ok(addIndex < updateIndex, "the script should roll Cloud Run after adding the new secret version");
      assert.equal(calls[addIndex].stdin, token);
      assert.ok(
        calls[updateIndex].args.includes("--update-secrets=WHATSAPP_ACCESS_TOKEN=WHATSAPP_ACCESS_TOKEN:latest"),
        "Cloud Run update should mount the latest WhatsApp token secret"
      );
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
