import { getCalcApiBase } from "../../../utils/calcApiBase.js";

function authHeader() {
  try {
    const token =
      (typeof window !== "undefined" && window.localStorage?.getItem("bmc_access_jwt")) || "";
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

async function request(method, path, body) {
  const base = getCalcApiBase();
  const url = `${base}${path}`;
  const init = {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
    },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  const resp = await fetch(url, init);
  const text = await resp.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { ok: false, error: "invalid_json", raw: text };
  }
  if (!resp.ok) {
    const err = new Error(data.error || `http_${resp.status}`);
    err.status = resp.status;
    err.payload = data;
    throw err;
  }
  return data;
}

export const tkApi = {
  me: () => request("GET", "/api/traktime/me"),
  health: () => request("GET", "/api/traktime/health"),
  listClients: () => request("GET", "/api/traktime/clients"),
  createClient: (body) => request("POST", "/api/traktime/clients", body),
  patchClient: (id, body) => request("PATCH", `/api/traktime/clients/${id}`, body),
  listProjects: () => request("GET", "/api/traktime/projects"),
  createProject: (body) => request("POST", "/api/traktime/projects", body),
  patchProject: (id, body) => request("PATCH", `/api/traktime/projects/${id}`, body),
  timerCurrent: () => request("GET", "/api/traktime/timer/current"),
  timerStart: (body) => request("POST", "/api/traktime/timer/start", body),
  timerStop: () => request("POST", "/api/traktime/timer/stop"),
  listEntries: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request("GET", `/api/traktime/entries${q ? `?${q}` : ""}`);
  },
  createEntry: (body) => request("POST", "/api/traktime/entries", body),
  patchEntry: (id, body) => request("PATCH", `/api/traktime/entries/${id}`, body),
  deleteEntry: (id) => request("DELETE", `/api/traktime/entries/${id}`),
  reportSummary: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request("GET", `/api/traktime/reports/summary${q ? `?${q}` : ""}`);
  },
  reportBillable: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request("GET", `/api/traktime/reports/billable${q ? `?${q}` : ""}`);
  },
  listInvoices: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request("GET", `/api/traktime/invoices${q ? `?${q}` : ""}`);
  },
  draftInvoice: (body) => request("POST", "/api/traktime/invoices/draft", body),
  issueInvoice: (id) => request("POST", `/api/traktime/invoices/${id}/issue`),
  markPaidInvoice: (id, paid = true) =>
    request("POST", `/api/traktime/invoices/${id}/mark-paid`, { paid }),
  voidInvoice: (id) => request("POST", `/api/traktime/invoices/${id}/void`),
  mirrorNow: () => request("POST", "/api/traktime/admin/mirror-now"),
};
