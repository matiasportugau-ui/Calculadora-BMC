/**
 * In-process event bus for omni domain events (ADR-003 phase 1).
 */
const subscribers = new Map();

/**
 * @param {string} eventType
 * @param {(payload: object) => Promise<void>|void} handler
 */
export function subscribe(eventType, handler) {
  if (!subscribers.has(eventType)) subscribers.set(eventType, new Set());
  subscribers.get(eventType).add(handler);
  return () => subscribers.get(eventType)?.delete(handler);
}

/**
 * @param {string} eventType
 * @param {object} payload
 */
export async function emit(eventType, payload) {
  const handlers = subscribers.get(eventType);
  if (!handlers?.size) return;
  for (const fn of handlers) {
    try {
      await fn(payload);
    } catch (e) {
      payload.logger?.warn?.({ err: e?.message, eventType }, "omni event handler failed");
    }
  }
}

export function resetSubscribersForTests() {
  subscribers.clear();
}
