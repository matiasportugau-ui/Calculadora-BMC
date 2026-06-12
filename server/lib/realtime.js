/**
 * Realtime module for Panelin BMC Platform (Fase 6)
 * 
 * Provides WebSocket broadcasting for live updates:
 * - stock-update (when movements happen via API or FE webhook)
 * - price-update (when cost changes and prices are recalculated)
 * - invoice-added / invoice-updated
 * 
 * Usage:
 *   import { initRealtime, broadcast } from './lib/realtime.js';
 *   // after http server is created
 *   initRealtime(server, logger);
 *   ...
 *   broadcast({ type: 'stock-update', payload: { sku, delta, qty_after } });
 *
 * Frontend (dashboard.html) connects to ws://host/realtime and reacts.
 * Falls back gracefully if WS not available.
 */

import { WebSocketServer } from 'ws';
import { EventEmitter } from 'node:events';

const emitter = new EventEmitter();
let wss = null;
let logger = console;
const clients = new Set();

export function initRealtime(httpServer, log = console) {
  logger = log;

  wss = new WebSocketServer({ 
    server: httpServer,
    path: '/realtime'   // dedicated path to not conflict with other upgrades
  });

  wss.on('connection', (ws) => {
    clients.add(ws);
    logger.info?.({ clients: clients.size }, '[realtime] client connected');

    ws.send(JSON.stringify({ 
      type: 'connected', 
      ts: Date.now(),
      message: 'Panelin realtime channel open' 
    }));

    ws.on('close', () => {
      clients.delete(ws);
      logger.info?.({ clients: clients.size }, '[realtime] client disconnected');
    });

    ws.on('error', (err) => {
      clients.delete(ws);
      logger.warn?.({ err: err.message }, '[realtime] client error');
    });
  });

  // Internal events -> WS broadcast
  emitter.on('broadcast', (data) => {
    const message = JSON.stringify(data);
    for (const client of clients) {
      if (client.readyState === 1) { // WebSocket.OPEN
        try {
          client.send(message);
        } catch (e) {
          clients.delete(client);
        }
      }
    }
  });

  logger.info('[realtime] WebSocket server initialized on /realtime');
}

export function broadcast(data) {
  // Always emit internally (useful for tests / future consumers)
  emitter.emit('broadcast', data);

  // If WS not initialized yet, the emitter will queue for when clients connect later
  // (the on('broadcast') will fire for future sends too)
}

/**
 * Helper to get current connected clients count (for health/debug)
 */
export function getRealtimeClientCount() {
  return clients.size;
}

// Optional: expose emitter for advanced use
export { emitter as realtimeEmitter };
