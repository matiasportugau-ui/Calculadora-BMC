/**
 * PEA terminal-state guards — Bugs BZ / CA / CS (#967+).
 * - Escalate must not clobber accepted → gap blocked + L3 grant (BZ)
 * - Re-analyze must not destroy accepted packets / flip resolved gaps (CA)
 * - Accept/reject/escalate must serialize under FOR UPDATE (CS)
 * Run: node tests/peaTerminalStateGuard.test.js
 */
import {
  acceptPeaPacket,
  escalatePeaPacket,
  rejectPeaPacket,
  ACCEPTABLE_PACKET_STATUSES,
  ESCALATABLE_PACKET_STATUSES,
  REJECTABLE_PACKET_STATUSES,
} from "../server/lib/pea/packetReview.js";
import { TERMINAL_GAP_STATUSES } from "../server/lib/pea/gapEvents.js";
import {
  IMMUTABLE_PACKET_STATUSES,
  saveEvolutionPacket,
} from "../server/lib/pea/evolutionPackets.js";
import { runAnalyzeGapJob } from "../server/lib/pea/analyzeGapJob.js";

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
assert(ESCALATABLE_PACKET_STATUSES.has("ready_for_review"), "escalate allows ready_for_review");
assert(!ESCALATABLE_PACKET_STATUSES.has("accepted"), "escalate refuses accepted");
assert(!ESCALATABLE_PACKET_STATUSES.has("rejected"), "escalate refuses rejected");
assert(REJECTABLE_PACKET_STATUSES.has("ready_for_review"), "reject allows ready_for_review");
assert(!REJECTABLE_PACKET_STATUSES.has("accepted"), "reject refuses accepted");
assert(TERMINAL_GAP_STATUSES.has("resolved"), "resolved is terminal");
assert(TERMINAL_GAP_STATUSES.has("ignored"), "ignored is terminal");
assert(!TERMINAL_GAP_STATUSES.has("investigating"), "investigating is not terminal");
assert(IMMUTABLE_PACKET_STATUSES.has("accepted"), "accepted packet immutable");
assert(IMMUTABLE_PACKET_STATUSES.has("rejected"), "rejected packet immutable");

/**
 * Minimal Pool mock with connect() + FOR UPDATE / conditional UPDATE semantics (Bug CS).
 * @param {{ id: string, gap_id: string, status: string, gap_status: string }} initial
 */
function makeReviewPool(initial) {
  const state = {
    packetStatus: initial.status,
    gapStatus: initial.gap_status,
    grantInserts: 0,
    packetUpdates: [],
    gapUpdates: [],
  };

  function packetRow() {
    return {
      id: initial.id,
      gap_id: initial.gap_id,
      status: state.packetStatus,
      gap_row_id: initial.gap_id,
      gap_status: state.gapStatus,
      signal_type: "tool_fail",
      fingerprint: "fp",
    };
  }

  async function query(sql, params) {
    if (/^\s*BEGIN/i.test(sql) || /^\s*COMMIT/i.test(sql) || /^\s*ROLLBACK/i.test(sql)) {
      return { rows: [], rowCount: 0 };
    }
    if (/FROM pea\.evolution_packets/i.test(sql)) {
      return { rows: [packetRow()] };
    }
    if (/UPDATE pea\.evolution_packets[\s\S]*status = 'accepted'/i.test(sql)) {
      const allowed = params?.[1] || [];
      state.packetUpdates.push({ to: "accepted", allowed, from: state.packetStatus });
      if (!allowed.includes(state.packetStatus)) {
        return { rows: [], rowCount: 0 };
      }
      state.packetStatus = "accepted";
      return { rows: [{ id: initial.id }], rowCount: 1 };
    }
    if (/UPDATE pea\.evolution_packets[\s\S]*status = 'rejected'/i.test(sql)) {
      const allowed = params?.[1] || [];
      state.packetUpdates.push({ to: "rejected", allowed, from: state.packetStatus });
      if (!allowed.includes(state.packetStatus)) {
        return { rows: [], rowCount: 0 };
      }
      state.packetStatus = "rejected";
      return { rows: [{ id: initial.id }], rowCount: 1 };
    }
    if (/UPDATE pea\.gaps[\s\S]*status = 'resolved'/i.test(sql)) {
      state.gapStatus = "resolved";
      state.gapUpdates.push("resolved");
      return { rows: [], rowCount: 1 };
    }
    if (/UPDATE pea\.gaps[\s\S]*status = 'ignored'/i.test(sql)) {
      state.gapStatus = "ignored";
      state.gapUpdates.push("ignored");
      return { rows: [], rowCount: 1 };
    }
    if (/UPDATE pea\.gaps[\s\S]*status = 'blocked'/i.test(sql)) {
      state.gapStatus = "blocked";
      state.gapUpdates.push("blocked");
      return { rows: [], rowCount: 1 };
    }
    if (/INSERT INTO pea\.grants/i.test(sql)) {
      state.grantInserts += 1;
      return {
        rows: [
          {
            id: `grant-${state.grantInserts}`,
            max_level: 3,
            scope: params?.[1],
          },
        ],
      };
    }
    if (/INSERT INTO pea\.audit_events/i.test(sql)) {
      return { rows: [{ id: "audit-1", created_at: new Date().toISOString() }] };
    }
    if (/INSERT INTO pea\.outbox/i.test(sql)) {
      return { rows: [{ id: "outbox-1" }] };
    }
    if (/INSERT INTO pea\.ratchet/i.test(sql)) {
      return { rows: [] };
    }
    throw new Error(`unexpected query: ${sql}`);
  }

  return {
    state,
    async connect() {
      return {
        query,
        release() {},
      };
    },
    query,
  };
}

