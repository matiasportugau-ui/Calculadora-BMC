/**
 * Contract tests for server/lib/clientes/customerResolver.js + normalize.js.
 * Run: node tests/clientes-customer-resolver.test.js
 *
 * Style mirrors tests/budget.test.js — manual passed/failed counters, no
 * external test framework, fail-fast assertions.
 */

import {
  normalizePhoneE164UY,
  normalizeEmail,
  normalizeRut,
  normalizeDisplayName,
  levenshtein,
  namesAreFuzzyMatch,
} from "../server/lib/clientes/normalize.js";
import { resolveCustomer } from "../server/lib/clientes/customerResolver.js";

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) { passed += 1; }
  else { failed += 1; console.error(`  ✗ ${label}`); }
}
function assertEq(actual, expected, label) {
  const ok = actual === expected;
  if (ok) { passed += 1; }
  else { failed += 1; console.error(`  ✗ ${label}\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`); }
}
function group(name, fn) { console.log(`\n— ${name}`); return fn(); }

// ═════════════════════════════════════════════════════════════════════════
// 1. normalize.js
// ═════════════════════════════════════════════════════════════════════════

group("normalizePhoneE164UY", () => {
  assertEq(normalizePhoneE164UY("099123456"), "59899123456", "local with trunk 0 → +598 + 8 digits");
  assertEq(normalizePhoneE164UY("99123456"),  "59899123456", "8 digits without trunk → +598 + 8 digits");
  assertEq(normalizePhoneE164UY("+598 99 123 456"), "59899123456", "E.164 with spaces");
  assertEq(normalizePhoneE164UY("0059899123456"), "59899123456", "international 00 prefix dropped");
  assertEq(normalizePhoneE164UY("(099) 123-456"), "59899123456", "punctuation stripped");
  // Codex P1 — country code + trunk zero must canonicalize like the local form:
  assertEq(normalizePhoneE164UY("+598 099 123 456"), "59899123456", "+598 + trunk-0 → drop trunk-0");
  assertEq(normalizePhoneE164UY("598099123456"), "59899123456", "598 + trunk-0 (no plus) → drop trunk-0");
  assertEq(normalizePhoneE164UY("00598099123456"), "59899123456", "00598 + trunk-0 → strip 00 + drop trunk-0");
  assertEq(normalizePhoneE164UY(""), null, "empty → null");
  assertEq(normalizePhoneE164UY(null), null, "null → null");
  assertEq(normalizePhoneE164UY(undefined), null, "undefined → null");
  assertEq(normalizePhoneE164UY("abc"), null, "no digits → null");
  assertEq(normalizePhoneE164UY("5491155667788"), "5491155667788", "Argentina E.164 untouched");
});

group("normalizeEmail", () => {
  assertEq(normalizeEmail("Foo@BAR.com"), "foo@bar.com", "lowercased");
  assertEq(normalizeEmail("  user@host.tld  "), "user@host.tld", "trimmed");
  assertEq(normalizeEmail(""), null, "empty → null");
  assertEq(normalizeEmail("not-an-email"), null, "no @ → null");
  assertEq(normalizeEmail("@host.tld"), null, "@ at start → null");
  assertEq(normalizeEmail("user@"), null, "@ at end → null");
  assertEq(normalizeEmail(null), null, "null → null");
});

group("normalizeRut", () => {
  assertEq(normalizeRut("21.123.456.789-1"), "211234567891", "12 digits with punct");
  assertEq(normalizeRut("211234567891"), "211234567891", "12 digits clean");
  assertEq(normalizeRut("123"), null, "<12 digits → null");
  assertEq(normalizeRut("1234567890123"), null, ">12 digits → null");
  assertEq(normalizeRut(""), null, "empty → null");
  assertEq(normalizeRut(null), null, "null → null");
});

group("normalizeDisplayName", () => {
  assertEq(normalizeDisplayName("José Pérez S.A."), "jose perez s a", "diacritics + punct stripped");
  assertEq(normalizeDisplayName("  Multi   Spaces  "), "multi spaces", "whitespace collapsed");
  assertEq(normalizeDisplayName(""), "", "empty → empty");
  assertEq(normalizeDisplayName(null), "", "null → empty");
});

