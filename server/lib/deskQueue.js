// ═══════════════════════════════════════════════════════════════════════════
// deskQueue — Mesa de revisión (Hito 1 · D1/D6/D10/D11)
//
// Postgres es fuente de verdad. Sheets = espejo. Desk nunca toca Sheets:
// lee/escribe vía API calculadora-bmc que usa este módulo.
//
// Tablas: matriz_snapshots + desk_reviews (ver migrations/desk/001_desk.sql).
// Pool inyectable para tests (mismo patrón que quoteStore.__test__).
// ═══════════════════════════════════════════════════════════════════════════
import { getOmniPool } from "./omni/omniDb.js";
import { config } from "../config.js";

let _testPool = null;
function pool() {
  if (_testPool) return _testPool;
  const p = getOmniPool(config.databaseUrl);
  if (!p) throw Object.assign(new Error("db_unavailable"), { status: 503 });
  return p;
}

export const __test__ = {
  setPool(p) { _testPool = p; },
  reset() { _testPool = null; },
};

const VALID_STATUS = new Set(["pending", "approved", "sent", "sold", "discarded"]);
// markStatus targets → allowed source statuses. pending/approved are reached only via
// saveEditCause / approveSend; sold and discarded are final.
const STATUS_FROM = {
  sent: ["approved"],
  sold: ["approved", "sent"],
  discarded: ["pending", "approved", "sent"],
};
const EDITABLE_STATUS = ["pending", "approved"];
const CAUSE_KEYS = new Set(["causa", "detalle", "at"]);

async function notFoundOrConflict(p, id, conflictError) {
  const { rows } = await p.query("select status from desk_reviews where id = $1", [id]);
  if (!rows.length) return Object.assign(new Error("review_not_found"), { status: 404 });
  return Object.assign(new Error(conflictError), { status: 409, detail: { current: rows[0].status } });
}

// D10 — causa en 1 clic al editar. Catálogo cerrado, extensible sin migrar.
export const EDIT_CAUSES = [
  "precio",
  "cantidad",
  "medidas",
  "familia",
  "flete",
  "cliente_pide",
  "error_ia",
  "otro",
];

/** Normaliza causa de edición a { causa, detalle, at }. Nunca tira. */
export function normalizeEditCause(input) {
  const causa = EDIT_CAUSES.includes(input?.causa) ? input.causa : "otro";
  const detalle = String(input?.detalle || "").slice(0, 500);
  return { causa, detalle, at: new Date().toISOString() };
}

/** wa.me link server-side (solo helper puro, no envía nada — HITL). */
export function buildWaLink(phoneE164, text) {
  const digits = String(phoneE164 || "").replace(/\D/g, "");
  if (digits.length < 8) throw Object.assign(new Error("invalid_phone"), { status: 400 });
  return `https://wa.me/${digits}?text=${encodeURIComponent(String(text || ""))}`;
}

/** Cola pendiente: drafts + aprobados no enviados, más nuevos primero. */
export async function listQueue({ limit = 50 } = {}, poolOverride) {
  const p = poolOverride || pool();
  const { rows } = await p.query(
    `select id, quote_id, conversation_id, contact_id, channel,
            matriz_version, payload, interp, faltantes, causa, status,
            wa_link, created_at, updated_at
       from desk_reviews
      where status in ('pending', 'approved')
      order by updated_at desc
      limit $1`,
    [Math.min(Number(limit) || 50, 200)],
  );
  return rows;
}

export async function getReview({ id }, poolOverride) {
  if (!id) throw Object.assign(new Error("id_required"), { status: 400 });
  const p = poolOverride || pool();
  const { rows } = await p.query(
    `select id, quote_id, conversation_id, contact_id, channel,
            matriz_version, payload, interp, faltantes, causa, status,
            wa_link, created_at, updated_at
       from desk_reviews where id = $1`,
    [id],
  );
  return rows[0] || null;
}

