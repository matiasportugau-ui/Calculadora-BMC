/**
 * WA Coexistence onboarding — orquestación del intercambio Embedded Signup → token
 * → registro/suscripción → persistencia. Aislado de Express para testear offline con
 * un `fetchImpl` inyectado y un fakePool (ver tests/waCoexistenceOnboarding.test.js).
 *
 * Flujo (todas las llamadas contra Graph API):
 *   1. code → business token   (GET /oauth/access_token)
 *   2. suscribir app a la WABA  (POST /{wabaId}/subscribed_apps)  → los webhooks fluyen
 *   3. registrar el número      (POST /{phoneNumberId}/register)  → best-effort (coexistencia)
 *   4. detalles del número      (GET /{phoneNumberId}?fields=…)
 *   5. persistir cifrado        (waConnectionStore.upsertConnection)
 */
import { upsertConnection } from "./waConnectionStore.js";

const GRAPH_HOST = "https://graph.facebook.com";

function graphUrl(config, path) {
  const v = config?.graphApiVersion || "v21.0";
  return `${GRAPH_HOST}/${v}/${path}`;
}

/** Extrae un mensaje de error de una respuesta Graph. */
function graphError(data, fallback) {
  return data?.error?.message || data?.error?.error_user_msg || fallback;
}

/**
 * Intercambia el authorization code de Embedded Signup por un token de negocio.
 * @throws Error si Graph responde error o falta el token.
 */
export async function exchangeCodeForToken({ code, config, fetchImpl }) {
  const clientSecret = config.whatsappAppSecret || config.metaAppSecret || "";
  if (!config.metaAppId) throw new Error("META_APP_ID not configured");
  if (!clientSecret) throw new Error("WHATSAPP_APP_SECRET (client_secret) not configured");
  const params = new URLSearchParams({
    client_id: config.metaAppId,
    client_secret: clientSecret,
    code,
  });
  const res = await fetchImpl(`${graphUrl(config, "oauth/access_token")}?${params.toString()}`, {
    method: "GET",
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.access_token) {
    throw new Error(`token exchange failed: ${graphError(data, `HTTP ${res.status}`)}`);
  }
  return data.access_token;
}

/**
 * Suscribe la app a la WABA para que los webhooks de mensajes lleguen.
 * @returns {Promise<boolean>} true si Graph confirma success.
 */
export async function subscribeApp({ wabaId, token, config, fetchImpl }) {
  if (!wabaId) return false;
  const res = await fetchImpl(graphUrl(config, `${wabaId}/subscribed_apps`), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`subscribe failed: ${graphError(data, `HTTP ${res.status}`)}`);
  return data?.success === true || res.ok;
}

/**
 * Registra el número en la Cloud API (coexistencia). Best-effort: en coexistencia el
 * número puede ya estar registrado y Graph devolver un error benigno; no aborta el flujo.
 * @returns {Promise<{ok:boolean, error?:string}>}
 */
export async function registerNumber({ phoneNumberId, token, config, fetchImpl }) {
  try {
    const res = await fetchImpl(graphUrl(config, `${phoneNumberId}/register`), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp" }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: graphError(data, `HTTP ${res.status}`) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message || "register error" };
  }
}

/** Trae display_phone_number / verified_name / quality_rating. Best-effort. */
export async function fetchNumberDetails({ phoneNumberId, token, config, fetchImpl }) {
  try {
    const res = await fetchImpl(
      graphUrl(config, `${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`),
      { method: "GET", headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return {};
    return {
      displayNumber: data.display_phone_number || null,
      verifiedName: data.verified_name || null,
      qualityRating: data.quality_rating || null,
    };
  } catch {
    return {};
  }
}

/**
 * Orquesta el onboarding completo y persiste la conexión cifrada.
 * @param {object} args
 * @param {string} args.code
 * @param {string} args.phoneNumberId
 * @param {string} [args.wabaId]
 * @param {object} args.config
 * @param {import('pg').Pool} args.pool
 * @param {typeof fetch} [args.fetchImpl]  inyectable para tests
 * @param {string} [args.connectedBy]
 * @param {object} [args.logger]
 * @returns {Promise<object>} conexión pública (sin token)
 */
export async function onboardNumber({
  code,
  phoneNumberId,
  wabaId = null,
  config,
  pool,
  fetchImpl = fetch,
  connectedBy = null,
  logger = console,
}) {
  if (!code) throw new Error("code required");
  if (!phoneNumberId) throw new Error("phoneNumberId required");

  const token = await exchangeCodeForToken({ code, config, fetchImpl });

  let subscribed = false;
  if (wabaId) {
    try {
      subscribed = await subscribeApp({ wabaId, token, config, fetchImpl });
    } catch (e) {
      // La suscripción es crítica para recibir; si falla, propagamos (el número no serviría).
      logger?.error?.({ err: e?.message, wabaId }, "wa onboarding: subscribe_apps failed");
      throw e;
    }
  }

  const reg = await registerNumber({ phoneNumberId, token, config, fetchImpl });
  if (!reg.ok) logger?.warn?.({ phoneNumberId, error: reg.error }, "wa onboarding: register best-effort failed");

  const details = await fetchNumberDetails({ phoneNumberId, token, config, fetchImpl });

  return upsertConnection(
    pool,
    { phoneNumberId, wabaId, accessToken: token, subscribed, connectedBy, ...details },
    { encryptionKey: config.tokenEncryptionKey },
  );
}
