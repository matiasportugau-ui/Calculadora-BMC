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

// ── Email-manager fields (009): assignment / team / snooze ──────────────────
const UUID = "11111111-2222-3333-4444-555555555555";

check("assign: valid uuid sets owner + stamps assigned_at", () => {
  const r = buildConversationPatch({ assigned_to_user_id: UUID });
  assert.equal(r.fields[0].col, "assigned_to_user_id");
  assert.equal(r.fields[0].value, UUID);
  assert.equal(r.fields[0].cast, "uuid");
  assert.equal(r.fields[1].col, "assigned_at");
  assert.ok(r.fields[1].value instanceof Date);
});

check("assign: null clears owner + assigned_at", () => {
  const r = buildConversationPatch({ assigned_to_user_id: null });
  assert.deepEqual(
    r.fields.map((f) => [f.col, f.value]),
    [["assigned_to_user_id", null], ["assigned_at", null]],
  );
});

check("assign: non-uuid rejected", () => {
  assert.equal(buildConversationPatch({ assigned_to_user_id: "bob" }).error, "invalid_assignee");
  assert.equal(buildConversationPatch({ assigned_to_user_id: 42 }).error, "invalid_assignee");
});

check("team_id: valid uuid / null clear / invalid", () => {
  assert.deepEqual(buildConversationPatch({ team_id: UUID }).fields, [
    { col: "team_id", value: UUID, cast: "uuid" },
  ]);
  assert.deepEqual(buildConversationPatch({ team_id: null }).fields, [
    { col: "team_id", value: null, cast: "uuid" },
  ]);
  assert.equal(buildConversationPatch({ team_id: "nope" }).error, "invalid_team");
});

check("snoozed_until: ISO ok, null un-snoozes, garbage rejected", () => {
  const r = buildConversationPatch({ snoozed_until: "2030-01-01T12:00:00.000Z" });
  assert.equal(r.fields[0].col, "snoozed_until");
  assert.ok(r.fields[0].value instanceof Date);
  assert.deepEqual(buildConversationPatch({ snoozed_until: null }).fields, [
    { col: "snoozed_until", value: null, cast: "timestamptz" },
  ]);
  assert.equal(buildConversationPatch({ snoozed_until: "not-a-date" }).error, "invalid_snooze");
});

console.log(`\nomni conversationPatch: ${passed} checks passed`);
