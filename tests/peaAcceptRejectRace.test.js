/**
 * PEA Bug CS — accept/reject/escalate race (status TOCTOU).
 * Concurrent operators must not both get ok:true with last-writer-wins
 * terminal corruption (accepted→rejected/ignored, or accepted+blocked+grant).
 *
 * Run: node tests/peaAcceptRejectRace.test.js
 */
import {
  acceptPeaPacket,
  rejectPeaPacket,
  escalatePeaPacket,
  ACCEPTABLE_PACKET_STATUSES,
  REJECTABLE_PACKET_STATUSES,
  ESCALATABLE_PACKET_STATUSES,
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
assert(ESCALATABLE_PACKET_STATUSES.has("ready_for_review"), "escalate allows ready_for_review");

/**
 * Pool mock that tracks BEGIN/COMMIT/ROLLBACK and routes FOR UPDATE + guarded UPDATEs.
 * @param {{ status: string, gap_id?: string, onGuardedUpdate?: (sql: string) => { rows: object[] } }} opts
 */
function makeTxPool(opts) {
  const status = { current: opts.status };
  const gapId = opts.gap_id || "gap-1";
  const sqlLog = [];
  let inTx = false;

  const client = {
    async query(sql, params) {
      sqlLog.push({ sql, params, inTx });
      if (/^BEGIN$/i.test(sql.trim())) {
        inTx = true;
        return { rows: [] };
      }
      if (/^COMMIT$/i.test(sql.trim())) {
        inTx = false;
        return { rows: [] };
      }
      if (/^ROLLBACK$/i.test(sql.trim())) {
        inTx = false;
        return { rows: [] };
      }
      if (/FOR UPDATE OF p/i.test(sql)) {
        return {
          rows: [
            {
              id: "pkt-1",
              gap_id: gapId,
              status: status.current,
              gap_row_id: gapId,
              gap_status: "investigating",
              signal_type: "tool_fail",
              fingerprint: "fp",
            },
          ],
        };
      }
      if (/UPDATE pea\.evolution_packets/i.test(sql) && /status = ANY/i.test(sql)) {
        if (typeof opts.onGuardedUpdate === "function") {
          return opts.onGuardedUpdate(sql, params, status);
        }
        const allowed = params?.[1] || [];
        if (!allowed.includes(status.current)) {
          return { rows: [] };
        }
        if (/status = 'accepted'/i.test(sql)) status.current = "accepted";
        if (/status = 'rejected'/i.test(sql)) status.current = "rejected";
        return { rows: [{ id: "pkt-1" }] };
      }
      if (/UPDATE pea\.evolution_packets/i.test(sql) && !/status = ANY/i.test(sql)) {
        // Unguarded packet UPDATE would be a Bug CS regression.
        throw new Error(`unguarded packet UPDATE: ${sql}`);
      }
      if (/UPDATE pea\.gaps/i.test(sql)) {
        return { rows: [] };
      }
      if (/INSERT INTO pea\.audit_events/i.test(sql)) {
        return { rows: [{ id: "aud-1", created_at: new Date().toISOString() }] };
      }
      if (/INSERT INTO pea\.outbox/i.test(sql) || /INSERT INTO pea\.pea_outbox/i.test(sql)) {
        return { rows: [{ id: "ob-1" }] };
      }
      if (/INSERT INTO pea\.ratchet_links/i.test(sql)) {
        return {
          rows: [
            {
              id: "rl-1",
              artifact_type: params?.[2],
              path: params?.[3],
              description: params?.[4],
              created_at: new Date().toISOString(),
            },
          ],
        };
      }
      if (/INSERT INTO pea\.grants/i.test(sql)) {
        return {
          rows: [
            {
              id: "grant-1",
              max_level: params?.[0],
              scope: params?.[1],
            },
          ],
        };
      }
      if (/FROM pea\.evolution_packets/i.test(sql) && !/FOR UPDATE/i.test(sql)) {
        return {
          rows: [
            {
              id: "pkt-1",
              gap_id: gapId,
              status: status.current,
              gap_row_id: gapId,
              gap_status: "investigating",
            },
          ],
        };
      }
      // insertOutboxEvent may use a specific table name — tolerate unknown inserts in tx
      if (/^INSERT /i.test(sql.trim())) {
        return { rows: [{ id: "ins-1" }] };
      }
      throw new Error(`unexpected query: ${sql}`);
    },
    release() {},
  };

  return {
    sqlLog,
    status,
    async connect() {
      return client;
    },
    async query(sql, params) {
      return client.query(sql, params);
    },
  };
}

async function testAcceptUsesForUpdateAndGuardedUpdate() {
  const pool = makeTxPool({ status: "ready_for_review" });
  const result = await acceptPeaPacket(
    pool,
    { peaRatchetRequired: true },
    {
      packetId: "pkt-1",
      actorId: "op-a",
      ratchet_links: [{ type: "golden", path: "tests/x.js", description: "golden closeout" }],
    },
  );
  assert(result.ok === true, "CS accept ready_for_review → ok");
  assert(result.status === "accepted", "CS accept status accepted");
  assert(
    pool.sqlLog.some((c) => /FOR UPDATE OF p/i.test(c.sql)),
    "CS accept SELECT FOR UPDATE",
  );
  assert(
    pool.sqlLog.some((c) => /UPDATE pea\.evolution_packets/i.test(c.sql) && /status = ANY/i.test(c.sql)),
    "CS accept status-guarded UPDATE",
  );
  assert(
    pool.sqlLog.some((c) => /^BEGIN$/i.test(c.sql.trim())),
    "CS accept BEGIN",
  );
  assert(
    pool.sqlLog.some((c) => /^COMMIT$/i.test(c.sql.trim())),
    "CS accept COMMIT",
  );
}

async function testRejectUsesForUpdateAndGuardedUpdate() {
  const pool = makeTxPool({ status: "ready_for_review" });
  const result = await rejectPeaPacket(pool, {
    packetId: "pkt-1",
    actorId: "op-b",
    reason: "not needed",
  });
  assert(result.ok === true, "CS reject ready_for_review → ok");
  assert(
    pool.sqlLog.some((c) => /FOR UPDATE OF p/i.test(c.sql)),
    "CS reject SELECT FOR UPDATE",
  );
  assert(
    pool.sqlLog.some((c) => /UPDATE pea\.evolution_packets/i.test(c.sql) && /status = ANY/i.test(c.sql)),
    "CS reject status-guarded UPDATE",
  );
}

async function testRejectAfterAcceptLostRace() {
  // FOR UPDATE sees ready_for_review, guarded UPDATE matches 0 rows → invalid_status
  // (peer accept won; must not flip gap to ignored).
  const sqlLog = [];
  const client = {
    async query(sql) {
      sqlLog.push(sql);
      if (/^BEGIN$/i.test(sql.trim()) || /^COMMIT$/i.test(sql.trim()) || /^ROLLBACK$/i.test(sql.trim())) {
        return { rows: [] };
      }
      if (/FOR UPDATE OF p/i.test(sql)) {
        return {
          rows: [
            {
              id: "pkt-1",
              gap_id: "gap-1",
              status: "ready_for_review",
              gap_row_id: "gap-1",
              gap_status: "investigating",
            },
          ],
        };
      }
      if (/UPDATE pea\.evolution_packets/i.test(sql) && /status = ANY/i.test(sql)) {
        return { rows: [] };
      }
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
      if (/UPDATE pea\.gaps/i.test(sql)) {
        throw new Error("must not update gap after lost race");
      }
      throw new Error(`unexpected: ${sql}`);
    },
    release() {},
  };
  const racePool = {
    async connect() {
      return client;
    },
  };
  const result = await rejectPeaPacket(racePool, { packetId: "pkt-1", actorId: "op-b" });
  assert(result.error === "invalid_status", "CS lost reject race → invalid_status");
  assert(result.status === "accepted", "CS lost reject race surfaces accepted");
  assert(
    !sqlLog.some((s) => /UPDATE pea\.gaps/i.test(s)),
    "CS lost reject race does not flip gap",
  );
}

async function testEscalateAcceptedUnderLockRefused() {
  const pool = makeTxPool({ status: "accepted" });
  const result = await escalatePeaPacket(
    pool,
    { peaMaxGrantLevel: 3 },
    { packetId: "pkt-1", actorId: "op-c" },
  );
  assert(result.error === "invalid_status", "CS escalate accepted → invalid_status");
  assert(
    !pool.sqlLog.some((c) => /INSERT INTO pea\.grants/i.test(c.sql)),
    "CS escalate accepted does not mint grant",
  );
  assert(
    pool.sqlLog.some((c) => /^ROLLBACK$/i.test(c.sql.trim())),
    "CS escalate invalid_status rolls back",
  );
}

async function testAcceptRejectedUnderLockRefused() {
  const pool = makeTxPool({ status: "rejected" });
  const result = await acceptPeaPacket(
    pool,
    { peaRatchetRequired: false },
    { packetId: "pkt-1", actorId: "op-a" },
  );
  assert(result.error === "invalid_status", "CS accept rejected → invalid_status");
  assert(result.status === "rejected", "CS accept preserves rejected");
}

await testAcceptUsesForUpdateAndGuardedUpdate();
await testRejectUsesForUpdateAndGuardedUpdate();
await testRejectAfterAcceptLostRace();
await testEscalateAcceptedUnderLockRefused();
await testAcceptRejectedUnderLockRefused();

console.log(`\npeaAcceptRejectRace: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
