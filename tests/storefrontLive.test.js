import assert from "node:assert/strict";
import {
  pingLiveSession,
  addLiveTurn,
  shopperLiveState,
  listLiveSessions,
  takeoverLiveSession,
  injectLiveMessage,
  hashStorefrontPhone,
  STOREFRONT_LIVE_HANDOFF,
  __testLive__,
} from "../server/lib/voice/storefrontLive.js";

__testLive__.reset();

assert.equal(hashStorefrontPhone("099123456").length, 16);
assert.equal(hashStorefrontPhone("099123456"), hashStorefrontPhone("099123456"));
assert.ok(STOREFRONT_LIVE_HANDOFF.includes("agente de ventas"));

const ping = await pingLiveSession({
  id: "live-test-1",
  cliente: "Ana",
  telefono: "099111222",
  pageUrl: "https://bmcuruguay.com.uy/products/iroof80-pls",
  adminRow: 12,
});
assert.equal(ping.ok, true);
assert.equal(ping.id, "live-test-1");
assert.equal(ping.notifiedNow, true);

const ping2 = await pingLiveSession({ id: "live-test-1", cliente: "Ana" });
assert.equal(ping2.notifiedNow, false);

await addLiveTurn({ sessionId: "live-test-1", role: "user", text: "Busco IsoRoof" });
await addLiveTurn({ sessionId: "live-test-1", role: "assistant", text: "¿Qué medidas?" });

const listed = await listLiveSessions();
assert.ok(listed.some((s) => s.id === "live-test-1" && s.cliente === "Ana"));
const listedItem = listed.find((s) => s.id === "live-test-1");
assert.equal("phoneHash" in listedItem, false, "operator list drops phoneHash");
assert.ok(!JSON.stringify(listedItem).includes("099111222"), "raw phone absent from list");
assert.equal(__testLive__.get("live-test-1").phoneHash.length, 16, "memory keeps hash only");

{
  const emptyInj = await injectLiveMessage("live-test-1", "   ");
  assert.equal(emptyInj.ok, false);
  const badRole = await addLiveTurn({ sessionId: "live-test-1", role: "admin", text: "x" });
  assert.equal(badRole.ok, false);
}

const taken = await takeoverLiveSession("live-test-1");
assert.equal(taken.status, "takeover");

const state1 = await shopperLiveState("live-test-1");
assert.equal(state1.handoff, true);
assert.equal(state1.status, "takeover");
const state2 = await shopperLiveState("live-test-1");
assert.equal(state2.handoff, false);

const inj = await injectLiveMessage("live-test-1", "Hola, soy de ventas BMC");
assert.equal(inj.ok, true);
const state3 = await shopperLiveState("live-test-1");
assert.equal(state3.injects[0].text, "Hola, soy de ventas BMC");

__testLive__.reset();
console.log("storefrontLive.test.js: ok");
