/**
 * Dual-audience print HTML. ADR-007.
 * audience=client + branding → strip BMC chrome, inject user logo.
 * audience=bmc → keep BMC logo; optional margin block.
 */

const BMC_HEADER_RE = /BMC Uruguay/gi;

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s) {
  return escapeHtml(s);
}

export function applyPdfAudience(html, { audience = "client", branding = null, snapshot = null } = {}) {
  let out = String(html || "");
  if (audience === "client" && branding) {
    const logo = branding.logo_data_url || branding.logoDataUrl || null;
    if (logo && /^data:image\/(png|jpeg|webp);base64,/i.test(String(logo))) {
      const safeLogo = escapeAttr(logo);
      out = out
        .replace(/src=["']\/bmc-pdf\/assets\/bmc-logo\.png["']/gi, `src="${safeLogo}"`)
        .replace(/src=["']assets\/bmc-logo\.png["']/gi, `src="${safeLogo}"`)
        .replace(/src=["'][^"']*bmc-logo\.png["']/gi, `src="${safeLogo}"`);
    }
    const name = branding.display_name || branding.displayName || "";
    const safeName = escapeHtml(name);
    if (name) {
      out = out.replace(BMC_HEADER_RE, safeName);
    } else {
      out = out.replace(BMC_HEADER_RE, "");
    }
    out = out.replace(/alt=["']BMC[^"']*["']/gi, `alt="${escapeAttr(name || "Logo")}"`);
  }

  if (audience === "bmc" && snapshot && typeof snapshot === "object") {
    const margin = snapshot.margin_usd != null ? Number(snapshot.margin_usd).toFixed(2) : "—";
    const total = snapshot.total_usd != null ? Number(snapshot.total_usd).toFixed(2) : "—";
    const drift = snapshot.price_drift ? " · DRIFT" : "";
    const block = `<div data-bmc-internal="margin">BMC interno · total USD ${escapeHtml(total)} · margen USD ${escapeHtml(margin)}${escapeHtml(drift)}</div>`;
    if (/<\/body>/i.test(out)) out = out.replace(/<\/body>/i, `${block}</body>`);
    else out += block;
  }
  return out;
}

export function resolveAudience(queryAudience, user) {
  const raw = String(queryAudience || "client").toLowerCase();
  const audience = raw === "bmc" ? "bmc" : "client";
  if (audience === "bmc") {
    const role = user?.role;
    if (!["admin", "operator", "superadmin"].includes(role)) {
      return { ok: false, error: "forbidden_audience", status: 403 };
    }
  }
  return { ok: true, audience };
}
