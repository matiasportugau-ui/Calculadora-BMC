/**
 * PEA terminal-state guards — Bugs BZ / CA (#967) + Bug CS (accept/reject race).
 * - Escalate must not clobber accepted → gap blocked + L3 grant (BZ)
 * - Re-analyze must not destroy accepted packets / flip resolved gaps (CA)
 * - Concurrent accept+reject: only one ok:true; loser gets invalid_status (CS)
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

assert(ESCALATABLE_PACKET_STATUSES.has("ready_for_review"), "escalate allows ready_for_review");
assert(!ESCALATABLE_PACKET_STATUSES.has("accepted"), "escalate refuses accepted");
assert(!ESCALATABLE_PACKET_STATUSES.has("rejected"), "escalate refuses rejected");
assert(REJECTABLE_PACKET_STATUSES.has("ready_for_review"), "reject allows ready_for_review");
assert(!REJECTABLE_PACKET_STATUSES.has("accepted"), "reject refuses accepted");
assert(ACCEPTABLE_PACKET_STATUSES.has("ready_for_review"), "accept allows ready_for_review");
assert(!ACCEPTABLE_PACKET_STATUSES.has("rejected"), "accept refuses rejected");
assert(TERMINAL_GAP_STATUSES.has("resolved"), "resolved is terminal");
assert(TERMINAL_GAP_STATUSES.has("ignored"), "ignored is terminal");
assert(!TERMINAL_GAP_STATUSES.has("investigating"), "investigating is not terminal");
assert(IMMUTABLE_PACKET_STATUSES.has("accepted"), "accepted packet immutable");
assert(IMMUTABLE_PACKET_STATUSES.has("rejected"), "rejected packet immutable");

async function testEscalateAcceptedRefused() {
  const calls = [];
  const db = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (/FROM pea\.evolution_packets/i.test(sql)) {
        return {
          rows: [
            {
              id: "pkt-1",
              gap_id: "gap-1",
              status: "accepted",
              gap_row_id: "gap-1",
              gap_status: "resolved",
              signal_type: "tool_fail",
              fingerprint: "fp",
            },
          ],
        };
      }
      throw new Error(`unexpected query: ${sql}`);
    },
  };
  const result = await escalatePeaPacket(db, { peaMaxGrantLevel: 3 }, {
    packetId: "pkt-1",
    actorId: "admin@test",
  });
  assert(result.error === "invalid_status", "BZ escalate accepted → invalid_status");
  assert(result.status === "accepted", "BZ escalate preserves accepted status");
  assert(
    !calls.some((c) => /UPDATE pea\.gaps SET status = 'blocked'/i.test(c.sql)),
    "BZ escalate does not set gap blocked",
  );
}

async function testRejectAcceptedRefused() {
  const db = {
    async query(sql) {
      if (/FROM pea\.evolution_packets/i.test(sql)) {
        return {
          rows: [
            {
              id: "pkt-1",
              gap_id: "gap-1",
              status: "accepted",
              gap_row_id: "gap-1",
              gap_status: "resolved",
            },
          ],
        };
      }
      throw new Error(`unexpected mutate: ${sql}`);
    },
  };
  const result = await rejectPeaPacket(db, { packetId: "pkt-1", actorId: "admin@test" });
  assert(result.error === "invalid_status", "reject accepted → invalid_status");
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

/**
 * Bug CS: reject's status-guarded UPDATE must lose when accept flips the packet
 * between the initial SELECT and the UPDATE (classic TOCTOU).
 */
async function testRejectLosesToAcceptRace() {
  let packetStatus = "ready_for_review";
  const sqlLog = [];
  const client = {
    async query(sql) {
      sqlLog.push(sql);
      if (/^\s*BEGIN/i.test(sql) || /^\s*COMMIT/i.test(sql) || /^\s*ROLLBACK/i.test(sql)) {
        return { rows: [], rowCount: 0 };
      }
      if (/FROM pea\.evolution_packets/i.test(sql) && /JOIN pea\.gaps/i.test(sql)) {
        return {
          rows: [
            {
              id: "pkt-cs",
              gap_id: "gap-cs",
              status: packetStatus,
              gap_row_id: "gap-cs",
              gap_status: packetStatus === "accepted" ? "resolved" : "ready_for_review",
            },
          ],
          rowCount: 1,
        };
      }
      if (/UPDATE pea\.evolution_packets/i.test(sql) && /'rejected'/i.test(sql)) {
        // Accept commits between SELECT and guarded UPDATE.
        packetStatus = "accepted";
        return { rows: [], rowCount: 0 };
      }
      throw new Error(`unexpected CS reject query: ${sql.slice(0, 120)}`);
    },
    release() {},
  };
  const pool = {
    async connect() {
      return client;
    },
  };

  const result = await rejectPeaPacket(pool, { packetId: "pkt-cs", actorId: "op-b" });
  assert(result.error === "invalid_status", "CS reject loses to accept → invalid_status");
  assert(result.status === "accepted", "CS reject surfaces accepted status");
  assert(
    sqlLog.some((s) => /UPDATE pea\.evolution_packets/i.test(s) && /'rejected'/i.test(s)),
    "CS reject attempted status-guarded UPDATE",
  );
  assert(
    !sqlLog.some((s) => /UPDATE pea\.gaps SET status = 'ignored'/i.test(s)),
    "CS reject does not set gap ignored after losing race",
  );
}

