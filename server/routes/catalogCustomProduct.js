/**
 * POST /api/catalog/custom-product
 * Operator added a product outside the matrix (Extraordinarios).
 * Soft-auth, fail-open logging for developers. Never blocks the quote.
 */
import { Router } from "express";

export function createCatalogCustomProductRouter(config, logger) {
  const router = Router();

  router.post("/catalog/custom-product", (req, res) => {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const titulo = String(body.titulo || "").trim().slice(0, 200);
    if (!titulo) {
      return res.status(400).json({ ok: false, error: "titulo requerido" });
    }
    const record = {
      event: "catalog_custom_product",
      titulo,
      descripcion: String(body.descripcion || "").trim().slice(0, 2000),
      unidades: String(body.unidades || "").trim().slice(0, 40),
      precio: body.precio ?? "",
      cantidad: body.cantidad ?? "",
      quotationCode: body.quotationCode || null,
      viewport: body.viewport || null,
      user: req.user?.email || req.user?.sub || null,
    };
    (logger || req.log || console).info(record, "catalog_custom_product");
    return res.status(202).json({ ok: true, notified: true });
  });

  return router;
}

export default createCatalogCustomProductRouter;
