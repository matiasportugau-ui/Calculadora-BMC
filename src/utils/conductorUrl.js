/**
 * Public chofer PWA URL. Always the Vite SPA host, never Cloud Run.
 */
export function conductorPublicUrl(frontendBaseUrl, token) {
  const spa = String(frontendBaseUrl || "https://calculadora-bmc.vercel.app").replace(/\/$/, "");
  const q = token ? `?t=${encodeURIComponent(token)}` : "";
  return `${spa}/conductor${q}`;
}

export function conductorLegacyPath() {
  return "/calculadora/conductor";
}
