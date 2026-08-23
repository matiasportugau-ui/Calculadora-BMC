// waOnboarding.onboardNumber — Embedded Signup exchange → subscribe → register →
// persist. Offline: injected fetchImpl + fake pool. Guards Graph URLs, token-at-rest
// encryption, and that listing shape never carries the token.
import { onboardNumber, exchangeCodeForToken } from "../server/lib/wa/waOnboarding.js";

let passed = 0;
let failed = 0;
function assert(name, condition) {
  if (condition) { console.log(`  ✅ ${name}`); passed += 1; }
  else { console.log(`  ❌ ${name}`); failed += 1; }
}

const KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const config = {
  metaAppId: "APP123",
  whatsappAppSecret: "SECRET456",
  graphApiVersion: "v21.0",
  tokenEncryptionKey: KEY,
};

function resp(data, ok = true, status = 200) {
  return { ok, status, json: async () => data };
}

function fakeFetch({ oauthOk = true } = {}) {
  const calls = [];
  const fn = async (url, opts) => {
    calls.push({ url, opts });
    if (/oauth\/access_token/.test(url)) {
      return oauthOk ? resp({ access_token: "BUSINESS_TOKEN" }) : resp({ error: { message: "bad code" } }, false, 400);
    }
    if (/\/subscribed_apps/.test(url)) return resp({ success: true });
    if (/\/register/.test(url)) return resp({ success: true });
    if (/\?fields=/.test(url)) return resp({ display_phone_number: "+598 91 234 567", verified_name: "BMC", quality_rating: "GREEN" });
    return resp({}, false, 404);
  };
  fn.calls = calls;
  return fn;
}

function fakePool() {
  const queries = [];
  return {
    queries,
    query: async (sql, params) => {
      queries.push({ sql, params });
      if (/insert into wa_connections/.test(sql)) {
        return { rows: [{
          phone_number_id: params[0], waba_id: params[1], display_phone_number: params[2],
          verified_name: params[3], quality_rating: params[4], status: "active",
          subscribed: params[6], connected_by: params[7], created_at: "t", updated_at: "t",
        }] };
      }
      return { rows: [] };
    },
  };
}

// ── happy path ──
const fetchImpl = fakeFetch();
const pool = fakePool();
const conn = await onboardNumber({
  code: "CODE789", phoneNumberId: "PHONE1", wabaId: "WABA1",
  config, pool, fetchImpl, connectedBy: "op1",
});

assert("oauth exchange called with client_id + code", fetchImpl.calls.some(c => /oauth\/access_token/.test(c.url) && /client_id=APP123/.test(c.url) && /code=CODE789/.test(c.url)));
assert("subscribed_apps called for the WABA", fetchImpl.calls.some(c => /WABA1\/subscribed_apps/.test(c.url) && c.opts?.method === "POST"));
assert("register called for the phone", fetchImpl.calls.some(c => /PHONE1\/register/.test(c.url)));
assert("number details fetched", fetchImpl.calls.some(c => /PHONE1\?fields=/.test(c.url)));
assert("uses configured graph version", fetchImpl.calls.every(c => /graph\.facebook\.com\/v21\.0\//.test(c.url)));

assert("returns public connection", conn.phoneNumberId === "PHONE1" && conn.displayNumber === "+598 91 234 567" && conn.subscribed === true);
assert("public connection carries NO token", !("accessToken" in conn) && !("access_token_enc" in conn));

// token persisted ENCRYPTED, not plaintext
const insert = pool.queries.find(q => /insert into wa_connections/.test(q.sql));
const tokenEnc = insert.params[5];
assert("persisted token is an encrypted envelope", JSON.parse(tokenEnc).encrypted === true);
assert("persisted token is not plaintext", !tokenEnc.includes("BUSINESS_TOKEN"));

// ── error paths ──
let threwNoCode = false;
try { await onboardNumber({ code: "", phoneNumberId: "P", config, pool: fakePool(), fetchImpl: fakeFetch() }); }
catch { threwNoCode = true; }
assert("missing code → throws", threwNoCode);

let threwBadExchange = false;
try { await exchangeCodeForToken({ code: "X", config, fetchImpl: fakeFetch({ oauthOk: false }) }); }
catch (e) { threwBadExchange = /token exchange failed/.test(e.message); }
assert("failed exchange → throws token exchange failed", threwBadExchange);

console.log(`\nwaCoexistenceOnboarding: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
