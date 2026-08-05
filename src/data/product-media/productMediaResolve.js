import catalog from "./product-media-catalog.json" with { type: "json" };
import links from "./product-media-links.json" with { type: "json" };

function productByHandle(handle) {
  if (!handle || !catalog?.byHandle) return null;
  const idx = catalog.byHandle[handle];
  if (idx == null) return null;
  return catalog.products[idx] || null;
}
function productBySku(sku) {
  if (!sku || !catalog?.bySku) return null;
  const idx = catalog.bySku[String(sku).trim()];
  if (idx == null) return null;
  return catalog.products[idx] || null;
}
function emptyMedia(reason) {
  return { primaryImage: null, images: [], title: "", description: "", url: "https://bmcuruguay.com.uy", handle: null, status: reason, source: "missing" };
}
export function resolveFromLink(link) {
  if (!link) return emptyMedia("none");
  const product = link.handle ? productByHandle(link.handle) : null;
  const primaryImage = link.imageSrc || product?.primaryImage || product?.images?.[0]?.src || null;
  return {
    primaryImage,
    images: product?.images?.length ? product.images : primaryImage ? [{ src: primaryImage, alt: link.title || product?.title || "" }] : [],
    title: link.title || product?.title || "",
    description: product?.description || "",
    url: product?.url || (link.handle ? `https://bmcuruguay.com.uy/products/${link.handle}` : "https://bmcuruguay.com.uy"),
    handle: link.handle || product?.handle || null,
    status: link.status || (primaryImage ? "linked" : null),
    source: primaryImage ? (link.imageSrc ? "link" : "catalog") : "missing",
  };
}
export function panelFamGroup(panelFamiliaKey) {
  const k = String(panelFamiliaKey || "");
  if (k.startsWith("ISODEC_PIR") || k === "ISODEC_PIR") return "ISODEC_PIR";
  if (k.startsWith("ISODEC")) return "ISODEC";
  if (k.startsWith("ISOROOF_COLONIAL")) return "ISOROOF_COLONIAL";
  if (k.startsWith("ISOROOF")) return "ISOROOF";
  if (k.startsWith("ISOPANEL")) return "ISOPANEL";
  if (k.startsWith("ISOWALL")) return "ISOWALL";
  if (k.startsWith("ISOFRIG")) return "ISOFRIG";
  return k || "";
}
export function resolveBorderMedia({ borderId, familia, panelFamiliaKey } = {}) {
  if (!borderId || borderId === "none") return emptyMedia("none");
  const entry = links?.borders?.[borderId];
  if (!entry) return emptyMedia("unlinked");
  const fam = familia || panelFamGroup(panelFamiliaKey) || "";
  let link = null;
  if (fam && entry.byFamilia?.[fam]) link = entry.byFamilia[fam];
  if (!link && fam === "ISODEC_PIR" && entry.byFamilia?.ISODEC) link = entry.byFamilia.ISODEC;
  if (!link && fam === "ISOROOF_COLONIAL" && entry.byFamilia?.ISOROOF) link = entry.byFamilia.ISOROOF;
  if (!link) link = entry.default || null;
  return resolveFromLink(link);
}
export function resolvePanelMedia({ familia } = {}) {
  if (!familia) return emptyMedia("unlinked");
  return resolveFromLink(links?.panels?.[familia] || null);
}
export function resolveAccessoryMedia({ kind, key } = {}) {
  if (!key) return emptyMedia("unlinked");
  const bucket = kind === "sellador" ? links?.selladores : links?.fijaciones;
  return resolveFromLink(bucket?.[key] || null);
}
export function resolveCatalogRowMedia(row) {
  if (!row) return emptyMedia("unlinked");
  if (row.kind === "panel" && row.familia) return resolvePanelMedia({ familia: row.familia });
  if (row.kind === "perfil") {
    const id = String(row.id || row.key || "");
    const m = id.match(/^p[tp]:([^:]+):([^:]+)/);
    if (m) {
      const media = resolveBorderMedia({ borderId: m[1], familia: m[2] === "_all" ? "" : m[2] });
      if (media.primaryImage) return media;
    }
    const t = String(row.label || "").toLowerCase();
    if (/babeta.*empotr/.test(t)) return resolveBorderMedia({ borderId: "babeta_empotrar" });
    if (/babeta|adosar|atornill/.test(t)) return resolveBorderMedia({ borderId: "babeta_adosar" });
    if (/gotero.*c[aá]mara|camara/.test(t)) return resolveBorderMedia({ borderId: "gotero_lateral_camara" });
    if (/gotero.*lateral/.test(t)) return resolveBorderMedia({ borderId: "gotero_lateral" });
    if (/gotero.*frontal.*greca|greca/.test(t)) return resolveBorderMedia({ borderId: "gotero_frontal_greca" });
    if (/gotero.*frontal|gotero.*superior/.test(t)) return resolveBorderMedia({ borderId: "gotero_frontal" });
    if (/canal[oó]n/.test(t)) return resolveBorderMedia({ borderId: "canalon" });
    if (/cumbrera/.test(t)) return resolveBorderMedia({ borderId: "cumbrera" });
  }
  if (row.kind === "fijacion" || row.category === "TORNILLERÍA") {
    const key = row.key || String(row.id || "").replace(/^fij:/, "");
    const media = resolveAccessoryMedia({ kind: "fijacion", key });
    if (media.primaryImage) return media;
  }
  if (row.kind === "sellador" || row.category === "SELLADORES") {
    const key = row.key || String(row.id || "").replace(/^sell:/, "");
    const media = resolveAccessoryMedia({ kind: "sellador", key });
    if (media.primaryImage) return media;
  }
  if (row.sku) {
    const p = productBySku(row.sku);
    if (p) return resolveFromLink({ handle: p.handle, imageSrc: p.primaryImage, title: p.title, status: "sku" });
  }
  return emptyMedia("unlinked");
}
export function getProductMediaCatalog() { return catalog; }
export function getProductMediaLinks() { return links; }
export function getCatalogProduct(handle) { return productByHandle(handle); }
