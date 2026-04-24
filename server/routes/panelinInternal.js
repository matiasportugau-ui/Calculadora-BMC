/**
 * Panelin interno — discovery RBAC + catálogo tools (orquestador en app).
 * Montaje: /api/internal/panelin
 */
import { Router } from "express";
import {
  resolveInternalServiceActor,
  canAccessDashboardRoute,
  listDashboardPolicies,
  PANELIN_ROLES,
} from "../lib/panelinInternalRbac.js";
import { PANELIN_INTERNAL_TOOLS } from "../lib/panelinInternalToolCatalog.js";
import { getInternalToolById, mayInvokeTool } from "../lib/panelinInternalInvoke.js";

/**
 * @param {import('../config.js').config} config
 */
export default function createPanelinInternalRouter(config) {
  const router = Router();

  router.use((_req, res, next) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    next();
  });

  function requireServiceAuth(req, res, next) {
    const actor = resolveInternalServiceActor(req, config);
    if (!actor.ok) {
      return res.status(actor.status).json({ ok: false, error: actor.error });
    }
    req.panelinActor = actor;
    next();
  }

  /** Quién soy y qué rutas dashboard podría usar con este rol (preview). */
  router.get("/whoami", requireServiceAuth, (req, res) => {
    const role = req.panelinActor.role;
    const samplePaths = [
      ["GET", "/api/cotizaciones"],
      ["POST", "/api/cotizaciones"],
      ["GET", "/api/proximas-entregas"],
      ["POST", "/api/marcar-entregado"],
      ["GET", "/api/pagos-pendientes"],
      ["POST", "/api/matriz/push-pricing-overrides"],
    ];
    const access = samplePaths.map(([method, path]) => {
      const { allowed, minRole } = canAccessDashboardRoute(method, path, role);
      return { method, path, allowed, min_role: minRole };
    });
    res.json({
      ok: true,
      role,
      roles_defined: [...PANELIN_ROLES],
      dashboard_access_sample: access,
      hint: "Enviar rol con header X-Panelin-Role (ventas|logistica|admin|director). Default: PANELIN_SERVICE_DEFAULT_ROLE o director.",
    });
  });

  /** Catálogo tools HTTP para agentes internos. */
  router.get("/tools", requireServiceAuth, (_req, res) => {
    res.json({
      ok: true,
      schema_version: "1",
      tools: PANELIN_INTERNAL_TOOLS,
      note: "approval_default es la política de producto deseada; la cola de aprobaciones se implementa en Fase 2.",
    });
  });

  /** Lista políticas dashboard (solo servicio autenticado). */
  router.get("/policies", requireServiceAuth, (_req, res) => {
    res.json({
      ok: true,
      policies: listDashboardPolicies(),
    });
  });

  /**
   * Ejecuta un tool del catálogo vía HTTP local (mismo proceso).
   * Body: { tool_id: string, body?: object, query?: Record<string,string> }
   */
  router.post("/invoke", requireServiceAuth, async (req, res) => {
    const toolId = String(req.body?.tool_id || "").trim();
    const tool = getInternalToolById(toolId);
    if (!tool) {
      return res.status(400).json({ ok: false, error: "Unknown or missing tool_id" });
    }
    const perm = mayInvokeTool(req.panelinActor.role, tool);
    if (!perm.ok) {
      return res.status(perm.status).json({ ok: false, error: perm.error });
    }
    const pathOnly = String(tool.path || "");
    if (!pathOnly.startsWith("/calc/") && !pathOnly.startsWith("/api/")) {
      return res.status(500).json({ ok: false, error: "Tool path not allowed" });
    }

    const port = Number(config.port || 3001);
    const base = `http://127.0.0.1:${port}`;
    const u = new URL(pathOnly, base);
    const q = req.body?.query;
    if (q && typeof q === "object" && !Array.isArray(q)) {
      for (const [k, v] of Object.entries(q)) {
        if (v == null || v === "") continue;
        u.searchParams.set(k, String(v));
      }
    }

    /** @type {RequestInit} */
    const init = { method: tool.method, headers: {} };
    const m = String(tool.method || "GET").toUpperCase();
    if (m === "POST" || m === "PUT" || m === "PATCH") {
      init.headers = { "Content-Type": "application/json" };
      init.body = JSON.stringify(req.body?.body ?? {});
    }

    let fr;
    try {
      fr = await fetch(u.toString(), init);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return res.status(502).json({ ok: false, error: `Upstream fetch failed: ${msg}` });
    }

    const ct = fr.headers.get("content-type") || "";
    const maxText = 500_000;
    let payload;
    if (ct.includes("application/json")) {
      try {
        payload = await fr.json();
      } catch {
        const txt = (await fr.text()).slice(0, maxText);
        payload = { _parse: "json_failed", text: txt };
      }
    } else {
      const txt = (await fr.text()).slice(0, maxText);
      payload = { text: txt, content_type: ct };
    }

    return res.status(200).json({
      ok: fr.ok,
      tool_id: tool.id,
      upstream_status: fr.status,
      content_type: ct || null,
      data: payload,
    });
  });

  return router;
}
