/**
 * Operator board for live Panelin Front chats.
 */
import { Router } from "express";
import { requireWolfboardRead, requireWolfboardWrite } from "../middleware/requireWolfboardAuth.js";
import {
  listLiveSessions,
  getLiveSession,
  takeoverLiveSession,
  injectLiveMessage,
} from "../lib/voice/storefrontLive.js";

export default function createStorefrontLiveRouter() {
  const router = Router();
  router.get("/", requireWolfboardRead, async (_req, res) => {
    const items = await listLiveSessions();
    return res.json({ ok: true, items });
  });
  router.get("/:id", requireWolfboardRead, async (req, res) => {
    const item = await getLiveSession(req.params.id);
    if (!item) return res.status(404).json({ ok: false, error: "Sesión no encontrada" });
    return res.json({ ok: true, item });
  });
  router.post("/:id/takeover", requireWolfboardWrite, async (req, res) => {
    const item = await takeoverLiveSession(req.params.id);
    return res.json({ ok: true, item });
  });
  router.post("/:id/inject", requireWolfboardWrite, async (req, res) => {
    const out = await injectLiveMessage(req.params.id, req.body?.text);
    if (!out.ok) return res.status(400).json(out);
    return res.json(out);
  });
  return router;
}
