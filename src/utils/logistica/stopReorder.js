/**
 * Stop list reorder (Ops UX F3a) — pure, immutable.
 */

/**
 * Reorder stops by moving activeId onto overId (insert before over).
 * Reassigns orden 1..n and optional palette colors.
 *
 * @param {object[]} stops
 * @param {string} activeId
 * @param {string} overId
 * @param {{ colors?: string[] }} [opts]
 * @returns {object[]}
 */
export function reorderStops(stops = [], activeId, overId, opts = {}) {
  const list = Array.isArray(stops) ? [...stops] : [];
  if (!activeId || !overId || activeId === overId) return renumberStops(list, opts);

  const from = list.findIndex((s) => s && s.id === activeId);
  const to = list.findIndex((s) => s && s.id === overId);
  if (from < 0 || to < 0) return renumberStops(list, opts);

  const [item] = list.splice(from, 1);
  // After removing `from`, indices after it shift left by 1. Without this
  // adjustment, dragging a stop downward "insert before over" lands one slot
  // too late (e.g. P1 onto P3 → [P2,P3,P1] instead of [P2,P1,P3]).
  const insertAt = from < to ? to - 1 : to;
  list.splice(insertAt, 0, item);
  return renumberStops(list, opts);
}

/**
 * @param {object[]} stops
 * @param {{ colors?: string[] }} [opts]
 * @returns {object[]}
 */
export function renumberStops(stops = [], opts = {}) {
  const colors = Array.isArray(opts.colors) && opts.colors.length ? opts.colors : null;
  return (Array.isArray(stops) ? stops : []).map((s, i) => ({
    ...s,
    orden: i + 1,
    ...(colors ? { color: colors[i % colors.length] } : {}),
  }));
}

/**
 * Default collapsed ids when many stops (keep first expanded).
 * @param {object[]} stops
 * @param {number} [threshold=3]
 * @returns {string[]}
 */
export function defaultCollapsedStopIds(stops = [], threshold = 3) {
  const list = Array.isArray(stops) ? stops : [];
  if (list.length <= threshold) return [];
  return list.slice(1).map((s) => s.id).filter(Boolean);
}

/**
 * Toggle id in collapsed list.
 * @param {string[]} collapsedIds
 * @param {string} stopId
 * @returns {string[]}
 */
export function toggleCollapsedStopId(collapsedIds = [], stopId) {
  if (!stopId) return Array.isArray(collapsedIds) ? [...collapsedIds] : [];
  const set = new Set(Array.isArray(collapsedIds) ? collapsedIds : []);
  if (set.has(stopId)) set.delete(stopId);
  else set.add(stopId);
  return [...set];
}
