/**
 * Pure helpers for Page comment registration.
 * Graph version stays at the caller's pin (v21.0). Hide is not a delete.
 */

export function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function authorMatches(from, needle, knownIds = new Set()) {
  const id = from?.id != null && from.id !== "" ? String(from.id) : "";
  if (id && knownIds.has(id)) return true;
  const name = normalizeName(from?.name);
  const n = normalizeName(needle);
  return Boolean(n) && Boolean(name) && name.includes(n);
}

export function knownAuthorIds(rows) {
  const ids = new Set();
  for (const row of rows || []) {
    if (row?.authorId != null && row.authorId !== "") ids.add(String(row.authorId));
  }
  return ids;
}

/**
 * Upsert by commentId. Rows absent from this scan stay, with lastSeenAt unchanged.
 */
export function mergeLedger(previous, scanned, nowIso) {
  const byId = new Map();
  for (const row of previous || []) {
    if (!row?.commentId) continue;
    byId.set(String(row.commentId), { ...row });
  }
  for (const row of scanned || []) {
    if (!row?.commentId) continue;
    const id = String(row.commentId);
    const prev = byId.get(id);
    if (!prev) {
      byId.set(id, {
        ...row,
        commentId: id,
        firstSeenAt: row.firstSeenAt || nowIso,
        lastSeenAt: nowIso,
      });
      continue;
    }
    byId.set(id, {
      ...prev,
      ...row,
      commentId: id,
      firstSeenAt: prev.firstSeenAt || row.firstSeenAt || nowIso,
      lastSeenAt: nowIso,
    });
  }
  return [...byId.values()];
}

export function readLedger(text) {
  const rows = [];
  for (const line of String(text || "").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    rows.push(JSON.parse(trimmed));
  }
  return rows;
}

export function writeLedger(rows) {
  if (!rows?.length) return "";
  return rows.map((row) => JSON.stringify(row)).join("\n") + "\n";
}

export function truncationReport({ scannedCount, totalCount, hasNext }) {
  const total = totalCount == null || totalCount === "" ? null : Number(totalCount);
  const knownTotal = total != null && !Number.isNaN(total);
  const truncated = (knownTotal && scannedCount < total) || Boolean(hasNext);
  return {
    truncated,
    scannedCount,
    totalCount: knownTotal ? total : null,
  };
}

/** POST body/query for hiding a Page comment. Never a DELETE. */
export function hideRequest(commentId) {
  return {
    method: "POST",
    path: `/${commentId}`,
    params: { is_hidden: "true" },
  };
}