/** Crea borrador de revisión (Omni/Postgres → Desk). Bloquea sin snapshot. D6. */
export async function createReview({
  quoteId = null,
  conversationId = null,
  contactId = null,
  channel = "wa",
  matrizVersion,
  payload = {},
  interp = {},
  faltantes = [],
  createdBy = null,
}, poolOverride) {
  if (!matrizVersion) {
    throw Object.assign(new Error("matriz_snapshot_required"), {
      status: 409,
      detail: "Sin snapshot MATRIZ versionado no hay borrador (D6).",
    });
  }
  const p = poolOverride || pool();
  const { rows } = await p.query(
    `insert into desk_reviews
       (quote_id, conversation_id, contact_id, channel, matriz_version,
        payload, interp, faltantes, causa, status, created_by)
     values ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,'{}'::jsonb,'pending',$9)
     returning id, status, created_at, updated_at`,
    [
      quoteId, conversationId, contactId, channel, matrizVersion,
      JSON.stringify(payload || {}), JSON.stringify(interp || {}),
      JSON.stringify(faltantes || []), createdBy,
    ],
  );
  return rows[0];
}

/** D10 — guarda causa (merge: conserva datos de venta D14) + patch de payload, vuelve a pending. */
export async function saveEditCause({ id, causa, detalle, payloadPatch = null }, poolOverride) {
  if (!id) throw Object.assign(new Error("id_required"), { status: 400 });
  const cause = normalizeEditCause({ causa, detalle });
  const p = poolOverride || pool();
  const { rows } = await p.query(
    `update desk_reviews
        set causa = causa || $2::jsonb,
            payload = case when $3::jsonb is null then payload else payload || $3::jsonb end,
            status = 'pending',
            updated_at = now()
      where id = $1 and status = any($4::text[])
      returning id, causa, status, updated_at`,
    [id, JSON.stringify(cause), payloadPatch ? JSON.stringify(payloadPatch) : null, EDITABLE_STATUS],
  );
  if (!rows.length) throw await notFoundOrConflict(p, id, "review_not_editable");
  return rows[0];
}

/**
 * Aprueba y genera wa.me (1 clic). NO envía WA — el operador abre el link.
 * D13: descuentos nunca automáticos (no se aplica descuento aquí).
 */
export async function approveSend({ id, phoneE164, text }, poolOverride) {
  if (!id) throw Object.assign(new Error("id_required"), { status: 400 });
  const link = buildWaLink(phoneE164, text);
  const p = poolOverride || pool();
  const { rows } = await p.query(
    `update desk_reviews
        set status = 'approved', wa_link = $2, updated_at = now()
      where id = $1 and status in ('pending', 'approved')
      returning id, status, wa_link, updated_at`,
    [id, link],
  );
  if (!rows.length) throw Object.assign(new Error("review_not_found_or_final"), { status: 404 });
  return rows[0];
}

/** Marca enviado/vendido/descartado (D14: vendido guarda monto/fecha/factura en causa). */
export async function markStatus({ id, status, extra = {} }, poolOverride) {
  if (!id) throw Object.assign(new Error("id_required"), { status: 400 });
  if (!VALID_STATUS.has(status)) throw Object.assign(new Error("invalid_status"), { status: 400 });
  const from = STATUS_FROM[status];
  if (!from) throw Object.assign(new Error("status_not_settable"), { status: 400 });
  const safeExtra = Object.fromEntries(
    Object.entries(extra && typeof extra === "object" ? extra : {}).filter(([k]) => !CAUSE_KEYS.has(k)),
  );
  const p = poolOverride || pool();
  const { rows } = await p.query(
    `update desk_reviews
        set status = $2,
            causa = causa || $3::jsonb,
            updated_at = now()
      where id = $1 and status = any($4::text[])
      returning id, status, updated_at`,
    [id, status, JSON.stringify(safeExtra), from],
  );
  if (!rows.length) throw await notFoundOrConflict(p, id, "invalid_transition");
  return rows[0];
}
