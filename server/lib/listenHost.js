/**
 * Bind host for the Express API (`server/index.js` → `app.listen`).
 *
 * Local / no Cloud Run: loopback only so LAN peers cannot hit :3001.
 * Cloud Run (`K_SERVICE` set): omit host so Node listens on all interfaces
 * (required for the container ingress).
 *
 * Pure function of `env` so tests inject process.env-shaped objects
 * without booting Express.
 *
 * @param {NodeJS.Dict<string>} [env=process.env]
 * @returns {string | undefined} host argument for `app.listen`;
 *   `undefined` = all interfaces (Cloud Run)
 */
export function resolveListenHost(env = process.env) {
  if (String(env.K_SERVICE || "").trim()) return undefined;
  return "127.0.0.1";
}
