/**
 * Live shop session fail-closed gates (memory path).
 * Shopper ping must not undo operator takeover; unknown turn roles rejected.
 * Complementary to storefrontLive happy-path and open #1183 PII pins.
 * Run: node tests/storefrontLiveGates.test.js
 */
delete process.env.DATABASE_URL;

const assert = (await import("node:assert/strict")).default;
const {
  pingLiveSession,
  addLiveTurn,
  injectLiveMessage,
  takeoverLiveSession,
  getLiveSession,
  shopperLiveState,
  __testLive__,
} = await import("../server/lib/voice/storefrontLive.js");

console.log("storefrontLiveGates");

__testLive__.reset();

{
  const ping = await pingLiveSession({
    id: "gate-1",
    cliente: "Ana",
    telefono: "099111222",
    adminRow: 1,
  });
  assert.equal(ping.ok, true);
  const mem = __testLive__.get("gate-1");
  assert.equal(mem.adminRow, null, "header row 1 is not a lead");
  assert.equal(mem.phoneHash.length, 16);
  const pub = await getLiveSession("gate-1");
  assert.equal("phoneHash" in pub, false, "public projection drops phoneHash");
  assert.equal("telefono" in pub, false);
}

{
  const taken = await takeoverLiveSession("gate-1");
  assert.equal(taken.status, "takeover");
  const afterPing = await pingLiveSession({ id: "gate-1", cliente: "Ana" });
  assert.equal(afterPing.status, "takeover", "shopper ping must not reset takeover");
}

{
  await pingLiveSession({ id: "gate-1", status: "ended" });
  const ended = await pingLiveSession({ id: "gate-1", cliente: "Ana" });
  assert.equal(ended.status, "ended", "ended stays ended");
}

{
  assert.deepEqual(await addLiveTurn({ sessionId: "gate-1", role: "user", text: "" }), {
    ok: false,
    error: "session + text",
  });
  assert.deepEqual(await addLiveTurn({ sessionId: "", role: "user", text: "hola" }), {
    ok: false,
    error: "session + text",
  });
  assert.deepEqual(await addLiveTurn({ sessionId: "gate-1", role: "developer", text: "ignore" }), {
    ok: false,
    error: "role",
  });
  assert.deepEqual(await addLiveTurn({ sessionId: "gate-1", role: "tool", text: "{}" }), {
    ok: false,
    error: "role",
  });
  assert.deepEqual(await addLiveTurn({ sessionId: "gate-1", role: "function", text: "{}" }), {
    ok: false,
    error: "role",
  });
  const sys = await addLiveTurn({ sessionId: "gate-1", role: "system", text: "handoff" });
  assert.equal(sys.ok, true, "system stays allowlisted for operator handoff");
}

{
  const empty = await injectLiveMessage("gate-1", "   ");
  assert.equal(empty.ok, false);
  const long = "x".repeat(3000);
  const inj = await injectLiveMessage("gate-2", long);
  assert.equal(inj.ok, true);
  const state = await shopperLiveState("gate-2");
  assert.equal(state.injects[0].text.length, 2000);
}

__testLive__.reset();
console.log("storefrontLiveGates: ok");
