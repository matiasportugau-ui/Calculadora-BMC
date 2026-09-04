// Clickable reply chips — parse + normalize.
// Run: node tests/storefrontChoices.test.js

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeChoiceOptions, parseReplyChoices } from "../server/lib/voice/storefrontChoices.js";
import { buildStorefrontVoicePack, isStorefrontShopTool } from "../server/lib/voice/storefrontVoicePack.js";
import { STOREFRONT_VOICE_INSTRUCTIONS } from "../server/lib/voice/storefrontVoiceInstructions.js";

assert.deepEqual(
  normalizeChoiceOptions([
    { label: "IsoDec", send: "IsoDec EPS" },
    { label: "IsoRoof" },
    { label: "IsoDec", send: "IsoDec EPS" },
    "  ",
  ]),
  [
    { label: "IsoDec", send: "IsoDec EPS" },
    { label: "IsoRoof", send: "IsoRoof" },
  ],
);

assert.deepEqual(parseReplyChoices("¿IsoDec o IsoRoof?"), [
  { label: "IsoDec", send: "IsoDec" },
  { label: "IsoRoof", send: "IsoRoof" },
]);
assert.deepEqual(parseReplyChoices("EPS o PIR"), [
  { label: "EPS", send: "EPS" },
  { label: "PIR", send: "PIR" },
]);
assert.deepEqual(
  parseReplyChoices("¿Qué espesor?\n1. 50 mm\n2. 100 mm\n3. 150 mm"),
  [
    { label: "50 mm", send: "50 mm" },
    { label: "100 mm", send: "100 mm" },
    { label: "150 mm", send: "150 mm" },
  ],
);
assert.deepEqual(parseReplyChoices("¿Largo y ancho del techo?"), []);
assert.deepEqual(parseReplyChoices("Hola, ¿cómo te puedo ayudar?"), []);

const pack = buildStorefrontVoicePack();
assert.ok((pack.tools || []).some((t) => t.name === "present_choices"), "present_choices in pack");
assert.equal(isStorefrontShopTool("present_choices"), true);
assert.ok(STOREFRONT_VOICE_INSTRUCTIONS.includes("present_choices"));

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const widget = fs.readFileSync(path.join(ROOT, "server/public/storefront-voice/widget.js"), "utf8");
assert.ok(widget.includes("present_choices"), "widget handles present_choices");
assert.ok(widget.includes("renderChoiceChips"), "widget renders tap chips");
assert.ok(widget.includes("__bmcShowChoices"), "local demo can inject chips");
assert.ok(widget.includes('id="bmc-shop-picks"'), "chip row");
assert.ok(widget.includes("Opciones rápidas"), "a11y label");
assert.match(widget, /shopPicks\.addEventListener\("click"/, "tap sends reply");

console.log("storefrontChoices.test.js: ok");
