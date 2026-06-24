// Identity normalization unit tests — node tests/omniIdentity.test.js
import {
  normalizeWaPhone,
  normalizeEmail,
  normalizeMlUserId,
  buildIntegrationUuid,
} from "../server/lib/omni/types.js";

let passed = 0;
let failed = 0;

function assert(name, condition) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed += 1;
  } else {
    console.log(`  ❌ ${name}`);
    failed += 1;
  }
}

assert("E.164 from local", normalizeWaPhone("099 123 456") === "+59899123456");
assert("keeps intl", normalizeWaPhone("+59899123456") === "+59899123456");
assert("email trim", normalizeEmail("  A@B.COM ") === "a@b.com");
assert("ml id number", normalizeMlUserId("12345") === 12345);
assert("ml id invalid", normalizeMlUserId("x") === null);
assert("uuid ml", buildIntegrationUuid({ ml_user_id: 42 }, "ml") === "ml:42");
assert("uuid email", buildIntegrationUuid({ email: "a@b.com" }, "email") === "email:a@b.com");

console.log(`\nomniIdentity: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
