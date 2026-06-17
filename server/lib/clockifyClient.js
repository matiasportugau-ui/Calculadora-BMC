/**
 * Clockify API client (read-only, Fase 1).
 *
 * Thin wrapper over the Clockify REST API (api.clockify.me) and Reports API
 * (reports.api.clockify.me). Auth is a workspace admin/owner API key sent in
 * the `X-Api-Key` header. Mirrors the resilience pattern of
 * mercadoLibreClient.js: native fetch + AbortSignal timeout + exponential
 * backoff on 429/5xx.
 *
 * Docs: https://docs.clockify.me/
 */
import { setTimeout as delay } from "node:timers/promises";

const shouldRetry = (status) => status === 429 || status >= 500;

const parseJsonSafe = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
};

export function createClockifyClient({ config, logger }) {
  const log = logger || { info() {}, warn() {}, error() {} };
  const apiBase = config.clockifyApiBase || "https://api.clockify.me/api/v1";
  const reportsBase = config.clockifyReportsBase || "https://reports.api.clockify.me/v1";
  const workspaceId = config.clockifyWorkspaceId;
  const apiKey = config.clockifyApiKey;
  const timeoutMs = config.requestTimeoutMs || 15000;
  const maxRetries = config.maxRetries ?? 3;

  function assertConfig() {
    const missing = [];
    if (!apiKey) missing.push("CLOCKIFY_API_KEY");
    if (!workspaceId) missing.push("CLOCKIFY_WORKSPACE_ID");
    if (missing.length > 0) {
      const err = new Error(`Missing Clockify configuration: ${missing.join(", ")}`);
      err.status = 500;
      throw err;
    }
  }

  async function rawRequest({ method, base, path, query, body }) {
    assertConfig();
    const url = new URL(path, base);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value != null && value !== "") url.searchParams.set(key, String(value));
      }
    }

    let attempt = 0;
    while (true) {
      attempt += 1;
      const response = await fetch(url, {
        method,
        headers: {
          "X-Api-Key": apiKey,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      });
      const payload = await parseJsonSafe(response);

      if (response.ok) return payload;

      if (attempt <= maxRetries && shouldRetry(response.status)) {
        const waitMs = Math.min(1000 * 2 ** (attempt - 1), 5000);
        log.warn?.({ status: response.status, attempt, waitMs, path }, "[clockify] retrying request");
        await delay(waitMs);
        continue;
      }

      const err = new Error("Clockify API request failed");
      err.status = response.status;
      err.payload = payload;
      err.path = path;
      throw err;
    }
  }

  /** All workspace users (paginated). Requires an admin/owner key. */
  async function getUsers() {
    const out = [];
    let page = 1;
    const pageSize = 200;
    while (true) {
      const rows = await rawRequest({
        method: "GET",
        base: apiBase,
        path: `/workspaces/${workspaceId}/users`,
        query: { page, "page-size": pageSize, memberships: "NONE" },
      });
      if (!Array.isArray(rows) || rows.length === 0) break;
      out.push(...rows);
      if (rows.length < pageSize) break;
      page += 1;
    }
    return out;
  }

  /** All workspace projects (paginated, incl. archived). */
  async function getProjects() {
    const out = [];
    let page = 1;
    const pageSize = 200;
    while (true) {
      const rows = await rawRequest({
        method: "GET",
        base: apiBase,
        path: `/workspaces/${workspaceId}/projects`,
        query: { page, "page-size": pageSize, "archived": "" },
      });
      if (!Array.isArray(rows) || rows.length === 0) break;
      out.push(...rows);
      if (rows.length < pageSize) break;
      page += 1;
    }
    return out;
  }

  /**
   * Detailed report — every time entry for every user in [startISO, endISO].
   * Paginates the Reports API and returns the flat `timeentries` array.
   */
  async function getDetailedEntries({ startISO, endISO }) {
    const out = [];
    let page = 1;
    const pageSize = 1000;
    while (true) {
      const report = await rawRequest({
        method: "POST",
        base: reportsBase,
        path: `/workspaces/${workspaceId}/reports/detailed`,
        body: {
          dateRangeStart: startISO,
          dateRangeEnd: endISO,
          detailedFilter: { page, pageSize, options: { totals: "EXCLUDE" } },
          users: { ids: [], contains: "CONTAINS", status: "ALL" },
          amountShown: "HIDE_AMOUNT",
        },
      });
      const entries = report?.timeentries || [];
      out.push(...entries);
      if (entries.length < pageSize) break;
      page += 1;
    }
    return out;
  }

  return { assertConfig, getUsers, getProjects, getDetailedEntries };
}
