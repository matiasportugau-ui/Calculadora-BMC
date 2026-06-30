/**
 * server/lib/omni/identity/duplicateContacts.js — pure, dependency-free
 * detection of likely-duplicate omni_contacts rows (Wave 6, detection only).
 *
 * resolveContact() (resolveContact.js) already dedupes NEW inbound contacts at
 * ingest time via DB unique constraints (integration_uuid / ml_user_id /
 * wa_phone / chrome_ext_contact_id) — those fields, by construction, can never
 * collide across two rows. Pre-existing duplicates therefore only show up on
 * the NON-unique fields: the same human reached BMC on two channels (e.g. WA
 * then email) and ended up as two separate contact rows sharing an email or
 * phone number. This module finds those candidate clusters; it does NOT merge
 * anything — see the module docstring on the (not yet built) merge endpoint
 * for why that's a deliberately separate, higher-stakes step.
 */
import { normalizeEmail, normalizeWaPhone } from "../types.js";

/**
 * Group contacts into duplicate-candidate clusters by normalized email and/or
 * normalized phone. A cluster is only reported when 2+ contacts share a key —
 * single contacts are never returned. A contact appearing in both an email-
 * match and a phone-match cluster simultaneously is the strongest signal
 * (`reasons` lists every key it matched on).
 *
 * @param {Array<{id:string, name?:string, email?:string, phone?:string,
 *   wa_phone?:string, ml_user_id?:string|number, created_at?:string,
 *   conversation_count?:number}>} contacts
 * @returns {Array<{key:string, reason:string, contacts:object[]}>} clusters,
 *   largest cluster first; ties broken by most recently created contact
 */
export function findDuplicateClusters(contacts = []) {
  const byEmail = new Map();
  const byPhone = new Map();

  for (const c of contacts) {
    const email = normalizeEmail(c?.email);
    if (email) {
      if (!byEmail.has(email)) byEmail.set(email, []);
      byEmail.get(email).push(c);
    }
    // omni_contacts.phone is free-form; normalizeWaPhone canonicalizes UY
    // numbers regardless of source format so "099123456" and "+59899123456"
    // cluster together the same way wa_phone already does at ingest. Check
    // both fields independently (not phone-falls-back-to-wa_phone) — a contact
    // edited manually could carry a different phone than its wa_phone, and
    // either one matching another contact's number is a real duplicate signal.
    const phoneKeys = new Set(
      [normalizeWaPhone(c?.phone), normalizeWaPhone(c?.wa_phone)].filter(Boolean),
    );
    for (const phone of phoneKeys) {
      if (!byPhone.has(phone)) byPhone.set(phone, []);
      byPhone.get(phone).push(c);
    }
  }

  const clusters = [];
  for (const [email, group] of byEmail) {
    if (group.length > 1) clusters.push({ key: `email:${email}`, reason: "mismo email", contacts: group });
  }
  for (const [phone, group] of byPhone) {
    if (group.length > 1) clusters.push({ key: `phone:${phone}`, reason: "mismo teléfono", contacts: group });
  }

  clusters.sort((a, b) => {
    if (b.contacts.length !== a.contacts.length) return b.contacts.length - a.contacts.length;
    const ta = Math.max(...a.contacts.map((c) => (c.created_at ? new Date(c.created_at).getTime() : 0)));
    const tb = Math.max(...b.contacts.map((c) => (c.created_at ? new Date(c.created_at).getTime() : 0)));
    return tb - ta;
  });

  return clusters;
}
