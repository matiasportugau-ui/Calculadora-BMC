/**
 * /api/desk/* — Mesa de revisión IAlfred Desk (Hito 1 · D1/D2/D10/D11)
 *
 * Postgres fuente de verdad; Sheets = espejo; Desk vía esta API, nunca
 * directo a Sheets. Auth: módulo `canales`. Sin DB → 503 (igual que omni).
 */
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { config } from "../config.js";
import { getOmniPool } from "../lib/omni/omniDb.js";
import { requireGrant } from "../middleware/requireGrant.js";
import {
  listQueue,
  getReview,
  createReview,
  saveEditCause,
  approveSend,
  markStatus,
} from "../lib/deskQueue.js";
import { freezeMatriz } from "../lib/matrizSnapshot.js";

const readLimiter = rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false });
const writeLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

function requireDeskDb(req, res, next) {
  const pool = getOmniPool(config.databaseUrl);
  if (!pool) return res.status(503).json({ ok: false, error: "desk_db_unavailable" });
  req.deskPool = pool;
  next();
}

const router = Router();
// Path-scoped: this router is mounted at "/api", so a bare use() would throttle every later /api route.
router.use("/desk", readLimiter);

router.get("/desk/health", requireDeskDb, async (req, res) => {
  try {
    await req.deskPool.query("select 1");
    res.json({ ok: true, source: "postgres", sheets_mirror: true });
  } catch (e) {
    res.status(503).json({ ok: false, error: "desk_db_unavailable" });
  }
});

router.get("/desk/queue", requireGrant.read("canales"), requireDeskDb, async (req, res) => {
  try {
    const rows = await listQueue({ limit: req.query.limit }, req.deskPool);
    res.json({ ok: true, reviews: rows });
  } catch (e) {
    res.status(e.status || 503).json({ ok: false, error: e.message });
  }
});

router.get("/desk/:id", requireGrant.read("canales"), requireDeskDb, async (req, res) => {
  try {
    const row = await getReview({ id: req.params.id }, req.deskPool);
    if (!row) return res.status(404).json({ ok: false, error: "review_not_found" });
    res.json({ ok: true, review: row });
  } catch (e) {
    res.status(e.status || 503).json({ ok: false, error: e.message });
  }
});

const createSchema = z.object({
  quoteId: z.string().nullable().optional(),
  conversationId: z.string().uuid().nullable().optional(),
  contactId: z.string().uuid().nullable().optional(),
  channel: z.enum(["wa", "email", "ml", "instagram", "facebook", "manual"]).default("wa"),
  matrizVersion: z.string().min(1).optional(),
  matrizCsv: z.string().optional(),
  payload: z.record(z.unknown()).default({}),
  interp: z.record(z.unknown()).default({}),
  faltantes: z.array(z.unknown()).default([]),
});

router.post("/desk/reviews", requireGrant.write("canales"), writeLimiter, requireDeskDb, async (req, res) => {
  const parsed = createSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ ok: false, error: "invalid_body", detail: parsed.error.issues });
  try {
    let matrizVersion = parsed.data.matrizVersion;

    // Auto-freeze Matriz if version not provided but CSV is
    if (!matrizVersion && parsed.data.matrizCsv) {
      matrizVersion = await freezeMatriz(parsed.data.matrizCsv, req.user?.id || "system", req.deskPool);
    }

    // Require a version (either provided or auto-frozen)
    if (!matrizVersion) {
      return res.status(400).json({ ok: false, error: "matrizVersion_required" });
    }

    const row = await createReview(
      {
        quoteId: parsed.data.quoteId,
        conversationId: parsed.data.conversationId,
        contactId: parsed.data.contactId,
        channel: parsed.data.channel,
        matrizVersion,
        payload: parsed.data.payload,
        interp: parsed.data.interp,
        faltantes: parsed.data.faltantes,
        createdBy: req.user?.id || null,
      },
      req.deskPool,
    );
    res.status(201).json({ ok: true, review: row });
  } catch (e) {
    res.status(e.status || 503).json({ ok: false, error: e.message, detail: e.detail });
  }
});

const causeSchema = z.object({
  causa: z.string().min(1),
  detalle: z.string().max(500).optional().default(""),
  payloadPatch: z.record(z.unknown()).nullable().optional(),
});

router.post("/desk/:id/edit-cause", requireGrant.write("canales"), writeLimiter, requireDeskDb, async (req, res) => {
  const parsed = causeSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ ok: false, error: "invalid_body", detail: parsed.error.issues });
  try {
    const row = await saveEditCause({ id: req.params.id, ...parsed.data }, req.deskPool);
    res.json({ ok: true, review: row });
  } catch (e) {
    res.status(e.status || 503).json({ ok: false, error: e.message });
  }
});

const approveSchema = z.object({
  phoneE164: z.string().min(8),
  text: z.string().min(1).max(2000),
});

router.post("/desk/:id/approve-send", requireGrant.write("canales"), writeLimiter, requireDeskDb, async (req, res) => {
  const parsed = approveSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ ok: false, error: "invalid_body", detail: parsed.error.issues });
  try {
    const row = await approveSend({ id: req.params.id, ...parsed.data }, req.deskPool);
    res.json({ ok: true, review: row });
  } catch (e) {
    res.status(e.status || 503).json({ ok: false, error: e.message });
  }
});

const statusSchema = z.object({
  status: z.enum(["pending", "approved", "sent", "sold", "discarded"]),
  extra: z.record(z.unknown()).default({}),
});

router.patch("/desk/:id/status", requireGrant.write("canales"), writeLimiter, requireDeskDb, async (req, res) => {
  const parsed = statusSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ ok: false, error: "invalid_body", detail: parsed.error.issues });
  try {
    const row = await markStatus({ id: req.params.id, ...parsed.data }, req.deskPool);
    res.json({ ok: true, review: row });
  } catch (e) {
    res.status(e.status || 503).json({ ok: false, error: e.message });
  }
});

export default router;
