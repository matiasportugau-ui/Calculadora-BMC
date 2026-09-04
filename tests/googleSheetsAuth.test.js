import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseGoogleCreds, redactGoogleError, googleAuthOptionsFromParsed } from "../server/lib/googleSheetsAuth.js";
import { VOICE_BRAIN_TOOL_ALLOWLIST } from "../server/lib/voiceBrainPack.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

assert.equal(parseGoogleCreds("").mode, "adc");
assert.equal(parseGoogleCreds("/tmp/sa.json").mode, "file");
const inline = parseGoogleCreds(JSON.stringify({
  type: "service_account",
  client_email: "x@y.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\\nABC\\n-----END PRIVATE KEY-----\\n",
}));
assert.equal(inline.mode, "json");
assert.equal(inline.credentials.client_email, "x@y.iam.gserviceaccount.com");

const leaked = redactGoogleError('The file at {\n  "type": "service_account",\n  "private_key": "-----BEGIN PRIVATE KEY-----\\nSECRET\\n-----END PRIVATE KEY-----"\n} does not exist');
assert.ok(!/SECRET|BEGIN PRIVATE/.test(leaked));
assert.ok(/credenciales/i.test(leaked));

const jsonOpts = googleAuthOptionsFromParsed(inline, ["https://www.googleapis.com/auth/spreadsheets"]);
assert.ok(jsonOpts.credentials, "inline SA JSON must pass credentials, not keyFile");
assert.equal(jsonOpts.keyFile, undefined);
const fileOpts = googleAuthOptionsFromParsed({ mode: "file", keyFile: "/tmp/sa.json" }, ["s"]);
assert.equal(fileOpts.keyFile, "/tmp/sa.json");
assert.equal(fileOpts.credentials, undefined);

{
  const wb = fs.readFileSync(path.join(ROOT, "server/routes/wolfboard.js"), "utf8");
  assert.match(wb, /from "\.\.\/lib\/googleSheetsAuth\.js"/, "wolfboard uses shared Sheets auth");
  assert.ok(!wb.includes("new google.auth.GoogleAuth"), "wolfboard must not treat inline JSON as a file path");
  const cache = fs.readFileSync(path.join(ROOT, "server/lib/googleAuthCache.js"), "utf8");
  assert.match(cache, /parseGoogleCreds/, "cached GoogleAuth honors inline Doppler JSON");
}

for (const n of ["sheets_get_pending_admin", "sheets_list_tabs", "sheets_read_range", "sheets_find", "generar_pdf"]) {
  assert.ok(VOICE_BRAIN_TOOL_ALLOWLIST.includes(n), n);
}

console.log("googleSheetsAuth.test.js: ok");
