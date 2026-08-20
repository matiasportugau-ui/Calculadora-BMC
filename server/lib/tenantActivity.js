// Tenant activity: white-label actions (BC, LAM, …). Stamp payload.tenant = slug.
import { logActivity, ACTION_TAXONOMY, CLIENT_EMITTABLE } from "./userActivityLog.js";
import { WHITELABEL } from "../../src/config/whitelabel.js";

export const TENANT_SLUG = WHITELABEL || "bc";

export const TENANT_CLIENT_ACTIONS = [
  "tenant.session.start",
  "tenant.session.end",
  "tenant.session.ping",
  "tenant.nav.route",
  "tenant.ui.click",
  "tenant.wizard.step",
  "tenant.quote.autosave",
  "tenant.quote.open",
  "tenant.quote.export.pdf",
  "tenant.quote.export.html",
];

export const TENANT_SERVER_ACTIONS = [
  "tenant.quote.autosave",
  "tenant.quote.complete",
  "tenant.member.invite",
  "tenant.member.revoke",
  "tenant.invite.claim",
  "tenant.control.pause",
  "tenant.control.resume",
  "tenant.export",
  "tenant.agent.turn",
];

export function registerTenantActivityActions() {
  for (const a of TENANT_CLIENT_ACTIONS) {
    ACTION_TAXONOMY.add(a);
    CLIENT_EMITTABLE.add(a);
  }
  for (const a of TENANT_SERVER_ACTIONS) ACTION_TAXONOMY.add(a);
}

registerTenantActivityActions();

export function isTenantClientAction(action) {
  return TENANT_CLIENT_ACTIONS.includes(action);
}

export async function recordTenantActivity({
  pool, actorId = null, sessionId = null, action, resourceType, resourceId,
  outcome = "success", payload = {}, req, clientEmitted = false,
}) {
  if (!ACTION_TAXONOMY.has(action)) return { ok: false, error: "unknown_action" };
  const stamped = {
    ...(payload && typeof payload === "object" ? payload : {}),
    tenant: (payload && payload.tenant) || TENANT_SLUG,
  };
  await logActivity({
    pool,
    actorId,
    sessionId,
    action,
    module: "tenant",
    resourceType,
    resourceId,
    outcome,
    payload: stamped,
    req,
    clientEmitted,
  });
  return { ok: true };
}

export async function listTenantActivity(pool, { tenantId, slug = TENANT_SLUG, limit = 80 } = {}) {
  const cap = Math.min(Math.max(Number(limit) || 80, 1), 200);
  const { rows } = await pool.query(
    `select l.event_id, l.at, l.action, l.module, l.outcome, l.resource_type, l.resource_id,
            l.client_emitted, l.payload, l.ip,
            u.email as actor_email, u.name as actor_name
       from identity.user_activity_log l
       left join identity.users u on u.user_id = l.actor_user_id
      where coalesce(l.payload->>'tenant', '') = $1
         or (
           $2::uuid is not null
           and l.resource_type = 'quote'
           and l.resource_id in (
             select quote_id::text from identity.quotes
              where tenant_id = $2 and status <> 'deleted'
           )
         )
      order by l.at desc
      limit $3`,
    [slug, tenantId || null, cap],
  );
  return rows;
}
