// ═══════════════════════════════════════════════════════════════════════════
// quoteStore — persistence layer for identity.quotes.
//
// Designed to coexist with the existing in-memory quotationRegistry in
// server/routes/calc.js. When a request has req.user, calc.js can call
// `attachToUser(req, quote)` to upsert the quote into Postgres; anonymous
// requests stay in the in-memory map until the user logs in (Phase F merge).
// ═══════════════════════════════════════════════════════════════════════════

import { getWaPool } from "./waDb.js";
import { config } from "../config.js";

function pool() {
  const p = getWaPool(config.databaseUrl);
  if (!p) throw Object.assign(new Error("db_unavailable"), { status: 503 });
  return p;
}

function pickTotals(payload) {
  if (!payload || typeof payload !== "object") return { totalUsd: null, totalUyu: null };
  const totalUsd =
    Number(payload.totalUsd) ||
    Number(payload.totals?.usd) ||
    Number(payload.summary?.total_usd) ||
    null;
  const totalUyu =
    Number(payload.totalUyu) ||
    Number(payload.totals?.uyu) ||
    Number(payload.summary?.total_uyu) ||
    null;
  return {
    totalUsd: Number.isFinite(totalUsd) && totalUsd > 0 ? totalUsd : null,
    totalUyu: Number.isFinite(totalUyu) && totalUyu > 0 ? totalUyu : null,
  };
}

/**
 * Upsert a quote into identity.quotes for the authenticated user.
 *
 * @param {object} args
 * @param {string} args.userId
 * @param {string} [args.clientQuoteId]   stable id known to the client
 * @param {object} args.payload           full quote payload (jsonb)
 * @param {string} [args.pdfId]
 * @param {string} [args.pdfUrl]
 * @param {string} [args.gcsUri]
 * @param {string} [args.driveFileId]
 * @param {string} [args.status]          'draft'|'completed'|'exported'
 * @param {number} [args.wizardStep]
 */
export async function upsertQuote({
  userId,
  clientQuoteId,
  payload,
  pdfId,
  pdfUrl,
  gcsUri,
  driveFileId,
  status = "draft",
  wizardStep,
}) {
  if (!userId) throw new Error("userId_required");
  const { totalUsd, totalUyu } = pickTotals(payload);

  // If clientQuoteId was provided, dedupe on (user_id, client_quote_id);
  // otherwise insert a new row.
  if (clientQuoteId) {
    const upd = await pool().query(
      `update identity.quotes
          set payload = $3::jsonb,
              total_usd = coalesce($4, total_usd),
              total_uyu = coalesce($5, total_uyu),
              pdf_id = coalesce($6, pdf_id),
              pdf_url = coalesce($7, pdf_url),
              gcs_uri = coalesce($8, gcs_uri),
              drive_file_id = coalesce($9, drive_file_id),
              wizard_step = coalesce($10, wizard_step),
              status = case when status = 'deleted' then status else $11 end
        where user_id = $1 and client_quote_id = $2
        returning quote_id, status, total_usd, total_uyu, created_at, updated_at`,
      [
        userId, clientQuoteId, JSON.stringify(payload || {}),
        totalUsd, totalUyu, pdfId || null, pdfUrl || null,
        gcsUri || null, driveFileId || null, wizardStep ?? null, status,
      ],
    );
    if (upd.rows.length) {
      await _event(upd.rows[0].quote_id, "updated", userId, { status });
      return upd.rows[0];
    }
  }

  const ins = await pool().query(
    `insert into identity.quotes (
        user_id, client_quote_id, payload, total_usd, total_uyu,
        pdf_id, pdf_url, gcs_uri, drive_file_id, wizard_step, status
     ) values ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9, $10, $11)
     returning quote_id, status, total_usd, total_uyu, created_at, updated_at`,
    [
      userId, clientQuoteId || null, JSON.stringify(payload || {}),
      totalUsd, totalUyu, pdfId || null, pdfUrl || null,
      gcsUri || null, driveFileId || null, wizardStep ?? null, status,
    ],
  );
  await _event(ins.rows[0].quote_id, "created", userId, { status });
  return ins.rows[0];
}

/** Claim anonymous quotes (user_id is null) by client_quote_id, after login. */
export async function claimAnonymousQuotes({ userId, clientQuoteIds }) {
  if (!userId) return { claimed: 0 };
  const ids = (clientQuoteIds || []).filter(Boolean);
  if (!ids.length) return { claimed: 0 };
  const { rowCount } = await pool().query(
    `update identity.quotes
        set user_id = $1
      where user_id is null
        and client_quote_id = any($2::text[])`,
    [userId, ids],
  );
  return { claimed: rowCount || 0 };
}

export async function listMyQuotes({ userId, limit = 50, includeDeleted = false }) {
  const sql = includeDeleted
    ? `select quote_id, client_quote_id, total_usd, total_uyu, status, pdf_url,
              wizard_step, created_at, updated_at
         from identity.quotes
        where user_id = $1
        order by created_at desc limit $2`
    : `select quote_id, client_quote_id, total_usd, total_uyu, status, pdf_url,
              wizard_step, created_at, updated_at
         from identity.quotes
        where user_id = $1 and status <> 'deleted'
        order by created_at desc limit $2`;
  const { rows } = await pool().query(sql, [userId, limit]);
  return rows;
}

export async function getMyQuote({ userId, quoteId }) {
  const { rows } = await pool().query(
    `select quote_id, client_quote_id, payload, total_usd, total_uyu, status, pdf_id,
            pdf_url, gcs_uri, drive_file_id, wizard_step, created_at, updated_at
       from identity.quotes
      where quote_id = $1 and user_id = $2`,
    [quoteId, userId],
  );
  return rows[0] || null;
}

export async function softDeleteQuote({ userId, quoteId }) {
  const { rows } = await pool().query(
    `update identity.quotes set status = 'deleted'
      where quote_id = $1 and user_id = $2
      returning quote_id`,
    [quoteId, userId],
  );
  if (rows.length) await _event(rows[0].quote_id, "deleted", userId, {});
  return rows[0] || null;
}

async function _event(quoteId, kind, actorUserId, payload) {
  try {
    await pool().query(
      `insert into identity.quote_events (quote_id, kind, actor_user_id, payload)
       values ($1, $2, $3, $4::jsonb)`,
      [quoteId, kind, actorUserId || null, JSON.stringify(payload || {})],
    );
  } catch {
    /* best-effort */
  }
}
