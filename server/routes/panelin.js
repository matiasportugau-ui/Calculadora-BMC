import { Router } from "express";
import { subscribePanelinEventType, emitPanelinEvent } from "../lib/panelinEvents.js";
import { publishForSku } from "../../scripts/publish-panelin-to-shopify.mjs";

/**
 * Public Panelin surfaces (operator dashboard realtime + PIM publish worker).
 * Mounted at /api/panelin with requireServiceOrUser() guard (see index.js).
 *
 * Provides:
 *   - GET /events (SSE) for stock.movement, invoice.upserted, product.* events (Fase 6 realtime)
 *   - Outbound publish worker (direct subscribe + call to publishForSku when ENABLE_PUBLISH_WORKER=1)
 *   - Stubs and debug hooks for products/stock/sync (expand in later PIM phases)
 *
 * The worker uses **direct import + await** of publishForSku (no child_process/exec).
 * Safety: everything best-effort; never blocks main request paths.
 */

const ENABLE_PUBLISH_WORKER = process.env.ENABLE_PUBLISH_WORKER === "1" || process.env.ENABLE_PUBLISH_WORKER === "true";
const PUBLISH_WRITE_DEFAULT = process.env.PUBLISH_WRITE === "1";

export default function createPanelinRouter(config) {
  const router = Router();

  router.use((_req, res, next) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    next();
  });

  // Lightweight health for the surface
  router.get("/health", (_req, res) => {
    res.json({ ok: true, workerEnabled: ENABLE_PUBLISH_WORKER });
  });

  // SSE endpoint (text/event-stream). Heartbeats + typed events + generic.
  // Clients: PanelinHubPanel (native EventSource), standalone dashboard, future pages.
  router.get("/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");

    const send = (event, data) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    res.write(": connected\n\n");
    send("open", { ts: Date.now() });

    const heartbeat = setInterval(() => {
      res.write(": hb\n\n");
    }, 20000);

    const unsubAll = subscribePanelinEvents((env) => {
      try {
        if (env && env.type) {
          send(env.type, env.payload || env);
        } else {
          send("event", env);
        }
      } catch (e) {
        // best-effort
      }
    });

    const unsubTyped = [
      subscribePanelinEventType("stock.movement", (p) => send("stock.movement", p)),
      subscribePanelinEventType("invoice.upserted", (p) => send("invoice.upserted", p)),
      subscribePanelinEventType("product.price.updated", (p) => send("product.price.updated", p)),
      subscribePanelinEventType("product.stock.updated", (p) => send("product.stock.updated", p)),
      subscribePanelinEventType("product.published", (p) => send("product.published", p)),
    ];

    req.on("close", () => {
      clearInterval(heartbeat);
      unsubAll();
      unsubTyped.forEach((u) => u && u());
    });
  });

  // Outbound publish worker (direct call, not exec).
  // Triggered by stock movements (and future product.* events) from webhooks / sync / collector.
  if (ENABLE_PUBLISH_WORKER) {
    // Direct import + subscribe (no shell).
    // "Direct call (not exec)" — see publish-panelin-to-shopify.mjs export.
    subscribePanelinEventType("stock.movement", async (payload) => {
      try {
        const sku = payload?.sku || payload?.item?.sku;
        if (!sku) return;
        const report = await publishForSku(sku, {
          write: PUBLISH_WRITE_DEFAULT,
        });
        emitPanelinEvent("product.published", {
          sku,
          channel: "shopify",
          kind: "stock-driven",
          reportPath: report?.reportPath?.json || null,
          dry: !PUBLISH_WRITE_DEFAULT,
        });
        console.log("[publish-worker] stock.movement -> publishForSku", { sku, summary: report?.summary });
      } catch (e) {
        console.warn("[publish-worker] error (best-effort)", e?.message || e);
      }
    });

    subscribePanelinEventType("product.updated", async (payload) => {
      try {
        const sku = payload?.sku;
        if (!sku) return;
        const report = await publishForSku(sku, { write: PUBLISH_WRITE_DEFAULT });
        console.log("[publish-worker] product.updated -> publishForSku", { sku, summary: report?.summary });
      } catch (e) {
        console.warn("[publish-worker] product.updated error (best-effort)", e?.message || e);
      }
    });

    console.log("[panelin] ENABLE_PUBLISH_WORKER=1 — outbound worker subscribed (direct publishForSku)");
  }

  // Minimal products stub (expand later for full dashboard surface / PIM editor)
  router.get("/products", (_req, res) => {
    res.json({ ok: true, note: "Panelin products surface — collector + rich PATCH coming in PIM phases. Use /api/panelin/events for realtime." });
  });

  // Example emit point for manual testing of the worker / SSE
  router.post("/_debug/emit", (req, res) => {
    const { type = "stock.movement", payload = {} } = req.body || {};
    emitPanelinEvent(type, payload);
    res.json({ ok: true, emitted: type });
  });

  // ── Cashflow Projection (mock API — Sheets mapper follow-up) ─────────────
  router.get("/cashflow-init", async (_req, res) => {
    try {
      const { getCashflowStateForApi } = await import("../lib/cashflowMockState.js");
      res.json(getCashflowStateForApi());
    } catch (e) {
      res.status(500).json({ ok: false, error: e?.message || "cashflow_init_failed" });
    }
  });

  router.patch("/vencimientos", async (req, res) => {
    try {
      const { transactionId, newDate } = req.body || {};
      if (!transactionId || !newDate) {
        return res.status(400).json({ ok: false, error: "missing_transactionId_or_newDate" });
      }
      const { patchVencimientoDate } = await import("../lib/cashflowMockState.js");
      const result = patchVencimientoDate(String(transactionId), String(newDate));
      if (!result.ok) {
        return res.status(result.status).json({ ok: false, error: result.error });
      }
      res.json({ ok: true, transactionId: result.transactionId, newDate: result.newDate });
    } catch (e) {
      res.status(500).json({ ok: false, error: e?.message || "patch_failed" });
    }
  });

  return router;
}
