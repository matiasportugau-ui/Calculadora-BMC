/**
 * PEA Bug CS — accept/reject/escalate TOCTOU under row lock.
 * Concurrent review mutations must not both return ok and clobber terminal state.
 * Run: node tests/peaAcceptRejectRace.test.js
 */
import {
  acceptPeaPacket,
  rejectPeaPacket,
  escalatePeaPacket,
  ACCEPTABLE_PACKET_STATUSES,
  REJECTABLE_PACKET_STATUSES,
  ESCALATABLE_PACKET_STATUSES,
  TERMINAL_OR_BLOCKED_GAP_STATUSES,
} from "../server/lib/pea/packetReview.js";

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

assert(ACCEPTABLE_PACKET_STATUSES.has("ready_for_review"), "accept allows ready_for_review");
assert(!ACCEPTABLE_PACKET_STATUSES.has("accepted"), "accept refuses accepted");
assert(REJECTABLE_PACKET_STATUSES.has("ready_for_review"), "reject allows ready_for_review");
assert(!REJECTABLE_PACKET_STATUSES.has("accepted"), "reject refuses accepted");
assert(ESCALATABLE_PACKET_STATUSES.has("ready_for_review"), "escalate allows ready_for_review");
assert(TERMINAL_OR_BLOCKED_GAP_STATUSES.has("blocked"), "blocked gap is terminal-or-blocked");
assert(TERMINAL_OR_BLOCKED_GAP_STATUSES.has("resolved"), "resolved gap is terminal-or-blocked");

/**
 * Minimal pool mock: connect() → client with scripted query handler.
 * @param {(sql: string, params: unknown[]) => { rows: object[] } | Promise<{ rows: object[] }>} handler
 */
function makePool(handler) {
  const client = {
    released: false,
    async query(sql, params = []) {
      if (/^BEGIN$/i.test(sql.trim())) return { rows: [] };
      if (/^(COMMIT|ROLLBACK)$/i.test(sql.trim())) return { rows: [] };
      return handler(sql, params);
    },
    release() {
      this.released = true;
    },
  };
  return {
    client,
    async connect() {
      return client;
    },
  };
}

function baseRow(overrides = {}) {
  return {
    id: "pkt-1",
    gap_id: "gap-1",
    status: "ready_for_review",
    gap_row_id: "gap-1",
    gap_status: "ready_for_review",
    signal_type: "tool_fail",
    fingerprint: "fp",
    ...overrides,
  };
}

async function testRejectAfterAcceptRefused() {
  const pool = makePool(async (sql) => {
    if (/FOR UPDATE/i.test(sql)) {
      return { rows: [baseRow({ status: "accepted", gap_status: "resolved" })] };
    }
    throw new Error(`reject must not mutate after accepted: ${sql}`);
  });
  const result = await rejectPeaPacket(pool, { packetId: "pkt-1", actorId: "admin@test" });
  assert(result.error === "invalid_status", "CS reject-after-accept → invalid_status");
  assert(result.status === "accepted", "CS reject-after-accept surfaces accepted");
  assert(pool.client.released, "CS reject-after-accept releases client");
}

async function testAcceptAfterRejectRefused() {
  const pool = makePool(async (sql) => {
    if (/FOR UPDATE/i.test(sql)) {
      return { rows: [baseRow({ status: "rejected", gap_status: "ignored" })] };
    }
    throw new Error(`accept must not mutate after rejected: ${sql}`);
  });
  const result = await acceptPeaPacket(
    pool,
    { peaRatchetRequired: false },
    { packetId: "pkt-1", actorId: "admin@test" },
  );
  assert(result.error === "invalid_status", "CS accept-after-reject → invalid_status");
  assert(result.status === "rejected", "CS accept-after-reject surfaces rejected");
}

async function testAcceptAfterEscalateBlockedGap() {
  const pool = makePool(async (sql) => {
    if (/FOR UPDATE/i.test(sql)) {
      // Escalate leaves packet reviewable but gap blocked — accept must refuse.
      return { rows: [baseRow({ status: "ready_for_review", gap_status: "blocked" })] };
    }
    throw new Error(`accept must not resolve blocked gap: ${sql}`);
  });
  const result = await acceptPeaPacket(
    pool,
    { peaRatchetRequired: false },
    { packetId: "pkt-1", actorId: "admin@test" },
  );
  assert(result.error === "invalid_status", "CS accept-after-escalate → invalid_status");
  assert(result.gap_status === "blocked", "CS accept-after-escalate surfaces gap_status");
}

async function testRejectCasConflict() {
  const pool = makePool(async (sql) => {
    if (/FOR UPDATE/i.test(sql)) {
      return { rows: [baseRow()] };
    }
    if (/UPDATE pea\.evolution_packets/i.test(sql) && /RETURNING/i.test(sql)) {
      return { rows: [] }; // concurrent accept won
    }
    throw new Error(`unexpected after CAS miss: ${sql}`);
  });
  const result = await rejectPeaPacket(pool, { packetId: "pkt-1", actorId: "admin@test" });
  assert(result.error === "invalid_status", "CS reject CAS miss → invalid_status");
  assert(result.status === "conflict", "CS reject CAS miss status=conflict");
}

async function testAcceptHappyPathGuarded() {
  const updates = [];
  const pool = makePool(async (sql, params) => {
    if (/FOR UPDATE/i.test(sql)) return { rows: [baseRow()] };
    if (/UPDATE pea\.evolution_packets/i.test(sql) && /RETURNING/i.test(sql)) {
      updates.push("packet");
      assert(
        Array.isArray(params?.[1]) && params[1].includes("ready_for_review"),
        "CS accept UPDATE predicates reviewable statuses",
      );
      return { rows: [{ id: "pkt-1", status: "accepted" }] };
    }
    if (/UPDATE pea\.gaps/i.test(sql) && /RETURNING/i.test(sql)) {
      updates.push("gap");
      return { rows: [{ id: "gap-1", status: "resolved" }] };
    }
    if (/INSERT INTO pea\.audit_events/i.test(sql)) return { rows: [{ id: "a1" }] };
    if (/INSERT INTO pea\.outbox/i.test(sql)) return { rows: [{ id: "o1" }] };
    throw new Error(`unexpected accept sql: ${sql}`);
  });
  const result = await acceptPeaPacket(
    pool,
    { peaRatchetRequired: false },
    { packetId: "pkt-1", actorId: "admin@test" },
  );
  assert(result.ok === true, "CS accept happy path ok");
  assert(result.status === "accepted", "CS accept happy path status");
  assert(updates.join(",") === "packet,gap", "CS accept updates packet then gap");
}

async function testEscalateAfterAcceptRefused() {
  const pool = makePool(async (sql) => {
    if (/FOR UPDATE/i.test(sql)) {
      return { rows: [baseRow({ status: "accepted", gap_status: "resolved" })] };
    }
    throw new Error(`escalate must not mint grant after accept: ${sql}`);
  });
  const result = await escalatePeaPacket(
    pool,
    { peaMaxGrantLevel: 3 },
    { packetId: "pkt-1", actorId: "admin@test" },
  );
  assert(result.error === "invalid_status", "CS escalate-after-accept → invalid_status");
  assert(result.status === "accepted", "CS escalate-after-accept surfaces accepted");
}

await testRejectAfterAcceptRefused();
await testAcceptAfterRejectRefused();
await testAcceptAfterEscalateBlockedGap();
await testRejectCasConflict();
await testAcceptHappyPathGuarded();
await testEscalateAfterAcceptRefused();

console.log(`\npeaAcceptRejectRace: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
