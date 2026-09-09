/**
 * Privacy-safe JSONL turn log edges (#1166).
 * Happy path (hash + no raw phone) lives in storefrontConversationLog.
 * Run: node tests/storefrontConversationLogGates.test.js
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  appendStorefrontTurn,
  hashStorefrontPhone,
  storefrontTurnsDir,
} from "../server/lib/voice/storefrontConversationLog.js";

console.log("storefrontConversationLogGates");

{
  assert.equal(hashStorefrontPhone(""), null);
  assert.equal(hashStorefrontPhone("099"), null, "short UY mobile is not hashed");
  assert.equal(hashStorefrontPhone("1234567"), null);
  assert.equal(String(hashStorefrontPhone("12345678")).length, 16);
  assert.equal(hashStorefrontPhone("099-123-456"), hashStorefrontPhone("099123456"));
  console.log("  ✓ hashStorefrontPhone: <8 digits → null (not empty string)");
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "storefront-turns-gates-"));
process.env.STOREFRONT_TURNS_DIR = dir;
assert.equal(storefrontTurnsDir(), dir);

{
  const written = appendStorefrontTurn({
    kind: `identify-failed-${"k".repeat(60)}`,
    adminRow: 1,
    telefono: "099",
    pageUrl: `https://bmcuruguay.com.uy/${"p".repeat(400)}`,
    transcript: "t".repeat(9000),
  });
  assert.equal(written.ok, true);
  const rec = written.record;
  assert.equal(rec.kind.length, 40, "kind cap");
  assert.equal(rec.adminRow, null, "header row 1 is not a lead");
  assert.equal(rec.phoneHash, null, "short phone is omitted, not hashed");
  assert.equal(rec.pageUrl.length, 300);
  assert.equal(rec.transcript.length, 8000);
  const raw = fs.readFileSync(written.file, "utf8");
  assert.ok(!raw.includes("099123456") && !/"telefono"/.test(raw), "no telefono field");
  console.log("  ✓ kind/pageUrl/transcript caps; adminRow 1 + short phone stay null");
}

{
  const stamped = appendStorefrontTurn({
    kind: "chat",
    adminRow: "31",
    telefono: "+598 99 111 222",
    pageUrl: "",
    transcript: "",
  });
  assert.equal(stamped.record.adminRow, 31, "numeric string row ≥ 2 stamps");
  assert.equal(String(stamped.record.phoneHash).length, 16);
  assert.equal(stamped.record.pageUrl, null);
  assert.equal(stamped.record.transcript, null);
  assert.ok(!JSON.stringify(stamped.record).includes("59899111222"), "E.164 absent from record");
  const man = appendStorefrontTurn({ kind: "log", adminRow: "MAN-1", telefono: "099123456" });
  assert.equal(man.record.adminRow, null, "MAN-* is not a row");
  console.log("  ✓ string adminRow 31 stamps; MAN-id and empty page/transcript → null");
}

{
  const asFile = path.join(os.tmpdir(), `storefront-turns-not-a-dir-${Date.now()}`);
  fs.writeFileSync(asFile, "not-a-dir");
  process.env.STOREFRONT_TURNS_DIR = asFile;
  const failed = appendStorefrontTurn({ kind: "chat", adminRow: 31, transcript: "hola" });
  assert.equal(failed.ok, false, "unwritable dest fail-soft");
  assert.ok(failed.error, "error message present");
  fs.rmSync(asFile, { force: true });
  process.env.STOREFRONT_TURNS_DIR = dir;
  console.log("  ✓ write failure returns ok:false (no throw)");
}

fs.rmSync(dir, { recursive: true, force: true });
console.log("storefrontConversationLogGates: ok");
