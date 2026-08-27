import assert from "node:assert/strict";
import {
  HISTORY_SEED_CAP,
  buildHistoryItemCreates,
  lastUserText,
} from "../src/utils/voiceHistoryBridge.js";

function texts(creates) {
  return creates.map((c) => c.item.content[0].text);
}

{
  const empty = buildHistoryItemCreates([]);
  assert.equal(empty.length, 0, "empty history → no items");
}

{
  const creates = buildHistoryItemCreates([
    { role: "user", content: "hola" },
    { role: "assistant", content: "dale" },
    { role: "user", text: "cotizame techo" },
  ]);
  assert.equal(creates.length, 3);
  assert.equal(creates[0].type, "conversation.item.create");
  assert.equal(creates[0].item.role, "user");
  assert.equal(creates[0].item.content[0].type, "input_text");
  assert.equal(creates[1].item.role, "assistant");
  assert.equal(creates[1].item.content[0].type, "text");
  assert.equal(creates[2].item.content[0].text, "cotizame techo");
}

{
  const many = Array.from({ length: HISTORY_SEED_CAP + 5 }, (_, i) => ({
    role: i % 2 === 0 ? "user" : "assistant",
    content: `t${i}`,
  }));
  const creates = buildHistoryItemCreates(many);
  assert.equal(creates.length, HISTORY_SEED_CAP + 1, "cap + summary item");
  assert.match(creates[0].item.content[0].text, /5 turnos/);
  assert.equal(texts(creates).at(-1), `t${HISTORY_SEED_CAP + 4}`);
}

{
  assert.equal(lastUserText([{ role: "assistant", content: "x" }]), "");
  assert.equal(
    lastUserText([
      { role: "user", content: "uno" },
      { role: "assistant", content: "ok" },
      { role: "user", content: "dos" },
    ]),
    "dos",
  );
}

console.log("voiceHistoryBridge.test.js: ok");
