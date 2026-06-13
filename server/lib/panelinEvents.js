/**
 * Panelin Events — minimal in-process event bus for Fase 6 realtime (SSE).
 *
 * Used to push live updates from FacturaExpress webhook + sync routes
 * (invoice upserts, stock movements) to connected dashboards without polling.
 *
 * Pattern modeled on server/lib/waWebhooks.js (emit + fire-and-forget)
 * but simpler: pure EventEmitter for server-local consumers (the SSE handler).
 *
 * Events (examples):
 *   - 'invoice.upserted'  { external_id, number?, source: 'webhook' | 'sync' }
 *   - 'stock.movement'    { sku, delta, reason, source: 'facturaexpress_webhook' | ... }
 *   - 'product.price.updated' { sku, price, source?: 'panelin' | 'collector' | 'publish' }
 *   - 'product.stock.updated' { sku, delta, reason, source? }
 *   - 'product.published'   { sku, channel: 'shopify' | 'ml', kind: 'price'|'inventory'|'full', reportPath? }
 *
 * Frontend (standalone dashboard.html or future hub) connects via:
 *   new EventSource(`${base}/api/panelin/events`)
 *
 * Review 5ae44e21 robustness: callers must never assume delivery; keep graceful
 * (emit is best-effort, errors swallowed).
 *
 * Used by outbound publish worker (NEXT #1 / PIM Phase 5) for central → channel push on changes.
 */

import { EventEmitter } from 'node:events';

const emitter = new EventEmitter();
emitter.setMaxListeners(100); // many potential SSE clients in theory

/**
 * Emit a panelin domain event. Non-blocking.
 * @param {string} type - e.g. 'invoice.upserted', 'stock.movement'
 * @param {object} payload - serializable data for the event
 */
export function emitPanelinEvent(type, payload = {}) {
  try {
    const enriched = {
      ...payload,
      occurred_at: new Date().toISOString(),
    };
    // Emit two ways for flexibility:
    // 1. generic 'event' with {type, payload}
    // 2. direct on the type name
    setImmediate(() => {
      emitter.emit('event', { type, payload: enriched });
      emitter.emit(type, enriched);
    });
  } catch (e) {
    // Never let emit break the caller (stock movement / invoice path must succeed)
    // (consistent with review graceful handling and wa patterns)
  }
}

/**
 * Subscribe to all panelin events.
 * Returns an unsubscribe function.
 * @param {(type: string, payload: object) => void} handler
 */
export function subscribePanelinEvents(handler) {
  const wrapped = ({ type, payload }) => {
    try { handler(type, payload); } catch {}
  };
  emitter.on('event', wrapped);
  return () => emitter.off('event', wrapped);
}

/**
 * Subscribe to a specific event type.
 */
export function subscribePanelinEventType(type, handler) {
  const wrapped = (payload) => {
    try { handler(payload); } catch {}
  };
  emitter.on(type, wrapped);
  return () => emitter.off(type, wrapped);
}

// For tests / reset if ever needed
export function _resetPanelinEventsForTests() {
  emitter.removeAllListeners();
}

// (no re-exports needed — consumers import directly from this module)
