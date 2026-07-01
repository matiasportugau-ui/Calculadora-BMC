/**
 * /api/assistants/status — AI Assistant control-plane status.
 *
 * Aggregates every assistant's enabled/health state + provider availability into
 * one payload, so "are all assistants live?" is a single call instead of hitting
 * five per-channel health endpoints. Backs the /hub/admin/assistants panel and is
 * safe to poll (results cached ~30s in assistantHealth.js).
 *
 * Auth: admin user JWT OR static API token (requireServiceOrUser({role:"admin"})),
 * matching the other admin-analytics surfaces.
 *
 * Query:
 *   ?deep=1  → bypasses the health cache (still key-presence for providers; there
 *              is no live provider ping to keep it token-free).
 *
 * Mounted in server/index.js: app.use("/api", createAssistantsStatusRouter())
 */
import { Router } from "express";
import { requireServiceOrUser } from "../middleware/requireServiceOrUser.js";
import { checkAllAssistants, checkAssistant } from "../lib/assistantHealth.js";

export default function createAssistantsStatusRouter() {
  const router = Router();
  const guard = requireServiceOrUser({ role: "admin" });

  router.get("/assistants/status", guard, async (req, res) => {
    try {
      const force = /^(1|true|yes)$/i.test(String(req.query.deep || ""));
      const payload = await checkAllAssistants({ force });
      res.json({ ok: true, ...payload });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err?.message || err).slice(0, 200) });
    }
  });

  router.get("/assistants/status/:key", guard, async (req, res) => {
    try {
      const force = /^(1|true|yes)$/i.test(String(req.query.deep || ""));
      const one = await checkAssistant(req.params.key, { force });
      res.json({ ok: true, assistant: one });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err?.message || err).slice(0, 200) });
    }
  });

  return router;
}
