/**
 * server/lib/googleAuthCache.js
 * Module-level cache of GoogleAuth clients keyed by scope.
 *
 * The googleapis auth client refreshes its access token internally; constructing
 * a new GoogleAuth + calling getClient() on every request is wasted work and adds
 * latency. Mirror the cache-on-failure-reset pattern from server/lib/driveUpload.js
 * so a transient ADC failure does not permanently disable the helper.
 */
import { google } from "googleapis";

const cache = new Map(); // scope:string -> Promise<authClient>

/**
 * Get a cached GoogleAuth client for the given scope.
 * @param {string} scope - e.g. "https://www.googleapis.com/auth/spreadsheets"
 * @returns {Promise<import("googleapis").Common.OAuth2Client>}
 */
export function getGoogleAuthClient(scope) {
  const key = String(scope);
  if (!cache.has(key)) {
    const auth = new google.auth.GoogleAuth({ scopes: [scope] });
    const promise = auth.getClient().catch((err) => {
      cache.delete(key);
      throw err;
    });
    cache.set(key, promise);
  }
  return cache.get(key);
}

/** Test/admin reset. */
export function resetGoogleAuthCache() {
  cache.clear();
}
