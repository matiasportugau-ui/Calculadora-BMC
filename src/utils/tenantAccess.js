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
};

export function tenantSlugFromHost(hostOrUrl) {
  const raw = String(hostOrUrl || "").trim().toLowerCase();
  if (!raw) return null;
  let host = raw;
  try {
    if (raw.includes("://")) host = new URL(raw).hostname;
  } catch {
    host = raw.split("/")[0];
  }
  host = host.split(":")[0];
  return TENANT_HOST_SLUGS[host] || null;
}
