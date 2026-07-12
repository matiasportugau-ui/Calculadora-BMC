// tests/omniContactsList.test.js — contract coverage for the unified contacts
// list query used by GET /api/omni/contacts. Run: `node tests/omniContactsList.test.js`.
import assert from "node:assert/strict";
import { buildContactsListQuery, mapContactsListRows } from "../server/lib/omni/contactsList.js";

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

check("admin contact list searches across identity fields without team filter", () => {
  const { sql, params } = buildContactsListQuery({
    query: { search: "  Ana  ", limit: "25", offset: "10" },
    user: { id: "admin-1", role: "admin" },
  });

  assert.deepEqual(params, ["%Ana%", 25, 10]);
  assert.match(sql, /co\.name ILIKE \$1/);
  assert.match(sql, /co\.email ILIKE \$1/);
  assert.match(sql, /co\.phone ILIKE \$1/);
  assert.match(sql, /co\.wa_phone ILIKE \$1/);
  assert.match(sql, /co\.properties->>'merged_into' IS NULL/);
  assert.match(sql, /COUNT\(\*\) OVER\(\) AS total_count/);
  assert.doesNotMatch(sql, /omni_team_members/);
  assert.doesNotMatch(sql, /AND agg\.contact_id IS NOT NULL/);
});

check("operator contact list scopes aggregation and visibility to visible team conversations", () => {
  const { sql, params } = buildContactsListQuery({
    query: { q: "099", limit: "5" },
    user: { id: "11111111-1111-4111-8111-111111111111", role: "operator" },
  });

  assert.deepEqual(params, ["%099%", 5, 0, "11111111-1111-4111-8111-111111111111"]);
  assert.match(sql, /WHERE \(c\.team_id IS NULL OR c\.team_id IN/);
  assert.match(sql, /omni_team_members WHERE user_id = \$4::uuid/);
  assert.match(sql, /AND agg\.contact_id IS NOT NULL/);
});

check("pagination clamps to the endpoint limits", () => {
  assert.deepEqual(
    buildContactsListQuery({ query: { limit: "9999", offset: "-12" }, user: { role: "admin" } }).params,
    [null, 200, 0],
  );
  assert.deepEqual(
    buildContactsListQuery({ query: { limit: "-7", offset: "3" }, user: { role: "admin" } }).params,
    [null, 1, 3],
  );
});

check("mapContactsListRows returns page count and strips window total_count from each contact", () => {
  const response = mapContactsListRows([
    {
      id: "contact-1",
      name: "Ana",
      channels: ["wa", "email"],
      conversation_count: 2,
      total_count: "42",
    },
    {
      id: "contact-2",
      name: "Bruno",
      channels: ["ml"],
      conversation_count: 1,
      total_count: "42",
    },
  ]);

  assert.equal(response.count, 2);
  assert.equal(response.total_count, 42);
  assert.deepEqual(response.contacts.map((c) => c.id), ["contact-1", "contact-2"]);
  assert.ok(!Object.hasOwn(response.contacts[0], "total_count"));
  assert.deepEqual(response.contacts[0].channels, ["wa", "email"]);
});

check("mapContactsListRows reports zero total for an empty page", () => {
  assert.deepEqual(mapContactsListRows([]), { count: 0, total_count: 0, contacts: [] });
});

console.log(`\n✅ omniContactsList: ${passed} checks OK`);
