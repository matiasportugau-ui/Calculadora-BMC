/**
 * mint-tour-session.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Login NO interactivo para CI: cambia un refresh-token de Google (de una cuenta
 * de prueba registrada en BMC) por un access-token de Google y lo canjea en
 * POST /api/auth/google, obteniendo un cookie `bmc_sess` fresco. Imprime SOLO el
 * valor del cookie en stdout (para `TOUR_SESSION_COOKIE`); todo lo demás a stderr.
 *
 * A diferencia de `bmc_sess` (rota + reuse-detection), el refresh-token de Google
 * sí se puede guardar como secret y reutilizar.
 *
 * Env requeridos:
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
 * Opcional:
 *   BMC_API_BASE (default https://calculadora-bmc.vercel.app)
 *
 * Uso:  COOKIE=$(node scripts/mint-tour-session.mjs)
 */
const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;
const API = (process.env.BMC_API_BASE || "https://calculadora-bmc.vercel.app").replace(/\/+$/, "");

function die(msg) {
  process.stderr.write(`[mint-tour-session] ${msg}\n`);
  process.exit(1);
}

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
  die("faltan GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN");
}

// 1) refresh-token de Google → access-token de Google
const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    refresh_token: GOOGLE_REFRESH_TOKEN,
    grant_type: "refresh_token",
  }),
});
const tokenJson = await tokenRes.json().catch(() => ({}));
if (!tokenRes.ok || !tokenJson.access_token) {
  die(`Google token endpoint ${tokenRes.status}: ${JSON.stringify(tokenJson).slice(0, 200)}`);
}

// 2) access-token de Google → sesión BMC (cookie bmc_sess)
const authRes = await fetch(`${API}/api/auth/google`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ accessToken: tokenJson.access_token }),
});
const authJson = await authRes.json().catch(() => ({}));
if (!authRes.ok) die(`/api/auth/google ${authRes.status}: ${JSON.stringify(authJson).slice(0, 200)}`);
if (authJson.status === "mfa_required") {
  die("la cuenta de prueba tiene 2FA activo — desactiva MFA para el usuario del tour");
}

// 3) extraer bmc_sess del Set-Cookie
const setCookies = authRes.headers.getSetCookie ? authRes.headers.getSetCookie() : [authRes.headers.get("set-cookie") || ""];
const sess = setCookies.map((c) => (c.match(/(?:^|;\s*)bmc_sess=([^;]+)/) || [])[1]).find(Boolean);
if (!sess) die("la respuesta no incluyó cookie bmc_sess");

process.stderr.write(`[mint-tour-session] sesión OK para ${authJson?.user?.email || "(usuario)"}\n`);
process.stdout.write(sess);
