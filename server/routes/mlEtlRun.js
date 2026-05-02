// ═══════════════════════════════════════════════════════════════════════════
// /api/ml/etl-run — Trigger / status del Price Monitor ETL
// ───────────────────────────────────────────────────────────────────────────
// Endpoints:
//   POST /api/ml/etl-run           — dispara scripts/price-monitor-etl.mjs
//                                    en background, devuelve { ok, run_id }
//                                    inmediatamente.
//   GET  /api/ml/etl-run/latest    — última corrida (status, contadores).
//   GET  /api/ml/etl-run/:id       — corrida específica.
//
// Auth: Bearer API_AUTH_TOKEN (mismo que /api/ml/search).
//
// Diseño:
//   - El trigger usa child_process.spawn — no bloquea el HTTP request.
//   - Lectura de status va a Supabase REST API directamente; no necesita
//     levantar el script (rápido y seguro).
// ═══════════════════════════════════════════════════════════════════════════

import { Router } from "express";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requireAuth } from "../middleware/requireAuth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ETL_SCRIPT = path.resolve(__dirname, "..", "..", "scripts", "price-monitor-etl.mjs");

const asyncHandler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Factory returning an Express Router with /api/ml/etl-run endpoints.
 *
 * @param {Object} deps
 * @param {Object} deps.config  — server/config.js singleton
 * @param {Object} [deps.logger]
 */
export default function createMlEtlRunRouter({ config, logger }) {
  const router = Router();

  // Compose Supabase REST headers from config / env.
  const sbHeaders = () => {
    const url = process.env.SUPABASE_URL || "";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!url || !key) {
      return { url: null, key: null };
    }
    return {
      url: url.replace(/\/$/, ""),
      key,
    };
  };

  async function sbGet(pathAndQuery) {
    const { url, key } = sbHeaders();
    if (!url || !key) {
      const err = new Error("Supabase not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
      err.status = 503;
      throw err;
    }
    const res = await fetch(`${url}/rest/v1/${pathAndQuery.replace(/^\//, "")}`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10_000),
    });
    const text = await res.text();
    let body = null;
    if (text) {
      try { body = JSON.parse(text); } catch { body = { raw: text }; }
    }
    if (!res.ok) {
      const err = new Error(`Supabase ${res.status}: ${text.slice(0, 200)}`);
      err.status = res.status;
      throw err;
    }
    return body;
  }

  // ── POST /api/ml/etl-run — fire-and-forget child process ─────────────────
  router.post(
    "/api/ml/etl-run",
    requireAuth,
    asyncHandler(async (req, res) => {
      const { url } = sbHeaders();
      if (!url) {
        return res.status(503).json({
          ok: false,
          error: "Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
        });
      }

      // Forward the same env to the child so it can call our own API.
      const child = spawn(process.execPath, [ETL_SCRIPT], {
        env: {
          ...process.env,
          // Make the child use loopback to talk to ourselves regardless of host.
          BMC_API_BASE: process.env.BMC_API_BASE || `http://127.0.0.1:${config.port || 3001}`,
        },
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
      });

      // Capture first stdout line to extract run_id (the script logs JSON lines).
      let resolved = false;
      let runId = null;

      child.stdout?.on("data", (buf) => {
        const lines = String(buf).split("\n").filter(Boolean);
        for (const line of lines) {
          try {
            const j = JSON.parse(line);
            if (j.msg === "etl_run_open" && j.runId) {
              runId = j.runId;
              if (!resolved) {
                resolved = true;
                res.json({ ok: true, run_id: runId, status: "running" });
              }
            }
          } catch { /* not JSON, ignore */ }
        }
      });
      child.stderr?.on("data", (buf) => {
        if (logger?.warn) logger.warn({ msg: "etl_stderr", chunk: String(buf).slice(0, 500) }, "etl");
      });
      child.on("error", (err) => {
        if (!resolved) {
          resolved = true;
          res.status(500).json({ ok: false, error: String(err) });
        }
      });
      child.on("exit", (code) => {
        if (!resolved) {
          resolved = true;
          res.json({
            ok: code === 0,
            run_id: runId,
            status: code === 0 ? "completed_inline" : "failed",
            exit_code: code,
          });
        }
      });

      // Detach so child survives the request (Cloud Run instance permitting).
      child.unref();

      // Safety net — if no run_id seen in 10s, respond with synthetic ack.
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          res.json({ ok: true, run_id: null, status: "started_no_id_yet" });
        }
      }, 10_000);
    }),
  );

  // ── GET /api/ml/etl-run/latest ───────────────────────────────────────────
  router.get(
    "/api/ml/etl-run/latest",
    requireAuth,
    asyncHandler(async (req, res) => {
      const rows = await sbGet(
        "bmc_price_monitor.etl_runs?select=*&order=started_at.desc&limit=1",
      );
      res.json({ ok: true, run: Array.isArray(rows) && rows[0] ? rows[0] : null });
    }),
  );

  // ── GET /api/ml/etl-run/:id ──────────────────────────────────────────────
  router.get(
    "/api/ml/etl-run/:id",
    requireAuth,
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ ok: false, error: "id must be numeric" });
      }
      const rows = await sbGet(
        `bmc_price_monitor.etl_runs?select=*&id=eq.${id}&limit=1`,
      );
      const run = Array.isArray(rows) && rows[0] ? rows[0] : null;
      if (!run) return res.status(404).json({ ok: false, error: "run not found" });
      res.json({ ok: true, run });
    }),
  );

  return router;
}
