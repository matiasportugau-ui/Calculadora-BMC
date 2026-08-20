/** Access state for a white-label calculator (closed silo). BMC hub is always "open". */
export function tenantAccessState({
  whitelabel = null,
  status = "anonymous",
  member = null,
  role = null,
} = {}) {
  if (!whitelabel) return "open";
  if (status === "loading") return "boot";
  if (status !== "authenticated") return "login";
  if (role === "admin" || role === "superadmin") return "ok";
  if (member && member.slug) return "ok";
  return "denied";
}

export const TENANT_HOST_SLUGS = {
  "calculadora-bc.vercel.app": "bc",
  "calculadora-paneleslam.vercel.app": "paneleslam",
  "calculadora-smartbuilding.vercel.app": "smartbuilding",
  "127.0.0.1:5180": "bc",
  "localhost:5180": "bc",
  "127.0.0.1:5181": "paneleslam",
  "localhost:5181": "paneleslam",
  "127.0.0.1:5182": "smartbuilding",
  "localhost:5182": "smartbuilding",
};

export function tenantSlugFromHost(hostOrUrl) {
  const raw = String(hostOrUrl || "").trim().toLowerCase();
  if (!raw) return null;
  let host = raw;
  try {
    if (raw.includes("://")) {
      const u = new URL(raw);
      host = u.host;
    }
  } catch {
    host = raw.split("/")[0];
  }
  host = host.split("/")[0];
  if (TENANT_HOST_SLUGS[host]) return TENANT_HOST_SLUGS[host];
  const noPort = host.split(":")[0];
  return TENANT_HOST_SLUGS[noPort] || null;
}

/** Closed silo on a tenant origin. BMC (slug null) stays open. */
export function tenantSiloDecision({ slug = null, user = null, member = null } = {}) {
  if (!slug) return { ok: true, status: 200, error: null };
  const role = user?.role || null;
  if (!user) return { ok: false, status: 401, error: "login_required" };
  if (role === "admin" || role === "superadmin") return { ok: true, status: 200, error: null };
  if (member && member.slug === slug) return { ok: true, status: 200, error: null };
  return { ok: false, status: 403, error: "not_tenant_member" };
}

export function tenantSlugFromRequest(req) {
  const env = String(
    (typeof process !== "undefined" && process.env && process.env.WHITELABEL) || "",
  ).trim().toLowerCase();
  if (env === "bc" || env === "paneleslam" || env === "smartbuilding") return env;
  const origin = req?.headers?.origin || (typeof req?.get === "function" ? req.get("origin") : "") || "";
  const referer = req?.headers?.referer || (typeof req?.get === "function" ? req.get("referer") : "") || "";
  const host = req?.headers?.host || (typeof req?.get === "function" ? req.get("host") : "") || "";
  return tenantSlugFromHost(origin) || tenantSlugFromHost(referer) || tenantSlugFromHost(host);
}
