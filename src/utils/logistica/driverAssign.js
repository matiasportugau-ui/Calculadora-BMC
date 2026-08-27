/**
 * One-tap "Asignar a chofer": WhatsApp + BMC Driver PWA URL.
 */

export function uyWhatsAppDigits(phone) {
  const d = String(phone || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("598")) return d;
  if (d.startsWith("0") && d.length >= 8) return `598${d.slice(1)}`;
  if (d.length === 8 || d.length === 9) return `598${d.replace(/^0/, "")}`;
  return d;
}

/**
 * Prefer a freshly fetched driver URL over a React-state snapshot.
 * Never invent a tokenless /conductor link (drivers cannot join without ?t=).
 * @param {{ cachedUrl?: string, fetchedUrl?: string|null }} opts
 */
export function resolveDriverUrlForAssign(opts = {}) {
  const fetched = String(opts.fetchedUrl || "").trim();
  if (fetched) return fetched;
  return String(opts.cachedUrl || "").trim();
}

/**
 * @param {{ phone?: string, driverUrl?: string, tripLabel?: string }} opts
 */
export function driverAssignWhatsAppUrl(opts = {}) {
  const digits = uyWhatsAppDigits(opts.phone);
  const url = String(opts.driverUrl || "").trim();
  const label = String(opts.tripLabel || "ruta BMC").trim() || "ruta BMC";
  const text = [`BMC Driver — ${label}`, url, "Abrí el link en el celular para hacer la ruta."]
    .filter(Boolean)
    .join("\n");
  const q = encodeURIComponent(text);
  return digits ? `https://wa.me/${digits}?text=${q}` : `https://wa.me/?text=${q}`;
}

/**
 * @param {{ driverUrl?: string, phone?: string, tripLabel?: string, open?: Function, copy?: Function }} opts
 */
export function openDriverAssign(opts = {}) {
  const driverUrl = String(opts.driverUrl || "").trim();
  const wa = driverAssignWhatsAppUrl(opts);
  const open = typeof opts.open === "function" ? opts.open : null;
  const copy = typeof opts.copy === "function" ? opts.copy : null;
  if (driverUrl && copy) {
    try {
      copy(driverUrl);
    } catch {
      /* ignore */
    }
  }
  if (open) {
    if (driverUrl) open(driverUrl, "_blank", "noopener,noreferrer");
    open(wa, "_blank", "noopener,noreferrer");
  }
  return { wa, driverUrl: driverUrl || null };
}
