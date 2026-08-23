/**
 * WA Coexistence onboarding — rutas /api/wa/onboarding/* (montar con app.use("/api", router)).
 *
 * Self-service "conectar número" desde /hub/wa vía Embedded Signup (Meta oficial).
 * Todas las rutas requieren auth (Bearer / X-Api-Key, igual que el cockpit) y el flag
 * config.waCoexistenceEnabled; con el flag OFF responden 404 (feature no existe).
 *
 * La lógica Graph + persistencia vive en ../lib/wa/waOnboarding.js (testeable offline).
 */
import { Router } from "express";
import { getWaPool } from "../lib/waDb.js";
import { onboardNumber } from "../lib/wa/waOnboarding.js";
import {
  listConnections,
  disableConnection,
} from "../lib/wa/waConnectionStore.js";

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function requireWaAuth(config) {
  return (req, res, next) => {
    const token = config.apiAuthToken;
    if (!token) {
      return res.status(503).json({
        ok: false,
        code: "ENV_MISSING",
        envVar: "API_AUTH_TOKEN",
        error: "API_AUTH_TOKEN not configured — wa cockpit disabled",
      });
    }
    const auth = String(req.headers.authorization || "");
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    // Header-only auth: no ?key= query fallback (credentials in URLs leak via logs/referrers).
    const xKey = String(req.headers["x-api-key"] || "");
    if (bearer === token || xKey === token) {
      req.waOperatorId = String(req.headers["x-operator-id"] || "").slice(0, 64).trim() || null;
      return next();
    }
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  };
}

/**
 * @param {import("../config.js").config} config
 * @param {import("pino").Logger} [logger]
 */
export default function createWaOnboardingRouter(config, logger) {
  const router = Router();
  const pool = getWaPool(config.databaseUrl);
  const log = logger || console;
  const auth = requireWaAuth(config);

  // Gate: con el flag OFF, la feature no existe.
  function requireFlag(_req, res, next) {
    if (!config.waCoexistenceEnabled) {
      return res.status(404).json({ ok: false, error: "wa coexistence onboarding disabled" });
    }
    return next();
  }
  function requireDb(_req, res, next) {
    if (!pool) return res.status(503).json({ ok: false, error: "DATABASE_URL not configured" });
    return next();
  }

  // Config no-secreta para inicializar el SDK en el frontend (sin rebuild).
  router.get("/wa/onboarding/config", auth, requireFlag, (_req, res) => {
    res.json({
      enabled: true,
      appId: config.metaAppId || "",
      configId: config.metaEsConfigId || "",
      graphVersion: config.graphApiVersion || "v21.0",
    });
  });

  // Intercambio: code (Embedded Signup) → token → suscribir/registrar → persistir.
  router.post(
    "/wa/onboarding/exchange",
    auth,
    requireFlag,
    requireDb,
    asyncHandler(async (req, res) => {
      const code = String(req.body?.code || "").trim();
      const phoneNumberId = String(req.body?.phoneNumberId || req.body?.phone_number_id || "").trim();
      const wabaId = String(req.body?.wabaId || req.body?.waba_id || "").trim() || null;
      if (!code) return res.status(400).json({ ok: false, error: "code required" });
      if (!phoneNumberId) return res.status(400).json({ ok: false, error: "phoneNumberId required" });
      if (!config.tokenEncryptionKey) {
        return res.status(503).json({
          ok: false,
          code: "ENV_MISSING",
          envVar: "TOKEN_ENCRYPTION_KEY",
          error: "TOKEN_ENCRYPTION_KEY not configured — cannot persist connection securely",
        });
      }
      try {
        const connection = await onboardNumber({
          code,
          phoneNumberId,
          wabaId,
          config,
          pool,
          connectedBy: req.waOperatorId,
          logger: log,
        });
        return res.json({ ok: true, connection });
      } catch (e) {
        log.error?.({ err: e?.message }, "wa onboarding exchange failed");
        return res.status(502).json({ ok: false, error: e?.message || "onboarding failed" });
      }
    }),
  );

  // Lista de números conectados (metadata, nunca el token).
  router.get(
    "/wa/onboarding/connections",
    auth,
    requireFlag,
    requireDb,
    asyncHandler(async (_req, res) => {
      const connections = await listConnections(pool);
      res.json({ ok: true, connections });
    }),
  );

  // Desconectar (marca inactivo).
  router.delete(
    "/wa/onboarding/connections/:phoneNumberId",
    auth,
    requireFlag,
    requireDb,
    asyncHandler(async (req, res) => {
      const ok = await disableConnection(pool, String(req.params.phoneNumberId || "").trim());
      if (!ok) return res.status(404).json({ ok: false, error: "connection not found or already inactive" });
      res.json({ ok: true });
    }),
  );

  return router;
}
