// In-memory live board must not expose phoneHash / raw telefono.
// Complementary to open #1177 HTTP list/detail pins — do not re-land those routes.
// Forces memory path (no DATABASE_URL) so CI stays deterministic.
// Run: node tests/storefrontLivePii.test.js

import assert from "node:assert/strict";

delete process.env.DATABASE_URL;

const {
  pingLiveSession,
  addLiveTurn,
  listLiveSessions,
  getLiveSession,
  hashStorefrontPhone,
  __testLive__,
} = await import("../server/lib/voice/storefrontLive.js");

__testLive__.reset();

assert.equal(hashStorefrontPhone("099123456").length, 16);
assert.equal(hashStorefrontPhone("1234567"), "", "short numbers are not hashed");
assert.equal(hashStorefrontPhone(""), "");
assert.equal(hashStorefrontPhone(null), "");

const phone = "099888777";
const ping = await pingLiveSession({
  id: "pii-live-1",
  cliente: "Luis",
  telefono: phone,
  pageUrl: "https://bmcuruguay.com.uy/collections/techos",
  adminRow: 8,
});
assert.equal(ping.ok, true);
assert.equal("telefono" in ping, false, "ping response has no raw phone");
assert.equal("phoneHash" in ping, false, "ping response has no hash");

const internal = __testLive__.get("pii-live-1");
assert.equal(internal.phoneHash, hashStorefrontPhone(phone));
assert.ok(!JSON.stringify(internal).includes(phone), "memory row stores hash only");

const listed = await listLiveSessions();
const row = listed.find((s) => s.id === "pii-live-1");
assert.ok(row, "session listed");
assert.equal(row.cliente, "Luis");
assert.equal("phoneHash" in row, false, "list drops phoneHash");
assert.equal("telefono" in row, false);
assert.ok(!JSON.stringify(row).includes(phone));
assert.ok(!JSON.stringify(row).includes(internal.phoneHash), "list does not echo the hash");

const detail = await getLiveSession("pii-live-1");
assert.equal(detail.cliente, "Luis");
assert.equal("phoneHash" in detail, false, "detail drops phoneHash");
assert.equal("telefono" in detail, false);
assert.ok(!JSON.stringify(detail).includes(phone));
assert.ok(!JSON.stringify(detail).includes(internal.phoneHash));

const badRole = await addLiveTurn({ sessionId: "pii-live-1", role: "system_override", text: "x" });
assert.equal(badRole.ok, false);
assert.equal(badRole.error, "role");

const empty = await addLiveTurn({ sessionId: "pii-live-1", role: "user", text: "   " });
assert.equal(empty.ok, false);

await pingLiveSession({ id: "pii-live-1", status: "ended" });
const afterEnd = await listLiveSessions();
assert.equal(
  afterEnd.some((s) => s.id === "pii-live-1"),
  false,
  "ended sessions leave the live list",
);

__testLive__.reset();
console.log("storefrontLivePii.test.js ok");
