import { getCalcApiBase } from "./calcApiBase.js";

const PANELIN_ROLE_KEY = "bmc_panelin_role";

export function adminIngresoApiBase() {
  const api = getCalcApiBase().replace(/\/+$/, "");
  return api ? `${api}/chat` : "/chat";
}

function storedPanelinRole() {
  try {
    return localStorage.getItem(PANELIN_ROLE_KEY) || "";
  } catch {
    return "";
  }
}

export async function adminIngresoFetch(token, path, options = {}) {
  const base = adminIngresoApiBase();
  const { timeoutMs = 60000, ...fetchOptions } = options;
  const headers = { "Content-Type": "application/json", ...(fetchOptions.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const role = storedPanelinRole();
  if (role) headers["X-Panelin-Role"] = role;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}${path}`, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    if (e.name === "AbortError") {
      return { ok: false, status: 0, data: { error: "Tiempo de espera agotado" } };
    }
    return { ok: false, status: 0, data: { error: e.message || "Error de red" } };
  } finally {
    clearTimeout(timer);
  }
}

export function formatMissingL(missing) {
  if (missing == null || missing === "") return "";
  if (Array.isArray(missing)) return missing.filter(Boolean).join(", ");
  return String(missing);
}