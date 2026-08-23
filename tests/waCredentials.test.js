// resolveWaCredentials — store-first outbound credentials with env fallback. Offline,
// fake pool + injected. Guards zero-regression: flag OFF or no connection ⇒ env creds.
// Also guards cache correctness: misses must not stick for TTL; disable must drop cache.
import {
  resolveWaCredentials,
  _clearWaCredentialsCache,
  invalidateWaCredentialsCache,
} from "../server/lib/wa/waCredentials.js";
import { encryptString } from "../server/lib/secretBox.js";
import { disableConnection } from "../server/lib/wa/waConnectionStore.js";

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
  let activeRow = active;
  return {
    queries,
    setActive(next) { activeRow = next; },
    query: async (sql, params) => {
      queries.push({ sql, params });
      if (/update wa_connections set status = 'inactive'/.test(sql)) {
        if (activeRow && activeRow.phoneNumberId === params[0]) {
          activeRow = null;
          return { rowCount: 1, rows: [] };
        }
        return { rowCount: 0, rows: [] };
      }
      if (/from wa_connections/.test(sql)) {
        if (!activeRow) return { rows: [] };
        return { rows: [{ phone_number_id: activeRow.phoneNumberId, waba_id: activeRow.wabaId, access_token_enc: activeRow.enc }] };
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

// ── FA: miss must not be cached — connect after a probe must take effect immediately ──
_clearWaCredentialsCache();
const pMiss = fakePool({ active: null });
const cfgOn = { ...envConfig, waCoexistenceEnabled: true };
const before = await resolveWaCredentials({ config: cfgOn, pool: pMiss });
assert("probe miss → env", before.accessToken === "ENV_TOKEN");
pMiss.setActive({ phoneNumberId: "P_NEW", wabaId: "W_NEW", enc: encryptString("NEW_TOKEN", KEY) });
const afterConnect = await resolveWaCredentials({ config: cfgOn, pool: pMiss });
assert(
  "FA: after connect (no invalidate) miss was not sticky → store token",
  afterConnect.accessToken === "NEW_TOKEN" && afterConnect.phoneNumberId === "P_NEW",
);

// ── FA: positive cache + disableConnection must invalidate (no 60s ghost sender) ──
_clearWaCredentialsCache();
const pDis = fakePool({ active: { phoneNumberId: "P_OLD", wabaId: "W_OLD", enc: encryptString("OLD_TOKEN", KEY) } });
const warm = await resolveWaCredentials({ config: cfgOn, pool: pDis });
assert("warm cache → store", warm.accessToken === "OLD_TOKEN");
const qBeforeDisable = pDis.queries.length;
const cachedAgain = await resolveWaCredentials({ config: cfgOn, pool: pDis });
assert("second resolve hits cache (no extra SELECT)", cachedAgain.accessToken === "OLD_TOKEN" && pDis.queries.length === qBeforeDisable);
await disableConnection(pDis, "P_OLD");
const afterDisable = await resolveWaCredentials({ config: cfgOn, pool: pDis });
assert(
  "FA: after disableConnection → env (cache invalidated)",
  afterDisable.accessToken === "ENV_TOKEN" && afterDisable.phoneNumberId === "ENV_PHONE",
);
invalidateWaCredentialsCache(); // tidy

console.log(`\nwaCredentials: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
