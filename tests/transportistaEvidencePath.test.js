/**
 * Bug EZ — driver evidence kind/path must not escape the evidence root.
 * Run: node tests/transportistaEvidencePath.test.js
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  sanitizeEvidenceKind,
  resolveSafeEvidencePath,
  isAllowedEvidenceObjectPath,
  writeLocalDevEvidence,
} from "../server/lib/transportistaEvidence.js";

console.log("transportistaEvidencePath");

assert.equal(sanitizeEvidenceKind("pod"), "pod");
assert.equal(sanitizeEvidenceKind("load_photo"), "load_photo");
assert.equal(sanitizeEvidenceKind("../evil"), null);
assert.equal(sanitizeEvidenceKind("a/b"), null);
assert.equal(sanitizeEvidenceKind(""), null);
assert.equal(sanitizeEvidenceKind(".."), null);
console.log("  ✓ sanitizeEvidenceKind");

const trip = "11111111-1111-4111-8111-111111111111";
assert.equal(isAllowedEvidenceObjectPath(trip, "pod", `trips/${trip}/pod/x.jpg`), true);
assert.equal(isAllowedEvidenceObjectPath(trip, "pod", `${trip}/pod/x.jpg`), true);
assert.equal(isAllowedEvidenceObjectPath(trip, "pod", `trips/${trip}/../etc/x.jpg`), false);
assert.equal(isAllowedEvidenceObjectPath(trip, "../x", `trips/${trip}/../x/a.jpg`), false);
assert.equal(isAllowedEvidenceObjectPath(trip, "pod", `/etc/passwd`), false);
console.log("  ✓ isAllowedEvidenceObjectPath");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "bmc-evi-"));
try {
  const okRel = `${trip}/pod/ok.jpg`;
  const full = resolveSafeEvidencePath(root, okRel);
  assert.ok(full.startsWith(path.resolve(root) + path.sep));
  console.log("  ✓ resolveSafeEvidencePath allows in-root");

  assert.throws(() => resolveSafeEvidencePath(root, `${trip}/../../outside.jpg`), /path_escape/);
  assert.throws(() => resolveSafeEvidencePath(root, "/etc/passwd"), /path_escape/);
  console.log("  ✓ resolveSafeEvidencePath rejects escape + absolute");

  await writeLocalDevEvidence({
    rootDir: root,
    relativePath: okRel,
    buffer: Buffer.from("ok"),
  });
  assert.equal(fs.readFileSync(full, "utf8"), "ok");

  let rejected = false;
  try {
    await writeLocalDevEvidence({
      rootDir: root,
      relativePath: `${trip}/../../pwned.jpg`,
      buffer: Buffer.from("nope"),
    });
  } catch (e) {
    rejected = e?.code === "path_escape";
  }
  assert.equal(rejected, true);
  assert.equal(fs.existsSync(path.join(root, "..", "pwned.jpg")), false);
  console.log("  ✓ writeLocalDevEvidence refuses traversal write");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

console.log("transportistaEvidencePath OK");
