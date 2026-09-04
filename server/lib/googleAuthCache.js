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
import {
  parseGoogleCreds,
  googleCredsEnvRaw,
  googleAuthOptionsFromParsed,
} from "./googleSheetsAuth.js";

const cache = new Map(); // scope:string -> Promise<authClient>

/**
 * Get a cached GoogleAuth client for the given scope.
 * Doppler/local may store the service-account JSON inline in
 * GOOGLE_APPLICATION_CREDENTIALS — do not treat that as a file path.
 * @param {string} scope - e.g. "https://www.googleapis.com/auth/spreadsheets"
 * @returns {Promise<import("googleapis").Common.OAuth2Client>}
 */
export function getGoogleAuthClient(scope) {
  const key = String(scope);
  if (!cache.has(key)) {
    const parsed = parseGoogleCreds(googleCredsEnvRaw());
    const auth = new google.auth.GoogleAuth(googleAuthOptionsFromParsed(parsed, [scope]));
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
