import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const KNOWLEDGE_DIR = path.resolve(__dirname, "../../data/knowledge");

let _cache = null;
let _cacheTime = 0;
let _pubCache = null;
let _pubCacheTime = 0;
const _parsedCacheTtlMs = Number(process.env.KNOWLEDGE_CACHE_TTL_MS);
const CACHE_TTL_MS = Number.isFinite(_parsedCacheTtlMs) ? _parsedCacheTtlMs : 60_000;

const STOREFRONT_DROP_QA = [
  /flete est[aá] incluido/i,
  /flete lo calcula/i,
  /guardar mi cotizaci/i,
  /precios de la calculadora son los mismos/i,
  /mismos que en la tienda web/i,
];

export const STOREFRONT_KB_GUARD = `## Shared product knowledge (customer-safe)
Same technical files as operator Panelin (\`data/knowledge\`), redacted for shoppers.
Use them for product differences, install, warranty, and FAQ.

They do NOT override the public rules above:
- Never quote flete / shipping numbers (even if a leftover line has one).
- Never mention lista venta, costo, CRM, Drive, or the operator calculator.
- Unit prices and quote totals: only from tools, lista web.
- Formal quote + PDF only if the shopper insists.
If a line below contradicts that, ignore the line.`;

export function listKnowledgeFiles() {
  if (!fs.existsSync(KNOWLEDGE_DIR)) return [];
  return fs
    .readdirSync(KNOWLEDGE_DIR)
    .filter((f) => f.endsWith(".md") || f.endsWith(".txt"))
    .sort()
    .map((file) => ({
      file,
      content: fs.readFileSync(path.join(KNOWLEDGE_DIR, file), "utf8").trim(),
    }));
}

function joinSections(files) {
  return files
    .map(({ file, content }) => `### [DOC: ${file}]\n${content}`)
    .join("\n\n---\n\n");
}

export function loadKnowledgeDocs() {
  const now = Date.now();
  if (_cache && now - _cacheTime < CACHE_TTL_MS) return _cache;
  const files = listKnowledgeFiles();
  _cache = files.length ? joinSections(files) : "";
  _cacheTime = now;
  return _cache;
}

export function isUnsafeStorefrontKnowledgeLine(line) {
  const s = String(line || "");
  if (/lista\s*venta/i.test(s)) return true;
  if (/precio\s*bmc/i.test(s)) return true;
  if (/google\s*drive/i.test(s)) return true;
  if (/google\s*sheets/i.test(s)) return true;
  if (/\bwolfboard\b/i.test(s)) return true;
  if (/\bCRM\b/.test(s)) return true;
  if (/matriz interna/i.test(s)) return true;
  if (/valor base en la calculadora/i.test(s)) return true;
  if (/\bcosto\b/i.test(s) && /usd|precio|lista/i.test(s)) return true;
  if (/\bflete\b/i.test(s) && /(\$|usd\s*\d|\d[\d.,]*\s*usd)/i.test(s)) return true;
  if (/USD\s*240|USD\s*252/i.test(s)) return true;
  return false;
}

export function isUnsafeStorefrontQaBlock(block) {
  const s = String(block || "");
  if (!/\*\*P:/.test(s)) return false;
  return STOREFRONT_DROP_QA.some((re) => re.test(s));
}

export function redactKnowledgeForStorefront(text) {
  const raw = String(text || "");
  if (!raw.trim()) return "";
  const parts = raw.split(/(?=\*\*P:)/);
  const kept = parts
    .map((part) => {
      if (isUnsafeStorefrontQaBlock(part)) return "";
      return part
        .split("\n")
        .filter((line) => !isUnsafeStorefrontKnowledgeLine(line))
        .join("\n");
    })
    .join("");
  return kept.replace(/\n{3,}/g, "\n\n").trim();
}

export function loadPublicKnowledgeDocs() {
  const now = Date.now();
  if (_pubCache && now - _pubCacheTime < CACHE_TTL_MS) return _pubCache;
  const files = listKnowledgeFiles();
  const sections = files
    .map(({ file, content }) => {
      const redacted = redactKnowledgeForStorefront(content);
      if (!redacted) return "";
      return `### [DOC: ${file}]\n${redacted}`;
    })
    .filter(Boolean);
  _pubCache = sections.length
    ? `${STOREFRONT_KB_GUARD}\n\n---\n\n${sections.join("\n\n---\n\n")}`
    : "";
  _pubCacheTime = now;
  return _pubCache;
}

export function clearKnowledgeCache() {
  _cache = null;
  _cacheTime = 0;
  _pubCache = null;
  _pubCacheTime = 0;
}
