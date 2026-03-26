/**
 * Local JSON store for follow-up items (CLI + /api/followups).
 * Single-file, atomic write. Path: FOLLOWUP_STORE_PATH or .followup/store.json
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DEFAULT_REL = path.join(".followup", "store.json");

function defaultStorePath() {
  return process.env.FOLLOWUP_STORE_PATH
    ? path.resolve(process.env.FOLLOWUP_STORE_PATH)
    : path.resolve(process.cwd(), DEFAULT_REL);
}

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function emptyStore() {
  return { version: 1, items: [] };
}

export function loadStore(storePath = defaultStorePath()) {
  try {
    if (!fs.existsSync(storePath)) return { ...emptyStore(), _path: storePath };
    const raw = fs.readFileSync(storePath, "utf8");
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.items)) return { ...emptyStore(), _path: storePath };
    return { ...data, _path: storePath };
  } catch {
    return { ...emptyStore(), _path: storePath };
  }
}

export function saveStore(data) {
  const storePath = data._path || defaultStorePath();
  ensureDir(storePath);
  const { _path, ...rest } = data;
  const tmp = `${storePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(rest, null, 2), "utf8");
  fs.renameSync(tmp, storePath);
  return loadStore(storePath);
}

function nowIso() {
  return new Date().toISOString();
}

export function newId() {
  return `fu_${crypto.randomBytes(8).toString("hex")}`;
}

/**
 * Open items that should surface now: status open and (no nextFollowUpAt or nextFollowUpAt <= now).
 */
export function listDueItems(items, now = new Date()) {
  const t = now.getTime();
  return items.filter((it) => {
    if (it.status !== "open") return false;
    if (!it.nextFollowUpAt) return true;
    const d = Date.parse(it.nextFollowUpAt);
    return !Number.isNaN(d) && d <= t;
  });
}

export function sortByFollowUp(items) {
  return [...items].sort((a, b) => {
    const ad = a.nextFollowUpAt ? Date.parse(a.nextFollowUpAt) : 0;
    const bd = b.nextFollowUpAt ? Date.parse(b.nextFollowUpAt) : 0;
    if (ad !== bd) return ad - bd;
    return String(a.createdAt).localeCompare(String(b.createdAt));
  });
}

export function addItem(store, { title, detail = "", tags = [], nextFollowUpAt = null }) {
  const id = newId();
  const ts = nowIso();
  const item = {
    id,
    title: String(title || "").trim() || "(sin título)",
    detail: String(detail || ""),
    tags: Array.isArray(tags) ? tags.map((t) => String(t).trim()).filter(Boolean) : [],
    status: "open",
    nextFollowUpAt,
    notes: [],
    createdAt: ts,
    updatedAt: ts,
  };
  store.items.push(item);
  store.updatedAt = ts;
  return item;
}

export function findItem(store, id) {
  return store.items.find((i) => i.id === id) || null;
}

export function appendNote(item, text) {
  const t = String(text || "").trim();
  if (!t) return item;
  if (!Array.isArray(item.notes)) item.notes = [];
  item.notes.push({ at: nowIso(), text: t });
  item.updatedAt = nowIso();
  return item;
}

export function markDone(store, id) {
  const it = findItem(store, id);
  if (!it) return null;
  it.status = "done";
  it.updatedAt = nowIso();
  return it;
}

export function snoozeItem(store, id, nextFollowUpAt) {
  const it = findItem(store, id);
  if (!it) return null;
  it.status = "open";
  it.nextFollowUpAt = nextFollowUpAt;
  it.updatedAt = nowIso();
  return it;
}

export function deleteItem(store, id) {
  const idx = store.items.findIndex((i) => i.id === id);
  if (idx < 0) return false;
  store.items.splice(idx, 1);
  store.updatedAt = nowIso();
  return true;
}

export function parseDueInput(str) {
  if (!str) return null;
  const s = String(str).trim();
  if (!s) return null;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  return null;
}

export function parseDays(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x < 0) return null;
  const d = new Date();
  d.setDate(d.getDate() + Math.floor(x));
  return d.toISOString();
}
