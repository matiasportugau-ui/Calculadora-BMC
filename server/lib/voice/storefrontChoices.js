/**
 * Clickable reply chips for Panelin Front.
 * Widget duplicates the small parser (no bundler); keep both in sync.
 */

export function normalizeChoiceOptions(raw) {
  const arr = Array.isArray(raw) ? raw : [];
  const out = [];
  const seen = new Set();
  for (const item of arr) {
    if (out.length >= 4) break;
    let label = "";
    let send = "";
    if (typeof item === "string") {
      label = item;
      send = item;
    } else if (item && typeof item === "object") {
      label = item.label || item.text || item.send || "";
      send = item.send || item.value || item.label || "";
    }
    label = String(label || "").replace(/\s+/g, " ").trim().slice(0, 32);
    send = String(send || label).replace(/\s+/g, " ").trim().slice(0, 120);
    if (label.length < 1 || send.length < 1) continue;
    const key = send.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label, send });
  }
  return out;
}

function cleanChoice(s) {
  return String(s || "")
    .replace(/^["'«»]+|["'«»]+$/g, "")
    .replace(/[?.!]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Conservative parse of a spoken question into 2–4 tap replies. */
export function parseReplyChoices(text) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t || t.length > 400) return [];

  const lines = String(text || "")
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const listed = [];
  for (const line of lines) {
    const m = line.match(/^(?:[-*•]|\d+[.)]|[A-Da-d][.)])\s+(.{2,40})$/);
    if (!m) continue;
    const label = cleanChoice(m[1]);
    if (label.length >= 2) listed.push({ label, send: label });
  }
  const listedN = normalizeChoiceOptions(listed);
  if (listedN.length >= 2) return listedN;

  const or = t.match(
    /([A-Za-zÁÉÍÓÚÑ0-9][A-Za-zÁÉÍÓÚÑ0-9 +/%.-]{0,28}[A-Za-zÁÉÍÓÚÑ0-9])\s+o\s+([A-Za-zÁÉÍÓÚÑ0-9][A-Za-zÁÉÍÓÚÑ0-9 +/%.-]{0,28}[A-Za-zÁÉÍÓÚÑ0-9])\??/i,
  );
  if (or && !/\b(día|días|hora|horas|minutos)\b/i.test(or[0])) {
    const a = cleanChoice(or[1]);
    const b = cleanChoice(or[2]);
    if (a.length >= 2 && b.length >= 2 && a.toLowerCase() !== b.toLowerCase()) {
      return normalizeChoiceOptions([
        { label: a, send: a },
        { label: b, send: b },
      ]);
    }
  }
  return [];
}
