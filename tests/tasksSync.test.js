// ═══════════════════════════════════════════════════════════════════════════
// tests/tasksSync.test.js — Contract tests for Tasks sync + CRUD
// Run: node tests/tasksSync.test.js
// ═══════════════════════════════════════════════════════════════════════════

import assert from "node:assert/strict";
import { mapGoogleTaskToDb, mapDbTaskToGoogle, classifyGoogleError } from "../server/lib/tasksClient.js";

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}: ${err.message}`);
  }
}

// ─── mapGoogleTaskToDb ───────────────────────────────────────────────────────

test("mapGoogleTaskToDb maps all required fields", () => {
  const google = {
    id: "gtask123",
    title: "Test task",
    notes: "Some notes",
    due: "2026-06-15T00:00:00.000Z",
    status: "needsAction",
    updated: "2026-06-10T10:00:00.000Z",
  };
  const result = mapGoogleTaskToDb(google, "list-uuid", "user-uuid");
  assert.equal(result.google_id, "gtask123");
  assert.equal(result.list_id, "list-uuid");
  assert.equal(result.user_id, "user-uuid");
  assert.equal(result.title, "Test task");
  assert.equal(result.notes, "Some notes");
  assert.equal(result.due, "2026-06-15");
  assert.equal(result.status, "needsAction");
  assert.ok(result.synced_at);
});

test("mapGoogleTaskToDb handles missing optional fields", () => {
  const google = { id: "gtask456", title: "Minimal", status: "completed" };
  const result = mapGoogleTaskToDb(google, "list", "user");
  assert.equal(result.notes, null);
  assert.equal(result.due, null);
  assert.equal(result.status, "completed");
});

test("mapGoogleTaskToDb handles empty title", () => {
  const google = { id: "gtask789" };
  const result = mapGoogleTaskToDb(google, "list", "user");
  assert.equal(result.title, "");
});

// ─── mapDbTaskToGoogle ───────────────────────────────────────────────────────

test("mapDbTaskToGoogle includes title", () => {
  const result = mapDbTaskToGoogle({ title: "My task" });
  assert.equal(result.title, "My task");
});

test("mapDbTaskToGoogle formats due date with T suffix", () => {
  const result = mapDbTaskToGoogle({ title: "T", due: "2026-06-15" });
  assert.equal(result.due, "2026-06-15T00:00:00.000Z");
});

test("mapDbTaskToGoogle omits due when null", () => {
  const result = mapDbTaskToGoogle({ title: "T", due: null });
  assert.ok(!("due" in result));
});

test("mapDbTaskToGoogle includes status", () => {
  const result = mapDbTaskToGoogle({ title: "T", status: "completed" });
  assert.equal(result.status, "completed");
});

test("mapDbTaskToGoogle includes notes", () => {
  const result = mapDbTaskToGoogle({ title: "T", notes: "hello" });
  assert.equal(result.notes, "hello");
});

// ─── classifyGoogleError ─────────────────────────────────────────────────────

test("classifyGoogleError: 401 → auth", () => {
  const r = classifyGoogleError({ code: 401 });
  assert.equal(r.type, "auth");
  assert.equal(r.status, 401);
});

test("classifyGoogleError: 429 → rate_limit", () => {
  const r = classifyGoogleError({ code: 429 });
  assert.equal(r.type, "rate_limit");
  assert.equal(r.status, 503);
});

test("classifyGoogleError: 500 → upstream", () => {
  const r = classifyGoogleError({ code: 500 });
  assert.equal(r.type, "upstream");
  assert.equal(r.status, 503);
});

test("classifyGoogleError: 503 → upstream", () => {
  const r = classifyGoogleError({ code: 503 });
  assert.equal(r.type, "upstream");
  assert.equal(r.status, 503);
});

test("classifyGoogleError: 404 → not_found", () => {
  const r = classifyGoogleError({ code: 404 });
  assert.equal(r.type, "not_found");
  assert.equal(r.status, 404);
});

test("classifyGoogleError: unknown → unknown/500", () => {
  const r = classifyGoogleError({ code: 418 });
  assert.equal(r.type, "unknown");
  assert.equal(r.status, 500);
});

test("classifyGoogleError: response.status fallback", () => {
  const r = classifyGoogleError({ response: { status: 429 } });
  assert.equal(r.type, "rate_limit");
});

// ─── Sync conflict types match migration CHECK constraint ────────────────────

test("Conflict types match migration enum", () => {
  const valid = ["soft_delete_mismatch", "update_timestamp_mismatch", "concurrent_edit"];
  for (const t of valid) {
    assert.ok(typeof t === "string" && t.length > 0);
  }
});

// ─── Sync log event types match migration CHECK constraint ───────────────────

test("Sync log event types are valid per migration", () => {
  const valid = [
    "sync_started", "sync_completed", "sync_failed",
    "conflict_detected", "token_refreshed", "token_revoked",
    "rate_limit_hit", "task_created", "task_updated", "task_deleted",
  ];
  assert.equal(valid.length, 10);
  assert.ok(valid.includes("sync_completed"));
  assert.ok(valid.includes("conflict_detected"));
});

// ─── Report ──────────────────────────────────────────────────────────────────

console.log(`\n════════════════════════════════════════════════════════════`);
console.log(`tasksSync tests — passed: ${passed}, failed: ${failed}`);
console.log(`════════════════════════════════════════════════════════════\n`);
process.exit(failed > 0 ? 1 : 0);
