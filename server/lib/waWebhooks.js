/**
 * WA Cockpit — webhooks salientes con HMAC + retries.
 *
 * Eventos canónicos (ver wa-package/migrations/014_wa_webhooks.sql):
 *   message.in / message.out / quote.created / followup.due / sla.breach /
 *   operator.invited
 *
 * Firma: header `X-WA-Signature: sha256=<hex>` con HMAC del body crudo.
 * Retries: exponencial según retry_policy.delaysMs (default [1s, 5s, 30s]).
 * Dead letter: tras maxAttempts → last_status='dead', failure_count++. Queda
 *   en la tabla pero el worker lo saltea hasta intervención manual.
 */

import crypto from "node:crypto";
import { getFlag } from "./waConfig.js";

let _pool = null;
let _logger = null;

export function initWaWebhooks({ pool, logger = console } = {}) {
  _pool = pool;
  _logger = logger;
}

/**
 * Dispara todos los webhooks suscriptos al evento. Fire-and-forget: no
 * bloquea al caller (await microtask y retorna). Errors no se propagan.
 *
 * @param {string} event — uno de los eventos canónicos
 * @param {object} payload — JSON serializable
 */
export function emitWaWebhook(event, payload) {
  if (!_pool) return;
  try {
    if (!getFlag("webhooks.enabled")) return;
  } catch { /* if not primed, skip */ return; }
  // Setup async sin awaitear
  _dispatch(event, payload).catch((e) =>
    (_logger || console).warn?.({ err: e, event }, "[waWebhooks] dispatch crashed"),
  );
}

async function _dispatch(event, payload) {
  const { rows } = await _pool.query(
    `select id, url, secret, headers, retry_policy
       from wa_webhooks
      where event = $1 and enabled = true and (last_status is null or last_status != 'dead')`,
    [event],
  );
  if (!rows.length) return;

  const body = JSON.stringify({
    event,
    occurred_at: new Date().toISOString(),
    payload,
  });

  await Promise.allSettled(rows.map((wh) => _sendOne(wh, event, body)));
}

async function _sendOne(wh, event, body) {
  const policy = wh.retry_policy || { maxAttempts: 3, delaysMs: [1000, 5000, 30000] };
  const maxAttempts = Math.max(1, Math.min(10, Number(policy.maxAttempts) || 3));
  const delays = Array.isArray(policy.delaysMs) ? policy.delaysMs : [1000, 5000, 30000];

  const sig = "sha256=" + crypto.createHmac("sha256", wh.secret).update(body).digest("hex");
  const baseHeaders = {
    "Content-Type": "application/json",
    "X-WA-Signature": sig,
    "X-WA-Event": event,
    "X-WA-Webhook-Id": wh.id,
    ...(wh.headers || {}),
  };

  let lastStatus = null;
  let lastCode = null;
  let lastError = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 10_000);
      const r = await fetch(wh.url, {
        method: "POST",
        headers: baseHeaders,
        body,
        signal: ctrl.signal,
      });
      clearTimeout(timeout);
      lastCode = r.status;
      if (r.ok) {
        await _pool.query(
          `update wa_webhooks
              set last_status = 'ok',
                  last_status_code = $2,
                  last_attempt_at = now(),
                  last_success_at = now(),
                  last_error = null,
                  failure_count = 0
            where id = $1`,
          [wh.id, lastCode],
        );
        return;
      }
      lastStatus = "http_error";
      lastError = `HTTP ${r.status}`;
    } catch (e) {
      lastStatus = "network_error";
      lastError = String(e?.message || e);
    }

    // Backoff antes del próximo intento (si lo hay).
    if (attempt < maxAttempts - 1) {
      const d = delays[Math.min(attempt, delays.length - 1)] || 5000;
      await new Promise((r) => setTimeout(r, d));
    }
  }

  // Todos los intentos fallaron → dead.
  await _pool.query(
    `update wa_webhooks
        set last_status = $2,
            last_status_code = $3,
            last_error = $4,
            last_attempt_at = now(),
            failure_count = failure_count + 1
      where id = $1`,
    [wh.id, lastStatus === "http_error" ? "http_error" : "dead", lastCode, lastError],
  );
  (_logger || console).warn?.(
    { id: wh.id, url: wh.url, event, attempts: maxAttempts, lastError },
    "[waWebhooks] all attempts failed",
  );
}

/** Para test endpoint /api/wa/webhooks/:id/test */
export async function testWebhook({ id }) {
  if (!_pool) throw new Error("waWebhooks not initialized");
  const { rows } = await _pool.query("select * from wa_webhooks where id=$1", [id]);
  const wh = rows[0];
  if (!wh) {
    const e = new Error("webhook not found");
    e.status = 404;
    throw e;
  }
  const body = JSON.stringify({
    event: "test.ping",
    occurred_at: new Date().toISOString(),
    payload: { ping: "from BMC WA Cockpit", id },
  });
  await _sendOne(wh, "test.ping", body);
  const after = await _pool.query("select last_status, last_status_code, last_error, last_success_at from wa_webhooks where id=$1", [id]);
  return after.rows[0];
}

export function _resetWaWebhooksForTests() {
  _pool = null;
  _logger = null;
}
