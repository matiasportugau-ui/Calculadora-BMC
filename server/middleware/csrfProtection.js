/**
 * CSRF (CWE-352) — verificación de procedencia + double-submit cookie.
 *
 * Contexto de arquitectura: los JWT de acceso viajan SOLO por
 * `Authorization: Bearer` (server/lib/identityAuth.js), inmunes a CSRF. Las
 * únicas rutas autenticadas por cookie son POST /auth/refresh y
 * POST /auth/logout (cookie httpOnly + SameSite=Strict, rate-limited). Este
 * middleware agrega la capa explícita (CodeQL js/missing-token-validation) con
 * dos mecanismos complementarios:
 *
 *  1. Verificación de origen (OWASP para SPAs): para métodos inseguros CON
 *     cookies se exige `Sec-Fetch-Site: same-origin|same-site|none`, u
 *     `Origin`/`Referer` dentro de config.corsOrigins (o chrome-extension://,
 *     espejo del CORS), o un header custom (`X-Requested-With`) que fuerza
 *     preflight CORS — solo aprobado para orígenes permitidos.
 *  2. Double-submit cookie: se emite una cookie legible `bmc_csrf` (random,
 *     no-httpOnly) que el cliente puede reflejar en `X-CSRF-Token`.
 *
 * Precedencia deliberada: la procedencia confiable (same-origin/same-site u
 * Origin permitido) pasa PRIMERO — un atacante no puede falsificar Origin
 * desde su sitio, y rechazar a un usuario legítimo de origen confiable por
 * un token rotado en otra pestaña sería un 403 gratuito. El double-submit
 * gobierna solo los requests SIN procedencia confiable: ahí, si cookie y
 * header están presentes se exige igualdad (mismatch → 403 aunque haya otros
 * headers); un header de token sin cookie gemela vale como señal de preflight
 * igual que X-Requested-With.
 *
 *  - Métodos seguros (GET/HEAD/OPTIONS) y requests SIN cookies pasan intactos
 *    (Bearer puro, webhooks HMAC, curl, health checks).
 *  - Requests con cookies pero sin ningún header de navegador (ni Origin, ni
 *    Referer, ni Sec-Fetch-Site) se asumen no-browser y pasan: los ataques
 *    CSRF provienen de navegadores, que siempre mandan Origin en POST cross-site.
 */
import crypto from "node:crypto";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const SAME_SITE_OK = new Set(["same-origin", "same-site", "none"]);
export const CSRF_COOKIE_NAME = "bmc_csrf";

/** Igualdad estricta del token double-submit (cookie ↔ header). */
function checkCsrfTokens(cookieToken, headerToken) {
  return (
    typeof cookieToken === "string" &&
    cookieToken.length >= 16 &&
    cookieToken === headerToken
  );
}

/**
 * @param {import("../config.js").config} config
 * @param {import("pino").Logger} [logger]
 */
export default function createCsrfProtection(config, logger) {
  const isProd = config.appEnv === "production";

  return function csrfProtection(req, res, next) {
    // Emitir la cookie double-submit si falta (legible por el SPA, que puede
    // reflejarla en X-CSRF-Token; su ausencia no bloquea — ver señales abajo).
    // Literales "bmc_csrf" a propósito: CodeQL solo resuelve nombres estáticos.
    const cookieToken = req.cookies?.["bmc_csrf"];
    if (req.cookies && !cookieToken) {
      res.cookie("bmc_csrf", crypto.randomBytes(16).toString("hex"), {
        httpOnly: false,
        secure: isProd,
        sameSite: "lax",
        path: "/",
      });
    }

    if (!UNSAFE_METHODS.has(req.method)) return next();
    if (!req.headers.cookie) return next();

    const fetchSite = req.headers["sec-fetch-site"];
    if (fetchSite && SAME_SITE_OK.has(fetchSite)) return next();

    let origin = req.headers.origin || null;
    if (!origin && req.headers.referer) {
      try {
        origin = new URL(req.headers.referer).origin;
      } catch {
        origin = null;
      }
    }
    if (origin && (config.corsOrigins.includes(origin) || origin.startsWith("chrome-extension://"))) {
      return next();
    }

    const headerToken = req.headers["x-csrf-token"] || req.headers["x-xsrf-token"];
    if (cookieToken && headerToken) {
      if (checkCsrfTokens(cookieToken, headerToken)) return next();
      logger?.warn?.(
        { method: req.method, path: req.path, origin, fetchSite },
        "[csrf] token double-submit no coincide",
      );
      return res.status(403).json({ ok: false, error: "csrf_token_mismatch" });
    }
    // Header custom sin cookie gemela: fuerza preflight CORS (solo orígenes permitidos).
    if (headerToken || req.headers["x-requested-with"]) return next();

    if (!fetchSite && !origin) return next(); // cliente no-browser con cookies

    logger?.warn?.(
      { method: req.method, path: req.path, origin, fetchSite },
      "[csrf] request con cookies rechazado por procedencia",
    );
    return res.status(403).json({ ok: false, error: "csrf_rejected" });
  };
}
