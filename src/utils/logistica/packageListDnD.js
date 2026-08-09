/**
 * BMC Envíos F10b — package list reorder (pure).
 */

/**
 * Move activeKey to overKey's current index (HTML5/dnd list semantics).
 * @param {string[]} keys
 * @param {string} activeKey
 * @param {string} overKey
 * @returns {string[]}
 */
export function reorderManualKeys(keys = [], activeKey, overKey) {
  if (!activeKey) return Array.isArray(keys) ? [...keys] : [];
  const list = (Array.isArray(keys) ? keys : []).filter(Boolean);
  if (!list.includes(activeKey)) list.push(activeKey);
  if (!overKey || activeKey === overKey) return list;
  if (!list.includes(overKey)) {
    return list.filter((k) => k !== activeKey).concat([activeKey]);
  }
  const from = list.indexOf(activeKey);
  const to = list.indexOf(overKey);
  if (from < 0 || to < 0) return list;
  list.splice(from, 1);
  list.splice(to, 0, activeKey);
  return list;
}

/**
 * Move key by delta index (-1 up / +1 down in list).
 * @param {string[]} keys
 * @param {string} activeKey
 * @param {number} delta
 */
export function moveManualKeyBy(keys = [], activeKey, delta) {
  const list = Array.isArray(keys) ? [...keys] : [];
  const i = list.indexOf(activeKey);
  if (i < 0) return list;
  const j = Math.max(0, Math.min(list.length - 1, i + Number(delta || 0)));
  if (j === i) return list;
  list.splice(i, 1);
  list.splice(j, 0, activeKey);
  return list;
}

/**
 * Build list rows for UI from placed packages + counts map.
 * @param {object[]} placed
 * @param {Map|null} counts from packageBultoCounts
 * @param {string[]} manualKeys
 */
export function buildPackageListRows(placed = [], counts = null, manualKeys = []) {
  const byKey = new Map((placed || []).filter((p) => p?.stableKey).map((p) => [p.stableKey, p]));
  const order =
    Array.isArray(manualKeys) && manualKeys.length
      ? [
          ...manualKeys.filter((k) => byKey.has(k)),
          ...[...byKey.keys()].filter((k) => !manualKeys.includes(k)),
        ]
      : [...byKey.keys()];
  return order.map((key, index) => {
    const pkg = byKey.get(key);
    const c = counts?.get?.(key);
    return {
      stableKey: key,
      index: index + 1,
      listIndex: index,
      pkg,
      bultoIndex: c?.index ?? null,
      bultoTotal: c?.total ?? null,
      row: pkg?.row,
      sCli: pkg?.sCli || "",
      sPed: pkg?.sPed || "",
    };
  });
}
