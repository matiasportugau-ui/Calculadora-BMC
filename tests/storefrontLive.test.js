import assert from "node:assert/strict";
import {
  pingLiveSession,
  addLiveTurn,
  shopperLiveState,
  listLiveSessions,
  takeoverLiveSession,
  injectLiveMessage,
  hashStorefrontPhone,
  resolveLivePingStatus,
  STOREFRONT_LIVE_HANDOFF,
  __testLive__,
} from "../server/lib/voice/storefrontLive.js";

__testLive__.reset();
__testLive__.useMemory();

assert.equal(hashStorefrontPhone("099123456").length, 16);
assert.equal(hashStorefrontPhone("099123456"), hashStorefrontPhone("099123456"));
assert.ok(STOREFRONT_LIVE_HANDOFF.includes("agente de ventas"));

assert.equal(resolveLivePingStatus("takeover", undefined), "takeover");
assert.equal(resolveLivePingStatus("takeover", "live"), "takeover");
assert.equal(resolveLivePingStatus("live", "ended"), "ended");
assert.equal(resolveLivePingStatus("ended", undefined), "ended");
assert.equal(resolveLivePingStatus("live", "takeover"), "takeover");

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

__testLive__.age("live-test-1", 60_000);
assert.ok(
  !(await listLiveSessions()).some((s) => s.id === "live-test-1"),
  "Hub hides sessions older than LIVE_MAX_AGE_MS",
);

__testLive__.reset();
__testLive__.useMemory();

await pingLiveSession({
  id: "live-test-1",
  cliente: "Ana",
  telefono: "099111222",
  pageUrl: "https://bmcuruguay.com.uy/products/iroof80-pls",
  adminRow: 12,
});

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

// Cold instance / cross-Cloud-Run: mem empty, durable still has takeover + injects
__testLive__.reset();
__testLive__.useMemory();

await pingLiveSession({
  id: "live-cold-1",
  cliente: "Bruno",
  telefono: "099333444",
  adminRow: 20,
});
await takeoverLiveSession("live-cold-1");
await injectLiveMessage("live-cold-1", "Te atiende ventas BMC");

__testLive__.clearMem();

const coldPing = await pingLiveSession({ id: "live-cold-1", cliente: "Bruno" });
assert.equal(
  coldPing.status,
  "takeover",
  "shopper ping must not downgrade takeover after mem miss",
);

const coldState = await shopperLiveState("live-cold-1");
assert.equal(coldState.handoff, true, "handoff must survive instance recycle");
assert.equal(coldState.status, "takeover");
assert.equal(
  coldState.injects[0]?.text,
  "Te atiende ventas BMC",
  "operator inject must survive instance recycle",
);

const coldState2 = await shopperLiveState("live-cold-1");
assert.equal(coldState2.handoff, false);
assert.equal(coldState2.injects.length, 0);

__testLive__.reset();
console.log("storefrontLive.test.js: ok");