group("levenshtein", () => {
  assertEq(levenshtein("metalog", "metalog"), 0, "identical → 0");
  assertEq(levenshtein("metalog", "metalg"),  1, "1 deletion → 1");
  assertEq(levenshtein("kitten", "sitting"),  3, "classic example");
  assertEq(levenshtein("", "abc"), 3, "empty vs 3 chars");
  assertEq(levenshtein("abc", ""), 3, "3 chars vs empty");
  assert(levenshtein(null, "x") === Infinity, "null input → Infinity");
});

group("namesAreFuzzyMatch", () => {
  assert(namesAreFuzzyMatch("Pedro Pérez", "pedro perez"), "diacritic-only diff");
  assert(namesAreFuzzyMatch("Acme S.A.", "acme s a"), "punctuation-only diff");
  assert(namesAreFuzzyMatch("Construcciones BMC", "Construcione BMC", 2), "1 typo within threshold");
  assert(!namesAreFuzzyMatch("Pedro", "Maria"), "different names not a match");
  assert(!namesAreFuzzyMatch("", "anything"), "empty does not match");
});

// ═════════════════════════════════════════════════════════════════════════
// 2. resolveCustomer — in-memory mock store
// ═════════════════════════════════════════════════════════════════════════

function createInMemoryStore() {
  const customers = new Map();         // id → customer
  const identities = new Map();        // `${channel}|${externalId}` → { customerId }
  const aliases = new Map();           // `${channel}|${externalId}` → { customerId }
  const phoneIdx = new Map();          // phoneE164 → customerId
  const emailIdx = new Map();          // email → customerId
  const rutIdx = new Map();            // rut → customerId
  const manualReview = [];
  let seq = 0;

  return {
    // ── helpers exposed for tests ────────────────────────────────────────
    _seedCustomer(c) {
      const id = c.id || `cust-${++seq}`;
      const row = {
        id,
        displayName: c.displayName || "",
        primaryPhoneE164: c.primaryPhoneE164 || null,
        primaryEmail: c.primaryEmail || null,
        rut: c.rut || null,
        channels: c.channels || [],
      };
      customers.set(id, row);
      if (row.primaryPhoneE164) phoneIdx.set(row.primaryPhoneE164, id);
      if (row.primaryEmail)     emailIdx.set(row.primaryEmail, id);
      if (row.rut)              rutIdx.set(row.rut, id);
      return row;
    },
    _seedAlias(channel, externalId, customerId) {
      aliases.set(`${channel}|${externalId}`, { customerId });
    },
    _seedIdentity(channel, externalId, customerId) {
      identities.set(`${channel}|${externalId}`, { customerId });
    },
    _customers: customers,
    _identities: identities,
    _manualReview: manualReview,

    // ── store contract ───────────────────────────────────────────────────
    async findAlias(channel, externalId) {
      return aliases.get(`${channel}|${externalId}`) || null;
    },
    async findIdentity(channel, externalId) {
      return identities.get(`${channel}|${externalId}`) || null;
    },
    async findCustomerByPhone(phone) {
      const id = phoneIdx.get(phone);
      return id ? customers.get(id) : null;
    },
    async findCustomerByEmail(email) {
      const id = emailIdx.get(email);
      return id ? customers.get(id) : null;
    },
    async findCustomerByRut(rut) {
      const id = rutIdx.get(rut);
      return id ? customers.get(id) : null;
    },
    async findCustomersByName(name, maxDistance) {
      const target = normalizeDisplayName(name);
      const out = [];
      for (const c of customers.values()) {
        if (levenshtein(normalizeDisplayName(c.displayName), target) <= maxDistance) {
          out.push(c);
        }
      }
      return out;
    },
    async findCustomersByPhonePrefix(prefix, n) {
      const out = [];
      for (const [phone, id] of phoneIdx.entries()) {
        if (phone.startsWith(prefix)) {
          out.push(customers.get(id));
          if (out.length >= n) break;
        }
      }
      return out;
    },
    async createCustomer(payload) {
      const id = `cust-${++seq}`;
      const row = {
        id,
        displayName: payload.displayName,
        primaryPhoneE164: payload.primaryPhoneE164 || null,
        primaryEmail: payload.primaryEmail || null,
        rut: payload.rut || null,
        channels: Array.isArray(payload.channels) ? payload.channels.slice() : [],
      };
      customers.set(id, row);
      if (row.primaryPhoneE164) phoneIdx.set(row.primaryPhoneE164, id);
      if (row.primaryEmail)     emailIdx.set(row.primaryEmail, id);
      if (row.rut)              rutIdx.set(row.rut, id);
      return row;
    },
    async createIdentity({ customerId, channel, externalId }) {
      identities.set(`${channel}|${externalId}`, { customerId });
    },
    async enqueueManualReview(payload) {
      manualReview.push(payload);
    },
  };
}

