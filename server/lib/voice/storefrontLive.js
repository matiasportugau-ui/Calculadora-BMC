/**
 * Live Panelin Front sessions: presence, turns, hub notify, operator takeover.
 * Memory for hot path; Postgres is source of truth when DATABASE_URL is set
 * (Cloud Run multi-instance / scale-to-zero must not lose takeover or injects).
 */
import crypto from "node:crypto";
import pg from "pg";
import { config } from "../../config.js";
import { sendWhatsAppText } from "../whatsappOutbound.js";

const LIVE_MAX_AGE_MS = 45 * 1000;
const sessions = new Map();

let pool = null;
let _testPool = null;
let schemaReady = false;
let schemaPromise = null;

export const STOREFRONT_LIVE_HANDOFF =
  "Un agente de ventas de BMC se suma a la conversación.";

function getPool() {
  if (_testPool) return _testPool;
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
        last_seen_at     timestamptz NOT NULL DEFAULT now(),
        created_at       timestamptz NOT NULL DEFAULT now()
      )
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
      CREATE TABLE IF NOT EXISTS public.storefront_live_injects (
        id           bigserial PRIMARY KEY,
        session_id   text NOT NULL,
        text         text NOT NULL,
        ts           timestamptz NOT NULL DEFAULT now(),
        consumed_at  timestamptz
      )
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS storefront_live_sessions_seen_idx
        ON public.storefront_live_sessions (last_seen_at DESC)
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS storefront_live_injects_pending_idx
        ON public.storefront_live_injects (session_id)
        WHERE consumed_at IS NULL
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

function rowToSession(r, turns = []) {
  return {
    id: r.id,
    conversationId: r.conversation_id || null,
    cliente: r.cliente || "",
    phoneHash: r.phone_hash || "",
    pageUrl: r.page_url || "",
    adminRow: r.admin_row == null ? null : Number(r.admin_row),
    status: r.status || "live",
    notified: Boolean(r.notified),
    handoffPending: Boolean(r.handoff_pending),
    lastSeenAt: Number(r.last_seen_at) || Date.now(),
    createdAt: Number(r.created_at) || Date.now(),
    turns: turns.map((t) => ({ role: t.role, text: t.text, ts: Number(t.ts) })),
    injects: [],
  };
}

/** Load durable session into this instance's memory when missing (multi-instance). */
async function hydrateSession(id) {
  const sid = String(id || "").trim();
  if (!sid) return null;
  const existing = memGet(sid);
  if (existing) return existing;
  const db = getPool();
  if (!db) return null;
  try {
    await ensureSchema(db);
    const { rows } = await db.query(
      `SELECT id, conversation_id, cliente, phone_hash, page_url, admin_row, status,
              notified, handoff_pending,
              extract(epoch from last_seen_at) * 1000 AS last_seen_at,
              extract(epoch from created_at) * 1000 AS created_at
         FROM public.storefront_live_sessions WHERE id = $1`,
      [sid],
    );
    if (!rows[0]) return null;
    const { rows: turns } = await db.query(
      `SELECT role, text, extract(epoch from ts) * 1000 AS ts
         FROM public.storefront_live_turns WHERE session_id = $1
         ORDER BY ts ASC LIMIT 80`,
      [sid],
    );
    return memPut(rowToSession(rows[0], turns));
  } catch {
    return null;
  }
}

async function resolveSession(id, { create = false } = {}) {
  const sid = String(id || "").trim();
  if (!sid) return null;
  let s = memGet(sid) || (await hydrateSession(sid));
  if (!s && create) {
    s = blankSession(sid);
    memPut(s);
  }
  return s;
}

