/**
 * BMC Envíos F8 — package visual identity (pure).
 * Format: k/N · #pedido · Cliente (compact / tiny for SVG).
 */

/**
 * Group key for client highlight (F9). Prefer stop id, else sCli|sPed.
 * @param {object} pkg
 * @returns {string}
 */
export function packageGroupKey(pkg) {
  if (!pkg) return "";
  if (pkg.sId != null && String(pkg.sId).trim()) return `stop:${pkg.sId}`;
  const cli = String(pkg.sCli || "").trim().toLowerCase();
  const ped = String(pkg.sPed || "").trim().toLowerCase();
  if (cli || ped) return `cli:${cli}|${ped}`;
  return pkg.stableKey ? `key:${pkg.stableKey}` : pkg.id ? `id:${pkg.id}` : "";
}

/**
 * Count packages per stop/group and assign 1-based index.
 * @param {object[]} placed
 * @returns {Map<string, { index: number, total: number, groupKey: string, stopId: string|null }>}
 */
export function packageBultoCounts(placed = []) {
  const list = Array.isArray(placed) ? placed.filter(Boolean) : [];
  /** @type {Map<string, object[]>} */
  const byGroup = new Map();

  for (const pkg of list) {
    const gk = packageGroupKey(pkg) || `key:${pkg.stableKey || pkg.id}`;
    if (!byGroup.has(gk)) byGroup.set(gk, []);
    byGroup.get(gk).push(pkg);
  }

  // Stable order within group: zBase, xStart, stableKey
  for (const arr of byGroup.values()) {
    arr.sort((a, b) => {
      const za = Number(a.zBase) || 0;
      const zb = Number(b.zBase) || 0;
      if (za !== zb) return za - zb;
      const xa = Number(a.xStart) || 0;
      const xb = Number(b.xStart) || 0;
      if (xa !== xb) return xa - xb;
      return String(a.stableKey || a.id || "").localeCompare(String(b.stableKey || b.id || ""));
    });
  }

  /** @type {Map<string, { index: number, total: number, groupKey: string, stopId: string|null }>} */
  const out = new Map();
  for (const [gk, arr] of byGroup) {
    const total = arr.length;
    arr.forEach((pkg, i) => {
      const key = pkg.stableKey || pkg.id;
      if (!key) return;
      out.set(key, {
        index: i + 1,
        total,
        groupKey: gk,
        stopId: pkg.sId != null ? pkg.sId : null,
      });
    });
  }
  return out;
}

function truncate(s, n) {
  const t = String(s || "").trim();
  if (t.length <= n) return t;
  return `${t.slice(0, Math.max(1, n - 1))}…`;
}

/**
 * @param {object} pkg
 * @param {Map<string, { index: number, total: number }>|null} [counts]
 * @returns {string} e.g. "2/5 · #BMC-123 · Acme"
 */
export function packageLabelCompact(pkg, counts = null) {
  if (!pkg) return "";
  const key = pkg.stableKey || pkg.id;
  const c = counts && key ? counts.get(key) : null;
  const kn = c ? `${c.index}/${c.total}` : null;
  const ped = String(pkg.sPed || "").trim();
  const cli = String(pkg.sCli || "").trim();
  const pedPart = ped ? `#${truncate(ped, 16)}` : "";
  const cliPart = cli ? truncate(cli, 18) : "";
  const parts = [kn, pedPart, cliPart].filter(Boolean);
  if (parts.length) return parts.join(" · ");
  if (pkg.kind === "accessory") return `P${pkg.sOrd ?? "?"}·ACC`;
  return `P${pkg.sOrd ?? "?"}·${pkg.n ?? pkg.tipo ?? "pkg"}`;
}

/**
 * Shorter for dense SVG labels.
 * @param {object} pkg
 * @param {Map|null} [counts]
 * @param {number} [maxLen]
 */
export function packageLabelTiny(pkg, counts = null, maxLen = 24) {
  const full = packageLabelCompact(pkg, counts);
  if (full.length <= maxLen) return full;
  const key = pkg.stableKey || pkg.id;
  const c = counts && key ? counts.get(key) : null;
  const kn = c ? `${c.index}/${c.total}` : "";
  const cli = truncate(pkg.sCli, 10);
  const tiny = [kn, cli].filter(Boolean).join(" · ");
  return truncate(tiny || full, maxLen);
}

/**
 * Keys of all packages in the same client/stop group.
 * @param {object[]} placed
 * @param {object|null} seedPkg
 * @returns {Set<string>}
 */
export function highlightKeysForPackage(placed, seedPkg) {
  const set = new Set();
  if (!seedPkg) return set;
  const gk = packageGroupKey(seedPkg);
  if (!gk) {
    if (seedPkg.stableKey) set.add(seedPkg.stableKey);
    return set;
  }
  for (const p of placed || []) {
    if (packageGroupKey(p) === gk && p.stableKey) set.add(p.stableKey);
  }
  return set;
}
