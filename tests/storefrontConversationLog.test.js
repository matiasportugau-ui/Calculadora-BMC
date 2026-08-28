// Privacy-safe storefront turns JSONL — no raw phone, no PCM, col J only if adminRow ≥ 2.
// Run: node tests/storefrontConversationLog.test.js

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  appendStorefrontTurn,
  hashStorefrontPhone,
  storefrontTurnsDir,
} from "../server/lib/voice/storefrontConversationLog.js";
import { shouldAttemptAdminColJ } from "../server/routes/publicVoice.js";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "storefront-turns-"));
process.env.STOREFRONT_TURNS_DIR = dir;

assert.equal(storefrontTurnsDir(), dir);
const hash = hashStorefrontPhone("099123456");
assert.equal(String(hash).length, 16);
assert.equal(hashStorefrontPhone("099123456"), hash);
assert.notEqual(hash, "099123456");

const written = appendStorefrontTurn({
  kind: "identify",
  adminRow: 31,
  telefono: "59899111222",
  pageUrl: "https://bmcuruguay.com.uy/",
  transcript: "Chat tienda Panelin — inicio",
});
assert.equal(written.ok, true);
assert.ok(written.file && fs.existsSync(written.file), "jsonl file exists");
const line = fs.readFileSync(written.file, "utf8").trim().split("\n").pop();
const rec = JSON.parse(line);
assert.equal(rec.kind, "identify");
assert.equal(rec.adminRow, 31);
assert.equal(rec.phoneHash, hashStorefrontPhone("59899111222"));
assert.equal(rec.transcript, "Chat tienda Panelin — inicio");
assert.equal("telefono" in rec, false, "no raw phone field");
assert.equal("pcm" in rec, false);
assert.equal("audio" in rec, false);
assert.ok(!JSON.stringify(rec).includes("59899111222"), "raw phone absent from record");

assert.equal(shouldAttemptAdminColJ(rec.adminRow), true, "col J attempted when row ≥ 2");
assert.equal(shouldAttemptAdminColJ(1), false, "col J skipped without real row");

const noRow = appendStorefrontTurn({
  kind: "log",
  adminRow: 1,
  telefono: "099123456",
  transcript: "hola IsoDec",
});
assert.equal(noRow.record.adminRow, null);
assert.equal(shouldAttemptAdminColJ(noRow.record.adminRow), false);

fs.rmSync(dir, { recursive: true, force: true });
console.log("storefrontConversationLog.test.js ok");