async function persistSession(s) {
  const db = getPool();
  if (!db) return;
  try {
    await ensureSchema(db);
    await db.query(
      `INSERT INTO public.storefront_live_sessions
         (id, conversation_id, cliente, phone_hash, page_url, admin_row, status, notified, handoff_pending, last_seen_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, to_timestamp($10::double precision / 1000.0))
       ON CONFLICT (id) DO UPDATE SET
         conversation_id = COALESCE(EXCLUDED.conversation_id, storefront_live_sessions.conversation_id),
         cliente = COALESCE(NULLIF(EXCLUDED.cliente, ''), storefront_live_sessions.cliente),
         phone_hash = COALESCE(NULLIF(EXCLUDED.phone_hash, ''), storefront_live_sessions.phone_hash),
         page_url = COALESCE(NULLIF(EXCLUDED.page_url, ''), storefront_live_sessions.page_url),
         admin_row = COALESCE(EXCLUDED.admin_row, storefront_live_sessions.admin_row),
         status = CASE
           WHEN storefront_live_sessions.status = 'ended' THEN 'ended'
           WHEN EXCLUDED.status = 'ended' THEN 'ended'
           WHEN storefront_live_sessions.status = 'takeover' OR EXCLUDED.status = 'takeover' THEN 'takeover'
           ELSE EXCLUDED.status
         END,
         notified = storefront_live_sessions.notified OR EXCLUDED.notified,
         -- handoff_pending is armed only via markHandoffPending / cleared via claimHandoff
         handoff_pending = storefront_live_sessions.handoff_pending,
         last_seen_at = GREATEST(storefront_live_sessions.last_seen_at, EXCLUDED.last_seen_at)`,
      [
        s.id, s.conversationId, s.cliente, s.phoneHash, s.pageUrl, s.adminRow,
        s.status, s.notified, s.handoffPending, s.lastSeenAt,
      ],
    );
  } catch { /* memory still works */ }
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

async function persistInject(sessionId, text) {
  const db = getPool();
  if (!db) return;
  try {
    await ensureSchema(db);
    await db.query(
      `INSERT INTO public.storefront_live_injects (session_id, text) VALUES ($1,$2)`,
      [sessionId, text],
    );
  } catch { /* ignore */ }
}

/** Arm handoff in DB (takeover only). persistSession must not re-arm from stale memory. */
async function markHandoffPending(sessionId) {
  const db = getPool();
  if (!db) return;
  try {
    await ensureSchema(db);
    await db.query(
      `UPDATE public.storefront_live_sessions
          SET handoff_pending = true, status = 'takeover', last_seen_at = now()
        WHERE id = $1`,
      [sessionId],
    );
  } catch { /* ignore */ }
}

/** Atomically claim notify right so multi-instance pings do not spam WA/hub. */
async function claimNotify(sessionId) {
  const db = getPool();
  if (!db) return true;
  try {
    await ensureSchema(db);
    const { rows } = await db.query(
      `UPDATE public.storefront_live_sessions
          SET notified = true
        WHERE id = $1 AND notified = false
        RETURNING id`,
      [sessionId],
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

/** Atomically claim handoff flag for the shopper poll that should show it. */
async function claimHandoff(sessionId) {
  const db = getPool();
  if (!db) return null;
  try {
    await ensureSchema(db);
    const { rows } = await db.query(
      `UPDATE public.storefront_live_sessions
          SET handoff_pending = false
        WHERE id = $1 AND handoff_pending = true
        RETURNING id, status`,
      [sessionId],
    );
    return rows[0] || null;
  } catch {
    return null;
  }
}

async function claimInjects(sessionId) {
  const db = getPool();
  if (!db) return [];
  try {
    await ensureSchema(db);
    const { rows } = await db.query(
      `UPDATE public.storefront_live_injects
          SET consumed_at = now()
        WHERE id IN (
          SELECT id FROM public.storefront_live_injects
           WHERE session_id = $1 AND consumed_at IS NULL
           ORDER BY id ASC
           LIMIT 40
           FOR UPDATE SKIP LOCKED
        )
        RETURNING text, extract(epoch from ts) * 1000 AS ts`,
      [sessionId],
    );
    return rows.map((r) => ({ text: r.text, ts: Number(r.ts) }));
  } catch {
    return [];
  }
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
  let s = await resolveSession(id, { create: true });
  const alreadyNotified = Boolean(s.notified);
  if (input.conversationId) s.conversationId = String(input.conversationId).slice(0, 80);
  if (input.cliente) s.cliente = String(input.cliente).trim().slice(0, 80);
  if (input.telefono) s.phoneHash = hashStorefrontPhone(input.telefono);
  if (input.pageUrl) s.pageUrl = String(input.pageUrl).slice(0, 300);
  const row = Number(input.adminRow);
  if (Number.isFinite(row) && row >= 2) s.adminRow = row;
  // Never downgrade takeover→live (stale instance memory / cold start must hydrate first).
  if (input.status === "ended") s.status = "ended";
  else if (s.status !== "takeover" && s.status !== "ended") s.status = "live";
  s.lastSeenAt = Date.now();
  memPut(s);

  let notifiedNow = false;
  if (s.status === "live" && !alreadyNotified) {
    // Persist first so claimNotify has a row; keep notified=false until claim wins.
    await persistSession(s);
    const won = getPool() ? await claimNotify(s.id) : true;
    s.notified = true;
    memPut(s);
    if (won) {
      notifiedNow = true;
      const title = `Chat en vivo · ${s.cliente || "tienda"}`;
      await notifyHub({ title, body: s.pageUrl || "bmcuruguay.com.uy", payload: { liveId: s.id, pageUrl: s.pageUrl } });
      await notifyWhatsApp(s);
    }
    await persistSession(s);
  } else {
    await persistSession(s);
  }
  return { ok: true, id: s.id, status: s.status, notified: s.notified, notifiedNow };
}

export async function addLiveTurn({ sessionId, role, text }) {
  const id = String(sessionId || "").trim();
  const t = String(text || "").trim().slice(0, 4000);
  const r = String(role || "assistant").slice(0, 20);
  if (!id || !t) return { ok: false, error: "session + text" };
  if (!["user", "assistant", "agent", "system"].includes(r)) return { ok: false, error: "role" };
  let s = await resolveSession(id, { create: true });
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
  let s = await resolveSession(sid);
  if (!s) return { ok: true, status: "idle", injects: [], handoff: false };

  const dbInjects = await claimInjects(sid);
  const memInjects = s.injects.splice(0, s.injects.length);
  const injects = dbInjects.length ? dbInjects : memInjects;

  let handoff = false;
  const claimed = await claimHandoff(sid);
  if (claimed) {
    handoff = true;
    s.handoffPending = false;
    if (claimed.status) s.status = claimed.status;
  } else if (!getPool()) {
    handoff = Boolean(s.handoffPending);
    if (handoff) s.handoffPending = false;
  } else {
    s.handoffPending = false;
  }
  memPut(s);
  if (handoff && !getPool()) await persistSession(s);
  return { ok: true, id: s.id, status: s.status, injects, handoff };
}

export async function listLiveSessions() {
  const cutoff = Date.now() - LIVE_MAX_AGE_MS;
  const db = getPool();
  if (db) {
    try {
      await ensureSchema(db);
      const { rows } = await db.query(
        `SELECT id, conversation_id, cliente, page_url, admin_row, status,
                extract(epoch from last_seen_at) * 1000 AS last_seen_at,
                extract(epoch from created_at) * 1000 AS created_at
           FROM public.storefront_live_sessions
          WHERE last_seen_at > now() - interval '2 minutes'
          ORDER BY last_seen_at DESC LIMIT 40`,
      );
      if (rows.length) {
        return rows.map((r) => ({
          id: r.id,
          conversationId: r.conversation_id,
          cliente: r.cliente,
          pageUrl: r.page_url,
          adminRow: r.admin_row,
          status: r.status,
          lastSeenAt: Number(r.last_seen_at),
          createdAt: Number(r.created_at),
          live: Number(r.last_seen_at) >= cutoff && r.status !== "ended",
        }));
      }
    } catch { /* memory */ }
  }
  return [...sessions.values()]
    .filter((s) => s.lastSeenAt >= cutoff && s.status !== "ended")
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
    .map(publicSession);
}

export async function getLiveSession(id) {
  const sid = String(id || "").trim();
  const s = await resolveSession(sid);
  if (s) return publicSession(s);
  return null;
}

export async function takeoverLiveSession(id) {
  const sid = String(id || "").trim();
  let s = await resolveSession(sid, { create: true });
  s.status = "takeover";
  s.handoffPending = true;
  s.lastSeenAt = Date.now();
  memPut(s);
  await addLiveTurn({ sessionId: sid, role: "system", text: STOREFRONT_LIVE_HANDOFF });
  await persistSession(s);
  await markHandoffPending(sid);
  return publicSession(s);
}

export async function injectLiveMessage(id, text) {
  const t = String(text || "").trim().slice(0, 2000);
  if (!t) return { ok: false, error: "texto vacío" };
  const sid = String(id || "").trim();
  let s = await resolveSession(sid, { create: true });
  s.injects.push({ text: t, ts: Date.now() });
  s.lastSeenAt = Date.now();
  if (s.status !== "ended") s.status = "takeover";
  memPut(s);
  await persistInject(sid, t);
  await addLiveTurn({ sessionId: sid, role: "agent", text: t });
  await persistSession(s);
  return { ok: true, id: sid };
}

export const __testLive__ = {
  reset() {
    sessions.clear();
    schemaReady = false;
    schemaPromise = null;
  },
  get: memGet,
  setPool(p) {
    _testPool = p;
    schemaReady = false;
    schemaPromise = null;
  },
  resetPool() {
    _testPool = null;
    schemaReady = false;
    schemaPromise = null;
  },
  /** Simulate another Cloud Run instance: drop in-process memory only. */
  clearMemory() {
    sessions.clear();
  },
};
