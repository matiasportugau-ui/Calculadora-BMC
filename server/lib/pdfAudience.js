/**
 * Dual-audience print HTML. ADR-007.
 * audience=client + branding → strip BMC chrome, inject user logo.
 * audience=bmc → keep BMC logo; optional margin block.
 */

const BMC_HEADER_RE = /BMC Uruguay/gi;

export function applyPdfAudience(html, { audience = "client", branding = null, snapshot = null } = {}) {
  let out = String(html || "");
  if (audience === "client" && branding) {
    const logo = branding.logo_data_url || branding.logoDataUrl || null;
    if (logo) {
      out = out
        .replace(/src=["']\/bmc-pdf\/assets\/bmc-logo\.png["']/gi, `src="${logo}"`)
        .replace(/src=["']assets\/bmc-logo\.png["']/gi, `src="${logo}"`)
        .replace(/src=["'][^"']*bmc-logo\.png["']/gi, `src="${logo}"`);
    }
    const name = branding.display_name || branding.displayName || "";
    if (name) {
      out = out.replace(BMC_HEADER_RE, name);
    } else {
      out = out.replace(BMC_HEADER_RE, "");
    }
    out = out.replace(/alt=["']BMC[^"']*["']/gi, `alt="${name || "Logo"}"`);
  }

  if (audience === "bmc" && snapshot && typeof snapshot === "object") {
    const margin = snapshot.margin_usd != null ? Number(snapshot.margin_usd).toFixed(2) : "—";
    const total = snapshot.total_usd != null ? Number(snapshot.total_usd).toFixed(2) : "—";
    const drift = snapshot.price_drift ? " · DRIFT" : "";
    const block = `<div data-bmc-internal="margin">BMC interno · total USD ${total} · margen USD ${margin}${drift}</div>`;
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
