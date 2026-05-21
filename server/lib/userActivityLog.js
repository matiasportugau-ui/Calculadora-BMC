// ═══════════════════════════════════════════════════════════════════════════
// server/lib/userActivityLog.js — unified user activity log helper.
// ───────────────────────────────────────────────────────────────────────────
// Writes to identity.user_activity_log. Single helper used by:
//   - server-side route handlers (business, auth, admin events) — set req param
//     for ip/ua extraction
//   - POST /api/me/activity (client-emitted intent events) — sets
//     client_emitted=true; validates against CLIENT_EMITTABLE subset
//
// Per-user isolation enforced via WHERE actor_user_id = req.user.id in the
// reader endpoint (GET /api/me/activity). RLS on the table is defense-in-depth;
// the BMC backend connects with a privileged Postgres role that bypasses it.
//
// NEVER throws — audit-log failures must not block the user action. Surfaces
// errors via console.warn so they appear in Cloud Logging.
// ═══════════════════════════════════════════════════════════════════════════

// ─── Action taxonomy ──────────────────────────────────────────────────────
// Flat dotted strings. Server-side enum. Adding a new action requires a code
// change here AND a downstream consumer (Historial display label, analytics
// pivot). Do NOT runtime-configure this set.

export const ACTION_TAXONOMY = new Set([
  // auth.* (mirror identity.audit_log entries)
  "auth.session.start",
  "auth.session.end",
  "auth.refresh",
  "auth.mfa_required",
  "auth.token_reuse_detected",

  // admin.* (mirror identityAdmin.js audit() calls)
  "admin.role_grant.add",
  "admin.role_grant.remove",
  "admin.module_grant.set",
  "admin.user.suspend",
  "admin.user.reactivate",
  "admin.user.revoke_sessions",

  // quote.* (calc)
  "quote.draft.create",
  "quote.draft.update",
  "quote.complete",
  "quote.export.pdf",
  "quote.export.csv",
  "quote.send.whatsapp",

  // wa / ml / canales
  "wa.message.send",
  "ml.respuesta.approve",
  "canales.export",

  // tareas
  "tareas.connect.start",
  "tareas.connect.complete",
  "tareas.list.sync",
  "tareas.task.create",

  // messages
  "message.thread.create",
  "message.reply",
  "message.read",

  // traktime
  "traktime.timer.start",
  "traktime.timer.stop",
  "traktime.invoice.draft",
  "traktime.invoice.issue",

  // client-emitted intent (validated against CLIENT_EMITTABLE below)
  "nav.route.change",
  "ui.drawer.open",
  "ui.search.submit",
]);

// Actions that POST /api/me/activity is allowed to claim. Server-emitted actions
// (quote.*, admin.*, etc.) must never come from the client because the client
// has no authority to assert "this admin action happened" — only the server
// route handler does.
export const CLIENT_EMITTABLE = new Set([
  "nav.route.change",
  "ui.drawer.open",
  "ui.search.submit",
]);

// Derive module from action prefix for quick fill-in if caller didn't supply it.
const MODULE_PREFIX_MAP = {
  "auth.": "auth",
  "admin.": "admin",
  "quote.": "calc",
  "wa.": "wa",
  "ml.": "ml",
  "canales.": "canales",
  "tareas.": "tareas",
  "message.": "me",
  "traktime.": "traktime",
  "nav.": "nav",
  "ui.": "ui",
};

function deriveModule(action) {
  for (const [prefix, mod] of Object.entries(MODULE_PREFIX_MAP)) {
    if (action.startsWith(prefix)) return mod;
  }
  return null;
}

// PII / payload-size scrub. Never log raw tokens, full message bodies, or
// quote totals. Clamp string fields at 200 chars.
const BLOCKED_KEYS = new Set([
  "access_token",
  "refresh_token",
  "password",
  "secret",
  "authorization",
  "cookie",
  "body",           // message body content
  "content",
  "phone",          // PII; OK to log resource_id (the message_id), not the phone string
]);

export function scrubPayload(p) {
  if (!p || typeof p !== "object") return {};
  const out = {};
  for (const [k, v] of Object.entries(p)) {
    if (BLOCKED_KEYS.has(k.toLowerCase())) continue;
    if (typeof v === "string" && v.length > 200) out[k] = v.slice(0, 200) + "…";
    else if (typeof v === "object" && v !== null) {
      // shallow recursion only — deeply nested payloads are rare and a sign
      // of misuse; stringify-clamp them as a safety net
      try {
        const s = JSON.stringify(v);
        out[k] = s.length > 200 ? s.slice(0, 200) + "…" : v;
      } catch {
        out[k] = "[unserializable]";
      }
    } else {
      out[k] = v;
    }
  }
  return out;
}

const VALID_OUTCOMES = new Set(["success", "failure", "pending", "orphan"]);

// ─── Main write helper ────────────────────────────────────────────────────
/**
 * Insert a row into identity.user_activity_log. Never throws.
 *
 * @param {object} args
 * @param {import("pg").Pool} args.pool        - PG pool from getWaPool()
 * @param {string|null} args.actorId           - identity.users.user_id of the actor
 * @param {string|null} [args.sessionId]       - identity.sessions.session_id if known
 * @param {string} args.action                 - must be in ACTION_TAXONOMY
 * @param {string} [args.module]               - derived from action if omitted
 * @param {string} [args.resourceType]
 * @param {string} [args.resourceId]
 * @param {string} [args.outcome]              - 'success'|'failure'|'pending'|'orphan'
 * @param {number} [args.durationMs]
 * @param {boolean} [args.clientEmitted]
 * @param {object} [args.payload]
 * @param {object} [args.req]                  - Express req for ip / user-agent extraction
 */
export async function logActivity({
  pool, actorId, sessionId,
  action, module: explicitModule, resourceType, resourceId,
  outcome = "success", durationMs,
  clientEmitted = false, payload = {}, req,
}) {
  if (!pool) return;
  if (!ACTION_TAXONOMY.has(action)) {
    // Never throw — block the user nothing. Just shout into the logs.
    console.warn(`[activity-log] unknown action rejected: ${action}`);
    return;
  }
  if (!VALID_OUTCOMES.has(outcome)) {
    console.warn(`[activity-log] invalid outcome ${outcome}; coercing to 'success'`);
    outcome = "success";
  }
  const module = explicitModule || deriveModule(action);
  const ip = req?.ip || null;
  const userAgent = req?.get?.("user-agent") || null;
  const safePayload = scrubPayload(payload);
  try {
    await pool.query(
      `INSERT INTO identity.user_activity_log (
         actor_user_id, session_id, action, module, resource_type, resource_id,
         outcome, duration_ms, ip, user_agent, client_emitted, payload
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)`,
      [
        actorId, sessionId || null, action, module, resourceType || null,
        resourceId || null, outcome, durationMs || null, ip, userAgent,
        !!clientEmitted, JSON.stringify(safePayload),
      ],
    );
  } catch (err) {
    console.warn("[activity-log] insert failed:", err?.message);
  }
}
