// resolveWaCredentials — store-first outbound credentials with env fallback. Offline,
// fake pool + injected. Guards zero-regression: flag OFF or no connection ⇒ env creds.
import { resolveWaCredentials, _clearWaCredentialsCache } from "../server/lib/wa/waCredentials.js";
import { encryptString } from "../server/lib/secretBox.js";

let passed = 0;
let failed = 0;
function assert(name, condition) {
  if (condition) { console.log(`  ✅ ${name}`); passed += 1; }
  else { console.log(`  ❌ ${name}`); failed += 1; }
}

const KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const envConfig = {
  whatsappAccessToken: "ENV_TOKEN",
  whatsappPhoneNumberId: "ENV_PHONE",
  tokenEncryptionKey: KEY,
  databaseUrl: "postgres://x",
};

function fakePool({ active = null } = {}) {
  const queries = [];
  return {
    queries,
    query: async (sql, params) => {
      queries.push({ sql, params });
      if (/from wa_connections/.test(sql)) {
        if (!active) return { rows: [] };
        return { rows: [{ phone_number_id: active.phoneNumberId, waba_id: active.wabaId, access_token_enc: active.enc }] };
      }
      return { rows: [] };
    },
  };
}

// ── flag OFF → env creds, no DB hit ──
_clearWaCredentialsCache();
const p0 = fakePool({ active: { phoneNumberId: "P1", wabaId: "W1", enc: encryptString("STORE_TOKEN", KEY) } });
const r0 = await resolveWaCredentials({ config: { ...envConfig, waCoexistenceEnabled: false }, pool: p0 });
assert("flag OFF → env creds", r0.accessToken === "ENV_TOKEN" && r0.phoneNumberId === "ENV_PHONE");
assert("flag OFF → no DB query", p0.queries.length === 0);

// ── flag ON + active connection → store creds (decrypted) ──
_clearWaCredentialsCache();
const p1 = fakePool({ active: { phoneNumberId: "P1", wabaId: "W1", enc: encryptString("STORE_TOKEN", KEY) } });
const r1 = await resolveWaCredentials({ config: { ...envConfig, waCoexistenceEnabled: true }, pool: p1 });
assert("flag ON + connection → store token", r1.accessToken === "STORE_TOKEN" && r1.phoneNumberId === "P1");

// ── flag ON + no connection → env fallback ──
_clearWaCredentialsCache();
const p2 = fakePool({ active: null });
const r2 = await resolveWaCredentials({ config: { ...envConfig, waCoexistenceEnabled: true }, pool: p2 });
assert("flag ON + no connection → env fallback", r2.accessToken === "ENV_TOKEN" && r2.phoneNumberId === "ENV_PHONE");

// ── flag ON but no encryption key → env fallback (fail safe) ──
_clearWaCredentialsCache();
const p3 = fakePool({ active: { phoneNumberId: "P1", wabaId: "W1", enc: encryptString("STORE_TOKEN", KEY) } });
const r3 = await resolveWaCredentials({ config: { ...envConfig, waCoexistenceEnabled: true, tokenEncryptionKey: "" }, pool: p3 });
assert("no key → env fallback, no DB query", r3.accessToken === "ENV_TOKEN" && p3.queries.length === 0);

console.log(`\nwaCredentials: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
