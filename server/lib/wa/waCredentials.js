/**
 * Resolver de credenciales de salida WhatsApp.
 *
 * Devuelve el { accessToken, phoneNumberId } a usar para enviar. Con el flag de
 * coexistencia ON y una conexión activa persistida (wa_connections), usa las de esa
 * conexión (token descifrado); si no hay conexión —o el flag está OFF— cae al env
 * actual (config.whatsappAccessToken / config.whatsappPhoneNumberId). Cero regresión:
 * sin números conectados, todos los callers siguen usando el env como hoy.
 *
 * Cachea solo hits positivos (conexión activa) con TTL corto. Misses no se cachean:
 * si no, el primer resolve antes de conectar fijaría env por 60s y el saliente
 * ignoraría el número recién onboarded. Writers (upsert/disable) invalidan vía
 * waCredentialsCache.
 */
import { getWaPool } from "../waDb.js";
import { getActiveConnection } from "./waConnectionStore.js";
import {
  getWaCredentialsCacheTtlMs,
  invalidateWaCredentialsCache,
  readWaCredentialsCache,
  writeWaCredentialsCache,
} from "./waCredentialsCache.js";

export { invalidateWaCredentialsCache };

/** @deprecated alias — tests / callers antiguos. */
export function _clearWaCredentialsCache() {
  invalidateWaCredentialsCache();
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
  const hit = !phoneNumberId ? readWaCredentialsCache() : null;
  if (hit && now - hit.at < getWaCredentialsCacheTtlMs()) {
    return hit.value;
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
    // Only cache positive hits — a miss must not block a later onboard for TTL_MS.
    if (!phoneNumberId && value) writeWaCredentialsCache(value);
    return value || envCreds;
  } catch {
    return envCreds;
  }
}
