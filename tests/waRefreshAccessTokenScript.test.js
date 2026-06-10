import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const scriptPath = path.join(repoRoot, "scripts", "wa-refresh-access-token.sh");

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env: options.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

const tmp = await mkdtemp(path.join(tmpdir(), "wa-refresh-token-"));
try {
  const binDir = path.join(tmp, "bin");
  const gcloudLog = path.join(tmp, "gcloud.log");
  await mkdir(binDir);

  await writeFile(
    path.join(binDir, "curl"),
    `#!/usr/bin/env bash
set -euo pipefail
printf '{"id":"meta-test-user"}\\n'
`,
  );

  await writeFile(
    path.join(binDir, "gcloud"),
    `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> "$GCLOUD_LOG"
if [[ "$1 $2 $3" == "secrets versions add" ]]; then
  python3 -c 'import sys; sys.stdin.read()' >/dev/null
  exit 0
fi
if [[ "$1 $2" == "secrets describe" ]]; then
  exit 0
fi
if [[ "$1 $2 $3" == "run services update" ]]; then
  exit 0
fi
if [[ "$1 $2 $3" == "run services describe" ]]; then
  format=""
  for arg in "$@"; do
    case "$arg" in
      --format=*) format="\${arg#--format=}" ;;
    esac
  done
  case "$format" in
    json)
      printf '%s\\n' "$SERVICE_JSON_FIXTURE"
      ;;
    "value(status.latestReadyRevisionName)")
      printf 'panelin-calc-test-rev\\n'
      ;;
    "value(status.url)")
      printf 'https://panelin-test.run.app\\n'
      ;;
    *)
      echo "unexpected gcloud format: $format" >&2
      exit 1
      ;;
  esac
  exit 0
fi
echo "unexpected gcloud invocation: $*" >&2
exit 1
`,
  );
  await chmod(path.join(binDir, "curl"), 0o755);
  await chmod(path.join(binDir, "gcloud"), 0o755);

  const serviceJson = JSON.stringify({
    spec: {
      template: {
        spec: {
          containers: [
            {
              env: [
                {
                  name: "WHATSAPP_ACCESS_TOKEN",
                  valueFrom: {
                    secretKeyRef: { name: "WHATSAPP_ACCESS_TOKEN", key: "latest" },
                  },
                },
                { name: "WHATSAPP_PHONE_NUMBER_ID", value: "59899123456" },
              ],
            },
          ],
        },
      },
    },
  });

  const token = `EAA${"x".repeat(180)}`;
  const result = await run("bash", [scriptPath, token], {
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH}`,
      GCLOUD_LOG: gcloudLog,
      SERVICE_JSON_FIXTURE: serviceJson,
      GCP_PROJECT: "test-project",
      GCP_REGION: "us-central1",
      CLOUD_RUN_SERVICE: "panelin-calc-test",
    },
  });

  assert.equal(
    result.status,
    0,
    `script should complete with stubbed gcloud/curl\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  assert.match(result.stdout, /mount actual: secret/);
  assert.match(result.stdout, /Revisión activa: panelin-calc-test-rev/);
  assert.match(result.stdout, /59899123456/);
  assert.doesNotMatch(result.stderr, /KeyError|Traceback/);
} finally {
  await rm(tmp, { recursive: true, force: true });
}

console.log("waRefreshAccessTokenScript test OK");
