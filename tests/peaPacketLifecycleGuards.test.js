/**
 * PEA packet lifecycle guards — escalate / reject / re-analyze clobber (Bugs BU/BV).
 * Run: node tests/peaPacketLifecycleGuards.test.js
 */
import {
  escalatePeaPacket,
  rejectPeaPacket,
  REVIEWABLE_PACKET_STATUSES,
} from "../server/lib/pea/packetReview.js";
import { saveEvolutionPacket, TERMINAL_GAP_STATUSES } from "../server/lib/pea/evolutionPackets.js";
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

assert(REVIEWABLE_PACKET_STATUSES.has("ready_for_review"), "ready_for_review is reviewable");
assert(!REVIEWABLE_PACKET_STATUSES.has("accepted"), "accepted is not reviewable");
assert(TERMINAL_GAP_STATUSES.has("resolved"), "resolved is terminal");
assert(TERMINAL_GAP_STATUSES.has("ignored"), "ignored is terminal");

function loadDb(row) {
  const writes = [];
  return {
    writes,
    async query(sql, params) {
      if (/FROM pea\.evolution_packets/i.test(sql) && /JOIN pea\.gaps/i.test(sql)) {
        return { rows: row ? [row] : [] };
      }
      writes.push({ sql, params });
      return { rows: [] };
    },
  };
}

// ── Bug BU: escalate must not flip resolved/accepted → blocked ────────────
{
  const accepted = {
    id: "pkt-acc",
    gap_id: "gap-1",
    status: "accepted",
    gap_status: "resolved",
    fingerprint: "fp",
    signal_type: "tool_fail",
  };
  const db = loadDb(accepted);
  const result = await escalatePeaPacket(
    db,
    { peaMaxGrantLevel: 3 },
    {
      packetId: "pkt-acc",
      actorId: "ops",
      maxLevel: 3,
    },
  );
  assert(result.error === "invalid_status", "escalate accepted → invalid_status");
  assert(result.status === "accepted", "escalate accepted preserves packet status");
  assert(db.writes.length === 0, "escalate accepted performs no writes / grants");
}

{
  const review = {
    id: "pkt-rev",
    gap_id: "gap-2",
    status: "ready_for_review",
    gap_status: "ready_for_review",
    fingerprint: "fp2",
    signal_type: "tool_fail",
  };
  const db = {
    async query(sql, params) {
      if (/FROM pea\.evolution_packets/i.test(sql) && /JOIN pea\.gaps/i.test(sql)) {
        return { rows: [review] };
      }
      if (/INSERT INTO pea\.grants/i.test(sql)) {
        return {
          rows: [{ id: "grant-1", max_level: 3, scope: params[1] }],
        };
      }
      if (/INSERT INTO pea\.audit/i.test(sql) || /pea\.audit_events/i.test(sql)) {
        return { rows: [{ id: "a1" }] };
      }
      if (/INSERT INTO pea\.outbox/i.test(sql)) {
        return { rows: [{ id: "o1" }] };
      }
      if (/UPDATE pea\.gaps SET status = 'blocked'/i.test(sql)) {
        assert(params?.[0] === "gap-2", "escalate blocks correct gap");
        return { rows: [] };
      }
      return { rows: [] };
    },
  };
  const ok = await escalatePeaPacket(
    db,
    { peaMaxGrantLevel: 3 },
    {
      packetId: "pkt-rev",
      actorId: "ops",
      maxLevel: 3,
    },
  );
  assert(ok.ok === true && ok.grant_id === "grant-1", "escalate ready_for_review succeeds");
}

// ── reject accepted must not clobber (same family as #972) ────────────────
{
  const db = loadDb({
    id: "pkt-acc",
    gap_id: "gap-1",
    status: "accepted",
    gap_status: "resolved",
  });
  const result = await rejectPeaPacket(db, { packetId: "pkt-acc", actorId: "ops" });
  assert(result.error === "invalid_status", "reject accepted → invalid_status");
  assert(db.writes.length === 0, "reject accepted performs no UPDATEs");
}

