/**
 * Infer panel lines from Ventas ENCARGO PDF URL / filename when Drive fetch fails.
 * Example:
 * Cotizaci-n-13052026-Isopanel-100-mm-Isodec-100-mm-petinho-WA.pdf
 */

const TIPO_ALIASES = [
  { re: /isofrig[_\s-]?pir/i, tipo: "ISOFRIG_PIR" },
  { re: /isofrig/i, tipo: "ISOFRIG" },
  { re: /isowall/i, tipo: "ISOWALL" },
  { re: /isoroof/i, tipo: "ISOROOF" },
  { re: /isodec/i, tipo: "ISODEC" },
  { re: /isopanel/i, tipo: "ISOPANEL" },
];

/**
 * Decode Drive / URL path to a filename-ish string.
 * @param {string} url
 */
export function extractFilenameFromUrl(url) {
  const s = String(url || "").trim();
  if (!s) return "";
  try {
    const u = new URL(s, "https://drive.google.com");
    // /file/d/ID/view — no name
    const path = decodeURIComponent(u.pathname || "");
    const base = path.split("/").filter(Boolean).pop() || "";
    if (/\.pdf/i.test(base) || /isop|isodec|panel/i.test(base)) return base;
    // query title=
    const t = u.searchParams.get("title") || u.searchParams.get("name") || "";
    if (t) return t;
  } catch {
    /* ignore */
  }
  // raw string last segment
  const m = s.match(/([^/?#]+\.pdf)/i);
  if (m) return decodeURIComponent(m[1]);
  return decodeURIComponent(s.split("/").pop() || s);
}

/**
 * Parse panel specs from a filename or free text blob.
 * @param {string} text
 * @returns {{ paneles: Array<{tipo:string,espesor:number,longitud:number,cantidad:number}>, warnings: string[] }}
 */
export function parsePanelsFromFilename(text) {
  const warnings = [];
  const raw = String(text || "");
  if (!raw) return { paneles: [], warnings: ["Sin texto de ENCARGO/filename."] };

  const paneles = [];
  // Pattern: Tipo-100-mm or Tipo_100mm or Tipo 100 mm (optionally with length 6m)
  const re =
    /(isofrig(?:[_\s-]?pir)?|isowall|isoroof|isodec|isopanel)[_\s-]*(\d{2,3})\s*(?:mm)?(?:[_\s-]+(\d+(?:[.,]\d+)?)\s*m)?/gi;
  let m;
  const seen = new Set();
  while ((m = re.exec(raw)) !== null) {
    let tipo = "ISODEC";
    for (const a of TIPO_ALIASES) {
      if (a.re.test(m[1])) {
        tipo = a.tipo;
        break;
      }
    }
    const espesor = Math.round(Number(m[2]));
    const longitud = m[3] ? Number(String(m[3]).replace(",", ".")) : 6;
    const key = `${tipo}|${espesor}|${longitud}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (![40, 50, 60, 80, 100, 120, 150, 200, 250].includes(espesor)) continue;
    paneles.push({
      tipo,
      espesor,
      longitud: Number.isFinite(longitud) && longitud > 0 ? longitud : 6,
      cantidad: 1,
    });
  }

  if (!paneles.length) {
    warnings.push(
      "No se detectaron líneas de panel en el nombre del ENCARGO/PDF. Abrí el PDF o cargá paneles a mano.",
    );
  } else {
    warnings.push(
      `Inferido desde nombre de archivo ENCARGO (${paneles.length} línea(s); cantidad default 1 — ajustá si hace falta).`,
    );
  }
  return { paneles, warnings, source: "encargo_filename" };
}

/**
 * Full client-side infer when PDF bytes unavailable.
 * @param {{ pdf?: string, pdfLink?: string, rawSheetText?: string }} stopLike
 * @param {(text: string) => { paneles: any[], accesorios: any[], warnings?: string[] }} [parseSheetText]
 */
export function inferCargoFromEncargoAndSheet(stopLike, parseSheetText) {
  const pdf = stopLike?.pdfLink || stopLike?.pdf || "";
  const raw = String(stopLike?.rawSheetText || "");
  const filename = extractFilenameFromUrl(pdf);
  const fromName = parsePanelsFromFilename(`${filename}\n${pdf}\n${raw}`);

  let paneles = [...fromName.paneles];
  let accesorios = [];
  const warnings = [...fromName.warnings];

  if (typeof parseSheetText === "function" && raw) {
    const fromSheet = parseSheetText(raw);
    if (fromSheet.paneles?.length) {
      paneles = fromSheet.paneles;
      warnings.push("Paneles tomados del texto de la fila Ventas.");
    }
    if (fromSheet.accesorios?.length) accesorios = fromSheet.accesorios;
    if (fromSheet.warnings?.length) warnings.push(...fromSheet.warnings);
  }

  return {
    paneles,
    accesorios,
    warnings: warnings.filter(Boolean),
    source: paneles.length ? fromName.source || "mixed" : "none",
  };
}
