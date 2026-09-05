// present_choices parser edges (#1198 tap chips).
// Happy path lives in storefrontChoices.test.js.
// Run: node tests/storefrontChoicesGates.test.js

import assert from "node:assert/strict";
import { normalizeChoiceOptions, parseReplyChoices } from "../server/lib/voice/storefrontChoices.js";

assert.deepEqual(normalizeChoiceOptions(null), []);
assert.deepEqual(normalizeChoiceOptions("IsoDec"), []);

{
  const capped = normalizeChoiceOptions([
    { label: "A" },
    { label: "B" },
    { label: "C" },
    { label: "D" },
    { label: "E" },
  ]);
  assert.deepEqual(
    capped.map((c) => c.label),
    ["A", "B", "C", "D"],
    "max 4 chips",
  );
}

{
  const long = "Espesor cincuenta milímetros extra largo";
  const [one] = normalizeChoiceOptions([{ label: long, send: long }]);
  assert.equal(one.label.length, 32);
  assert.equal(one.send.length, long.length);
}

{
  const viaText = normalizeChoiceOptions([{ text: "PIR", value: "isodec-pir" }]);
  assert.deepEqual(viaText, [{ label: "PIR", send: "isodec-pir" }]);
}

assert.deepEqual(parseReplyChoices(""), []);
assert.deepEqual(parseReplyChoices("x".repeat(401)), [], "spoken blob >400 chars → no chips");
assert.deepEqual(
  parseReplyChoices("¿En 2 días o 3 días?"),
  [],
  "día/hora 'o' questions are not product chips",
);
assert.deepEqual(parseReplyChoices("¿IsoDec o IsoDec?"), [], "same option twice");
assert.deepEqual(parseReplyChoices("techo o pared"), [
  { label: "techo", send: "techo" },
  { label: "pared", send: "pared" },
]);

assert.deepEqual(
  parseReplyChoices("Elegí:\n- 50 mm\n- 80 mm\n- 100 mm\n- 150 mm\n- 200 mm"),
  [
    { label: "50 mm", send: "50 mm" },
    { label: "80 mm", send: "80 mm" },
    { label: "100 mm", send: "100 mm" },
    { label: "150 mm", send: "150 mm" },
  ],
);

console.log("storefrontChoicesGates.test.js: ok");
