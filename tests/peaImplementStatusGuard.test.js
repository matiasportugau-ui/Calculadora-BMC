/**
 * PEA Bug DB — implement must not honor orphan grants on terminal packets/gaps.
 * Run: node tests/peaImplementStatusGuard.test.js
 */
import {
  IMPLEMENTABLE_PACKET_STATUSES,
  NON_IMPLEMENTABLE_GAP_STATUSES,
  runImplementPacket,
} from "../server/lib/pea/implementGapJob.js";
import { rejectPeaPacket } from "../server/lib/pea/packetReview.js";
import { revokePeaGrantsForPacket } from "../server/lib/pea/grants.js";

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

assert(IMPLEMENTABLE_PACKET_STATUSES.has("ready_for_review"), "ready_for_review implementable");
assert(!IMPLEMENTABLE_PACKET_STATUSES.has("rejected"), "rejected not implementable");
assert(!IMPLEMENTABLE_PACKET_STATUSES.has("accepted"), "accepted not implementable");
assert(NON_IMPLEMENTABLE_GAP_STATUSES.has("ignored"), "ignored gap blocks implement");
assert(NON_IMPLEMENTABLE_GAP_STATUSES.has("resolved"), "resolved gap blocks implement");
assert(!NON_IMPLEMENTABLE_GAP_STATUSES.has("blocked"), "blocked gap allows escalate→implement");

async function testImplementRejectedPacketRefused() {
  const calls = [];
  const pool = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (/FROM pea\.evolution_packets/i.test(sql)) {
        return {
          rows: [
            {
              id: "pkt-rej",
              gap_id: "gap-1",
              status: "rejected",
              gap_row_id: "gap-1",
              gap_status: "ignored",
              signal_type: "tool_fail",
              fingerprint: "fp1",
              title: "t",
              summary: "s",
            },
          ],
        };
      }
      if (/FROM pea\.grants/i.test(sql)) {
        throw new Error("must not query grants after invalid_status");
      }
      throw new Error(`unexpected: ${sql.slice(0, 80)}`);
    },
  };
  const result = await runImplementPacket(
    pool,
    { peaImplementEnabled: true, appEnv: "development", peaStagingMode: true },
    { packetId: "pkt-rej", actorId: "admin@test" },
  );
  assert(result.error === "invalid_status", "DB implement rejected → invalid_status");
  assert(result.status === "rejected", "DB implement preserves rejected status");
  assert(
    !calls.some((c) => /FROM pea\.grants/i.test(c.sql)),
    "DB implement does not consult grants for rejected packet",
  );
}

async function testImplementIgnoredGapRefused() {
  const pool = {
    async query(sql) {
      if (/FROM pea\.evolution_packets/i.test(sql)) {
        return {
          rows: [
            {
              id: "pkt-1",
              gap_id: "gap-1",
              status: "ready_for_review",
              gap_status: "ignored",
              signal_type: "tool_fail",
              fingerprint: "fp1",
            },
          ],
        };
      }
      throw new Error(`unexpected: ${sql.slice(0, 80)}`);
    },
  };
  const result = await runImplementPacket(
    pool,
    { peaImplementEnabled: true, appEnv: "development" },
    { packetId: "pkt-1", actorId: "admin@test" },
  );
  assert(result.error === "invalid_gap_status", "DB implement ignored gap → invalid_gap_status");
  assert(result.status === "ignored", "DB implement reports ignored gap status");
}

async function testRejectRevokesPacketGrants() {
  const revoked = [];
  const db = {
    async query(sql, params) {
      if (/FROM pea\.evolution_packets/i.test(sql)) {
        return {
          rows: [
            {
              id: "pkt-1",
              gap_id: "gap-1",
              status: "ready_for_review",
              gap_status: "blocked",
              signal_type: "tool_fail",
              fingerprint: "fp",
            },
          ],
        };
      }
      if (/UPDATE pea\.evolution_packets SET status = 'rejected'/i.test(sql)) {
        return { rows: [] };
      }
      if (/UPDATE pea\.gaps SET status = 'ignored'/i.test(sql)) {
        return { rows: [] };
      }
      if (/UPDATE pea\.grants SET revoked_at/i.test(sql)) {
        revoked.push({ packetId: params[0], scope: params[1] });
        return { rows: [{ id: "grant-1" }] };
      }
      if (/INSERT INTO pea\.audit/i.test(sql) || /pea\.audit_events/i.test(sql)) {
        return { rows: [{ id: "aud-1" }] };
      }
      // audit helper may use different table name — allow no-op
      if (/INSERT INTO/i.test(sql)) return { rows: [{ id: "x" }] };
      throw new Error(`unexpected reject SQL: ${sql.slice(0, 100)}`);
    },
  };
  const result = await rejectPeaPacket(db, {
    packetId: "pkt-1",
    actorId: "admin@test",
    reason: "not wanted",
  });
  assert(result.ok === true, "reject still succeeds");
  assert(revoked.length >= 1, "DB reject revokes grants for packet");
  assert(revoked[0].packetId === "pkt-1", "DB revoke targets packet id");
  assert(revoked[0].scope === "packet:pkt-1", "DB revoke targets packet scope");
}

async function testRevokeHelperMatchesPacketOrScope() {
  const paramsSeen = [];
  const db = {
    async query(sql, params) {
      if (/UPDATE pea\.grants SET revoked_at/i.test(sql)) {
        paramsSeen.push(params);
        return { rows: [{ id: "g1" }, { id: "g2" }] };
      }
      if (/INSERT INTO/i.test(sql)) return { rows: [{ id: "a" }] };
      throw new Error(`unexpected: ${sql.slice(0, 80)}`);
    },
  };
  const rows = await revokePeaGrantsForPacket(db, {
    packetId: "pkt-z",
    revokedBy: "admin@test",
    reason: "packet_rejected",
  });
  assert(rows.length === 2, "revoke helper returns all revoked rows");
  assert(paramsSeen[0][0] === "pkt-z", "revoke helper binds packet_id");
  assert(paramsSeen[0][1] === "packet:pkt-z", "revoke helper binds scope");
}

await testImplementRejectedPacketRefused();
await testImplementIgnoredGapRefused();
await testRejectRevokesPacketGrants();
await testRevokeHelperMatchesPacketOrScope();

console.log(`\npeaImplementStatusGuard: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
