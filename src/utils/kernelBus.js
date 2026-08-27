import { getCalcApiBase } from "./calcApiBase.js";

const API_BASE = getCalcApiBase();

export const KERNEL_WAKE_RE = /\b(kernel|n[uú]cleo)\b/i;

export function addressedToFromText(text) {
  return KERNEL_WAKE_RE.test(String(text || "")) ? "kernel" : "other_agent";
}

export function kernelAuthHeaders(authHeader) {
  const headers = { "Content-Type": "application/json" };
  if (authHeader) headers.Authorization = authHeader;
  return headers;
}

export async function kernelFetch(path, { method = "GET", body, authHeader } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: kernelAuthHeaders(authHeader),
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Kernel ${res.status}`);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

export function ingestTurn({ authHeader, speaker, role, text, addressed_to }) {
  return kernelFetch("/api/kernel/events", {
    method: "POST",
    authHeader,
    body: {
      kind: "turn",
      speaker,
      role,
      text,
      addressed_to: addressed_to || addressedToFromText(text),
      timestamp: new Date().toISOString(),
    },
  }).catch(() => null);
}

export function ingestEvent({ authHeader, type, source, severity = "info", payload }) {
  return kernelFetch("/api/kernel/events", {
    method: "POST",
    authHeader,
    body: {
      kind: "event",
      type,
      source,
      severity,
      payload: typeof payload === "string" ? payload : JSON.stringify(payload ?? {}),
    },
  }).catch(() => null);
}

export function postSnapshot({ authHeader, snapshot }) {
  return kernelFetch("/api/kernel/events", {
    method: "POST",
    authHeader,
    body: { kind: "snapshot", snapshot },
  }).catch(() => null);
}
