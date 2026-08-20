// Node-only: Origin / Referer / Host → tenant slug. Shared Cloud Run must
// NOT set WHITELABEL — Origin wins so BMC stays null.
import { tenantSlugFromHost } from "../../src/utils/tenantAccess.js";

const SLUGS = new Set(["bc", "paneleslam", "smartbuilding"]);

function header(req, name) {
  const fromGet = typeof req?.get === "function" ? req.get(name) : "";
  return req?.headers?.[name] || req?.headers?.[name.toLowerCase()] || fromGet || "";
}

export function tenantSlugFromRequest(req, env = process.env) {
  const origin = header(req, "origin");
  if (origin) return tenantSlugFromHost(origin);
  const referer = header(req, "referer");
  const host = header(req, "host");
  const envSlug = String(env?.WHITELABEL || "").trim().toLowerCase();
  return tenantSlugFromHost(referer) || tenantSlugFromHost(host) || (SLUGS.has(envSlug) ? envSlug : null);
}
