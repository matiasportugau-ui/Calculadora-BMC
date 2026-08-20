const ApiBase = (() => {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE.replace(/\/+$/, "");
  }
  return "";
})();

export async function tenantAdminFetch(path, { token, method = "GET", body } = {}) {
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body != null) headers["Content-Type"] = "application/json";
  const r = await fetch(`${ApiBase}${path}`, {
    method,
    credentials: "include",
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { ok: false, error: "bad_json" }; }
  if (!r.ok || json?.ok === false) {
    const err = new Error(json?.error || `http_${r.status}`);
    err.status = r.status;
    throw err;
  }
  return json;
}

export function downloadBlob(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function moneyUsd(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return Number(n).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function moneyUsdEstimate(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const x = Number(n);
  if (x === 0) return "$0.00";
  const digits = x < 0.01 ? 4 : 2;
  return Number(x).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: Math.max(digits, 4),
  });
}

export function whenUy(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-UY");
}

export function formatDurationMs(ms) {
  if (ms == null || !Number.isFinite(Number(ms))) return "—";
  const s = Math.max(0, Math.round(Number(ms) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 120) return `${m} min`;
  const h = (s / 3600).toFixed(1);
  return `${h} h`;
}

export function lightColor(light) {
  if (light === "online") return "var(--ac-success)";
  if (light === "recent") return "var(--ac-warn)";
  if (light === "paused") return "var(--ac-error)";
  return "var(--ac-text-3)";
}
