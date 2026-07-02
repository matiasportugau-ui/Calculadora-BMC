// tests/omniDuplicateContacts.test.js — standalone (no deps, no DB) unit test
// for the duplicate-contact-cluster detector. Run: `node tests/omniDuplicateContacts.test.js`.
import assert from "node:assert/strict";
import { findDuplicateClusters } from "../server/lib/omni/identity/duplicateContacts.js";

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

check("two contacts sharing an email cluster together", () => {
  const clusters = findDuplicateClusters([
    { id: "a", email: "juan@example.com", created_at: "2026-01-01" },
    { id: "b", email: "Juan@Example.com  ", created_at: "2026-02-01" }, // case/whitespace
    { id: "c", email: "otro@example.com", created_at: "2026-01-15" },
  ]);
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].reason, "mismo email");
  assert.deepEqual(clusters[0].contacts.map((c) => c.id).sort(), ["a", "b"]);
});

check("two contacts sharing a phone (different formats) cluster together", () => {
  const clusters = findDuplicateClusters([
    { id: "a", phone: "099123456" },
    { id: "b", wa_phone: "+59899123456" },
    { id: "c", phone: "098000000" },
  ]);
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].reason, "mismo teléfono");
  assert.deepEqual(clusters[0].contacts.map((c) => c.id).sort(), ["a", "b"]);
});

check("a contact with DIFFERENT phone and wa_phone still matches on either field independently", () => {
  // e.g. a manually-edited `phone` diverged from the WA-ingest `wa_phone` —
  // both are real signals and must each be checked, not phone||wa_phone.
  const clusters = findDuplicateClusters([
    { id: "a", phone: "099111111", wa_phone: "+59899222222" },
    { id: "b", phone: "099111111" }, // matches a's `phone`
    { id: "c", wa_phone: "+59899222222" }, // matches a's `wa_phone`, NOT its `phone`
  ]);
  assert.equal(clusters.length, 2);
  const byContacts = clusters.map((cl) => cl.contacts.map((c) => c.id).sort());
  assert.ok(byContacts.some((ids) => ids.join(",") === "a,b"), "clustered via phone");
  assert.ok(byContacts.some((ids) => ids.join(",") === "a,c"), "clustered via wa_phone");
});

check("a contact matching on both email and phone produces two clusters", () => {
  const clusters = findDuplicateClusters([
    { id: "a", email: "x@example.com", phone: "099111111" },
    { id: "b", email: "x@example.com" },
    { id: "c", phone: "099111111" },
  ]);
  assert.equal(clusters.length, 2);
  const reasons = clusters.map((c) => c.reason).sort();
  assert.deepEqual(reasons, ["mismo email", "mismo teléfono"]);
});

check("singletons never produce a cluster", () => {
  const clusters = findDuplicateClusters([
    { id: "a", email: "unico@example.com", phone: "099999999" },
    { id: "b", email: "otro@example.com", phone: "098888888" },
  ]);
  assert.deepEqual(clusters, []);
});

check("contacts with no email/phone are ignored, not crashed on", () => {
  const clusters = findDuplicateClusters([
    { id: "a" },
    { id: "b", email: null, phone: undefined },
  ]);
  assert.deepEqual(clusters, []);
});

check("empty/undefined input → empty result", () => {
  assert.deepEqual(findDuplicateClusters([]), []);
  assert.deepEqual(findDuplicateClusters(undefined), []);
});

check("largest cluster sorts first; ties broken by most recently created", () => {
  const clusters = findDuplicateClusters([
    { id: "a", email: "pair@example.com", created_at: "2026-01-01" },
    { id: "b", email: "pair@example.com", created_at: "2026-01-02" },
    { id: "c", email: "trio@example.com", created_at: "2026-03-01" },
    { id: "d", email: "trio@example.com", created_at: "2026-03-02" },
    { id: "e", email: "trio@example.com", created_at: "2026-01-10" },
  ]);
  assert.equal(clusters.length, 2);
  assert.equal(clusters[0].key, "email:trio@example.com", "3-contact cluster ranks above the 2-contact one");
  assert.equal(clusters[0].contacts.length, 3);
});

console.log(`\n✅ omniDuplicateContacts: ${passed} checks OK`);
