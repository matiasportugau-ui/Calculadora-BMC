// Product drawer / agent catalog search: fold accents, AND tokens, aliases, rank.

const ALIAS_PAIRS = [
  ["hexagonal", "exagonal"],
  ["hex", "exagonal"],
  ["tornillo", "torn"],
  ["tornilleria", "tornillo"],
  ["poliuretano", "pu"],
  ["espuma", "pu"],
  ["flashing", "babeta"],
  ["tapajunta", "babeta"],
  ["canalon", "canalón"],
  ["mecha", "punta mecha"],
  ["selfdrill", "punta mecha"],
  ["anclaje", "taco"],
  ["expansivo", "taco"],
  ["silicona", "sil"],
  ["sil", "silicona"],
  ["isodec", "isodec"],
  ["isoroof", "isoroof"],
  ["isopanel", "isopanel"],
  ["gotero frontal", "gfs"],
  ["cumbrera", "cumbrera"],
  ["angulo", "5852"],
  ["estructural", "5852"],
  ["aluminio", "5852"],
  ["anodizado", "5852"],
  ["k6", "5852"],
  ["plechu", "5852"],
  ["pa5852", "5852"],
];

export function foldSearchText(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[×x](?=\s|$)/g, "x")
    .replace(/["”“″]/g, " ")
    .replace(/(\d)\s*mm\b/g, "$1")
    .replace(/[/_\-·•|,;:()]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenizeQuery(q) {
  const folded = foldSearchText(q);
  if (!folded) return [];
  return folded.split(" ").filter(Boolean);
}

function aliasExpansions(token) {
  const out = new Set([token]);
  for (const [a, b] of ALIAS_PAIRS) {
    const fa = foldSearchText(a);
    const fb = foldSearchText(b);
    if (token === fa || fa.startsWith(token) || token.startsWith(fa)) out.add(fb);
    if (token === fb || fb.startsWith(token) || token.startsWith(fb)) out.add(fa);
  }
  return [...out];
}

export function haystackForRow(row) {
  if (!row) return "";
  if (row.searchHaystack) return row.searchHaystack;
  return foldSearchText(
    [
      row.label,
      row.sku,
      row.key,
      row.id,
      row.familia,
      row.kind,
      row.category,
      row.unidad,
      row.searchText,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function tokenHits(hay, token) {
  if (!token) return false;
  if (hay.includes(token)) return true;
  return aliasExpansions(token).some((t) => t && hay.includes(t));
}

export function rowMatchesTokens(row, tokens) {
  if (!tokens.length) return true;
  const hay = haystackForRow(row);
  return tokens.every((t) => tokenHits(hay, t));
}

/** Higher is better. */
export function scoreProductRow(row, tokens) {
  if (!tokens.length) return 0;
  const hay = haystackForRow(row);
  const sku = foldSearchText(row.sku || row.id || "");
  const label = foldSearchText(row.label || "");
  let score = 0;
  const joined = tokens.join(" ");
  if (sku && (sku === joined || sku === tokens[0])) score += 80;
  if (sku && tokens.some((t) => sku === t || sku.startsWith(t))) score += 40;
  if (tokens.every((t) => label.split(" ").some((w) => w.startsWith(t)))) score += 30;
  if (tokens.every((t) => label.includes(t))) score += 20;
  if (tokens.every((t) => hay.includes(t))) score += 10;
  score += Math.max(0, 8 - tokens.length);
  return score;
}

export function filterAndRankProducts(rows, query, { category } = {}) {
  const tokens = tokenizeQuery(query);
  let list = Array.isArray(rows) ? rows : [];
  if (category && category !== "ALL") {
    list = list.filter((r) => r.category === category);
  }
  if (!tokens.length) return list;
  return list
    .filter((r) => rowMatchesTokens(r, tokens))
    .map((r) => ({ r, s: scoreProductRow(r, tokens) }))
    .sort((a, b) => b.s - a.s || String(a.r.label).localeCompare(String(b.r.label), "es"))
    .map((x) => x.r);
}

export function buildSearchHaystack(row) {
  return haystackForRow(row);
}
