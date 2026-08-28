// Storefront widget: mint /session before getUserMedia (mic privacy).
// Run: node tests/storefrontVoiceMicOrder.test.js

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const widget = fs.readFileSync(
  path.join(ROOT, "server/public/storefront-voice/widget.js"),
  "utf8",
);

const startCallIdx = widget.indexOf("async function startCall()");
assert.ok(startCallIdx >= 0, "startCall present");
const startCallChunk = widget.slice(startCallIdx, startCallIdx + 3200);
const sessFetchIdx = startCallChunk.search(/fetch\(`\$\{API\}\/api\/public\/voice\/session`/);
const openMicIdx = startCallChunk.indexOf("await openMic()");
assert.ok(sessFetchIdx >= 0, "startCall mints /session");
assert.ok(openMicIdx >= 0, "startCall opens mic");
assert.ok(
  sessFetchIdx < openMicIdx,
  "session mint before openMic — failed /session must not leave mic tracks live",
);
assert.ok(
  !/Promise\.all\(\[micP,\s*sessP\]\)/.test(startCallChunk),
  "no parallel mic+session (orphans MediaStream on reject)",
);
assert.match(
  startCallChunk,
  /if \(stream\) \{[\s\S]*getTracks\(\)\.forEach/,
  "error path stops mic if opened after a successful mint",
);

console.log("storefrontVoiceMicOrder.test.js ok");
