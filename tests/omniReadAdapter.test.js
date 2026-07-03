// Phase 2b read-model adapter — offline (pure mappers + SQL builders).
import {
  mapOmniConversation, mapOmniMessage, mapOmniSuggestion,
  buildOmniConversationsSql, buildOmniMessagesSql, buildOmniSuggestionsSql,
  OMNI_TO_WA_STATUS, WA_TO_OMNI_STATUS,
} from "../server/lib/wa/omniReadAdapter.js";

let passed = 0;
let failed = 0;
function assert(name, condition) {
  if (condition) { console.log(`  ✅ ${name}`); passed += 1; }
  else { console.log(`  ❌ ${name}`); failed += 1; }
}

// ── conversation mapper ──
const conv = mapOmniConversation({
  chat_id: "59899", phone: "59899", contact_name: "Ana",
  last_msg_at: "2026-06-30T10:00:00Z", last_msg_in_at: "2026-06-30T09:00:00Z", last_msg_out_at: null,
  omni_status: "open", properties: { owner_op: "MA", intent: "cotizacion", crm_row_id: 12 },
  unread_count: "3", created_at: "x", updated_at: "y",
});
assert("conv: status open→new", conv.status === "new");
assert("conv: chat_id/phone/name mapped", conv.chat_id === "59899" && conv.contact_name === "Ana");
assert("conv: owner_op from properties", conv.owner_op === "MA");
assert("conv: intent_last from properties.intent", conv.intent_last === "cotizacion");
assert("conv: lead_sheet_row from crm_row_id", conv.lead_sheet_row === 12);
assert("conv: unread_count coerced to number", conv.unread_count === 3);
assert("conv: resolved→closed", mapOmniConversation({ omni_status: "resolved", properties: {} }).status === "closed");
assert("conv: snoozed→pending", mapOmniConversation({ omni_status: "snoozed", properties: {} }).status === "pending");
assert("conv: unknown status → new fallback", mapOmniConversation({ omni_status: "weird", properties: {} }).status === "new");

// ── message mapper ──
const inMsg = mapOmniMessage({ id: "uuid1", chat_id: "59899", sender: "customer", body: "hola", metadata: { wa_msg_id: "wamid.A", source: "cloud_api" }, read_at: null, created_at: "t1" });
assert("msg: customer→direction in", inMsg.direction === "in");
assert("msg: msg_id from metadata.wa_msg_id", inMsg.msg_id === "wamid.A");
assert("msg: source from metadata", inMsg.source === "cloud_api");
assert("msg: unread → status sent", inMsg.status === "sent");
const outMsg = mapOmniMessage({ id: "uuid2", chat_id: "59899", sender: "agent", body: "hi", metadata: {}, read_at: "t", created_at: "t2" });
assert("msg: agent→direction out", outMsg.direction === "out");
assert("msg: read_at → status read", outMsg.status === "read");
assert("msg: msg_id falls back to omni id", outMsg.msg_id === "uuid2");

// ── suggestion mapper ──
const sug = mapOmniSuggestion({ id: "s1", chat_id: "59899", message_id: "m1", body: "Respuesta sugerida", metadata: { tone: "corta", provider: "claude" }, approval_state: "pending", resolved_at: null, created_at: "t", body_ai_category: "cotizacion" });
assert("sug: options[] single with text+tone", sug.options.length === 1 && sug.options[0].text === "Respuesta sugerida" && sug.options[0].tone === "corta");
assert("sug: pending → chosen_idx null", sug.chosen_idx === null);
assert("sug: intent from body_ai_category", sug.intent === "cotizacion");
assert("sug: provider from metadata", sug.provider === "claude");
const sugAcc = mapOmniSuggestion({ id: "s2", body: "x", metadata: {}, approval_state: "accepted", resolved_at: "t2", created_at: "t" });
// chosen_at comes from resolved_at (stamped by resolveSuggestion, migration 015).
assert("sug: accepted → chosen_idx 0, chosen_at from resolved_at", sugAcc.chosen_idx === 0 && sugAcc.chosen_at === "t2");
const sugAccOld = mapOmniSuggestion({ id: "s3", body: "x", metadata: {}, approval_state: "accepted", created_at: "t" });
assert("sug: accepted pre-015 (no resolved_at) → chosen_at null", sugAccOld.chosen_at === null);
assert("sug: default tone 'sugerida'", sugAcc.options[0].tone === "sugerida");

// ── SQL builders ──
const c1 = buildOmniConversationsSql({ status: "new", q: "ana", cursor: "2026-06-30T00:00:00Z", limit: 50 });
assert("convSql: always scopes channel=wa", c1.text.includes("c.channel = 'wa'"));
assert("convSql: status new → omni ANY(['open'])", JSON.stringify(c1.params[0]) === JSON.stringify(["open"]));
assert("convSql: q + cursor params present", c1.params.includes("%ana%") && c1.params.includes("2026-06-30T00:00:00Z"));
assert("convSql: limit+1", c1.text.includes("LIMIT 51"));
const c2 = buildOmniConversationsSql({ status: "stale_24h", q: "", cursor: "", limit: 10 });
assert("convSql: stale_24h computed branch (no status param)", c2.text.includes("24 hours") && c2.params.length === 0);
assert("WA_TO_OMNI_STATUS pending → [pending,snoozed]", JSON.stringify(WA_TO_OMNI_STATUS.pending) === JSON.stringify(["pending", "snoozed"]));
assert("OMNI_TO_WA_STATUS open=new", OMNI_TO_WA_STATUS.open === "new");

const m1 = buildOmniMessagesSql({ chatId: "59899", before: "2026-06-30T00:00:00Z", limit: 100 });
assert("msgSql: chat_id param + before clause", m1.params[0] === "59899" && m1.text.includes("m.created_at < $2") && m1.params[1] === "2026-06-30T00:00:00Z");
assert("msgSql: scopes channel=wa", m1.text.includes("c.channel='wa'"));

const s1 = buildOmniSuggestionsSql({ chatId: "59899", onlyPending: true, limit: 20 });
assert("sugSql: pending filter", s1.text.includes("s.approval_state = 'pending'") && s1.params[0] === "59899");
const s2 = buildOmniSuggestionsSql({ chatId: "59899", onlyPending: false, limit: 20 });
assert("sugSql: no pending filter when false", !s2.text.includes("approval_state = 'pending'"));
// resolved_at exists as of migration 015 (stamped on approve) — the adapter maps
// chosen_at from it. OMNI_WA_READS=1 therefore requires 015 applied first.
assert("sugSql: selects resolved_at (migration 015)", s1.text.includes("s.resolved_at") && s2.text.includes("s.resolved_at"));

console.log(`\nomniReadAdapter: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
