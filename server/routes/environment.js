/**
 * GET /api/environment — IMP-PEA-10
 */
import { Router } from "express";
import { getEnvironmentInfo } from "../lib/pea/stagingGuard.js";

/**
 * @param {import('../config.js').config} config
 */
export default function createEnvironmentRouter(config) {
  const router = Router();
  router.get("/environment", (_req, res) => {
    res.json(getEnvironmentInfo(config));
  });
  return router;
}
