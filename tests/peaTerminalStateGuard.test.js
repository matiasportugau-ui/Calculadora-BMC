/**
 * PEA terminal-state guards — Bugs BZ / CA (#967).
 * - Escalate must not clobber accepted → gap blocked + L3 grant (BZ)
 * - Re-analyze must not destroy accepted packets / flip resolved gaps (CA)
 * Run: node tests/peaTerminalStateGuard.test.js
 */
import {
  escalatePeaPacket,
  rejectPeaPacket,
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

await testEscalateAcceptedRefused();
await testRejectAcceptedRefused();
await testAnalyzeTerminalSkipped();
await testSaveImmutablePacket();

console.log(`\npeaTerminalStateGuard: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