// ── Bug BV: saveEvolutionPacket must not UPSERT clobber accepted v1 ───────
{
  const sqlLog = [];
  const pool = {
    async query(sql) {
      sqlLog.push(sql.replace(/\s+/g, " ").trim());
      if (/SELECT id, status FROM pea\.gaps/i.test(sql)) {
        return { rows: [{ id: "gap-t", status: "resolved" }] };
      }
      return { rows: [] };
    },
  };
  let threw = null;
  try {
    await saveEvolutionPacket(pool, {
      gap_id: "gap-t",
      status: "ready_for_review",
      primary_lane: "H",
      diagnosis: "should not save",
    });
  } catch (e) {
    threw = e;
  }
  assert(threw?.code === "terminal_gap_status", "save on resolved gap throws terminal_gap_status");
  assert(
    !sqlLog.some((s) => /ON CONFLICT \(gap_id, version\) DO UPDATE/i.test(s)),
    "no destructive ON CONFLICT UPSERT path",
  );
}

{
  const sqlLog = [];
  const pool = {
    async query(sql, params) {
      const norm = sql.replace(/\s+/g, " ").trim();
      sqlLog.push(norm);
      if (/SELECT id, status FROM pea\.gaps/i.test(sql)) {
        return { rows: [{ id: "gap-open", status: "investigating" }] };
      }
      if (/COALESCE\(MAX\(version\)/i.test(sql)) {
        return { rows: [{ next_version: 2 }] };
      }
      if (/SET status = 'superseded'/i.test(sql)) {
        return { rows: [] };
      }
      if (/INSERT INTO pea\.evolution_packets/i.test(sql)) {
        assert(params?.[1] === 2, "inserts next version (2), not hard-coded 1");
        assert(params?.[0] === "gap-open", "inserts for correct gap");
        return {
          rows: [
            {
              id: "pkt-v2",
              gap_id: "gap-open",
              version: 2,
              status: "ready_for_review",
            },
          ],
        };
      }
      if (/UPDATE pea\.gaps/i.test(sql) && /latest_packet_id/i.test(sql)) {
        assert(params?.[1] === "pkt-v2", "points latest_packet_id at new version");
        assert(/CASE/i.test(sql), "gap status update preserves terminal via CASE");
        return { rows: [] };
      }
      return { rows: [] };
    },
  };
  const saved = await saveEvolutionPacket(pool, {
    gap_id: "gap-open",
    status: "ready_for_review",
    primary_lane: "H",
    diagnosis: "v2",
    secondary_lanes: [],
    recommended_changes: [],
    ratchet_plan: {},
    spec_citations: [],
    critic_result: { passed: true },
    blast_radius: { risk_level: "R0" },
  });
  assert(saved.id === "pkt-v2" && saved.version === 2, "save returns versioned packet");
  assert(
    !sqlLog.some((s) => /ON CONFLICT \(gap_id, version\) DO UPDATE/i.test(s)),
    "versioned insert has no clobber UPSERT",
  );
}

// ── Bug BV: analyze_gap skips terminal gaps even with force:true ──────────
{
  const jobUpdates = [];
  const pool = {
    async query(sql, params) {
      if (/SELECT \* FROM pea\.gaps WHERE id/i.test(sql)) {
        return {
          rows: [
            {
              id: "gap-res",
              status: "resolved",
              occurrence_count: 9,
              signal_type: "tool_fail",
              summary: "done",
              fingerprint: "abc",
            },
          ],
        };
      }
      if (/UPDATE pea\.jobs/i.test(sql)) {
        jobUpdates.push(JSON.parse(params[1]));
        return { rows: [] };
      }
      throw new Error(`unexpected SQL in terminal analyze test: ${sql.slice(0, 80)}`);
    },
  };
  const result = await runAnalyzeGapJob(
    pool,
    { peaArchitectMock: true, peaMaxOutputTokensPerCall: 1000 },
    { id: "job-1", gap_id: "gap-res", input_json: { force: true } },
  );
  assert(result.skipped === true, "analyze skips resolved gap");
  assert(result.reason === "terminal_gap_status", "analyze skip reason terminal_gap_status");
  assert(jobUpdates[0]?.skipped === "terminal_gap_status", "job output records terminal skip");
}

console.log(`\npeaPacketLifecycleGuards: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
