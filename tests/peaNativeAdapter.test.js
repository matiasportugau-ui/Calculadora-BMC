/**
 * Offline tests for native L3 implementer adapter.
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { runNativeImplementer } from "../server/lib/pea/implementer/nativeAdapter.js";

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "pea-native-"));
await fs.writeFile(path.join(tmp, ".gitkeep"), "");
const { execFileSync } = await import("node:child_process");
execFileSync("git", ["init"], { cwd: tmp });
execFileSync("git", ["config", "user.email", "pea@test.local"], { cwd: tmp });
execFileSync("git", ["config", "user.name", "PEA Test"], { cwd: tmp });
execFileSync("git", ["add", ".gitkeep"], { cwd: tmp });
execFileSync("git", ["commit", "-m", "init"], { cwd: tmp });

const packet = {
  id: "pkt-1",
  primary_lane: "H",
  diagnosis: "test",
  recommended_changes: [],
  ratchet_plan: {},
};
const gap = { id: "gap-1", fingerprint: "abc123def456", signal_type: "tool_fail" };

const result = await runNativeImplementer({ packet, gap, repoRoot: tmp });
assert.equal(result.ok, true);
assert.equal(result.adapter, "native");
assert.match(result.branch, /^pea\//);
assert.ok(result.artifact_path);

console.log("peaNativeAdapter.test.js OK");
