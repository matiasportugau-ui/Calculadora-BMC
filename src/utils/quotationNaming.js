// ═══════════════════════════════════════════════════════════════════════════
// quotationNaming.js — fecha UY + slugs para PDF / Drive / .bmc.json
// ═══════════════════════════════════════════════════════════════════════════

/** YYYY-MM-DD en America/Montevideo */
export function montevideoYmd(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Montevideo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const pick = (t) => parts.find((p) => p.type === t)?.value || "";
  const y = pick("year");
  const m = pick("month");
  const day = pick("day");
  if (!y || !m || !day) {
    const loc = new Date(d).toLocaleDateString("en-CA", { timeZone: "America/Montevideo" });
    return loc.includes("-") ? loc : new Date(d).toISOString().slice(0, 10);
  }
  return `${y}-${m}-${day}`;
}

const MAX_CLIENT_SLUG = 30;

export function sanitizeFileSegment(s, maxLen = MAX_CLIENT_SLUG) {
  return String(s || "")
    .replace(/[/\\?*:"<>|]+/g, "")
    .replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ _.-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen) || "proyecto";
}

/**
 * @param {string|{ nombre?: string, razonSocial?: string }} proyectoOrNombre
 */
export function clientFileSlug(proyectoOrNombre) {
  if (proyectoOrNombre == null) return "proyecto";
  if (typeof proyectoOrNombre === "string") {
    return sanitizeFileSegment(proyectoOrNombre, MAX_CLIENT_SLUG);
  }
  const rs = String(proyectoOrNombre.razonSocial || "").trim();
  const nom = String(proyectoOrNombre.nombre || "").trim();
  return sanitizeFileSegment(rs || nom || "proyecto", MAX_CLIENT_SLUG);
}

/** Carpeta nivel 1 en Drive: RUT + razón/nombre, o solo nombre sanitizado. */
export function buildDriveClientFolderName(proyecto = {}) {
  const rutRaw = String(proyecto.rut || "").trim();
  const rutCompact = rutRaw.replace(/\./g, "").replace(/\s+/g, "");
  const rs = String(proyecto.razonSocial || "").trim();
  const nom = String(proyecto.nombre || "").trim();
  const label = rs || nom || "proyecto";
  const safeLabel = sanitizeFileSegment(label, 35);
  if (rutCompact) {
    const shortRut = rutCompact.slice(0, 14);
    return sanitizeFileSegment(`${shortRut} - ${safeLabel}`, 72);
  }
  return sanitizeFileSegment(safeLabel, 72);
}

/** Carpeta por cotización (nivel 2): código estable para reutilizar / sobrescribir .bmc.json */
export function buildDriveQuotationFolderName(quotationCode) {
  const code = String(quotationCode || "BMC").trim() || "BMC";
  return sanitizeFileSegment(code.replace(/[/\\?*:"<>|]+/g, ""), 40);
}

/** Legado: cotización en raíz con patrón histórico "{código} — {cliente…}" (em dash). */
export function isLegacyFlatQuotationFolder(name) {
  const n = String(name || "");
  return n.startsWith("BMC-") && n.includes(" — ");
}

/** ddmmyy en America/Montevideo — e.g. "200526" para 20 de mayo 2026 */
export function montevideoDdmmyy(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Montevideo",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const pick = (t) => parts.find((p) => p.type === t)?.value || "00";
  return `${pick("day")}${pick("month")}${pick("year")}`;
}

/** Extrae ciudad: último segmento separado por coma, si no hay usa primera palabra */
export function extractCityFromDireccion(direccion) {
  const s = String(direccion || "").trim();
  if (!s) return "";
  const parts = s.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 1];
  return s.split(/\s+/)[0] || "";
}

/** Construye nuevo formato PDF: 0022BMC-200526-Arcor SA-Montevideo.pdf */
export function buildGlobalPdfFileName(counter, proyecto, date = new Date()) {
  const seq = String(counter).padStart(4, "0");
  const ddmmyy = montevideoDdmmyy(date);
  const name = sanitizeFileSegment(
    String(proyecto?.razonSocial || proyecto?.nombre || "proyecto").trim(),
    40
  );
  const city = sanitizeFileSegment(extractCityFromDireccion(proyecto?.direccion), 30);
  return `${seq}BMC-${ddmmyy}-${name}${city ? `-${city}` : ""}.pdf`;
}
