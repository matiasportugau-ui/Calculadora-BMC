// tests/omniContactsDuplicatesTeamIsolation.test.js — GET /omni/contacts/duplicates
// must inherit conversation team isolation (same rule as GET /omni/contacts).
// Run: `node tests/omniContactsDuplicatesTeamIsolation.test.js`.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildDuplicateContactsScanQuery,
  isOmniAdmin,
} from "../server/lib/omni/teamIsolation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OMNI_ROUTE = path.join(__dirname, "../server/routes/omni.js");

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

const USER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

check("isOmniAdmin recognizes admin/superadmin only", () => {
  assert.equal(isOmniAdmin({ role: "admin" }), true);
  assert.equal(isOmniAdmin({ role: "superadmin" }), true);
  assert.equal(isOmniAdmin({ role: "operator" }), false);
  assert.equal(isOmniAdmin({}), false);
});

check("admin scan has no team predicate and only LIMIT param", () => {
  const { sql, params } = buildDuplicateContactsScanQuery({ role: "admin", id: USER_A }, 100);
  assert.deepEqual(params, [100]);
  assert.doesNotMatch(sql, /omni_team_members/);
  assert.doesNotMatch(sql, /EXISTS/);
  assert.match(sql, /LIMIT \$1/);
});

check("operator scan EXISTS-scopes contacts + conversation_count by team", () => {
  const { sql, params } = buildDuplicateContactsScanQuery({ role: "operator", id: USER_A }, 5000);
  assert.deepEqual(params, [5000, USER_A]);
  assert.match(sql, /EXISTS \(SELECT 1 FROM omni_conversations c WHERE c\.contact_id = co\.id/);
  assert.match(sql, /omni_team_members WHERE user_id = \$2::uuid/);
  // conversation_count subquery must also be scoped (no peer-team volume leak).
  assert.match(
    sql,
    /SELECT COUNT\(\*\)::int FROM omni_conversations c WHERE c\.contact_id = co\.id AND \(c\.team_id IS NULL/,
  );
});

check("missing role treated as non-admin (filter applied)", () => {
  const { sql, params } = buildDuplicateContactsScanQuery({ id: USER_A }, 10);
  assert.deepEqual(params, [10, USER_A]);
  assert.match(sql, /omni_team_members/);
});

check("route uses buildDuplicateContactsScanQuery (not raw unscoped SELECT)", () => {
  const src = fs.readFileSync(OMNI_ROUTE, "utf8");
  assert.match(src, /buildDuplicateContactsScanQuery\(req\.user/);
});

check("automation rule create/patch require admin grant (not write)", () => {
  const src = fs.readFileSync(OMNI_ROUTE, "utf8");
  const postCreate = src.indexOf("router.post(", src.indexOf('"/omni/automation/rules"'));
  const patchStart = src.indexOf("router.patch(", src.indexOf('"/omni/automation/rules/:id"') - 80);
  assert.ok(postCreate > 0 && patchStart > 0);
  const postCreateBlock = src.slice(postCreate, postCreate + 220);
  const patchBlock = src.slice(patchStart, patchStart + 220);
  assert.match(postCreateBlock, /requireGrant\.admin\("canales"\)/);
  assert.doesNotMatch(postCreateBlock, /requireGrant\.write\("canales"\)/);
  assert.match(patchBlock, /requireGrant\.admin\("canales"\)/);
  assert.doesNotMatch(patchBlock, /requireGrant\.write\("canales"\)/);
});

console.log(`\n✅ omniContactsDuplicatesTeamIsolation: ${passed} checks OK`);
