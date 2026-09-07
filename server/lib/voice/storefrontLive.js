/**
 * Live Panelin Front sessions: presence, turns, hub notify, operator takeover.
 * Memory always; Postgres when DATABASE_URL is set.
 *
 * Operator Hub and shopper widget are different clients → often different Cloud Run
 * instances. Handoff / injects / status must survive mem miss (hydrate + durable
 * pending_injects). Shopper pings must never downgrade takeover → live.
 */
import crypto from "node:crypto";
import pg from "pg";
import { config } from "../../config.js";
import { sendWhatsAppText } from "../whatsappOutbound.js";

const LIVE_MAX_AGE_MS = 45 * 1000;
const sessions = new Map();
/** Test double for Postgres when __testLive__.useMemory() — survives clearMem(). */
const durable = new Map();

let pool = null;
let schemaReady = false;
let schemaPromise = null;
let forceMemory = false;

export const STOREFRONT_LIVE_HANDOFF =
  "Un agente de ventas de BMC se suma a la conversación.";

function getPool() {
  if (forceMemory) return null;
  const url = process.env.DATABASE_URL || "";
  if (!url) return null;
  if (!pool) {
    pool = new pg.Pool({
      connectionString: url,
      max: 2,
      connectionTimeoutMillis: 4000,
      idleTimeoutMillis: 30_000,
    });
    pool.on("error", () => {});
  }
  return pool;
}