async function testEscalateAcceptedRefused() {
  const db = makeReviewPool({
    id: "pkt-1",
    gap_id: "gap-1",
    status: "accepted",
    gap_status: "resolved",
  });
  const result = await escalatePeaPacket(db, { peaMaxGrantLevel: 3 }, {
    packetId: "pkt-1",
    actorId: "admin@test",
  });
  assert(result.error === "invalid_status", "BZ escalate accepted → invalid_status");
  assert(result.status === "accepted", "BZ escalate preserves accepted status");
  assert(db.state.grantInserts === 0, "BZ escalate does not mint grant");
  assert(!db.state.gapUpdates.includes("blocked"), "BZ escalate does not set gap blocked");
}

async function testRejectAcceptedRefused() {
  const db = makeReviewPool({
    id: "pkt-1",
    gap_id: "gap-1",
    status: "accepted",
    gap_status: "resolved",
  });
  const result = await rejectPeaPacket(db, { packetId: "pkt-1", actorId: "admin@test" });
  assert(result.error === "invalid_status", "reject accepted → invalid_status");
  assert(db.state.packetStatus === "accepted", "reject does not clobber accepted");
}

async function testAnalyzeTerminalSkipped() {
  const updates = [];
  const pool = {
    async query(sql, params) {
      if (/SELECT \* FROM pea\.gaps/i.test(sql)) {
        return { rows: [{ id: "gap-1", status: "resolved", occurrence_count: 9, severity: "high" }] };
      }
      if (/UPDATE pea\.jobs/i.test(sql)) {
        updates.push(params?.[1]);
        return { rows: [] };
      }
      throw new Error(`unexpected analyze query: ${sql}`);
    },
  };
  const out = await runAnalyzeGapJob(
    pool,
    { peaArchitectMock: true, peaAutoMinOccurrences: 1 },
    { id: "job-1", gap_id: "gap-1", input_json: { force: true } },
  );
  assert(out.skipped === true, "CA analyze skips terminal gap");
  assert(out.reason === "terminal_gap_status", "CA analyze skip reason");
  assert(
    String(updates[0] || "").includes("terminal_gap_status"),
    "CA job output records terminal skip",
  );
}

async function testSaveImmutablePacket() {
  const pool = {
    async query(sql) {
      if (/SELECT id, status FROM pea\.evolution_packets/i.test(sql)) {
        return { rows: [{ id: "pkt-1", status: "accepted" }] };
      }
      throw new Error(`must not UPSERT immutable: ${sql}`);
    },
  };
  let threw = null;
  try {
    await saveEvolutionPacket(pool, {
      gap_id: "gap-1",
      status: "ready_for_review",
      primary_lane: "C",
      diagnosis: "x",
    });
  } catch (e) {
    threw = e;
  }
  assert(threw?.code === "packet_immutable", "CA saveEvolutionPacket refuses accepted overwrite");
  assert(threw?.status === "accepted", "CA immutable status surfaced");
}

