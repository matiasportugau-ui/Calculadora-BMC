// Offline. node tests/autoLearnLog.test.js
import assert from "node:assert/strict";
import { logTrainingEvent } from "../server/lib/autoLearnExtractor.js";

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

check("uses the caller logger.info when present", () => {
  const calls = [];
  const logger = {
    info(payload, msg) {
      calls.push({ payload, msg });
    },
  };
  const payload = { event: "ai_training_extraction", model: "claude" };
  logTrainingEvent(logger, payload);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].msg, "ai_training_extraction");
  assert.equal(calls[0].payload, payload);
});

check("falls back to console.log JSON when no logger is passed", () => {
  const lines = [];
  const original = console.log;
  console.log = (line) => lines.push(line);
  try {
    logTrainingEvent(null, { event: "ai_training_extraction_complete", pairs_returned: 2 });
  } finally {
    console.log = original;
  }
  assert.deepEqual(lines, [
    JSON.stringify({ event: "ai_training_extraction_complete", pairs_returned: 2 }),
  ]);
});

console.log(`\nautoLearnLog: ${passed} passed`);
