/**
 * Exact Chrome profile argv matching (WA always-on / G8).
 * Run: node tests/waChromeProfileMatch.test.js
 */
import assert from "assert";
import {
  cmdlineMatchesProfile,
  profileProcPattern,
} from "../scripts/lib/waChromeProfileMatch.mjs";

const PROFILE = "/tmp/chrome-wa-profile";
const PERSONAL = "/tmp/chrome-wa-profile-personal-1";

assert.strictEqual(
  profileProcPattern(PROFILE),
  `user-data-dir=${PROFILE}( |$)`,
);

const exact = `Google Chrome --user-data-dir=${PROFILE} https://web.whatsapp.com/`;
const sibling = `Google Chrome --user-data-dir=${PERSONAL} https://web.whatsapp.com/`;
const glued = `Google Chrome --user-data-dir=${PROFILE}foo https://web.whatsapp.com/`;
const other = `Google Chrome --user-data-dir=/other/chrome-wa-profile https://web.whatsapp.com/`;
const trailing = `Chrome --user-data-dir=${PROFILE}`;

assert.strictEqual(cmdlineMatchesProfile(exact, PROFILE), true, "exact path");
assert.strictEqual(cmdlineMatchesProfile(trailing, PROFILE), true, "end of argv");
assert.strictEqual(cmdlineMatchesProfile(sibling, PROFILE), false, "sibling personal-1");
assert.strictEqual(cmdlineMatchesProfile(glued, PROFILE), false, "glued suffix");
assert.strictEqual(cmdlineMatchesProfile(other, PROFILE), false, "different dir");
assert.strictEqual(cmdlineMatchesProfile(sibling, PERSONAL), true, "personal exact");

// Broken prefix semantics (what pkill without boundary did)
assert.ok(sibling.includes(`user-data-dir=${PROFILE}`), "sibling shares prefix string");
assert.strictEqual(
  cmdlineMatchesProfile(sibling, PROFILE),
  false,
  "must not treat prefix as match",
);

console.log("waChromeProfileMatch.test.js: OK");
