import assert from "node:assert/strict";
import { parseGoogleCreds, redactGoogleError } from "../server/lib/googleSheetsAuth.js";
import { VOICE_BRAIN_TOOL_ALLOWLIST } from "../server/lib/voiceBrainPack.js";

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

for (const n of ["sheets_get_pending_admin", "sheets_list_tabs", "sheets_read_range", "sheets_find"]) {
  assert.ok(VOICE_BRAIN_TOOL_ALLOWLIST.includes(n), n);
}

console.log("googleSheetsAuth.test.js: ok");
