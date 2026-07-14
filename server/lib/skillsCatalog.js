// ═══════════════════════════════════════════════════════════════════════════
// server/lib/skillsCatalog.js — read-only discovery of the repo's SKILL.md
// catalogue (agent/operator skills committed under .cursor/, .claude/, .agents/).
// ───────────────────────────────────────────────────────────────────────────
// Each skill lives in `<root>/<id>/SKILL.md` with a YAML frontmatter block
// (`name`, `description`, …). This module scans those roots, parses the
// frontmatter (no YAML dependency — same hand-rolled parser used by
// scripts/generate-skill-matrix-block.mjs), and exposes:
//
//   listSkills({ source, q })  → metadata-only catalogue (no bodies)
//   getSkill(id)               → one skill's metadata + markdown body
//
// Path-traversal safety: callers only ever supply a skill `id`, which is
// resolved against the in-memory catalogue map. The filesystem path read is the
// one discovered by `readdir` at scan time — never a path built from raw input.
//
// Backed by GET /api/skills (server/routes/skills.js). Read-only, secret-free.
// ═══════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = path.resolve(__dirname, "..", "..");

/**
 * Skill roots scanned, in priority order. When the same skill `id` appears in
 * more than one root (e.g. a symlink), the first occurrence wins and the later
 * roots are recorded in `alsoIn`.
 */
function defaultRoots(repoRoot) {
  return [
    { source: "cursor", dir: path.join(repoRoot, ".cursor", "skills") },
    { source: "claude", dir: path.join(repoRoot, ".claude", "skills") },
    { source: "agents", dir: path.join(repoRoot, ".agents", "skills") },
  ];
}

const CACHE_TTL_MS = 60_000;

let _repoRoot = DEFAULT_REPO_ROOT;
let _roots = defaultRoots(DEFAULT_REPO_ROOT);
let _cache = null; // { at, list, byId }

/**
 * Parse a leading `---\n … \n---\n` YAML frontmatter block into a flat
 * string map. Supports folded (`>`) / literal (`|`) scalars by joining their
 * continuation lines with a space. Returns null when no frontmatter is present.
 */
export function parseFrontmatter(raw) {
  if (typeof raw !== "string" || !raw.startsWith("---\n")) return null;
  const end = raw.indexOf("\n---", 4);
  if (end === -1) return null;
  const block = raw.slice(4, end);
  const out = {};
  let key = null;
  let buf = [];
  const flush = () => {
    if (!key) return;
    out[key] = buf.join(" ").replace(/\s+/g, " ").trim();
    key = null;
    buf = [];
  };
  for (const line of block.split("\n")) {
    const m = /^([a-zA-Z0-9_-]+):\s*(.*)$/.exec(line);
    if (m && !/^\s/.test(line)) {
      flush();
      key = m[1];
      const rest = m[2];
      buf = rest === ">" || rest === "|" ? [] : [rest];
      continue;
    }
    if (key && /^\s+/.test(line)) {
      buf.push(line.trim());
      continue;
    }
    if (key) flush();
  }
  flush();
  return out;
}

/** Strip a leading frontmatter block, returning the markdown body. */
function stripFrontmatter(raw) {
  if (!raw.startsWith("---\n")) return raw;
  const end = raw.indexOf("\n---", 4);
  if (end === -1) return raw;
  return raw.slice(raw.indexOf("\n", end + 1) + 1).replace(/^\s+/, "");
}

/** Tidy a frontmatter description for wire display (drop md emphasis/code ticks). */
function cleanDescription(desc) {
  return String(desc || "")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Public projection of an internal catalogue entry (never exposes absPath). */
function toPublic(entry) {
  return {
    id: entry.id,
    name: entry.name,
    description: entry.description,
    source: entry.source,
    alsoIn: entry.alsoIn.slice(),
    path: entry.path,
  };
}

/** (Re)build the catalogue by scanning every configured root once. */
function build() {
  const byId = new Map();
  const list = [];
  for (const root of _roots) {
    let entries;
    try {
      entries = fs.readdirSync(root.dir, { withFileTypes: true });
    } catch {
      continue; // root absent on this checkout — skip silently
    }
    for (const d of entries) {
      // Accept real dirs and symlinked dirs (some roots symlink shared skills).
      if (!d.isDirectory() && !d.isSymbolicLink()) continue;
      const id = d.name;
      const mdPath = path.join(root.dir, id, "SKILL.md");
      if (!fs.existsSync(mdPath)) continue;

      const existing = byId.get(id);
      if (existing) {
        if (!existing.alsoIn.includes(root.source)) existing.alsoIn.push(root.source);
        continue;
      }

      let fm = null;
      try {
        fm = parseFrontmatter(fs.readFileSync(mdPath, "utf8"));
      } catch {
        fm = null;
      }
      const entry = {
        id,
        name: (fm?.name || id).trim(),
        description: cleanDescription(fm?.description),
        source: root.source,
        alsoIn: [],
        path: path.relative(_repoRoot, mdPath),
        absPath: mdPath,
      };
      byId.set(id, entry);
      list.push(entry);
    }
  }
  list.sort((a, b) => a.id.localeCompare(b.id));
  return { list, byId };
}

function getCatalog({ force = false } = {}) {
  const now = Date.now();
  if (!force && _cache && now - _cache.at < CACHE_TTL_MS) return _cache;
  const { list, byId } = build();
  _cache = { at: now, list, byId };
  return _cache;
}

/**
 * List skill metadata (no bodies).
 * @param {{ source?: string, q?: string }} [opts]
 *   source — keep only skills whose primary or `alsoIn` source matches.
 *   q      — case-insensitive substring over id + name + description.
 * @returns {Array<{id,name,description,source,alsoIn,path}>}
 */
export function listSkills(opts = {}) {
  const { source, q } = opts;
  let list = getCatalog().list.map(toPublic);
  if (source) {
    list = list.filter((e) => e.source === source || e.alsoIn.includes(source));
  }
  if (q) {
    const needle = String(q).toLowerCase();
    list = list.filter((e) =>
      `${e.id} ${e.name} ${e.description}`.toLowerCase().includes(needle),
    );
  }
  return list;
}

/**
 * Full skill: metadata + parsed frontmatter + markdown body. Resolves `id`
 * against the catalogue map only — never builds a path from raw input.
 * @returns {null | {id,name,description,source,alsoIn,path,frontmatter,body}}
 */
export function getSkill(id) {
  const entry = getCatalog().byId.get(String(id));
  if (!entry) return null;
  let raw;
  try {
    raw = fs.readFileSync(entry.absPath, "utf8");
  } catch {
    return null;
  }
  return {
    ...toPublic(entry),
    frontmatter: parseFrontmatter(raw) || {},
    body: stripFrontmatter(raw),
  };
}

/** Test-only — point the scanner at a fixture tree and reset the cache. */
export const __test__ = {
  setRoots(roots, repoRoot) {
    _roots = roots;
    _repoRoot = repoRoot || DEFAULT_REPO_ROOT;
    _cache = null;
  },
  reset() {
    _repoRoot = DEFAULT_REPO_ROOT;
    _roots = defaultRoots(DEFAULT_REPO_ROOT);
    _cache = null;
  },
};
