// ═══════════════════════════════════════════════════════════════════════════
// server/routes/skills.js — discovery surface for the repo's SKILL.md catalogue.
// ───────────────────────────────────────────────────────────────────────────
//   GET /api/skills           list skill metadata (name/description/source)
//   GET /api/skills/:id       one skill's metadata + full markdown body
//
// Query params on the list route:
//   ?source=cursor|claude|agents   filter by skill root
//   ?q=<text>                      substring search over id + name + desc
//
// Auth: gated by requireServiceOrUser({ authOnly: true }) — the static
// API_AUTH_TOKEN (operators/CI/agents) OR any valid identity JWT. Skill bodies
// are internal team playbooks, so anonymous public access is closed. See the
// middleware header for the "close public exposure, allow authed cohorts" note.
// ═══════════════════════════════════════════════════════════════════════════

import express from "express";
import { requireServiceOrUser } from "../middleware/requireServiceOrUser.js";
import { listSkills, getSkill } from "../lib/skillsCatalog.js";
import { safeErr } from "../lib/safeErr.js";

const router = express.Router();

// Skill ids are folder names; keep the whitelist tight (defense in depth on top
// of the catalogue-map lookup, which already blocks path traversal).
const ID_RE = /^[A-Za-z0-9._-]+$/;
const VALID_SOURCES = new Set(["cursor", "claude", "agents"]);

router.get("/api/skills", requireServiceOrUser({ authOnly: true }), (req, res) => {
  try {
    const source = req.query.source ? String(req.query.source) : undefined;
    if (source && !VALID_SOURCES.has(source)) {
      return res.status(400).json({ ok: false, error: "invalid_source" });
    }
    const q = req.query.q ? String(req.query.q).slice(0, 200) : undefined;
    const skills = listSkills({ source, q });
    res.json({ ok: true, count: skills.length, skills });
  } catch (e) {
    res.status(500).json({ ok: false, error: safeErr(e) });
  }
});

router.get("/api/skills/:id", requireServiceOrUser({ authOnly: true }), (req, res) => {
  try {
    const id = String(req.params.id || "");
    if (!ID_RE.test(id)) {
      return res.status(400).json({ ok: false, error: "invalid_skill_id" });
    }
    const skill = getSkill(id);
    if (!skill) return res.status(404).json({ ok: false, error: "skill_not_found" });
    res.json({ ok: true, skill });
  } catch (e) {
    res.status(500).json({ ok: false, error: safeErr(e) });
  }
});

export default router;
