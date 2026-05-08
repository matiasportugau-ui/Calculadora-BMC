// ═══════════════════════════════════════════════════════════════════════════
// server/lib/clientes/customerResolver.js — agent-resolver algorithm.
// ───────────────────────────────────────────────────────────────────────────
// Implements §4.4 of docs/clientes-360/FEATURE-BRIEF-v2.md:
//
//   For each incoming event with (channel, externalId, contactHint):
//     1. Manual override:  customer_aliases  by (channel, externalId)
//     2. Direct lookup:    customer_identities by (channel, externalId)
//     3. Strong match:     normalized phone OR email OR RUT against customers
//     4. Fuzzy match:      Levenshtein(displayName, customer.display_name) ≤ 2
//                          AND (same prior channel OR shared phone prefix)
//                          → enqueue manual_review (no auto-link)
//     5. New customer:     create customers row + identity link
//
// Phase 1 brief explicitly says "sin fuzzy aún, solo match fuerte" — fuzzy is
// gated by `opts.enableFuzzy` (default: false). Phase 2 turns it on.
//
// Pure-function design: no DB, no fetch. Caller passes a `store` object
// implementing the contract documented below. Tests inject an in-memory
// mock; production wires this to Postgres.
//
// Store contract (all methods async):
//
//   findAlias(channel, externalId)           → { customerId } | null
//   findIdentity(channel, externalId)        → { customerId } | null
//   findCustomerByPhone(phoneE164)           → { id, displayName, ...} | null
//   findCustomerByEmail(emailLower)          → ... | null
//   findCustomerByRut(rut12)                 → ... | null
//   findCustomersByName(name, maxDistance)   → Customer[]   (fuzzy candidates)
//   findCustomersByPhonePrefix(prefix, n)    → Customer[]   (used in fuzzy gate)
//   createCustomer(payload)                  → { id, ...}
//   createIdentity(payload)                  → void
//   enqueueManualReview(payload)             → void
//
// Design note: the resolver returns a discriminated result object; it does
// NOT throw on "no match". Caller decides whether to retry, escalate, or
// drop the event. This makes the resolver safe to use from cron jobs and
// from synchronous webhook handlers alike.
// ═══════════════════════════════════════════════════════════════════════════

import {
  normalizePhoneE164UY,
  normalizeEmail,
  normalizeRut,
  normalizeDisplayName,
  levenshtein,
} from "./normalize.js";

/**
 * @typedef {Object} ContactHint
 * @property {string} [phone]
 * @property {string} [email]
 * @property {string} [rut]
 *
 * @typedef {Object} ResolverInput
 * @property {string} channel       'wa'|'ml'|'shopify'|'sheets'|'identity'|'calculadora'|...
 * @property {string} externalId    stable ID in the source system
 * @property {string} [displayName]
 * @property {ContactHint} [contactHint]
 *
 * @typedef {Object} ResolverResult
 * @property {string|null} customerId   null when source==='manual_review_pending'
 * @property {'alias'|'identity'|'phone_match'|'email_match'|'rut_match'|'manual_review_pending'|'new'} source
 * @property {string[]} [candidates]   present when source==='manual_review_pending'
 *
 * @typedef {Object} ResolverOptions
 * @property {boolean} [enableFuzzy=false]
 * @property {number}  [fuzzyMaxDistance=2]
 */

/**
 * Resolve an event to a customer_id.
 *
 * @param {ResolverInput}  input
 * @param {object}         store   see contract above
 * @param {ResolverOptions} [opts]
 * @returns {Promise<ResolverResult>}
 */
