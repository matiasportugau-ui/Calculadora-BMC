// tests/omniResolveContact.test.js — offline (mock pg client) test for the
// contact-dedup race fix in resolveContact: ON CONFLICT DO NOTHING + re-resolve
// so a contact created by a concurrent transaction is resolved, not dropped.
import assert from "node:assert/strict";
import { resolveContact } from "../server/lib/omni/identity/resolveContact.js";

let passed = 0;
async function check(name, fn) {
  await fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

// Mock client driven by SQL-substring matching. `insertReturnsRow` simulates a
// winning insert; `contactAfterConflict` simulates a row created by a concurrent
// txn (only visible to the ml_user_id lookup AFTER the insert ran).
function makeClient({ insertReturnsRow, contactAfterConflict }) {
  const calls = [];
  return {
    calls,
    async query(sql) {
      const s = String(sql).replace(/\s+/g, " ");
      const insertedAlready = calls.some((c) => c.includes("INSERT INTO omni_contacts"));
      calls.push(s);
      if (s.includes("INSERT INTO omni_contacts")) {
        return { rows: insertReturnsRow ? [{ id: "new-1", integration_uuid: "u-new" }] : [] };
      }
      if (s.includes("WHERE ml_user_id = $1")) {
        return {
          rows: insertedAlready && contactAfterConflict ? [{ id: "race-1", integration_uuid: "u-race" }] : [],
        };
      }
      return { rows: [] }; // uuid / wa_phone / email / chrome_ext / id-hint → not found
    },
  };
}

const hint = { contact_hint: { ml_user_id: 123 }, channel: "ml", source: "ml_sync" };

await check("creates a new contact when none exists", async () => {
  const out = await resolveContact(makeClient({ insertReturnsRow: true, contactAfterConflict: false }), hint);
  assert.equal(out.created, true);
  assert.equal(out.contact_id, "new-1");
});

await check("re-resolves the racing contact on ON CONFLICT (no drop)", async () => {
  const out = await resolveContact(makeClient({ insertReturnsRow: false, contactAfterConflict: true }), hint);
  assert.equal(out.created, false);
  assert.equal(out.contact_id, "race-1");
});

await check("throws if conflict but contact still not found", async () => {
  await assert.rejects(
    resolveContact(makeClient({ insertReturnsRow: false, contactAfterConflict: false }), hint),
    /not found on re-resolve/,
  );
});

console.log(`\nomniResolveContact: ${passed} passed`);
