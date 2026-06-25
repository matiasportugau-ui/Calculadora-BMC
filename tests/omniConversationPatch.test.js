// tests/omniConversationPatch.test.js — standalone (no DB/server) unit test for
// PATCH /api/omni/conversations/:id validation. Run: `node tests/omniConversationPatch.test.js`.
import assert from "node:assert/strict";
import { buildConversationPatch } from "../server/lib/omni/conversationPatch.js";

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

check("empty body → no_fields", () => {
  assert.equal(buildConversationPatch({}).error, "no_fields");
  assert.equal(buildConversationPatch(undefined).error, "no_fields");
});

check("valid status passes through", () => {
  const r = buildConversationPatch({ status: "closed" });
  assert.deepEqual(r.fields, [{ col: "status", value: "closed" }]);
});

check("invalid status rejected", () => {
  assert.equal(buildConversationPatch({ status: "archived" }).error, "invalid_status");
  assert.equal(buildConversationPatch({ status: "" }).error, "invalid_status");
});

check("tags: full replace, de-duped, trimmed, blanks dropped", () => {
  const r = buildConversationPatch({ tags: [" obra ", "obra", "", "lead"] });
  assert.equal(r.fields[0].col, "tags");
  assert.equal(r.fields[0].cast, "text[]");
  assert.deepEqual(r.fields[0].value, ["obra", "lead"]);
});

check("tags must be a string array", () => {
  assert.equal(buildConversationPatch({ tags: "obra" }).error, "invalid_tags");
  assert.equal(buildConversationPatch({ tags: [1, 2] }).error, "invalid_tags");
});

check("empty tags array is a valid clear", () => {
  const r = buildConversationPatch({ tags: [] });
  assert.deepEqual(r.fields, [{ col: "tags", value: [], cast: "text[]" }]);
});

check("priority must be an integer", () => {
  assert.deepEqual(buildConversationPatch({ priority: 3 }).fields, [
    { col: "priority", value: 3 },
  ]);
  assert.equal(buildConversationPatch({ priority: 1.5 }).error, "invalid_priority");
  assert.equal(buildConversationPatch({ priority: "x" }).error, "invalid_priority");
});

check("multiple fields combine in order", () => {
  const r = buildConversationPatch({ status: "snoozed", tags: ["x"], priority: 2 });
  assert.deepEqual(
    r.fields.map((f) => f.col),
    ["status", "tags", "priority"],
  );
});

console.log(`\nomni conversationPatch: ${passed} checks passed`);
