// ═══════════════════════════════════════════════════════════════════════════
// server/routes/planCad.js
// POST /api/plan/cad — geometría (footprint corregido por el operador) → CAD.
//
// Cuerpo: { footprint: [[x,y],...] (m, Y-up), wallThickness?, title?, format? }
//   format = "json" (default) → { ok, dxf, svg, areaM2, bbox }
//   format = "dxf"           → descarga archivo .dxf (text/plain)
//   format = "svg"           → descarga archivo .svg (image/svg+xml)
//
// El interpreter (POST /api/plan/interpret) produce las medidas; el operador las
// corrige y arma el footprint; este endpoint genera los entregables CAD.
// ═══════════════════════════════════════════════════════════════════════════

import { Router } from "express";
import rateLimit from "express-rate-limit";
import { buildPlanGeometry } from "../lib/cad/planGeometry.js";
import { geometryToDxf } from "../lib/cad/dxfExport.js";
import { geometryToSvg } from "../lib/cad/svgExport.js";

const router = Router();

const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Demasiadas solicitudes. Intentá de nuevo más tarde." },
});

function slug(s) {
  return String(s || "plano").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "plano";
}

router.post("/plan/cad", limiter, async (req, res) => {
  try {
    const { footprint, wallThickness, rooms, openings, scale, title, format = "json" } = req.body || {};
    const geom = buildPlanGeometry({ footprint, wallThickness, rooms, openings, scale, title });
    const name = slug(title?.titulo);

    if (format === "dxf") {
      const dxf = geometryToDxf(geom);
      res.setHeader("Content-Type", "application/dxf; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${name}.dxf"`);
      return res.send(dxf);
    }
    if (format === "svg") {
      const svg = geometryToSvg(geom);
      res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${name}.svg"`);
      return res.send(svg);
    }

    return res.json({
      ok: true,
      areaM2: geom.areaM2,
      bbox: geom.bbox,
      dxf: geometryToDxf(geom),
      svg: geometryToSvg(geom),
    });
  } catch (err) {
    const status = err.status || 500;
    if (req.log) req.log.warn({ err }, "plan/cad error");
    return res.status(status).json({ ok: false, error: err.message || "Error generando CAD" });
  }
});

export default router;
