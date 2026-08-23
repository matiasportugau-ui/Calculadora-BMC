// secretBox — AES-256-GCM string box (WA connection tokens at rest). Offline.
// Guards the round-trip + fail-loud-on-bad-key contract (mismo esquema que tokenStore).
import { encryptString, decryptString, getKeyBuffer } from "../server/lib/secretBox.js";

let passed = 0;
let failed = 0;
function assert(name, condition) {
  if (condition) { console.log(`  ✅ ${name}`); passed += 1; }
  else { console.log(`  ❌ ${name}`); failed += 1; }
}

const KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"; // 32 bytes

// ── round-trip ──
const plain = "EAAG...long-lived-token...xyz";
const env = encryptString(plain, KEY);
assert("envelope is JSON with encrypted:true", JSON.parse(env).encrypted === true);
assert("ciphertext != plaintext", !env.includes(plain));
assert("decrypt returns original", decryptString(env, KEY) === plain);

// ── unencrypted passthrough (matches tokenStore behaviour) ──
assert("non-encrypted payload passes through", decryptString(JSON.stringify({ foo: 1 }), KEY) === JSON.stringify({ foo: 1 }));

// ── bad key → loud failure ──
let threwMissing = false;
try { encryptString("x", ""); } catch { threwMissing = true; }
assert("missing key throws", threwMissing);

let threwShort = false;
try { getKeyBuffer("abcd"); } catch { threwShort = true; }
assert("short key throws", threwShort);

// ── wrong key cannot decrypt (GCM auth) ──
const WRONG = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
let threwWrong = false;
try { decryptString(env, WRONG); } catch { threwWrong = true; }
assert("wrong key fails auth", threwWrong);

console.log(`\nsecretBox: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
