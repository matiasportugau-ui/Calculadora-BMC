import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const knowledgeDir = path.resolve(__dirname, "../../data/knowledge");

let _cache = null;
let _cacheTime = 0;
const CACHE_TTL_MS = Number(process.env.KNOWLEDGE_CACHE_TTL_MS) || 60_000;

export function loadKnowledgeDocs() {
  const now = Date.now();
  if (_cache && now - _cacheTime < CACHE_TTL_MS) return _cache;

  if (!fs.existsSync(knowledgeDir)) {
    _cache = "";
    _cacheTime = now;
    return _cache;
  }

  const files = fs.readdirSync(knowledgeDir)
    .filter((f) => f.endsWith(".md") || f.endsWith(".txt"))
    .sort();

  const sections = files.map((file) => {
    const content = fs.readFileSync(path.join(knowledgeDir, file), "utf8").trim();
    return `### [DOC: ${file}]\n${content}`;
  });

  _cache = sections.join("\n\n---\n\n");
  _cacheTime = now;
  return _cache;
}

export function clearKnowledgeCache() {
  _cache = null;
  _cacheTime = 0;
}