async function ensureSchema(db) {
  if (schemaReady) return;
  if (schemaPromise) return schemaPromise;
  schemaPromise = (async () => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS public.storefront_live_sessions (
        id               text PRIMARY KEY,
        conversation_id  text,
        cliente          text,
        phone_hash       text,
        page_url         text,
        admin_row        integer,
        status           text NOT NULL DEFAULT 'live',
        notified         boolean NOT NULL DEFAULT false,
        handoff_pending  boolean NOT NULL DEFAULT false,
        pending_injects  jsonb NOT NULL DEFAULT '[]'::jsonb,
        last_seen_at     timestamptz NOT NULL DEFAULT now(),
        created_at       timestamptz NOT NULL DEFAULT now()
      )
    `);
    await db.query(`
      ALTER TABLE public.storefront_live_sessions
        ADD COLUMN IF NOT EXISTS pending_injects jsonb NOT NULL DEFAULT '[]'::jsonb
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS public.storefront_live_turns (
        id          bigserial PRIMARY KEY,
        session_id  text NOT NULL,
        role        text NOT NULL,
        text        text NOT NULL,
        ts          timestamptz NOT NULL DEFAULT now()
      )
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS storefront_live_sessions_seen_idx
        ON public.storefront_live_sessions (last_seen_at DESC)
    `);
    schemaReady = true;
  })().catch((err) => {
    schemaPromise = null;
    throw err;
  });
  return schemaPromise;
}

export function hashStorefrontPhone(telefono) {
  const d = String(telefono || "").replace(/\D/g, "");
  if (d.length < 8) return "";
  return crypto.createHash("sha256").update(d).digest("hex").slice(0, 16);
}

function blankSession(id) {
  return {
    id,
    conversationId: null,
    cliente: "",
    phoneHash: "",
    pageUrl: "",
    adminRow: null,
    status: "live",
    notified: false,
    handoffPending: false,
    lastSeenAt: Date.now(),
    createdAt: Date.now(),
    turns: [],
    injects: [],
  };
}

function cloneSession(s) {
  return {
    ...s,
    turns: Array.isArray(s.turns) ? [...s.turns] : [],
    injects: Array.isArray(s.injects) ? s.injects.map((x) => ({ ...x })) : [],
  };
}

function parseInjects(raw) {
  if (!raw) return [];
  let list = raw;
  if (typeof raw === "string") {
    try {
      list = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];
  return list
    .filter((row) => row && typeof row === "object" && String(row.text || "").trim())
    .map((row) => ({
      text: String(row.text).trim().slice(0, 2000),
      ts: Number(row.ts) || Date.now(),
    }))
    .slice(-40);
}

function memGet(id) {
  return sessions.get(id) || null;
}

function memPut(s) {
  sessions.set(s.id, s);
  if (sessions.size > 400) {
    const old = [...sessions.values()].sort((a, b) => a.lastSeenAt - b.lastSeenAt);
    old.slice(0, sessions.size - 300).forEach((x) => sessions.delete(x.id));
  }
  return s;
}

function publicSession(s) {
  if (!s) return null;
  return {
    id: s.id,
    conversationId: s.conversationId,
    cliente: s.cliente,
    pageUrl: s.pageUrl,
    adminRow: s.adminRow,
    status: s.status,
    lastSeenAt: s.lastSeenAt,
    createdAt: s.createdAt,
    turns: (s.turns || []).slice(-80),
    live: s.status !== "ended" && Date.now() - s.lastSeenAt < LIVE_MAX_AGE_MS,
  };
}

/**
 * Resolve status for a shopper/operator ping. Never downgrade takeover→live;
 * ended stays ended unless an explicit non-ended status is sent (orb reopen
 * revive is handled by callers that pass status omit + separate revive PRs).
 */
export function resolveLivePingStatus(currentStatus, inputStatus) {
  const cur = String(currentStatus || "live");
  const next = inputStatus != null && String(inputStatus).trim() !== ""
    ? String(inputStatus).trim()
    : "";
  if (next === "ended") return "ended";
  if (next === "takeover") return "takeover";
  if (cur === "takeover") return "takeover";
  if (cur === "ended") return "ended";
  return "live";
}

function rowToSession(r) {
  const id = String(r.id);
  return {
    id,
    conversationId: r.conversation_id || null,
    cliente: String(r.cliente || ""),
    phoneHash: String(r.phone_hash || ""),
    pageUrl: String(r.page_url || ""),
    adminRow: r.admin_row != null ? Number(r.admin_row) : null,
    status: String(r.status || "live"),
    notified: Boolean(r.notified),
    handoffPending: Boolean(r.handoff_pending),
    lastSeenAt: Number(r.last_seen_at) || Date.now(),
    createdAt: Number(r.created_at) || Date.now(),
    turns: [],
    injects: parseInjects(r.pending_injects),
  };
}

async function readStoreRow(sid) {
  if (forceMemory) {
    const d = durable.get(sid);
    return d ? cloneSession(d) : null;
  }
  const db = getPool();
  if (!db) return null;
  try {
    await ensureSchema(db);
    const { rows } = await db.query(
      `SELECT id, conversation_id, cliente, phone_hash, page_url, admin_row, status,
              notified, handoff_pending, pending_injects,
              extract(epoch from last_seen_at) * 1000 AS last_seen_at,
              extract(epoch from created_at) * 1000 AS created_at
         FROM public.storefront_live_sessions WHERE id = $1`,
      [sid],
    );
    if (!rows[0]) return null;
    return rowToSession(rows[0]);
  } catch {
    return null;
  }
}

/**
 * Merge authoritative takeover / handoff / injects from durable/DB into mem.
 * Required on mem hit: shopper and operator hit different Cloud Run instances.
 */
async function mergeFromStore(s) {
  if (!s?.id) return s;
  const row = await readStoreRow(s.id);
  if (!row) return s;
  if (row.status === "takeover" && s.status === "live") s.status = "takeover";
  if (row.status === "ended" && s.status === "live") s.status = "ended";
  s.handoffPending = Boolean(row.handoffPending);
  s.notified = Boolean(s.notified || row.notified);
  if ((row.injects?.length || 0) >= (s.injects?.length || 0)) {
    s.injects = row.injects.map((x) => ({ ...x }));
  }
  if (!s.cliente && row.cliente) s.cliente = row.cliente;
  if (s.adminRow == null && row.adminRow != null) s.adminRow = row.adminRow;
  if (!s.pageUrl && row.pageUrl) s.pageUrl = row.pageUrl;
  return s;
}

/** Load session into mem from durable/DB when this instance never saw it. */
async function hydrateSession(id) {
  const sid = String(id || "").trim();
  if (!sid) return null;
  const hit = memGet(sid);
  if (hit) {
    await mergeFromStore(hit);
    return memPut(hit);
  }
  const row = await readStoreRow(sid);
  if (!row) return null;
  return memPut(row);
}

async function persistSession(s) {
  if (forceMemory) {
    durable.set(s.id, cloneSession(s));
    return;
  }
  const db = getPool();
  if (!db) return;
  try {
    await ensureSchema(db);
    const injectsJson = JSON.stringify(Array.isArray(s.injects) ? s.injects.slice(-40) : []);
    await db.query(
      `INSERT INTO public.storefront_live_sessions
         (id, conversation_id, cliente, phone_hash, page_url, admin_row, status, notified,
          handoff_pending, pending_injects, last_seen_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb, to_timestamp($11::double precision / 1000.0))
       ON CONFLICT (id) DO UPDATE SET
         conversation_id = COALESCE(EXCLUDED.conversation_id, storefront_live_sessions.conversation_id),
         cliente = COALESCE(NULLIF(EXCLUDED.cliente, ''), storefront_live_sessions.cliente),
         phone_hash = COALESCE(NULLIF(EXCLUDED.phone_hash, ''), storefront_live_sessions.phone_hash),
         page_url = COALESCE(NULLIF(EXCLUDED.page_url, ''), storefront_live_sessions.page_url),
         admin_row = COALESCE(EXCLUDED.admin_row, storefront_live_sessions.admin_row),
         status = CASE
           WHEN storefront_live_sessions.status = 'takeover'
            AND EXCLUDED.status = 'live'
           THEN storefront_live_sessions.status
           ELSE EXCLUDED.status
         END,
         notified = storefront_live_sessions.notified OR EXCLUDED.notified,
         handoff_pending = EXCLUDED.handoff_pending,
         pending_injects = EXCLUDED.pending_injects,
         last_seen_at = EXCLUDED.last_seen_at`,
      [
        s.id, s.conversationId, s.cliente, s.phoneHash, s.pageUrl, s.adminRow,
        s.status, s.notified, s.handoffPending, injectsJson, s.lastSeenAt,
      ],
    );
  } catch { /* memory still works */ }
}

/**
 * Atomically claim handoff + pending injects for the shopper poll.
 * Survives Cloud Run instance mismatch / recycle.
 */
async function claimShopperDelivery(id) {
  const sid = String(id || "").trim();
  if (!sid) return null;

  if (forceMemory) {
    const d = durable.get(sid) || memGet(sid);
    if (!d) return null;
    const handoff = Boolean(d.handoffPending);
    const injects = Array.isArray(d.injects) ? d.injects.map((x) => ({ ...x })) : [];
    d.handoffPending = false;
    d.injects = [];
    durable.set(sid, cloneSession(d));
    const mem = memGet(sid);
    if (mem) {
      mem.handoffPending = false;
      mem.injects = [];
      mem.status = d.status;
      memPut(mem);
    }
    return { status: d.status, handoff, injects };
  }

  const db = getPool();
  if (!db) {
    const s = memGet(sid);
    if (!s) return null;
    const handoff = Boolean(s.handoffPending);
    const injects = s.injects.splice(0, s.injects.length);
    if (handoff) s.handoffPending = false;
    memPut(s);
    if (handoff) await persistSession(s);
    return { status: s.status, handoff, injects };
  }

  try {
    await ensureSchema(db);
    const { rows } = await db.query(
      `WITH prev AS (
         SELECT id, status, handoff_pending, pending_injects
           FROM public.storefront_live_sessions
          WHERE id = $1
          FOR UPDATE
       )
       UPDATE public.storefront_live_sessions AS s
          SET handoff_pending = false,
              pending_injects = '[]'::jsonb
         FROM prev
        WHERE s.id = prev.id
       RETURNING prev.status AS status,
                 prev.handoff_pending AS handoff_pending,
                 prev.pending_injects AS pending_injects`,
      [sid],
    );
    if (!rows[0]) return null;
    const handoff = Boolean(rows[0].handoff_pending);
    const injects = parseInjects(rows[0].pending_injects);
    const status = String(rows[0].status || "live");
    const mem = memGet(sid);
    if (mem) {
      mem.status = status;
      mem.handoffPending = false;
      mem.injects = [];
      memPut(mem);
    }
    return { status, handoff, injects };
  } catch {
    const s = memGet(sid);
    if (!s) return null;
    const handoff = Boolean(s.handoffPending);
    const injects = s.injects.splice(0, s.injects.length);
    if (handoff) s.handoffPending = false;
    memPut(s);
    return { status: s.status, handoff, injects };
  }
}

async function persistTurn(sessionId, role, text) {
  const db = getPool();
  if (!db) return;
  try {
    await ensureSchema(db);
    await db.query(
      `INSERT INTO public.storefront_live_turns (session_id, role, text) VALUES ($1,$2,$3)`,
      [sessionId, role, text],
    );
  } catch { /* ignore */ }
}

async function notifyHub({ title, body, payload }) {
  const db = getPool();
  if (!db) return false;
  try {
    const { rows } = await db.query(
      `select user_id from identity.role_grants where role = 'superadmin'`,
    );
    if (!rows.length) return false;
    const values = rows.map((_, i) => `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5}::jsonb)`).join(",");
    const params = rows.flatMap((r) => [
      r.user_id, "storefront_live", title, body, JSON.stringify(payload || {}),
    ]);
    await db.query(
      `insert into identity.notifications (user_id, kind, title, body, payload) values ${values}`,
      params,
    );
    return true;
  } catch {
    return false;
  }
}

async function notifyWhatsApp(s) {
  const to = String(config.storefrontLiveNotifyWa || "").replace(/\D/g, "");
  if (to.length < 8) return false;
  if (to === String(config.storefrontWaNumber || "").replace(/\D/g, "")) return false;
  const token = config.whatsappAccessToken;
  const phoneNumberId = config.whatsappPhoneNumberId;
  if (!token || !phoneNumberId) return false;
  const board = `${String(config.frontendBaseUrl || "").replace(/\/$/, "")}/hub/panelin-web?s=${encodeURIComponent(s.id)}`;
  const page = s.pageUrl ? ` en ${s.pageUrl}` : "";
  const who = s.cliente || "Alguien";
  const text = `Chat en vivo Panelin web: ${who}${page}. Abrí el tablero: ${board}`;
  try {
    await sendWhatsAppText({ to, text, accessToken: token, phoneNumberId });
    return true;
  } catch {
    return false;
  }
}

export async function pingLiveSession(input = {}) {
  const id = String(input.id || input.liveId || "").trim().slice(0, 80) || crypto.randomUUID();
  let s = await hydrateSession(id);
  const wasNew = !s;
  if (!s) s = blankSession(id);
  if (input.conversationId) s.conversationId = String(input.conversationId).slice(0, 80);
  if (input.cliente) s.cliente = String(input.cliente).trim().slice(0, 80);
  if (input.telefono) s.phoneHash = hashStorefrontPhone(input.telefono);
  if (input.pageUrl) s.pageUrl = String(input.pageUrl).slice(0, 300);
  const row = Number(input.adminRow);
  if (Number.isFinite(row) && row >= 2) s.adminRow = row;
  s.status = resolveLivePingStatus(s.status, input.status);
  s.lastSeenAt = Date.now();
  memPut(s);

  let notifiedNow = false;
  if (wasNew && s.status === "live" && !s.notified) {
    s.notified = true;
    memPut(s);
    notifiedNow = true;
    const title = `Chat en vivo · ${s.cliente || "tienda"}`;
    await notifyHub({ title, body: s.pageUrl || "bmcuruguay.com.uy", payload: { liveId: s.id, pageUrl: s.pageUrl } });
    await notifyWhatsApp(s);
  }
  await persistSession(s);
  return { ok: true, id: s.id, status: s.status, notified: s.notified, notifiedNow };
}

export async function addLiveTurn({ sessionId, role, text }) {
  const id = String(sessionId || "").trim();
  const t = String(text || "").trim().slice(0, 4000);
  const r = String(role || "assistant").slice(0, 20);
  if (!id || !t) return { ok: false, error: "session + text" };
  if (!["user", "assistant", "agent", "system"].includes(r)) return { ok: false, error: "role" };
  let s = await hydrateSession(id);
  if (!s) {
    s = blankSession(id);
    memPut(s);
  }
  s.turns.push({ role: r, text: t, ts: Date.now() });
  if (s.turns.length > 120) s.turns = s.turns.slice(-80);
  s.lastSeenAt = Date.now();
  memPut(s);
  await persistTurn(id, r, t);
  await persistSession(s);
  return { ok: true, id };
}

export async function shopperLiveState(id) {
  const sid = String(id || "").trim();
  if (!sid) return { ok: true, status: "idle", injects: [], handoff: false };
  await hydrateSession(sid);
  const claimed = await claimShopperDelivery(sid);
  if (!claimed) return { ok: true, status: "idle", injects: [], handoff: false };
  return {
    ok: true,
    id: sid,
    status: claimed.status,
    injects: claimed.injects,
    handoff: claimed.handoff,
  };
}

export async function listLiveSessions() {
  const cutoff = Date.now() - LIVE_MAX_AGE_MS;
  const db = forceMemory ? null : getPool();
  if (db) {
    try {
      await ensureSchema(db);
      const { rows } = await db.query(
        `SELECT id, conversation_id, cliente, page_url, admin_row, status,
                extract(epoch from last_seen_at) * 1000 AS last_seen_at,
                extract(epoch from created_at) * 1000 AS created_at
           FROM public.storefront_live_sessions
          WHERE status <> 'ended'
            AND last_seen_at > now() - ($1::int * interval '1 millisecond')
          ORDER BY last_seen_at DESC LIMIT 40`,
        [LIVE_MAX_AGE_MS],
      );
      if (rows.length) {
        return rows
          .map((r) => ({
            id: r.id,
            conversationId: r.conversation_id,
            cliente: r.cliente,
            pageUrl: r.page_url,
            adminRow: r.admin_row,
            status: r.status,
            lastSeenAt: Number(r.last_seen_at),
            createdAt: Number(r.created_at),
            live: Number(r.last_seen_at) >= cutoff && r.status !== "ended",
          }))
          .filter((r) => r.live);
      }
    } catch { /* memory */ }
  }
  const source = forceMemory && durable.size
    ? [...durable.values()]
    : [...sessions.values()];
  return source
    .filter((s) => s.lastSeenAt >= cutoff && s.status !== "ended")
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
    .map(publicSession);
}

export async function getLiveSession(id) {
  const sid = String(id || "").trim();
  const hydrated = await hydrateSession(sid);
  if (hydrated) {
    if (!hydrated.turns?.length && !forceMemory) {
      const db = getPool();
      if (db) {
        try {
          await ensureSchema(db);
          const { rows: turns } = await db.query(
            `SELECT role, text, extract(epoch from ts) * 1000 AS ts
               FROM public.storefront_live_turns WHERE session_id = $1
               ORDER BY ts ASC LIMIT 80`,
            [sid],
          );
          hydrated.turns = turns.map((t) => ({ role: t.role, text: t.text, ts: Number(t.ts) }));
          memPut(hydrated);
        } catch { /* ignore */ }
      }
    }
    return publicSession(hydrated);
  }
  return null;
}

export async function takeoverLiveSession(id) {
  const sid = String(id || "").trim();
  let s = await hydrateSession(sid);
  if (!s) s = blankSession(sid);
  s.status = "takeover";
  s.handoffPending = true;
  s.lastSeenAt = Date.now();
  memPut(s);
  await persistSession(s);
  await addLiveTurn({ sessionId: sid, role: "system", text: STOREFRONT_LIVE_HANDOFF });
  // addLiveTurn merges from store — re-assert takeover flags afterward.
  s = (await hydrateSession(sid)) || s;
  s.status = "takeover";
  s.handoffPending = true;
  memPut(s);
  await persistSession(s);
  return publicSession(s);
}

export async function injectLiveMessage(id, text) {
  const t = String(text || "").trim().slice(0, 2000);
  if (!t) return { ok: false, error: "texto vacío" };
  const sid = String(id || "").trim();
  let s = await hydrateSession(sid);
  if (!s) s = blankSession(sid);
  const row = { text: t, ts: Date.now() };
  s.injects.push(row);
  s.lastSeenAt = Date.now();
  if (s.status !== "ended") s.status = "takeover";
  // Do not re-arm handoff_pending — shopper may already have claimed it.
  memPut(s);
  await persistSession(s);
  await addLiveTurn({ sessionId: sid, role: "agent", text: t });
  s = (await hydrateSession(sid)) || s;
  if (!s.injects.some((x) => x.text === t && x.ts === row.ts)) {
    s.injects.push(row);
  }
  if (s.status !== "ended") s.status = "takeover";
  memPut(s);
  await persistSession(s);
  return { ok: true, id: sid };
}

export const __testLive__ = {
  reset() {
    sessions.clear();
    durable.clear();
    forceMemory = false;
  },
  get: memGet,
  useMemory() {
    forceMemory = true;
  },
  /** Drop in-process mem only — durable/DB still holds takeover + injects. */
  clearMem() {
    sessions.clear();
  },
  /** Age lastSeenAt in mem + durable (Hub TTL tests). */
  age(id, msAgo) {
    const sid = String(id || "").trim();
    const ts = Date.now() - Number(msAgo || 0);
    const mem = memGet(sid);
    if (mem) {
      mem.lastSeenAt = ts;
      memPut(mem);
    }
    const d = durable.get(sid);
    if (d) {
      d.lastSeenAt = ts;
      durable.set(sid, cloneSession(d));
    }
  },
  resolveLivePingStatus,
};
