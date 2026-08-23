/**
 * Resolver de credenciales de salida WhatsApp.
 *
 * Devuelve el { accessToken, phoneNumberId } a usar para enviar. Con el flag de
 * coexistencia ON y una conexión activa persistida (wa_connections), usa las de esa
 * conexión (token descifrado); si no hay conexión —o el flag está OFF— cae al env
 * actual (config.whatsappAccessToken / config.whatsappPhoneNumberId). Cero regresión:
 * sin números conectados, todos los callers siguen usando el env como hoy.
 *
 * Cachea el lookup por defecto (sin phoneNumberId) con TTL corto para no pegarle a la
 * DB en cada envío. `pool` es inyectable para tests offline.
 */
import { getWaPool } from "../waDb.js";
import { getActiveConnection } from "./waConnectionStore.js";

const TTL_MS = 60000;
let cache = null; // { at:number, value:{accessToken,phoneNumberId}|null }

/** Solo tests. */
export function _clearWaCredentialsCache() {
  cache = null;
}

/**
 * @param {object} args
 * @param {object} args.config
 * @param {string} [args.phoneNumberId]  fuerza una conexión específica (no cacheado)
 * @param {import('pg').Pool} [args.pool]  inyectable (tests); default getWaPool(config.databaseUrl)
 * @returns {Promise<{ accessToken: string, phoneNumberId: string }>}
 */
export async function resolveWaCredentials({ config, phoneNumberId, pool } = {}) {
  const envCreds = {
    accessToken: config?.whatsappAccessToken || "",
    phoneNumberId: config?.whatsappPhoneNumberId || "",
  };
  if (!config?.waCoexistenceEnabled) return envCreds;
  if (!config?.tokenEncryptionKey) return envCreds;

  const p = pool || getWaPool(config.databaseUrl);
  if (!p) return envCreds;

  const now = Date.now();
  if (!phoneNumberId && cache && now - cache.at < TTL_MS) {
    return cache.value || envCreds;
  }
  try {
    const active = await getActiveConnection(p, {
      phoneNumberId: phoneNumberId || undefined,
      encryptionKey: config.tokenEncryptionKey,
    });
    const value =
      active?.accessToken && active?.phoneNumberId
        ? { accessToken: active.accessToken, phoneNumberId: active.phoneNumberId }
        : null;
    if (!phoneNumberId) cache = { at: now, value };
    return value || envCreds;
  } catch {
    return envCreds;
  }
}
