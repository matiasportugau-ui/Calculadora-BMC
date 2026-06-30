// ═══════════════════════════════════════════════════════════════════════════
// server/routes/driveConfig.js — per-user Google Drive destination folder.
// ───────────────────────────────────────────────────────────────────────────
//   GET  /api/drive/config   read the authed user's configured Drive folder
//   POST /api/drive/config   upsert { folderId, folderName, valid }
//
// Folder selection + write-permission validation happen client-side (in-app
// Drive-API folder browser + the user's own drive.file OAuth token); the server
// only persists the resulting reference. The server holds no per-user Google
// token, so it never touches Drive here. See SPEC §8 + docs/team/PROJECT-STATE.md.
// ═══════════════════════════════════════════════════════════════════════════

import express from "express";
import { getWaPool } from "../lib/waDb.js";
import { config } from "../config.js";
import { requireUser } from "../lib/identityAuth.js";
import { safeErr as _safeErr } from "../lib/safeErr.js";

const router = express.Router();

let _testPool = null;
function pool() {
  if (_testPool) return _testPool;
  const p = getWaPool(config.databaseUrl);
  if (!p) throw Object.assign(new Error("db_unavailable"), { status: 503 });
  return p;
}

/** Test-only — inject the same in-memory shim used by quoteStore + identityAuth. */
export const __test__ = {
  setPool(p) { _testPool = p; },
  reset() { _testPool = null; },
};

/** Shape the DB row into the camelCase contract the frontend expects. */
function toConfig(row) {
  if (!row) return null;
  return {
    folderId: row.folder_id || null,
    folderName: row.folder_name || null,
    valid: !!row.valid,
    configuredAt: row.configured_at || null,
    lastValidatedAt: row.last_validated_at || null,
  };
}

// ─── Read ──────────────────────────────────────────────────────────────────

router.get("/api/drive/config", requireUser(), async (req, res) => {
  try {
    const { rows } = await pool().query(
      `select folder_id, folder_name, valid, configured_at, last_validated_at
         from identity.user_drive_config
        where user_id = $1`,
      [req.user.id],
    );
    res.json({ ok: true, config: toConfig(rows[0]) });
  } catch (e) {
    // Migration not yet applied (relation absent): degrade to "no config" so the
    // Drive tab still opens. Safety net for the deploy-before-migrate window.
    if (e?.code === "42P01") return res.json({ ok: true, config: null });
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

// ─── Upsert ────────────────────────────────────────────────────────────────

router.post("/api/drive/config", requireUser(), async (req, res) => {
  try {
    const folderId = String(req.body?.folderId || "").trim();
    const folderName = String(req.body?.folderName || "").trim();
    const valid = req.body?.valid !== false; // default true; client validates before POST
    if (!folderId || !folderName) {
      return res.status(400).json({ ok: false, error: "folderId_and_folderName_required" });
    }
    const { rows } = await pool().query(
      `insert into identity.user_drive_config
         (user_id, email, folder_id, folder_name, valid, configured_at, last_validated_at)
       values ($1, $2, $3, $4, $5, now(), now())
       on conflict (user_id) do update
         set email             = excluded.email,
             folder_id         = excluded.folder_id,
             folder_name       = excluded.folder_name,
             valid             = excluded.valid,
             configured_at     = now(),
             last_validated_at = now()
       returning folder_id, folder_name, valid, configured_at, last_validated_at`,
      [req.user.id, req.user.email, folderId, folderName, valid],
    );
    res.json({ ok: true, config: toConfig(rows[0]) });
  } catch (e) {
    if (e?.code === "42P01") {
      return res.status(503).json({ ok: false, error: "drive_config_unavailable" });
    }
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

export default router;