/**
 * Bug CS: accept's status-guarded UPDATE must lose when reject flips the packet
 * between the initial SELECT and the UPDATE.
 */
async function testAcceptLosesToRejectRace() {
  let packetStatus = "ready_for_review";
  const sqlLog = [];
  const client = {
    async query(sql) {
      sqlLog.push(sql);
      if (/^\s*BEGIN/i.test(sql) || /^\s*COMMIT/i.test(sql) || /^\s*ROLLBACK/i.test(sql)) {
        return { rows: [], rowCount: 0 };
      }
      if (/FROM pea\.evolution_packets/i.test(sql) && /JOIN pea\.gaps/i.test(sql)) {
        return {
          rows: [
            {
              id: "pkt-cs2",
              gap_id: "gap-cs2",
              status: packetStatus,
              gap_row_id: "gap-cs2",
              gap_status: packetStatus === "rejected" ? "ignored" : "ready_for_review",
              signal_type: "tool_fail",
              fingerprint: "fp",
            },
          ],
          rowCount: 1,
        };
      }
      if (/UPDATE pea\.evolution_packets/i.test(sql) && /'accepted'/i.test(sql)) {
        // Reject commits between SELECT and guarded UPDATE.
        packetStatus = "rejected";
        return { rows: [], rowCount: 0 };
      }
      throw new Error(`unexpected CS accept query: ${sql.slice(0, 120)}`);
    },
    release() {},
  };
  const pool = {
    async connect() {
      return client;
    },
  };

  const result = await acceptPeaPacket(
    pool,
    { peaRatchetRequired: false },
    { packetId: "pkt-cs2", actorId: "op-a" },
  );
  assert(result.error === "invalid_status", "CS accept loses to reject → invalid_status");
  assert(result.status === "rejected", "CS accept surfaces rejected status");
  assert(
    sqlLog.some((s) => /UPDATE pea\.evolution_packets/i.test(s) && /'accepted'/i.test(s)),
    "CS accept attempted status-guarded UPDATE",
  );
  assert(
    !sqlLog.some((s) => /SET status = 'resolved'/i.test(s)),
    "CS accept does not resolve gap after losing race",
  );
}

/**
 * Bug CS sibling: escalate must not mint L3 grant after accept flipped the packet
 * between the initial SELECT and the escalatable re-check.
 */
async function testEscalateLosesToAcceptRace() {
  let packetStatus = "ready_for_review";
  const sqlLog = [];
  const client = {
    async query(sql) {
      sqlLog.push(sql);
      if (/^\s*BEGIN/i.test(sql) || /^\s*COMMIT/i.test(sql) || /^\s*ROLLBACK/i.test(sql)) {
        return { rows: [], rowCount: 0 };
      }
      if (/FROM pea\.evolution_packets/i.test(sql) && /JOIN pea\.gaps/i.test(sql)) {
        return {
          rows: [
            {
              id: "pkt-cs3",
              gap_id: "gap-cs3",
              status: packetStatus,
              gap_row_id: "gap-cs3",
              gap_status: packetStatus === "accepted" ? "resolved" : "ready_for_review",
              signal_type: "tool_fail",
              fingerprint: "fp",
            },
          ],
          rowCount: 1,
        };
      }
      if (/SELECT id, status FROM pea\.evolution_packets/i.test(sql)) {
        // Accept commits between initial load and re-check.
        packetStatus = "accepted";
        return { rows: [], rowCount: 0 };
      }
      throw new Error(`unexpected CS escalate query: ${sql.slice(0, 120)}`);
    },
    release() {},
  };
  const pool = {
    async connect() {
      return client;
    },
  };

  const result = await escalatePeaPacket(pool, { peaMaxGrantLevel: 3 }, {
    packetId: "pkt-cs3",
    actorId: "op-c",
  });
  assert(result.error === "invalid_status", "CS escalate loses to accept → invalid_status");
  assert(result.status === "accepted", "CS escalate surfaces accepted status");
  assert(
    !sqlLog.some((s) => /INSERT INTO pea\.grants/i.test(s)),
    "CS escalate does not mint grant after losing race",
  );
  assert(
    !sqlLog.some((s) => /UPDATE pea\.gaps SET status = 'blocked'/i.test(s)),
    "CS escalate does not block gap after losing race",
  );
}

await testEscalateAcceptedRefused();
await testRejectAcceptedRefused();
await testAnalyzeTerminalSkipped();
await testSaveImmutablePacket();
await testRejectLosesToAcceptRace();
await testAcceptLosesToRejectRace();
await testEscalateLosesToAcceptRace();

console.log(`\npeaTerminalStateGuard: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