export async function resolveCustomer(input, store, opts = {}) {
  const { channel, externalId, displayName, contactHint } = _validateInput(input);
  _validateStore(store);

  // 1. Manual override.
  const alias = await store.findAlias(channel, externalId);
  if (alias?.customerId) {
    return { customerId: alias.customerId, source: "alias" };
  }

  // 2. Direct identity lookup.
  const identity = await store.findIdentity(channel, externalId);
  if (identity?.customerId) {
    return { customerId: identity.customerId, source: "identity" };
  }

  // 3. Strong match by normalized contact hint.
  const phone = normalizePhoneE164UY(contactHint?.phone);
  if (phone) {
    const c = await store.findCustomerByPhone(phone);
    if (c?.id) {
      await store.createIdentity({ customerId: c.id, channel, externalId });
      return { customerId: c.id, source: "phone_match" };
    }
  }
  const email = normalizeEmail(contactHint?.email);
  if (email) {
    const c = await store.findCustomerByEmail(email);
    if (c?.id) {
      await store.createIdentity({ customerId: c.id, channel, externalId });
      return { customerId: c.id, source: "email_match" };
    }
  }
  const rut = normalizeRut(contactHint?.rut);
  if (rut) {
    const c = await store.findCustomerByRut(rut);
    if (c?.id) {
      await store.createIdentity({ customerId: c.id, channel, externalId });
      return { customerId: c.id, source: "rut_match" };
    }
  }

  // 4. Fuzzy match — Phase 2 (gated by opts.enableFuzzy).
  const enableFuzzy = !!opts.enableFuzzy;
  const maxDistance = Number.isFinite(opts.fuzzyMaxDistance) ? opts.fuzzyMaxDistance : 2;
  if (enableFuzzy && displayName) {
    const candidates = await _findFuzzyCandidates({
      store,
      displayName,
      maxDistance,
      phone,
      channel,
    });
    if (candidates.length > 0) {
      await store.enqueueManualReview({
        channel,
        externalId,
        candidateCustomerIds: candidates.map((c) => c.id),
        hint: { displayName, contactHint: contactHint || null },
      });
      return {
        customerId: null,
        source: "manual_review_pending",
        candidates: candidates.map((c) => c.id),
      };
    }
  }

  // 5. New customer.
  const newCustomer = await store.createCustomer({
    displayName: displayName || `${channel}:${externalId}`,
    rut: rut || null,
    primaryPhoneE164: phone || null,
    primaryEmail: email || null,
    channels: [channel],
  });
  await store.createIdentity({
    customerId: newCustomer.id,
    channel,
    externalId,
  });
  return { customerId: newCustomer.id, source: "new" };
}

// ─── internals ─────────────────────────────────────────────────────────────

async function _findFuzzyCandidates({ store, displayName, maxDistance, phone, channel }) {
  const byName = (await store.findCustomersByName(displayName, maxDistance)) || [];
  if (byName.length === 0) return [];
  const targetNorm = normalizeDisplayName(displayName);

  // Gate: same channel previously OR shared phone prefix (first 6 digits).
  const prefix = phone && phone.length >= 6 ? phone.slice(0, 6) : null;
  const byPrefix = prefix
    ? new Set(((await store.findCustomersByPhonePrefix(prefix, 50)) || []).map((c) => c.id))
    : new Set();

  return byName.filter((c) => {
    const dn = normalizeDisplayName(c.displayName || c.display_name || "");
    if (!dn) return false;
    if (levenshtein(dn, targetNorm) > maxDistance) return false;
    const channels = c.channels || [];
    const sameChannel = Array.isArray(channels) && channels.includes(channel);
    const phonePrefixMatch = prefix && byPrefix.has(c.id);
    return sameChannel || phonePrefixMatch;
  });
}

function _validateInput(input) {
  if (!input || typeof input !== "object") {
    throw new TypeError("resolveCustomer: input must be an object");
  }
  const { channel, externalId, displayName, contactHint } = input;
  if (typeof channel !== "string" || !channel) {
    throw new TypeError("resolveCustomer: input.channel is required");
  }
  if (typeof externalId !== "string" || !externalId) {
    throw new TypeError("resolveCustomer: input.externalId is required");
  }
  return {
    channel,
    externalId,
    displayName: displayName ? String(displayName) : null,
    contactHint: contactHint || null,
  };
}

const REQUIRED_STORE_METHODS = [
  "findAlias",
  "findIdentity",
  "findCustomerByPhone",
  "findCustomerByEmail",
  "findCustomerByRut",
  "findCustomersByName",
  "findCustomersByPhonePrefix",
  "createCustomer",
  "createIdentity",
  "enqueueManualReview",
];

function _validateStore(store) {
  if (!store || typeof store !== "object") {
    throw new TypeError("resolveCustomer: store must be an object");
  }
  for (const m of REQUIRED_STORE_METHODS) {
    if (typeof store[m] !== "function") {
      throw new TypeError(`resolveCustomer: store.${m} must be a function`);
    }
  }
}
