/**
 * CSRF (CWE-352) — verificación de procedencia para requests con cookies.
 *
 * Contexto de arquitectura: los JWT de acceso viajan SOLO por
 * `Authorization: Bearer` (server/lib/identityAuth.js), inmunes a CSRF. Las
 * únicas rutas autenticadas por cookie son POST /auth/refresh y
 * POST /auth/logout (cookie httpOnly + SameSite=Strict, rate-limited). Este
 * middleware agrega la capa explícita que exige CodeQL js/missing-token-validation
 * y defensa en profundidad estilo OWASP (verificación de origen para SPAs):
 *
 *  - Métodos seguros (GET/HEAD/OPTIONS) y requests SIN cookies pasan intactos
 *    (Bearer puro, webhooks HMAC, curl, health checks).
 *  - Para métodos inseguros CON cookies se exige una señal de mismo origen:
 *    `Sec-Fetch-Site: same-origin|same-site|none`, u `Origin`/`Referer` dentro
 *    de config.corsOrigins (o extensión chrome-extension://, espejo del CORS),
 *    o un header custom `X-CSRF-Token`/`X-XSRF-Token`/`X-Requested-With` — los
 *    headers custom fuerzan preflight CORS, que solo aprueba orígenes permitidos.
 *  - Requests con cookies pero sin ningún header de navegador (ni Origin, ni
 *    Referer, ni Sec-Fetch-Site) se asumen no-browser y pasan: los ataques
 *    CSRF provienen de navegadores, que siempre mandan Origin en POST cross-site.
 */
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const SAME_SITE_OK = new Set(["same-origin", "same-site", "none"]);

/**
 * @param {import("../config.js").config} config
 * @param {import("pino").Logger} [logger]
 */
export default function createCsrfProtection(config, logger) {
  return function csrfProtection(req, res, next) {
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

    const csrfToken = req.headers["x-csrf-token"] || req.headers["x-xsrf-token"];
    if (csrfToken || req.headers["x-requested-with"]) return next();

    if (!fetchSite && !origin) return next(); // cliente no-browser con cookies

    logger?.warn?.(
      { method: req.method, path: req.path, origin, fetchSite },
      "[csrf] request con cookies rechazado por procedencia",
    );
    return res.status(403).json({ ok: false, error: "csrf_rejected" });
  };
}
