// ═══════════════════════════════════════════════════════════════════════════
// server/routes/quotes.js — Quote counter API
// GET /api/quotes/counter — read current counter (no increment)
// POST /api/quotes/counter/next — atomic increment, return new counter
// ═══════════════════════════════════════════════════════════════════════════

import { Router } from "express";
import { getQuoteCounterPool } from "../lib/quoteCounterDb.js";

function uruguayYear() {
  return parseInt(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Montevideo",
      year: "numeric",
    }).format(new Date()),
    10
  );
}

export function createQuotesRouter(config) {
  const router = Router();

  // GET /api/quotes/counter — read current seq (no increment, for display)
  router.get("/quotes/counter", async (req, res) => {
    try {
      const pool = getQuoteCounterPool(config.databaseUrl);
      if (!pool) {
        return res.status(503).json({ ok: false, error: "database_unavailable" });
      }
      const year = uruguayYear();
      const { rows } = await pool.query(
        "select seq from bmc_quote_counter where year = $1",
        [year]
      );
      const seq = rows[0]?.seq ?? 0;
      return res.json({
        ok: true,
        counter: seq,
        code: `BMC-${year}-${String(seq).padStart(4, "0")}`,
        year,
      });
    } catch (err) {
      console.error("[quotes.js GET /counter]", err?.message);
      return res.status(500).json({ ok: false, error: "query_failed" });
    }
  });

  // POST /api/quotes/counter/next — atomic increment, return new counter
  router.post("/quotes/counter/next", async (req, res) => {
    try {
      const pool = getQuoteCounterPool(config.databaseUrl);
      if (!pool) {
        return res.status(503).json({ ok: false, error: "database_unavailable" });
      }
      const year = uruguayYear();
      const { rows } = await pool.query(
        `insert into bmc_quote_counter (year, seq)
         values ($1, 1)
         on conflict (year)
         do update set seq = bmc_quote_counter.seq + 1, updated_at = now()
         returning seq, year`,
        [year]
      );
      const { seq, year: retYear } = rows[0];
      return res.json({
        ok: true,
        counter: seq,
        code: `BMC-${retYear}-${String(seq).padStart(4, "0")}`,
        year: retYear,
      });
    } catch (err) {
      console.error("[quotes.js POST /counter/next]", err?.message);
      return res.status(500).json({ ok: false, error: "increment_failed" });
    }
  });

  return router;
}
