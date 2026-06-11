// Regression tests for scripts/wa-refresh-access-token.sh.
// Run: node --test tests/wa-refresh-access-token.test.js

import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const tempDirs = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function longMetaToken() {
  return `EAA${"x".repeat(180)}`;
}

function serviceJsonForMount(mountKind) {
  const env = [{ name: "WHATSAPP_PHONE_NUMBER_ID", value: "59899123456" }];
  if (mountKind === "plain") {
    env.unshift({ name: "WHATSAPP_ACCESS_TOKEN", value: "old-plain-token" });
  }
  if (mountKind === "secret") {
    env.unshift({
      name: "WHATSAPP_ACCESS_TOKEN",
      valueFrom: { secretKeyRef: { name: "WHATSAPP_ACCESS_TOKEN", key: "latest" } },
    });
  }
  return JSON.stringify({
    spec: { template: { spec: { containers: [{ env }] } } },
  });
}

async function writeExecutable(path, contents) {
  await writeFile(path, contents, "utf8");
  await chmod(path, 0o755);
}

async function makeFakeBin({ mountKind = "secret", graphJson = '{"id":"test-business"}' } = {}) {
  const dir = await mkdtemp(join(tmpdir(), "wa-refresh-token-"));
  tempDirs.push(dir);
  const binDir = join(dir, "bin");
  await mkdir(binDir);
  const gcloudLog = join(dir, "gcloud.log");
  const curlLog = join(dir, "curl.log");
  const secretData = join(dir, "secret-data.txt");

  await writeExecutable(
    join(binDir, "gcloud"),
    `#!/usr/bin/env bash
set -euo pipefail
printf 'gcloud' >> "$FAKE_GCLOUD_LOG"
printf ' %q' "$@" >> "$FAKE_GCLOUD_LOG"
printf '\\n' >> "$FAKE_GCLOUD_LOG"

if [[ "$1 $2" == "secrets describe" ]]; then
  exit 0
fi

if [[ "$1 $2 $3" == "secrets versions add" ]]; then
  cat > "$FAKE_SECRET_DATA"
  exit 0
fi

if [[ "$1 $2 $3" == "run services describe" ]]; then
  for arg in "$@"; do
    case "$arg" in
      --format=json)
        printf '%s\\n' "$FAKE_SERVICE_JSON"
        exit 0
        ;;
      --format=value\\(status.latestReadyRevisionName\\))
        printf '%s\\n' "panelin-calc-test-rev"
        exit 0
        ;;
      --format=value\\(status.url\\))
        printf '%s\\n' "https://panelin-calc-test.run.app"
        exit 0
        ;;
    esac
  done
fi

if [[ "$1 $2 $3" == "run services update" ]]; then
  exit 0
fi

echo "unexpected gcloud invocation: $*" >&2
exit 64
`,
  );

  await writeExecutable(
    join(binDir, "curl"),
    `#!/usr/bin/env bash
set -euo pipefail
printf 'curl' >> "$FAKE_CURL_LOG"
printf ' %q' "$@" >> "$FAKE_CURL_LOG"
printf '\\n' >> "$FAKE_CURL_LOG"
printf '%s\\n' "$FAKE_GRAPH_JSON"
`,
  );

  return {
    dir,
    env: {
      ...process.env,
      PATH: `${binDir}${delimiter}${process.env.PATH}`,
      FAKE_GCLOUD_LOG: gcloudLog,
      FAKE_CURL_LOG: curlLog,
      FAKE_SECRET_DATA: secretData,
      FAKE_SERVICE_JSON: serviceJsonForMount(mountKind),
      FAKE_GRAPH_JSON: graphJson,
      GCP_PROJECT: "test-project",
      GCP_REGION: "test-region",
      CLOUD_RUN_SERVICE: "test-service",
    },
    gcloudLog,
    curlLog,
    secretData,
  };
}

function runRefreshScript({ args = [], stdin = "", env }) {
  return new Promise((resolve) => {
    const child = spawn("bash", ["scripts/wa-refresh-access-token.sh", ...args], {
      cwd: repoRoot,
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(stdin);
  });
}

async function readIfExists(path) {
  return existsSync(path) ? readFile(path, "utf8") : "";
}

describe("wa-refresh-access-token.sh", () => {
  it("rejects too-short tokens before Graph, GSM, or Cloud Run side effects", async () => {
    const fake = await makeFakeBin();
    const result = await runRefreshScript({ args: ["too-short"], env: fake.env });

    assert.equal(result.code, 1);
    assert.match(result.stderr, /token demasiado corto/);
    assert.equal(await readIfExists(fake.gcloudLog), "");
    assert.equal(await readIfExists(fake.curlLog), "");
  });

  it("migrates a plain Cloud Run env var to a Secret Manager mount", async () => {
    const token = `${longMetaToken()}\n`;
    const fake = await makeFakeBin({ mountKind: "plain" });
    const result = await runRefreshScript({ stdin: token, env: fake.env });

    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /mount actual: plain/);
    assert.match(result.stdout, /59899123456/);
    assert.equal(await readFile(fake.secretData, "utf8"), token.trim());

    const gcloudLog = await readFile(fake.gcloudLog, "utf8");
    assert.match(gcloudLog, /secrets versions add WHATSAPP_ACCESS_TOKEN/);
    assert.match(gcloudLog, /run services update test-service/);
    assert.match(gcloudLog, /--remove-env-vars=WHATSAPP_ACCESS_TOKEN/);
    assert.match(gcloudLog, /--update-secrets=WHATSAPP_ACCESS_TOKEN=WHATSAPP_ACCESS_TOKEN:latest/);
  });

  for (const mountKind of ["secret", "absent"]) {
    it(`updates ${mountKind} Cloud Run mount without remove-env-vars migration`, async () => {
      const token = longMetaToken();
      const fake = await makeFakeBin({ mountKind });
      const result = await runRefreshScript({ args: [token], env: fake.env });

      assert.equal(result.code, 0, result.stderr);
      assert.match(result.stdout, new RegExp(`mount actual: ${mountKind}`));
      assert.equal(await readFile(fake.secretData, "utf8"), token);

      const gcloudLog = await readFile(fake.gcloudLog, "utf8");
      assert.match(gcloudLog, /run services update test-service/);
      assert.doesNotMatch(gcloudLog, /--remove-env-vars=WHATSAPP_ACCESS_TOKEN/);
      assert.match(gcloudLog, /--update-secrets=WHATSAPP_ACCESS_TOKEN=WHATSAPP_ACCESS_TOKEN:latest/);
    });
  }

  it("stops before writing a new GSM version when Graph API rejects the token", async () => {
    const fake = await makeFakeBin({
      mountKind: "secret",
      graphJson: '{"error":{"message":"Invalid OAuth access token."}}',
    });
    const result = await runRefreshScript({ args: [longMetaToken()], env: fake.env });

    assert.equal(result.code, 1);
    assert.match(result.stderr, /Graph API rechazó el token/);
    const gcloudLog = await readFile(fake.gcloudLog, "utf8");
    assert.match(gcloudLog, /secrets describe WHATSAPP_ACCESS_TOKEN/);
    assert.doesNotMatch(gcloudLog, /secrets versions add/);
  });
});