async function testAcceptRejectRaceSecondLoses() {
  const db = makeReviewPool({
    id: "pkt-cs",
    gap_id: "gap-cs",
    status: "ready_for_review",
    gap_status: "ready_for_review",
  });
  const cfg = { peaRatchetRequired: false, peaMaxGrantLevel: 3 };

  const accept = await acceptPeaPacket(db, cfg, {
    packetId: "pkt-cs",
    actorId: "op-a",
  });
  assert(accept.ok === true, "CS first accept wins");
  assert(db.state.packetStatus === "accepted", "CS packet accepted");
  assert(db.state.gapStatus === "resolved", "CS gap resolved");

  const reject = await rejectPeaPacket(db, {
    packetId: "pkt-cs",
    actorId: "op-b",
  });
  assert(reject.error === "invalid_status", "CS concurrent reject loses after accept");
  assert(db.state.packetStatus === "accepted", "CS reject does not flip accepted→rejected");
  assert(db.state.gapStatus === "resolved", "CS reject does not flip resolved→ignored");
  assert(
    db.state.packetUpdates.some((u) => u.to === "accepted" && u.allowed.includes("ready_for_review")),
    "CS accept UPDATE uses status predicate",
  );
}

async function testRejectAcceptRaceSecondLoses() {
  const db = makeReviewPool({
    id: "pkt-cs2",
    gap_id: "gap-cs2",
    status: "ready_for_review",
    gap_status: "investigating",
  });
  const cfg = { peaRatchetRequired: false, peaMaxGrantLevel: 3 };

  const reject = await rejectPeaPacket(db, {
    packetId: "pkt-cs2",
    actorId: "op-b",
  });
  assert(reject.ok === true, "CS first reject wins");
  assert(db.state.packetStatus === "rejected", "CS packet rejected");
  assert(db.state.gapStatus === "ignored", "CS gap ignored");

  const accept = await acceptPeaPacket(db, cfg, {
    packetId: "pkt-cs2",
    actorId: "op-a",
  });
  assert(accept.error === "invalid_status", "CS concurrent accept loses after reject");
  assert(db.state.packetStatus === "rejected", "CS accept does not flip rejected→accepted");
  assert(db.state.gapStatus === "ignored", "CS accept does not flip ignored→resolved");
}

async function testAcceptEscalateRace() {
  const db = makeReviewPool({
    id: "pkt-cs3",
    gap_id: "gap-cs3",
    status: "ready_for_review",
    gap_status: "ready_for_review",
  });
  const cfg = { peaRatchetRequired: false, peaMaxGrantLevel: 3 };

  const escalate = await escalatePeaPacket(db, cfg, {
    packetId: "pkt-cs3",
    actorId: "op-esc",
  });
  assert(escalate.ok === true, "CS escalate wins first");
  assert(db.state.gapStatus === "blocked", "CS escalate sets gap blocked");
  assert(db.state.grantInserts === 1, "CS escalate mints one grant");

  const accept = await acceptPeaPacket(db, cfg, {
    packetId: "pkt-cs3",
    actorId: "op-a",
  });
  assert(accept.error === "invalid_status", "CS accept loses after escalate (gap blocked)");
  assert(accept.gap_status === "blocked", "CS accept surfaces blocked gap_status");
  assert(db.state.packetStatus === "ready_for_review", "CS accept does not accept after escalate");
  assert(db.state.gapStatus === "blocked", "CS accept does not overwrite blocked→resolved");
}

await testEscalateAcceptedRefused();
await testRejectAcceptedRefused();
await testAnalyzeTerminalSkipped();
await testSaveImmutablePacket();
await testAcceptRejectRaceSecondLoses();
await testRejectAcceptRaceSecondLoses();
await testAcceptEscalateRace();

console.log(`\npeaTerminalStateGuard: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
