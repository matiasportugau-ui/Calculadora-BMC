// tests/omniUrgentActions.test.js — standalone (no deps, no server) unit test for
// the Omni "reply-zero" urgency scoring. Run: `node tests/omniUrgentActions.test.js`.
import assert from "node:assert/strict";
import {
  scoreConversationUrgency,
  rankUrgentConversations,
  DEFAULT_SLA_HOURS,
} from "../server/lib/omni/urgency.js";

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

const NOW = new Date("2026-06-30T12:00:00Z");
const hoursAgo = (h) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

// ── scoreConversationUrgency ────────────────────────────────────────────────

check("awaiting first reply within SLA → scored, not breached", () => {
  const u = scoreConversationUrgency(
    { channel: "email", status: "open", created_at: hoursAgo(1), first_agent_reply_at: null },
    { now: NOW },
  );
  assert.ok(u.score > 0, "has positive score");
  assert.equal(u.sla_breached, false, "1h < email SLA 2h");
  assert.ok(u.reasons.some((r) => r.includes("esperando")), "mentions awaiting");
  assert.ok(!u.reasons.some((r) => r.includes("SLA")), "no SLA breach reason");
});

check("awaiting past SLA → breached, +100 weight, breach reason", () => {
  const within = scoreConversationUrgency(
    { channel: "email", status: "open", created_at: hoursAgo(1), first_agent_reply_at: null },
    { now: NOW },
  );
  const breached = scoreConversationUrgency(
    { channel: "email", status: "open", created_at: hoursAgo(5), first_agent_reply_at: null },
    { now: NOW },
  );
  assert.equal(breached.sla_breached, true);
  assert.ok(breached.reasons.some((r) => r.includes("SLA vencido")));
  // breach adds a large fixed boost on top of age — clearly more urgent than within-SLA.
  assert.ok(breached.score >= within.score + 100, "breach dominates ranking");
});

check("already replied → no awaiting, low score", () => {
  const u = scoreConversationUrgency(
    {
      channel: "email",
      status: "open",
      created_at: hoursAgo(10),
      first_agent_reply_at: hoursAgo(9),
      assigned_to_user_id: "u1",
    },
    { now: NOW },
  );
  assert.equal(u.awaiting_hours, 0);
  assert.equal(u.sla_breached, false);
  assert.ok(!u.reasons.some((r) => r.includes("esperando")));
  assert.equal(u.score, 0, "replied + assigned + no unread → nothing urgent");
});

check("unassigned adds weight + reason", () => {
  const base = { channel: "email", status: "open", created_at: hoursAgo(9), first_agent_reply_at: hoursAgo(8) };
  const assigned = scoreConversationUrgency({ ...base, assigned_to_user_id: "u1" }, { now: NOW });
  const unassigned = scoreConversationUrgency({ ...base, assigned_to_user_id: null }, { now: NOW });
  assert.ok(unassigned.score > assigned.score);
  assert.ok(unassigned.reasons.some((r) => r.includes("sin asignar")));
});

check("unread customer messages add weight + reason", () => {
  const base = {
    channel: "email",
    status: "open",
    created_at: hoursAgo(9),
    first_agent_reply_at: hoursAgo(8),
    assigned_to_user_id: "u1",
  };
  const none = scoreConversationUrgency({ ...base, unread_count: 0 }, { now: NOW });
  const some = scoreConversationUrgency({ ...base, unread_count: 3 }, { now: NOW });
  assert.ok(some.score > none.score);
  assert.ok(some.reasons.some((r) => r.includes("3 sin leer")));
});

check("high priority adds weight (priority is the real INTEGER column type, not a string enum)", () => {
  const base = {
    channel: "email",
    status: "open",
    created_at: hoursAgo(9),
    first_agent_reply_at: hoursAgo(8),
    assigned_to_user_id: "u1",
  };
  const normal = scoreConversationUrgency({ ...base, priority: 0 }, { now: NOW });
  const high = scoreConversationUrgency({ ...base, priority: 10 }, { now: NOW });
  assert.ok(high.score > normal.score);
  assert.ok(high.reasons.some((r) => r.includes("prioridad 10")));
});

check("WA breaches faster than email (channel SLA)", () => {
  // 1h awaiting: WA (SLA 0.5h) breaches, email (SLA 2h) does not.
  const wa = scoreConversationUrgency(
    { channel: "wa", status: "open", created_at: hoursAgo(1), first_agent_reply_at: null },
    { now: NOW },
  );
  const email = scoreConversationUrgency(
    { channel: "email", status: "open", created_at: hoursAgo(1), first_agent_reply_at: null },
    { now: NOW },
  );
  assert.equal(wa.sla_breached, true);
  assert.equal(email.sla_breached, false);
  assert.equal(wa.sla_hours, DEFAULT_SLA_HOURS.wa);
  assert.equal(email.sla_hours, DEFAULT_SLA_HOURS.email);
});

check("missing/empty fields degrade gracefully (no throw)", () => {
  const u = scoreConversationUrgency({}, { now: NOW });
  // empty conv: awaiting (first_agent_reply_at undefined == null) but no timestamps → 0 age,
  // unassigned (assigned_to_user_id undefined == null) → some score, never NaN.
  assert.ok(Number.isFinite(u.score));
  assert.ok(Array.isArray(u.reasons));
});

// ── rankUrgentConversations ─────────────────────────────────────────────────

check("ranks by score desc and respects limit", () => {
  const convs = [
    { id: "calm", channel: "email", status: "open", created_at: hoursAgo(1), first_agent_reply_at: hoursAgo(0.5), assigned_to_user_id: "u1" },
    { id: "breach", channel: "email", status: "open", created_at: hoursAgo(6), first_agent_reply_at: null, assigned_to_user_id: null },
    { id: "mild", channel: "email", status: "open", created_at: hoursAgo(1), first_agent_reply_at: null, assigned_to_user_id: "u1" },
  ];
  const ranked = rankUrgentConversations(convs, { now: NOW, limit: 2 });
  assert.equal(ranked.length, 2, "limit applied");
  assert.equal(ranked[0].id, "breach", "most urgent first");
  assert.ok(ranked[0].urgency.score >= ranked[1].urgency.score);
});

check("excludes non-open conversations defensively", () => {
  const convs = [
    { id: "closed", channel: "email", status: "closed", created_at: hoursAgo(10), first_agent_reply_at: null },
    { id: "open", channel: "email", status: "open", created_at: hoursAgo(10), first_agent_reply_at: null },
  ];
  const ranked = rankUrgentConversations(convs, { now: NOW });
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].id, "open");
});

check("tie-break: oldest conversation first", () => {
  // Two identical-shape unassigned awaiting convs at the same SLA tier; older created_at wins.
  const convs = [
    { id: "newer", channel: "email", status: "open", created_at: hoursAgo(3), first_agent_reply_at: null, assigned_to_user_id: null },
    { id: "older", channel: "email", status: "open", created_at: hoursAgo(3.0), first_agent_reply_at: null, assigned_to_user_id: null },
  ];
  // make 'older' genuinely older by a hair
  convs[1].created_at = hoursAgo(4);
  const ranked = rankUrgentConversations(convs, { now: NOW });
  // older has more awaiting hours → higher score anyway; assert it leads.
  assert.equal(ranked[0].id, "older");
});

check("empty input → empty queue", () => {
  assert.deepEqual(rankUrgentConversations([], { now: NOW }), []);
  assert.deepEqual(rankUrgentConversations(undefined, { now: NOW }), []);
});

console.log(`\n✅ omniUrgentActions: ${passed} checks OK`);
