import { Router } from "express";
import { config } from "../config.js";
import { saveFeedback, loadRecentFeedback, getFeedbackStats } from "../lib/responseFeedback.js";

const router = Router();

function requireAuth(req, res, next) {
  const token = config.apiAuthToken;
  if (!token) return res.status(503).json({ ok: false, error: "API_AUTH_TOKEN not configured" });
  const bearer = String(req.headers.authorization || "").replace(/^Bearer /, "").trim();
  const xKey = String(req.headers["x-api-key"] || req.query?.key || "");
  if (bearer === token || xKey === token) return next();
  return res.status(401).json({ ok: false, error: "Unauthorized" });
}

// Public endpoint — no auth required (chat users are not authenticated)
router.post("/agent/feedback", (req, res) => {
  try {
    const { channel, question, generatedText, rating, correction, comment, convId, rowId } = req.body || {};
    if (!channel || !question || !generatedText || !rating) {
      return res.status(400).json({ ok: false, error: "channel, question, generatedText, rating required" });
    }
    if (!["good", "bad", "edit"].includes(rating)) {
      return res.status(400).json({ ok: false, error: "rating must be good|bad|edit" });
    }
    if (rating === "edit" && !correction?.trim()) {
      return res.status(400).json({ ok: false, error: "correction required for rating=edit" });
    }
    const result = saveFeedback({ channel, question, generatedText, rating, correction, comment, convId, rowId });
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

// Admin endpoints — auth required
router.get("/agent/feedback", requireAuth, (req, res) => {
  try {
    const days = Math.min(Number(req.query.days) || 7, 90);
    const channel = req.query.channel || null;
    let events = loadRecentFeedback({ days });
    if (channel) events = events.filter((e) => e.channel === channel);
    res.json({ ok: true, total: events.length, events });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

router.get("/agent/feedback/stats", requireAuth, (req, res) => {
  try {
    const days = Math.min(Number(req.query.days) || 30, 90);
    res.json({ ok: true, ...getFeedbackStats({ days }) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

export default router;
