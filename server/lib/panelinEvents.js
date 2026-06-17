/**
 * Panelin Events — best-effort EventEmitter for realtime (Fase 6 + Product Central PIM).
 *
 * Events:
 *   - 'stock.movement'    { sku, delta, reason, source?: 'facturaexpress_webhook' | 'manual' | ..., occurred_at }
 *   - 'invoice.upserted'  { invoiceId, items: [...], occurred_at }
 *   - 'product.price.updated' { sku, price, source?: 'panelin' | 'collector' | 'publish', occurred_at }
 *   - 'product.stock.updated' { sku, delta, reason?, source?, occurred_at }
 *   - 'product.published'   { sku, channel: 'shopify' | 'ml' | 'caucadi', kind: 'price'|'inventory'|'full', reportPath?, occurred_at }
 *   - 'event' (generic envelope for SSE)
 *
 * Subscribe helpers return an unsubscribe function.
 * All handlers are wrapped; errors are logged but never throw to callers (best-effort).
 *
 * Used by:
 *   - webhooks / sync routes (emit after DB writes)
 *   - publish worker (subscribe + act)
 *   - SSE endpoint /api/panelin/events (fanout)
 *   - HubPanel + standalone dashboard (EventSource consumers)
 */

import { EventEmitter } from 'node:events';

const bus = new EventEmitter();

// Increase if many listeners (SSE + worker + future).
bus.setMaxListeners(50);

function nowIso() {
  return new Date().toISOString();
}

/**
 * Emit a panelin event (enriched with occurred_at if missing).
 * Also emits a generic 'event' envelope { type, payload, occurred_at } for SSE convenience.
 * Uses setImmediate to avoid blocking the caller.
 */
export function emitPanelinEvent(type, payload = {}) {
  const occurred_at = payload.occurred_at || nowIso();
  const enriched = { ...payload, occurred_at };

  // Specific typed event
  setImmediate(() => {
    try {
      bus.emit(type, enriched);
    } catch (e) {
      // best-effort only
      console.warn('[panelinEvents] emit error for', type, e?.message || e);
    }
  });

  // Generic envelope (used by SSE / generic listeners)
  setImmediate(() => {
    try {
      bus.emit('event', { type, payload: enriched, occurred_at });
    } catch (e) {
      console.warn('[panelinEvents] generic emit error', e?.message || e);
    }
  });
}

/**
 * Subscribe to all panelin events.
 * handler receives (payload) for typed, or the envelope for 'event'.
 */
export function subscribePanelinEvents(handler) {
  const wrapped = (data) => {
    try {
      handler(data);
    } catch (e) {
      // best-effort, never break emitters
      console.warn('[panelinEvents] handler error (all events)', e?.message || e);
    }
  };
  bus.on('event', wrapped);
  // Also listen to common typed ones explicitly so handler gets raw enriched payload
  const typed = ['stock.movement', 'invoice.upserted', 'product.price.updated', 'product.stock.updated', 'product.published'];
  typed.forEach((t) => bus.on(t, wrapped));

  return () => {
    bus.removeListener('event', wrapped);
    typed.forEach((t) => bus.removeListener(t, wrapped));
  };
}

/**
 * Subscribe only to a specific event type.
 * handler receives the enriched payload.
 */
export function subscribePanelinEventType(type, handler) {
  const wrapped = (data) => {
    try {
      handler(data);
    } catch (e) {
      console.warn('[panelinEvents] handler error for', type, e?.message || e);
    }
  };
  bus.on(type, wrapped);
  // Also forward from generic if someone emits only the envelope
  const generic = (env) => {
    if (env && env.type === type) {
      try { handler(env.payload || env); } catch (e) { /* best-effort */ }
    }
  };
  bus.on('event', generic);

  return () => {
    bus.removeListener(type, wrapped);
    bus.removeListener('event', generic);
  };
}

// For tests / reset in same process (rarely needed).
export function _reset() {
  bus.removeAllListeners();
}

export default {
  emitPanelinEvent,
  subscribePanelinEvents,
  subscribePanelinEventType,
  _reset,
};
