/**
 * PEA auth hardening — Bug BS (#967): bare requireUser factory hang +
 * missing GRANT_WRITE on reject/revoke + reject status clobber.
 * Run: node tests/peaAuthHardening.test.js
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requireUser } from "../server/lib/identityAuth.js";
import { rejectPeaPacket } from "../server/lib/pea/packetReview.js";
import { authorizePea, buildPeaPrincipal, PEA_ACTIONS } from "../server/lib/pea/principal.js";

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const peaRoutesSrc = fs.readFileSync(path.join(__dirname, "../server/routes/pea.js"), "utf8");

// ── factory misuse: Express calls bare requireUser(req,res,next) ──────────
{
  const req = { headers: {} };
  const res = {
    statusCode: null,
    body: null,
    status(c) {
      this.statusCode = c;
      return this;
    },
    json(b) {
      this.body = b;
      return this;
    },
  };
  let nextCalled = false;
  const ret = requireUser(req, res, () => {
    nextCalled = true;
  });
  assert(typeof ret === "function", "bare requireUser returns inner middleware (factory)");
  assert(nextCalled === false, "bare requireUser does not call next()");
  assert(res.statusCode === null, "bare requireUser does not send a response");
}

{
  const mw = requireUser();
  assert(typeof mw === "function", "requireUser() returns Express middleware");
}

// ── routes must invoke the factory ────────────────────────────────────────
assert(
  /const authUser = requireUser\(\)/.test(peaRoutesSrc),
  "pea routes bind authUser = requireUser()",
);
assert(
  !/^\s*requireUser,/m.test(peaRoutesSrc),
  "pea routes never pass bare requireUser as middleware",
);

// revoke + reject must require GRANT_WRITE (not JWT-only)
assert(
  /grants\/:grantId\/revoke[\s\S]{0,120}peaGrantWrite/.test(peaRoutesSrc) ||
    /revoke[\s\S]{0,80}authUser,\s*peaGrantWrite/.test(peaRoutesSrc),
  "grant revoke uses peaGrantWrite",
);
assert(
  /packets\/:packetId\/reject[\s\S]{0,120}peaGrantWrite/.test(peaRoutesSrc),
  "packet reject uses peaGrantWrite",
);
assert(
  /worker\/tick[\s\S]{0,80}authAdmin/.test(peaRoutesSrc),
  "worker tick requires admin",
);
assert(
  /gaps\/:gapId[\s\S]{0,80}peaRead/.test(peaRoutesSrc),
  "gap detail uses peaRead",
);

// ── principal: comprador must not grant-write / reject ────────────────────
{
  const cfg = { appEnv: "development" };
  const comprador = buildPeaPrincipal({ sub: "c1", role: "comprador" }, cfg);
  assert(
    authorizePea(comprador, PEA_ACTIONS.GRANT_WRITE).allowed === false,
    "comprador cannot GRANT_WRITE",
  );
  assert(
    authorizePea(comprador, PEA_ACTIONS.GAP_READ).allowed === false,
    "comprador cannot GAP_READ",
  );
}

// ── reject must not clobber accepted packets ──────────────────────────────
async function runRejectGuards() {
  const acceptedRow = {
    id: "pkt-1",
    gap_id: "gap-1",
    status: "accepted",
    fingerprint: "fp",
    signal_type: "tool_fail",
  };
  const writes = [];
  const db = {
    async query(sql) {
      if (/FROM pea\.evolution_packets/i.test(sql) && /JOIN pea\.gaps/i.test(sql)) {
        return { rows: [acceptedRow] };
      }
      writes.push(sql);
      return { rows: [] };
    },
  };
  const result = await rejectPeaPacket(db, {
    packetId: "pkt-1",
    actorId: "attacker",
    reason: "nope",
  });
  assert(result.error === "invalid_status", "reject accepted → invalid_status");
  assert(result.status === "accepted", "reject accepted preserves status in error");
  assert(writes.length === 0, "reject accepted performs no UPDATEs");

  const reviewRow = { ...acceptedRow, status: "ready_for_review" };
  const db2 = {
    async query(sql, params) {
      if (/FROM pea\.evolution_packets/i.test(sql) && /JOIN pea\.gaps/i.test(sql)) {
        return { rows: [reviewRow] };
      }
      if (/INSERT INTO pea\.audit/i.test(sql) || /pea\.audit_events/i.test(sql)) {
        return { rows: [] };
      }
      if (/UPDATE pea\.evolution_packets/i.test(sql)) {
        assert(params?.[0] === "pkt-1", "reject updates packet id");
        return { rows: [] };
      }
      if (/UPDATE pea\.gaps/i.test(sql)) {
        assert(params?.[0] === "gap-1", "reject updates gap id");
        return { rows: [] };
      }
      return { rows: [] };
    },
  };
  const ok = await rejectPeaPacket(db2, { packetId: "pkt-1", actorId: "admin" });
  assert(ok.ok === true && ok.status === "rejected", "reject ready_for_review succeeds");
}

await runRejectGuards();

console.log(`\npeaAuthHardening: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
