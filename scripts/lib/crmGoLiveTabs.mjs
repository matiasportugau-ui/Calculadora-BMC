/**
 * Header rows and create-if-absent plan for the CRM go-live tabs.
 * Order matches accessible-base-sync.js (periodo, tipo, meta_monto, moneda, notas).
 * No network. A title that already exists is skipped and its row 1 is not rewritten.
 */

export const CRM_GO_LIVE_TABS = [
  {
    title: "Metas_Ventas",
    headers: ["PERIODO", "TIPO", "META_MONTO", "MONEDA", "NOTAS"],
  },
  {
    title: "AUDIT_LOG",
    headers: ["TIMESTAMP", "ACTION", "ROW", "OLD_VALUE", "NEW_VALUE", "REASON", "USER", "SHEET"],
  },
];

/**
 * @param {string[]} existingTitles
 * @param {{title: string, headers: string[]}[]} specs
 * @returns {{ creates: {title: string, headers: string[]}[], skips: string[], headerWrites: {title: string, headers: string[]}[] }}
 */
export function planTabCreates(existingTitles, specs) {
  const present = new Set((existingTitles || []).map((title) => String(title)));
  const creates = [];
  const skips = [];
  for (const spec of specs || []) {
    if (!spec?.title) continue;
    if (present.has(spec.title)) {
      skips.push(spec.title);
      continue;
    }
    const row = { title: spec.title, headers: [...(spec.headers || [])] };
    creates.push(row);
    present.add(spec.title);
  }
  return { creates, skips, headerWrites: creates.map((row) => ({ ...row, headers: [...row.headers] })) };
}
