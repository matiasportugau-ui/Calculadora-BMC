/**
 * HITL chofer password crypto + phone login (#1144 / #1147).
 * Run: node tests/choferPassword.test.js
 */
import assert from "node:assert/strict";
import { createTransportistaMemoryPool } from "../server/lib/transportistaMemoryPool.js";
import { ensureTransportistaSchema } from "../server/lib/transportistaSchema.js";
import {
  digitsPhone,
  hashChoferPassword,
  verifyChoferPassword,
  registerChofer,
  loginChofer,
} from "../server/lib/choferRoster.js";

console.log("choferPassword");

{
  assert.equal(digitsPhone("+598 99 123 456"), "59899123456");
  assert.equal(digitsPhone("099123456"), "099123456");
  assert.equal(digitsPhone("123"), "");
  assert.equal(digitsPhone(""), "");
  console.log("  ✓ digitsPhone requires ≥8 digits");
}

{
  const a = hashChoferPassword("secreto1");
  const b = hashChoferPassword("secreto1");
  assert.match(a, /^[0-9a-f]{32}:[0-9a-f]{64}$/);
  assert.notEqual(a, b, "unique salt per hash");
  assert.equal(verifyChoferPassword("secreto1", a), true);
  assert.equal(verifyChoferPassword("secreto1", b), true);
  assert.equal(verifyChoferPassword("wrongpass", a), false);
  assert.equal(verifyChoferPassword("secreto1", "not-a-hash"), false);
  assert.equal(verifyChoferPassword("secreto1", ""), false);
  assert.equal(verifyChoferPassword("secreto1", "abcd:zzzz"), false);
  console.log("  ✓ scrypt hash verifies; wrong / malformed stored hash fail closed");
}

const pool = createTransportistaMemoryPool();
await ensureTransportistaSchema(pool);

{
  const short = await registerChofer(pool, {
    name: "X",
    phone: "099111222",
    password: "12345",
  });
  assert.equal(short.ok, false);
  assert.equal(short.error, "password_too_short");

  const noId = await registerChofer(pool, { name: "X", password: "secreto1" });
  assert.equal(noId.ok, false);
  assert.equal(noId.error, "email_or_phone_required");
  console.log("  ✓ register refuses short password and missing contact");
}

{
  const reg = await registerChofer(pool, {
    name: "Rosa",
    phone: "099888777",
    password: "flota-ok",
  });
  assert.equal(reg.ok, true);
  assert.equal(reg.chofer.password_hash, undefined);
  assert.equal(reg.chofer.phone_e164, "099888777");

  const byPhone = await loginChofer(pool, { phone: "099 888 777", password: "flota-ok" });
  assert.equal(byPhone.ok, true);
  assert.ok(byPhone.token.length >= 16);

  const wrong = await loginChofer(pool, { phone: "099888777", password: "nope" });
  assert.equal(wrong.ok, false);
  assert.equal(wrong.error, "invalid_credentials");

  const missing = await loginChofer(pool, { password: "flota-ok" });
  assert.equal(missing.ok, false);
  assert.equal(missing.error, "email_or_phone_required");
  console.log("  ✓ login by phone; wrong password / missing contact fail closed");
}

console.log("choferPassword OK");
