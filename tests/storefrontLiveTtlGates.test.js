/**
 * Hub live TTL edges (#1216): ended/stale drop; just-under 45s stays;
 * takeover stays visible. Complementary to storefrontLive happy-path
 * and open #1189 takeover/role gates.
 * Run: node tests/storefrontLiveTtlGates.test.js
 */
delete process.env.DATABASE_URL;

const assert = (await import("node:assert/strict")).default;
const {
  pingLiveSession,
  listLiveSessions,
  takeoverLiveSession,
  getLiveSession,
  __testLive__,
} = await import("../server/lib/voice/storefrontLive.js");

console.log("storefrontLiveTtlGates");

__testLive__.reset();
__testLive__.useMemory();

{
  const ping = await pingLiveSession({ id: "ttl-fresh", cliente: "Ana" });
  assert.equal(ping.ok, true);
  const listed = await listLiveSessions();
  const row = listed.find((s) => s.id === "ttl-fresh");
  assert.ok(row, "fresh session appears on Hub");
  assert.equal(row.live, true);
  assert.equal(row.status, "live");
  assert.equal("phoneHash" in row, false);
}

{
  const mem = __testLive__.get("ttl-fresh");
  mem.lastSeenAt = Date.now() - 44_000;
  const listed = await listLiveSessions();
  const row = listed.find((s) => s.id === "ttl-fresh");
  assert.ok(row, "44s-old session still listed (LIVE_MAX_AGE_MS is 45s)");
  assert.equal(row.live, true);
}

{
  const mem = __testLive__.get("ttl-fresh");
  mem.lastSeenAt = Date.now() - 46_000;
  const listed = await listLiveSessions();
  assert.ok(
    !listed.some((s) => s.id === "ttl-fresh"),
    "46s-old session is hidden from Hub",
  );
  const pub = await getLiveSession("ttl-fresh");
  assert.equal(pub.live, false, "stale session.live is false");
  assert.equal(pub.status, "live", "TTL hide does not rewrite status");
}

{
  await pingLiveSession({ id: "ttl-ended", cliente: "Beto", status: "ended" });
  const listed = await listLiveSessions();
  assert.ok(
    !listed.some((s) => s.id === "ttl-ended"),
    "ended session is hidden even with a fresh lastSeenAt",
  );
  const pub = await getLiveSession("ttl-ended");
  assert.equal(pub.status, "ended");
  assert.equal(pub.live, false);
}

{
  await pingLiveSession({ id: "ttl-take", cliente: "Cata" });
  const taken = await takeoverLiveSession("ttl-take");
  assert.equal(taken.status, "takeover");
  const listed = await listLiveSessions();
  const row = listed.find((s) => s.id === "ttl-take");
  assert.ok(row, "operator takeover stays on the Hub board");
  assert.equal(row.status, "takeover");
  assert.equal(row.live, true);
}

{
  const mem = __testLive__.get("ttl-take");
  mem.lastSeenAt = Date.now() - 60_000;
  const listed = await listLiveSessions();
  assert.ok(
    !listed.some((s) => s.id === "ttl-take"),
    "stale takeover is hidden the same as a stale live row",
  );
}

__testLive__.reset();
console.log("storefrontLiveTtlGates: ok");
