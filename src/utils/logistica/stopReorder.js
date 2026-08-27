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
  // After removal, indices > from shift left by 1. Insert *before* overId:
  // when dragging down (from < to), over's new index is to - 1.
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
 * Reorder stops to match `orderedIds` (unknown/missing ids stay at the end).
 * Ids are string-coerced so number/string stop ids from plans still match.
 * @param {object[]} stops
 * @param {Array<string|number>} orderedIds
 * @param {{ colors?: string[] }} [opts]
 */
export function orderStopsByIds(stops = [], orderedIds = [], opts = {}) {
  const list = Array.isArray(stops) ? [...stops] : [];
  const ids = Array.isArray(orderedIds) ? orderedIds.map((id) => String(id)) : [];
  if (!ids.length) return renumberStops(list, opts);

  const byId = new Map();
  for (const s of list) {
    const id = s?.id != null ? String(s.id) : "";
    if (id && !byId.has(id)) byId.set(id, s);
  }

  const ordered = [];
  const seen = new Set();
  for (const id of ids) {
    if (seen.has(id)) continue;
    const s = byId.get(id);
    if (!s) continue;
    ordered.push(s);
    seen.add(id);
  }
  for (const s of list) {
    const id = s?.id != null ? String(s.id) : "";
    if (!id || seen.has(id)) continue;
    ordered.push(s);
    seen.add(id);
  }
  return renumberStops(ordered, opts);
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
