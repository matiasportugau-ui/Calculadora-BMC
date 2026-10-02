// tests/omniResolveContact.test.js — offline (mock pg client) test for the
// contact-dedup race fix in resolveContact: ON CONFLICT DO NOTHING + re-resolve
// so a contact created by a concurrent transaction is resolved, not dropped.
// Also covers soft-merge redirect (properties.merged_into).
import assert from "node:assert/strict";
import { resolveContact, followMergedInto } from "../server/lib/omni/identity/resolveContact.js";

let passed = 0;
async function check(name, fn) {
  await fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

// Mock client driven by SQL-substring matching. `insertReturnsRow` simulates a
// winning insert; `contactAfterConflict` simulates a row created by a concurrent
// txn (only visible to the ml_user_id lookup AFTER the insert ran).
function makeClient({ insertReturnsRow, contactAfterConflict, contactsById = {}, contactsByUuid = {}, contactsByWa = {} }) {
  const calls = [];
  return {
    calls,
    async query(sql, params = []) {
      const s = String(sql).replace(/\s+/g, " ");
      const insertedAlready = calls.some((c) => c.includes("INSERT INTO omni_contacts"));
      calls.push(s);
      if (s.includes("INSERT INTO omni_contacts")) {
        return { rows: insertReturnsRow ? [{ id: "new-1", integration_uuid: "u-new" }] : [] };
      }
      if (s.includes("WHERE id = $1")) {
        const id = params[0];
        return { rows: contactsById[id] ? [contactsById[id]] : [] };
      }
      if (s.includes("WHERE integration_uuid = $1")) {
        const uuid = params[0];
        return { rows: contactsByUuid[uuid] ? [contactsByUuid[uuid]] : [] };
      }
      if (s.includes("WHERE wa_phone = $1")) {
        const phone = params[0];
        return { rows: contactsByWa[phone] ? [contactsByWa[phone]] : [] };
      }
      if (s.includes("WHERE ml_user_id = $1")) {
        return {
          rows: insertedAlready && contactAfterConflict ? [{ id: "race-1", integration_uuid: "u-race", merged_into: null }] : [],
        };
      }
      return { rows: [] }; // email / chrome_ext → not found
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

await check("followMergedInto walks loser → winner", async () => {
  const client = makeClient({
    insertReturnsRow: false,
    contactsById: {
      loser: { id: "loser", integration_uuid: "wa:59899", merged_into: "winner" },
      winner: { id: "winner", integration_uuid: "email:a@b.c", merged_into: null },
    },
  });
  const out = await followMergedInto(client, { id: "loser", integration_uuid: "wa:59899", merged_into: "winner" });
  assert.equal(out.id, "winner");
  assert.equal(out.integration_uuid, "email:a@b.c");
});

await check("resolveContact follows merged_into after wa_phone hit on loser", async () => {
  const phone = "+59899111222";
  const loser = { id: "loser", integration_uuid: `wa:${phone}`, merged_into: "winner" };
  const client = makeClient({
    insertReturnsRow: true, // unused once lookup hits
    contactsByUuid: { [`wa:${phone}`]: loser },
    contactsByWa: { [phone]: loser },
    contactsById: {
      winner: { id: "winner", integration_uuid: "email:cliente@bmc.uy", merged_into: null },
    },
  });
  const out = await resolveContact(client, {
    contact_hint: { wa_phone: "59899111222", name: "Cliente" },
    channel: "wa",
    source: "wa_webhook",
  });
  assert.equal(out.created, false);
  assert.equal(out.contact_id, "winner");
  assert.equal(out.integration_uuid, "email:cliente@bmc.uy");
});

await check("resolveContact follows merged_into for contact_id hint on loser", async () => {
  const client = makeClient({
    insertReturnsRow: false,
    contactsById: {
      loser: { id: "loser", integration_uuid: "wa:1", merged_into: "winner" },
      winner: { id: "winner", integration_uuid: "email:x@y.z", merged_into: null },
    },
  });
  const out = await resolveContact(client, {
    contact_hint: { contact_id: "loser" },
    channel: "wa",
  });
  assert.equal(out.contact_id, "winner");
});

console.log(`\nomniResolveContact: ${passed} passed`);