group("resolveCustomer — manual alias wins over everything", async () => {
  const store = createInMemoryStore();
  store._seedCustomer({ id: "alice",   displayName: "Alice",   primaryPhoneE164: "59811111111" });
  store._seedCustomer({ id: "bob",     displayName: "Bob",     primaryPhoneE164: "59899123456" });
  store._seedAlias("ml", "ML-789", "alice");

  const r = await resolveCustomer({
    channel: "ml",
    externalId: "ML-789",
    displayName: "Bob",
    contactHint: { phone: "099123456" },  // would otherwise match Bob
  }, store);

  assertEq(r.source, "alias", "source=alias");
  assertEq(r.customerId, "alice", "customerId=alice (alias overrides)");
});

group("resolveCustomer — direct identity lookup hits", async () => {
  const store = createInMemoryStore();
  store._seedCustomer({ id: "carla", displayName: "Carla" });
  store._seedIdentity("wa", "59899111222", "carla");

  const r = await resolveCustomer({
    channel: "wa",
    externalId: "59899111222",
  }, store);

  assertEq(r.source, "identity", "source=identity");
  assertEq(r.customerId, "carla", "customerId=carla");
});

group("resolveCustomer — phone match links new identity", async () => {
  const store = createInMemoryStore();
  store._seedCustomer({ id: "diego", displayName: "Diego", primaryPhoneE164: "59899123456" });

  const r = await resolveCustomer({
    channel: "ml",
    externalId: "ML-100",
    contactHint: { phone: "099 123 456" },
  }, store);

  assertEq(r.source, "phone_match", "source=phone_match");
  assertEq(r.customerId, "diego", "customerId=diego");
  assert(store._identities.has("ml|ML-100"), "identity ml|ML-100 was created");
});

group("resolveCustomer — email match links new identity", async () => {
  const store = createInMemoryStore();
  store._seedCustomer({ id: "elena", displayName: "Elena", primaryEmail: "elena@example.com" });

  const r = await resolveCustomer({
    channel: "shopify",
    externalId: "shop-42",
    contactHint: { email: "Elena@Example.COM" },
  }, store);

  assertEq(r.source, "email_match", "source=email_match");
  assertEq(r.customerId, "elena", "customerId=elena");
});

group("resolveCustomer — RUT match links new identity", async () => {
  const store = createInMemoryStore();
  store._seedCustomer({ id: "fab", displayName: "Fabrica X", rut: "211234567891" });

  const r = await resolveCustomer({
    channel: "calculadora",
    externalId: "calc-555",
    contactHint: { rut: "21.123.456.789-1" },
  }, store);

  assertEq(r.source, "rut_match", "source=rut_match");
  assertEq(r.customerId, "fab", "customerId=fab");
});

group("resolveCustomer — phone wins over email when both match different customers", async () => {
  const store = createInMemoryStore();
  store._seedCustomer({ id: "g1", displayName: "G One", primaryPhoneE164: "59899111111" });
  store._seedCustomer({ id: "g2", displayName: "G Two", primaryEmail: "g2@example.com" });

  const r = await resolveCustomer({
    channel: "wa",
    externalId: "wa-X",
    contactHint: { phone: "099 111 111", email: "g2@example.com" },
  }, store);

  assertEq(r.source, "phone_match", "phone has higher precedence than email");
  assertEq(r.customerId, "g1", "customerId=g1 (phone match wins)");
});

