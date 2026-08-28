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

/**
 * Minimal pg shim for multi-instance durability paths.
 * Models sessions / turns / injects tables used by storefrontLive.
 */
function makeLiveShim() {
  const sessions = new Map();
  const turns = [];
  const injects = [];
  let injectSeq = 1;

  function norm(sql) {
    return String(sql).replace(/\s+/g, " ").trim().toLowerCase();
  }

  async function query(sql, params = []) {
    const q = norm(sql);

    if (q.startsWith("create table") || q.startsWith("create index")) {
      return { rows: [] };
    }

    if (q.includes("insert into public.storefront_live_sessions")) {
      const [id, conversationId, cliente, phoneHash, pageUrl, adminRow, status, notified, handoffPending, lastSeenAt] = params;
      const prev = sessions.get(id);
      if (!prev) {
        sessions.set(id, {
          id,
          conversation_id: conversationId,
          cliente,
          phone_hash: phoneHash,
          page_url: pageUrl,
          admin_row: adminRow,
          status,
          notified: Boolean(notified),
          handoff_pending: Boolean(handoffPending),
          last_seen_at: Number(lastSeenAt) || Date.now(),
          created_at: Date.now(),
        });
      } else {
        const nextStatus =
          prev.status === "ended" ? "ended"
            : status === "ended" ? "ended"
              : (prev.status === "takeover" || status === "takeover") ? "takeover"
                : status;
        sessions.set(id, {
          ...prev,
          conversation_id: conversationId || prev.conversation_id,
          cliente: cliente || prev.cliente,
          phone_hash: phoneHash || prev.phone_hash,
          page_url: pageUrl || prev.page_url,
          admin_row: adminRow ?? prev.admin_row,
          status: nextStatus,
          notified: prev.notified || Boolean(notified),
          handoff_pending: prev.handoff_pending,
          last_seen_at: Math.max(prev.last_seen_at, Number(lastSeenAt) || 0),
        });
      }
      return { rows: [] };
    }

    if (q.includes("update public.storefront_live_sessions") && q.includes("set notified = true")) {
      const id = params[0];
      const row = sessions.get(id);
      if (!row || row.notified) return { rows: [] };
      row.notified = true;
      return { rows: [{ id }] };
    }

    if (q.includes("update public.storefront_live_sessions") && q.includes("set handoff_pending = true")) {
      const id = params[0];
      const row = sessions.get(id);
      if (!row) return { rows: [] };
      row.handoff_pending = true;
      row.status = "takeover";
      row.last_seen_at = Date.now();
      return { rows: [] };
    }

    if (q.includes("update public.storefront_live_sessions") && q.includes("set handoff_pending = false")) {
      const id = params[0];
      const row = sessions.get(id);
      if (!row || !row.handoff_pending) return { rows: [] };
      row.handoff_pending = false;
      return { rows: [{ id: row.id, status: row.status }] };
    }

    if (q.includes("insert into public.storefront_live_turns")) {
      turns.push({ session_id: params[0], role: params[1], text: params[2], ts: Date.now() });
      return { rows: [] };
    }

    if (q.includes("insert into public.storefront_live_injects")) {
      injects.push({
        id: injectSeq++,
        session_id: params[0],
        text: params[1],
        ts: Date.now(),
        consumed_at: null,
      });
      return { rows: [] };
    }

    if (q.includes("update public.storefront_live_injects") && q.includes("consumed_at")) {
      const sessionId = params[0];
      const out = [];
      for (const row of injects) {
        if (row.session_id === sessionId && !row.consumed_at && out.length < 40) {
          row.consumed_at = Date.now();
          out.push({ text: row.text, ts: row.ts });
        }
      }
      return { rows: out };
    }

    if (q.includes("from public.storefront_live_sessions where id =")) {
      const row = sessions.get(params[0]);
      return { rows: row ? [row] : [] };
    }

    if (q.includes("from public.storefront_live_turns where session_id =")) {
      return {
        rows: turns
          .filter((t) => t.session_id === params[0])
          .slice(-80)
          .map((t) => ({ role: t.role, text: t.text, ts: t.ts })),
      };
    }

    if (q.includes("from public.storefront_live_sessions") && q.includes("last_seen_at >")) {
      const cutoff = Date.now() - 2 * 60 * 1000;
      return {
        rows: [...sessions.values()]
          .filter((r) => r.last_seen_at > cutoff)
          .sort((a, b) => b.last_seen_at - a.last_seen_at)
          .slice(0, 40),
      };
    }

    if (q.includes("from identity.role_grants")) {
      return { rows: [] };
    }

    throw new Error(`unhandled SQL in live shim: ${q.slice(0, 140)}`);
  }

  return { query, _sessions: sessions, _injects: injects };
}

__testLive__.reset();
__testLive__.resetPool();

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

// ── Multi-instance: memory miss must not clobber takeover or drop injects ──
const shim = makeLiveShim();
__testLive__.setPool(shim);

await pingLiveSession({
  id: "live-multi-1",
  cliente: "Bruno",
  pageUrl: "https://bmcuruguay.com.uy/",
});
assert.equal(shim._sessions.get("live-multi-1").notified, true);

// Instance B: wipe memory, operator takeover + inject
__testLive__.clearMemory();
const takenB = await takeoverLiveSession("live-multi-1");
assert.equal(takenB.status, "takeover");
assert.equal(shim._sessions.get("live-multi-1").handoff_pending, true);
await injectLiveMessage("live-multi-1", "Te atiende ventas BMC");

// Instance A (shopper heartbeat): wipe memory again, ping must keep takeover
__testLive__.clearMemory();
const pingAfter = await pingLiveSession({ id: "live-multi-1", cliente: "Bruno" });
assert.equal(pingAfter.status, "takeover", "shopper ping on cold instance must not downgrade takeover");
assert.equal(shim._sessions.get("live-multi-1").status, "takeover");
assert.equal(pingAfter.notifiedNow, false, "must not re-notify after memory miss");

// Shopper state on yet another cold instance must deliver handoff + inject
__testLive__.clearMemory();
const coldState = await shopperLiveState("live-multi-1");
assert.equal(coldState.handoff, true, "handoff must survive instance hop via DB claim");
assert.equal(coldState.status, "takeover");
assert.equal(coldState.injects[0]?.text, "Te atiende ventas BMC");

__testLive__.clearMemory();
const coldState2 = await shopperLiveState("live-multi-1");
assert.equal(coldState2.handoff, false);
assert.equal(coldState2.injects.length, 0);

__testLive__.reset();
__testLive__.resetPool();
console.log("storefrontLive.test.js: ok");
