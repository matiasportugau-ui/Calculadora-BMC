/**
 * Follow-up tracker API — local JSON store (see server/lib/followUpStore.js).
 * Mount at /api/followups (full paths: GET /api/followups, POST /api/followups, etc.)
 */
import { Router } from "express";
import {
  loadStore,
  saveStore,
  addItem,
  findItem,
  appendNote,
  markDone,
  snoozeItem,
  deleteItem,
  listDueItems,
  sortByFollowUp,
  parseDueInput,
  parseDays,
} from "../lib/followUpStore.js";
import { requireAuth } from "../middleware/requireAuth.js";

export function createFollowupsRouter() {
  const router = Router();

  router.get("/followups", (req, res) => {
    const store = loadStore();
    const status = req.query.status || "open";
    let items = store.items;
    if (status === "open") items = items.filter((i) => i.status === "open");
    else if (status === "done") items = items.filter((i) => i.status === "done");
    if (req.query.due === "1" || req.query.due === "true") {
      items = listDueItems(items);
    }
    items = sortByFollowUp(items);
    res.json({ ok: true, count: items.length, items });
  });

  router.post("/followups", requireAuth, (req, res) => {
    const { title, detail, tags, nextFollowUpAt, daysUntil } = req.body || {};
    const store = loadStore();
    let due = nextFollowUpAt ? parseDueInput(nextFollowUpAt) : null;
    if (!due && daysUntil != null) due = parseDays(daysUntil);
    const item = addItem(store, {
      title,
      detail,
      tags: tags || [],
      nextFollowUpAt: due,
    });
    saveStore(store);
    res.status(201).json({ ok: true, item });
  });

  router.get("/followups/:id", (req, res) => {
    const store = loadStore();
    const item = findItem(store, req.params.id);
    if (!item) return res.status(404).json({ ok: false, error: "Not found" });
    res.json({ ok: true, item });
  });

  router.patch("/followups/:id", requireAuth, (req, res) => {
    const store = loadStore();
    const item = findItem(store, req.params.id);
    if (!item) return res.status(404).json({ ok: false, error: "Not found" });
    const { title, detail, tags, status, nextFollowUpAt, daysUntil, note } = req.body || {};
    if (title != null) item.title = String(title).trim() || item.title;
    if (detail != null) item.detail = String(detail);
    if (tags != null) item.tags = Array.isArray(tags) ? tags : item.tags;
    if (note != null) appendNote(item, note);
    if (status === "done") markDone(store, item.id);
    else if (status === "open") {
      item.status = "open";
      item.updatedAt = new Date().toISOString();
    }
    if (daysUntil != null) {
      const iso = parseDays(daysUntil);
      if (iso) item.nextFollowUpAt = iso;
    } else if (nextFollowUpAt !== undefined) {
      item.nextFollowUpAt = nextFollowUpAt ? parseDueInput(nextFollowUpAt) : null;
    }
    item.updatedAt = new Date().toISOString();
    saveStore(store);
    res.json({ ok: true, item: findItem(store, item.id) });
  });

  router.post("/followups/:id/done", requireAuth, (req, res) => {
    const store = loadStore();
    const item = markDone(store, req.params.id);
    if (!item) return res.status(404).json({ ok: false, error: "Not found" });
    saveStore(store);
    res.json({ ok: true, item });
  });

  router.post("/followups/:id/snooze", requireAuth, (req, res) => {
    const { nextFollowUpAt, days } = req.body || {};
    const store = loadStore();
    let iso = nextFollowUpAt ? parseDueInput(nextFollowUpAt) : null;
    if (!iso && days != null) iso = parseDays(days);
    if (!iso) return res.status(400).json({ ok: false, error: "Need nextFollowUpAt or days" });
    const item = snoozeItem(store, req.params.id, iso);
    if (!item) return res.status(404).json({ ok: false, error: "Not found" });
    saveStore(store);
    res.json({ ok: true, item });
  });

  router.delete("/followups/:id", requireAuth, (req, res) => {
    const store = loadStore();
    const ok = deleteItem(store, req.params.id);
    if (!ok) return res.status(404).json({ ok: false, error: "Not found" });
    saveStore(store);
    res.json({ ok: true, deleted: req.params.id });
  });

  return router;
}
