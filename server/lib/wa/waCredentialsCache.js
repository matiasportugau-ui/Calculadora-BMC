/**
 * Process-local cache for resolveWaCredentials (default / no phoneNumberId lookup).
 * Kept in its own module so waConnectionStore can invalidate without importing the
 * resolver (avoids a circular dependency with waCredentials.js).
 */

const TTL_MS = 60000;
let cache = null; // { at:number, value:{accessToken,phoneNumberId} } — never stores null

export function getWaCredentialsCacheTtlMs() {
  return TTL_MS;
}

/** @returns {{ at:number, value:{accessToken:string,phoneNumberId:string} }|null} */
export function readWaCredentialsCache() {
  return cache;
}

/** @param {{ accessToken: string, phoneNumberId: string }} value */
export function writeWaCredentialsCache(value) {
  if (!value?.accessToken || !value?.phoneNumberId) return;
  cache = { at: Date.now(), value };
}

/** Drop cache after connect/disconnect so outbound picks up the change immediately. */
export function invalidateWaCredentialsCache() {
  cache = null;
}
