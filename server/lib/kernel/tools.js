/**
 * Dispatch Kernel function tools against the living store + repo allowlist.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadStore,
  saveStore,
  ingestConversationTurn,
  ingestAppEvent,
  readEventLog,
  readConversationLog,
  getSnapshot,
  setSnapshot,
  setMode,
  appendImprovement,
  readImprovementLog,
  applyPlaybookPatch,
  getAgent,
  proposeCodeChange,
  findProposal,
  deliverReport,
} from "./store.js";
import { seedPanelin } from "./provision.js";
import { KERNEL_TOOL_NAMES } from "./kernelTools.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "../../..");

export const SOURCE_ALLOW_PREFIXES = Object.freeze(["src/", "server/", "docs/"]);
const DENY_FRAGMENTS = Object.freeze([
  "node_modules",
  ".env",
  ".kernel",
  "secrets",
  ".git/",
  "service-account",
]);
const MAX_FILE_BYTES = 200_000;
const MAX_HITS = 40;

export function isKernelTool(name) {
  return KERNEL_TOOL_NAMES.includes(name);
}

export function normalizeRepoPath(raw) {
  const p = String(raw || "").replace(/\\/g, "/").replace(/^\/+/, "").trim();
  if (!p || p.includes("..")) return null;
  if (!SOURCE_ALLOW_PREFIXES.some((pre) => p === pre.slice(0, -1) || p.startsWith(pre))) {
    return null;
  }
  if (DENY_FRAGMENTS.some((d) => p.includes(d))) return null;
  return p;
}

function globToRegExp(glob) {
  const g = String(glob || "").trim();
  if (!g) return null;
  const escaped = g
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, ":::GLOBSTAR:::")
    .replace(/\*/g, "[^/]*")
    .replace(/:::GLOBSTAR:::/g, ".*");
  return new RegExp(`^${escaped}$`);
}

function walkAllowlisted(root, globRe, hits, queryRe) {
  const stack = SOURCE_ALLOW_PREFIXES.map((pre) => path.join(root, pre));
  while (stack.length && hits.length < MAX_HITS) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      if (hits.length >= MAX_HITS) break;
      const full = path.join(dir, ent.name);
      const rel = path.relative(root, full).replace(/\\/g, "/");
      if (DENY_FRAGMENTS.some((d) => rel.includes(d))) continue;
      if (ent.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (!ent.isFile()) continue;
      if (globRe && !globRe.test(rel)) continue;
      let text;
      try {
        const st = fs.statSync(full);
        if (st.size > MAX_FILE_BYTES) continue;
        text = fs.readFileSync(full, "utf8");
      } catch {
        continue;
      }
      const lines = text.split(/\n/);
      for (let i = 0; i < lines.length; i++) {
        if (hits.length >= MAX_HITS) break;
        if (queryRe.test(lines[i])) {
          hits.push({ path: rel, line: i + 1, text: lines[i].slice(0, 240) });
        }
      }
    }
  }
}

export function searchCode({ query, path_glob } = {}) {
  const q = String(query || "").trim();
  if (!q) return { ok: false, error: "query required", hits: [] };
  // Always treat query as a literal substring — never compile user input as RegExp
  // (ReDoS / regex injection). Case-insensitive via escaped pattern only.
  const queryRe = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const globRe = globToRegExp(path_glob);
  const hits = [];
  walkAllowlisted(REPO_ROOT, globRe, hits, queryRe);
  return { ok: true, query: q, hits, truncated: hits.length >= MAX_HITS };
}

export function readSourceFile(relPath) {
  const norm = normalizeRepoPath(relPath);
  if (!norm) {
    return { ok: false, error: "path not allowed" };
  }
  const full = path.join(REPO_ROOT, norm);
  try {
    const st = fs.statSync(full);
    if (st.size > MAX_FILE_BYTES) {
      return { ok: false, error: "file too large", path: norm, bytes: st.size };
    }
    const content = fs.readFileSync(full, "utf8");
    return { ok: true, path: norm, content };
  } catch (err) {
    return { ok: false, error: err?.message || "read failed", path: norm };
  }
}

function codeApplyAllowed() {
  return String(process.env.KERNEL_ALLOW_CODE_APPLY || "") === "1";
}

function applyStagedProposal(store, proposal) {
  const files = String(proposal.files || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const denied = files.filter((f) => !normalizeRepoPath(f));
  if (denied.length) {
    return { ok: false, error: `path not allowed: ${denied.join(", ")}`, staged: true };
  }
  // Only apply when the diff looks like a full-file replacement for a single file.
  if (files.length !== 1 || String(proposal.diff || "").startsWith("diff ") || String(proposal.diff || "").includes("\n--- ")) {
    return {
      ok: false,
      staged: true,
      error: "apply_code_change only writes a single full-file replacement under allowlist",
    };
  }
  const rel = normalizeRepoPath(files[0]);
  const full = path.join(REPO_ROOT, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, proposal.diff, "utf8");
  proposal.status = "applied";
  proposal.appliedAt = new Date().toISOString();
  return { ok: true, applied: true, files: [rel], proposal_id: proposal.id };
}

export function executeKernelTool(name, args = {}) {
  const store = loadStore();
  seedPanelin(store);

  const save = () => saveStore(store);

  switch (name) {
    case "ingest_conversation_turn": {
      const result = ingestConversationTurn(store, args);
      save();
      return result;
    }
    case "ingest_app_event": {
      const result = ingestAppEvent(store, args);
      save();
      return result;
    }
    case "read_event_log":
      return { ok: true, events: readEventLog(store, args) };
    case "read_conversation_log":
      return { ok: true, turns: readConversationLog(store, args) };
    case "read_project_snapshot":
      return { ok: true, snapshot: getSnapshot(store) };
    case "search_code":
      return searchCode(args);
    case "read_source_file":
      return readSourceFile(args.path);
    case "read_playbook": {
      const agent = getAgent(store, args.agent_id);
      if (!agent) return { ok: false, error: `unknown agent_id: ${args.agent_id}` };
      return {
        ok: true,
        agent_id: agent.agent_id,
        version: agent.version,
        playbook: agent.playbook,
      };
    }
    case "read_improvement_log":
      return { ok: true, items: readImprovementLog(store, args) };
    case "set_mode": {
      const mode = setMode(store, args.mode);
      save();
      return { ok: true, mode };
    }
    case "append_improvement": {
      const row = appendImprovement(store, args);
      save();
      return { ok: true, improvement: row };
    }
    case "apply_playbook_patch": {
      const result = applyPlaybookPatch(store, args);
      save();
      return result;
    }
    case "propose_code_change": {
      const row = proposeCodeChange(store, args);
      save();
      return { ok: true, proposal_id: row.id, status: row.status };
    }
    case "apply_code_change": {
      const proposal = findProposal(store, args.proposal_id);
      if (!proposal) return { ok: false, error: "proposal not found" };
      if (!codeApplyAllowed()) {
        return {
          ok: false,
          staged: true,
          proposal_id: proposal.id,
          error: "KERNEL_ALLOW_CODE_APPLY is not set; proposal stays staged",
        };
      }
      const result = applyStagedProposal(store, proposal);
      save();
      return result;
    }
    case "deliver_report": {
      const row = deliverReport(store, args);
      save();
      return { ok: true, report: row };
    }
    default:
      return { ok: false, error: `unknown kernel tool: ${name}` };
  }
}

export function hostSetSnapshot(snapshot) {
  const store = loadStore();
  seedPanelin(store);
  const next = setSnapshot(store, snapshot);
  saveStore(store);
  return next;
}

export { KERNEL_TOOL_NAMES };
