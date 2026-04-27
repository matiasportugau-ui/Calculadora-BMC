import { Router } from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { interpretPlan } from "../lib/planInterpreter.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10_000_000 },
});

const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Demasiadas solicitudes. Intentá de nuevo en una hora." },
});

const ALLOWED_MIMES = new Set([
  "image/jpeg", "image/png", "image/webp",
  "application/pdf",
]);
const ALLOWED_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".pdf", ".dxf"]);

router.post("/plan/interpret", limiter, upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ ok: false, error: "No se recibió ningún archivo." });
  }

  const ext = (file.originalname || "").toLowerCase().match(/\.[^.]+$/)?.[0] || "";
  const isDxf = ext === ".dxf";
  const isDwg = ext === ".dwg";

  if (isDwg) {
    return res.status(400).json({
      ok: false,
      error: "Formato DWG no soportado directamente. Exportá el archivo a DXF desde AutoCAD: Archivo → Guardar como → AutoCAD DXF.",
    });
  }

  if (!isDxf && !ALLOWED_MIMES.has(file.mimetype) && !ALLOWED_EXTS.has(ext)) {
    return res.status(400).json({
      ok: false,
      error: "Tipo de archivo no soportado. Usá JPG, PNG, PDF o DXF.",
    });
  }

  let hints = {};
  if (req.body.hints) {
    try {
      hints = JSON.parse(req.body.hints);
    } catch {
      return res.status(400).json({ ok: false, error: "El campo 'hints' debe ser JSON válido." });
    }
  }

  try {
    const mimeType = isDxf ? "text/plain" : file.mimetype;
    const result = await interpretPlan(file.buffer, mimeType, file.originalname);

    if (hints.familia && result.bmcPayload?.techo) {
      result.bmcPayload.techo.familia = hints.familia;
      result.gaps = result.gaps.filter(g => g !== "familia");
    }
    if (hints.espesor && result.bmcPayload?.techo) {
      result.bmcPayload.techo.espesor = String(hints.espesor);
      result.gaps = result.gaps.filter(g => g !== "espesor");
    }
    if (hints.familia && result.bmcPayload?.pared) {
      result.bmcPayload.pared.familia = hints.familia;
    }
    if (hints.espesor && result.bmcPayload?.pared) {
      result.bmcPayload.pared.espesor = String(hints.espesor);
    }
    if (hints.escenario) {
      result.bmcPayload.scenario = hints.escenario;
      result.gaps = result.gaps.filter(g => g !== "scenario");
    }

    result.ok = result.gaps.length === 0;
    return res.json(result);
  } catch (err) {
    const status = err.status || 500;
    req.log?.error(err, "plan/interpret error");
    return res.status(status).json({ ok: false, error: err.message });
  }
});

export default router;
