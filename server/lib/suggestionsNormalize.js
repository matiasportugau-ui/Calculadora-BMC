/** Quick-reply chips payload (SUGGEST_JSON) — caps keep SSE payloads small and UI readable */

export const SUGGEST_MAX_GROUPS = 4;
export const SUGGEST_MAX_ITEMS_TOTAL = 12;
export const SUGGEST_MAX_ITEMS_PER_GROUP = 8;
export const SUGGEST_MAX_LABEL_LEN = 120;
export const SUGGEST_MAX_SEND_LEN = 800;
export const SUGGEST_MAX_TITLE_LEN = 80;

/**
 * @param {unknown} raw
 * @returns {{ groups: { title?: string, items: { label: string, send: string }[] }[] } | null}
 */
export function normalizeSuggestionsPayload(raw) {
  if (!raw || typeof raw !== "object") return null;

  /** @type {{ title?: string, items: { label: string, send: string }[] }[]} */
  const groups = [];
  let budget = SUGGEST_MAX_ITEMS_TOTAL;

  const pushItems = (title, itemsIn) => {
    if (!Array.isArray(itemsIn) || budget <= 0) return;
    /** @type {{ label: string, send: string }[]} */
    const items = [];
    for (const it of itemsIn) {
      if (budget <= 0) break;
      if (!it || typeof it !== "object") continue;
      const label = String(it.label ?? "").trim().slice(0, SUGGEST_MAX_LABEL_LEN);
      if (!label) continue;
      const sendRaw = it.send != null && String(it.send).trim() !== "" ? String(it.send).trim() : label;
      const send = sendRaw.slice(0, SUGGEST_MAX_SEND_LEN);
      items.push({ label, send: send || label });
      budget -= 1;
      if (items.length >= SUGGEST_MAX_ITEMS_PER_GROUP) break;
    }
    if (!items.length) return;
    const g = { items };
    if (typeof title === "string" && title.trim()) {
      g.title = title.trim().slice(0, SUGGEST_MAX_TITLE_LEN);
    }
    groups.push(g);
  };

  if (Array.isArray(raw.groups) && raw.groups.length > 0) {
    for (const g of raw.groups.slice(0, SUGGEST_MAX_GROUPS)) {
      if (budget <= 0) break;
      const title = g && typeof g === "object" && typeof g.title === "string" ? g.title : "";
      pushItems(title, g?.items);
    }
  } else if (Array.isArray(raw.items)) {
    pushItems("", raw.items);
  }

  return groups.length ? { groups } : null;
}