group("resolveCustomer — no match → creates new customer", async () => {
  const store = createInMemoryStore();
  const r = await resolveCustomer({
    channel: "wa",
    externalId: "59899555555",
    displayName: "Nuevo Cliente",
    contactHint: { phone: "099555555" },
  }, store);

  assertEq(r.source, "new", "source=new");
  assert(typeof r.customerId === "string" && r.customerId.length > 0, "customerId returned");
  const c = store._customers.get(r.customerId);
  assert(!!c, "new customer is in store");
  assertEq(c.primaryPhoneE164, "59899555555", "phone normalized to E.164");
});

group("resolveCustomer — fuzzy disabled by default (no manual_review)", async () => {
  const store = createInMemoryStore();
  store._seedCustomer({ id: "metalog", displayName: "Metalog SAS", channels: ["ml"], primaryPhoneE164: "59899100200" });

  const r = await resolveCustomer({
    channel: "ml",
    externalId: "ML-NEW",
    displayName: "Metalg SAS",
    contactHint: { phone: "099 100 200" },
  }, store);

  // phone match exists → that path wins regardless of fuzzy
  assertEq(r.source, "phone_match", "phone match still wins when present");

  const r2 = await resolveCustomer({
    channel: "ml",
    externalId: "ML-NEW2",
    displayName: "Metalg SAS",        // 1 typo from "Metalog SAS"
    // no contactHint → strong matches all miss
  }, store);
  assertEq(r2.source, "new", "without fuzzy enabled → new customer (no manual review)");
  assertEq(store._manualReview.length, 0, "no manual review enqueued when fuzzy disabled");
});

group("resolveCustomer — fuzzy enabled enqueues manual review when gate satisfied", async () => {
  const store = createInMemoryStore();
  store._seedCustomer({
    id: "metalog",
    displayName: "Metalog SAS",
    channels: ["ml"],                  // same-channel gate hits
    primaryPhoneE164: "59899100200",
  });

  const r = await resolveCustomer({
    channel: "ml",
    externalId: "ML-NEW",
    displayName: "Metalg SAS",          // 1 char off
    // no contactHint — strong matches all miss
  }, store, { enableFuzzy: true });

  assertEq(r.source, "manual_review_pending", "fuzzy hit → manual review");
  assertEq(r.customerId, null, "no auto-link when fuzzy");
  assert(Array.isArray(r.candidates) && r.candidates.includes("metalog"), "candidate metalog included");
  assertEq(store._manualReview.length, 1, "enqueueManualReview was called once");
});

group("resolveCustomer — fuzzy enabled but gate fails → new customer", async () => {
  const store = createInMemoryStore();
  store._seedCustomer({
    id: "metalog",
    displayName: "Metalog SAS",
    channels: ["wa"],                   // different channel
    primaryPhoneE164: "59899100200",
  });

  const r = await resolveCustomer({
    channel: "ml",                      // not previously seen on this customer
    externalId: "ML-NEW",
    displayName: "Metalg SAS",
    // no phone hint → no prefix gate either
  }, store, { enableFuzzy: true });

  assertEq(r.source, "new", "gate fails (different channel + no phone) → new customer");
  assertEq(store._manualReview.length, 0, "no manual review enqueued");
});

group("resolveCustomer — input validation", async () => {
  const store = createInMemoryStore();
  let threw = false;
  try { await resolveCustomer(null, store); } catch { threw = true; }
  assert(threw, "throws on null input");

  threw = false;
  try { await resolveCustomer({ channel: "ml" }, store); } catch { threw = true; }
  assert(threw, "throws when externalId missing");

  threw = false;
  try { await resolveCustomer({ channel: "ml", externalId: "x" }, null); } catch { threw = true; }
  assert(threw, "throws when store is null");

  threw = false;
  try { await resolveCustomer({ channel: "ml", externalId: "x" }, { findAlias: () => null }); } catch { threw = true; }
  assert(threw, "throws when store missing required methods");
});

// ═════════════════════════════════════════════════════════════════════════
// Summary
// ═════════════════════════════════════════════════════════════════════════

(async () => {
  // resolveCustomer groups are async — wait for any pending microtasks.
  await new Promise((r) => setImmediate(r));
  console.log(`\n════════════════════════════════════════════════════════════`);
  console.log(`clientes-customer-resolver tests — passed: ${passed}, failed: ${failed}`);
  console.log(`════════════════════════════════════════════════════════════`);
  if (failed > 0) process.exit(1);
})();
