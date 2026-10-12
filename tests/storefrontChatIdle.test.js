// Storefront idle check-in + farewell closeout. Run: node tests/storefrontChatIdle.test.js

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CHAT_ABANDON_MS,
  CHAT_CHECKIN,
  CHAT_CLOSEOUT_BYE,
  CHAT_HIDDEN_MS,
  CHAT_IDLE_MS,
  formatCloseoutFooter,
  isStorefrontFarewell,
} from "../server/lib/voice/storefrontChatIdle.js";

assert.equal(CHAT_IDLE_MS, 25000);
assert.equal(CHAT_ABANDON_MS, 50000);
assert.equal(CHAT_HIDDEN_MS, 60000);
assert.equal(isStorefrontFarewell("chau, gracias"), true);
assert.equal(isStorefrontFarewell("adiós, me voy"), true);
assert.equal(isStorefrontFarewell("gracias"), true);
assert.equal(isStorefrontFarewell("gracias, ¿y el espesor?"), false);
assert.equal(isStorefrontFarewell("quiero IsoDec 150"), false);
assert.equal(formatCloseoutFooter("silence"), "— closeout silence");

const widget = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "../server/public/storefront-voice/widget.js"),
  "utf8",
);
assert.ok(widget.includes(CHAT_CHECKIN), "widget check-in copy");
assert.ok(widget.includes(CHAT_CLOSEOUT_BYE), "widget closeout copy");
assert.ok(widget.includes("CHAT_IDLE_MS = 25 * 1000"), "widget idle wait");
assert.ok(widget.includes("function closeoutChat"), "widget closeout");
assert.ok(widget.includes("awaitingReply"), "one check-in until reply");
assert.ok(widget.includes("has-chat"), "less invasive while chatting");

console.log("storefrontChatIdle.test.js ok");
