import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCalcApiBase } from "../utils/calcApiBase.js";

// TODO refactor split (no behavior change, ~407 LOC today): three slice hooks
//   useToken          — load/save bmc_cockpit_token, autoLoad from /api/cockpit
//   useBatchOpts      — persist batch flags in localStorage[bmc_admin_quote_batch_opts]
//   useRowActions     — load/sync/save/approve/markEnviado bulk + per-row mutations
// Keep this hook as composer until slices land in a follow-up PR.

const TOKEN_KEY = "bmc_cockpit_token";
const BATCH_OPTS_KEY = "bmc_admin_quote_batch_opts";
// Hybrid RBAC soft hint — backend logs the role via resolveInternalServiceActor.
// Valid values: "ventas" | "logistica" | "admin" | "director". Absent = no hint
// sent → backend falls back to PANELIN_SERVICE_DEFAULT_ROLE env / "director".
const PANELIN_ROLE_KEY = "bmc_panelin_role";

const DEFAULT_BATCH_OPTS = {
  force: false,
  syncToCrm: true,
  createCrmRows: true,
  syncQuoteLink: true,
};

function loadBatchOpts() {
  try {
    const raw = localStorage.getItem(BATCH_OPTS_KEY);
    if (!raw) return { ...DEFAULT_BATCH_OPTS };
    const o = JSON.parse(raw);
    return {
      force: Boolean(o.force),
      syncToCrm: o.syncToCrm !== false,
      createCrmRows: o.createCrmRows !== false,
      syncQuoteLink: o.syncQuoteLink !== false,
    };
  } catch { return { ...DEFAULT_BATCH_OPTS }; }
}

function saveBatchOpts(opts) {
  try { localStorage.setItem(BATCH_OPTS_KEY, JSON.stringify(opts)); } catch { /* ignore */ }
}

function getStoredToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
}

function setStoredToken(t) {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* ignore */ }
}

function getStoredPanelinRole() {
  try { return localStorage.getItem(PANELIN_ROLE_KEY) || ""; } catch { return ""; }
}

async function apiFetch(token, path, options = {}) {
  const base = getCalcApiBase().replace(/\/+$/, "");
  const { timeoutMs = 45000, ...fetchOptions } = options;
  const headers = { ...(fetchOptions.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  // Hybrid RBAC (from #223): server logs role for analytics; no enforcement yet.
  const role = getStoredPanelinRole();
  if (role) headers["X-Panelin-Role"] = role;
  // AbortController wrapper (from #224): replaces silent hangs with a structured
  // timeout error. Both intents are additive.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}${path}`, { ...fetchOptions, headers, signal: controller.signal });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    if (e.name === "AbortError") {
      return { ok: false, status: 0, data: { error: `Request timed out after ${Math.round(timeoutMs / 1000)}s` } };
    }
    return { ok: false, status: 0, data: { error: e.message || "Network error" } };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Hook orchestrating the Administrador de Cotizaciones v2 module.
 * State + actions over /api/wolfboard/*. No backend changes.
 */
export function useAdminCotizaciones() {
  const [token, setToken] = useState(() => getStoredToken());
  const [tokenAutoLoaded, setTokenAutoLoaded] = useState(false);
  const [tokenLoadError, setTokenLoadError] = useState("");

  const [scope, setScopeState] = useState("consulta"); // "consulta" | "admin"
  const [statusFilter, setStatusFilterState] = useState("todas");
  const [search, setSearchState] = useState("");
  const [selected, setSelected] = useState(() => new Set());

  const [rows, setRows] = useState([]);
  const [sheetRowCount, setSheetRowCount] = useState(null);

  const [loading, setLoading] = useState(false);
  const [busyOp, setBusyOp] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToastState] = useState("");

  const [batchOpts, setBatchOptsState] = useState(() => loadBatchOpts());

  const toastTimerRef = useRef(null);
  const showToast = useCallback((msg) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastState(msg);
    toastTimerRef.current = setTimeout(() => setToastState(""), 3500);
  }, []);
  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  const setScope = useCallback((next) => {
    setScopeState(next === "admin" ? "admin" : "consulta");
    setSelected(new Set());
  }, []);
  const setStatusFilter = useCallback((next) => setStatusFilterState(next || "todas"), []);
  const setSearch = useCallback((s) => setSearchState(s || ""), []);

  const updateBatchOpts = useCallback((patch) => {
    setBatchOptsState((prev) => {
      const next = { ...prev, ...patch };
      saveBatchOpts(next);
      return next;
    });
  }, []);
  const resetBatchOpts = useCallback(() => {
    setBatchOptsState({ ...DEFAULT_BATCH_OPTS });
    saveBatchOpts(DEFAULT_BATCH_OPTS);
  }, []);

  // Auto-load token on mount (browser-Origin-gated endpoint).
  useEffect(() => {
    const stored = getStoredToken();
    if (stored) {
      setToken(stored);
      setTokenAutoLoaded(true);
      return;
    }
    const base = getCalcApiBase().replace(/\/+$/, "");
    fetch(`${base}/api/crm/cockpit-token`, { credentials: "omit" })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d?.ok) {
          setTokenLoadError(`No se pudo cargar el token (${d?.error || `HTTP ${r.status}`}). Pegalo manualmente.`);
          return;
        }
        const t = String(d?.token || "").trim();
        if (t) {
          setStoredToken(t);
          setToken(t);
          setTokenAutoLoaded(true);
        } else {
          setTokenLoadError("El servidor no devolvió token. Pegalo manualmente.");
        }
      })
      .catch(() => setTokenLoadError("Error de red al pedir el token. Pegalo manualmente."));
  }, []);

  const saveToken = useCallback((t) => {
    const v = String(t || "").trim();
    setStoredToken(v);
    setToken(v);
    if (v) setTokenAutoLoaded(true);
    showToast(v ? "Token guardado." : "Token borrado.");
  }, [showToast]);

  const clearToken = useCallback(() => {
    setStoredToken("");
    setToken("");
    setTokenAutoLoaded(false);
    showToast("Token borrado.");
  }, [showToast]);

  /**
   * Map a CRM_Operativo row (from `/api/crm/cockpit/ml-queue`) into the same
   * shape used by Admin 2.0 rows, so the table can render both side by side.
   *
   * Step 5 of F1 (Gap 3a). The ML pipeline already lands inbound questions
   * in CRM_Operativo via the PANELSIM webhook; until those leads are also
   * sync'd into Admin 2.0, they were invisible to operators working from
   * `/hub/cotizaciones`. We surface them inline with a `source: "crm-ml"`
   * tag so the UI can gate destructive actions (Admin-rowNum-only) and
   * style them differently.
   */
  function mapCrmMlItemToRow(item) {
    const p = item?.parsed || {};
    return {
      // No Admin sheet rowNum — synthetic key to satisfy React. Actions
      // that require adminRow (save/approve/markEnviado) are disabled by
      // the UI when source !== "admin".
      rowNum: null,
      source: "crm-ml",
      crmRow: item?.row ?? null,
      mlQuestionId: item?.questionId ?? "",
      id: p.cotizacionId || p.id || `CRM-${item?.row ?? ""}`,
      fecha: p.fecha || p.fechaCreacion || "",
      telefono: p.telefono || "",
      cliente: p.cliente || p.clienteNombre || "",
      canal: p.origen || "ML",
      origen: p.origen || "ML",
      zona: p.direccion || p.zona || "",
      consulta: p.consulta || p.notas || "",
      respuesta: p.respuesta || p.respuestaSugerida || "",
      link: p.linkPresupuesto || "",
      estado: p.estado || "",
      replaySnapshotUrl: "",
      sheetUrl: "",
    };
  }

  const load = useCallback(async () => {
    if (!token) { setError("Falta el token (cockpit)."); return; }
    setLoading(true);
    setError("");
    const q = scope === "admin" ? "?scope=admin" : "?scope=consulta";

    // Fan out: Admin 2.0 rows (primary) + CRM ML queue (Step 5 / Gap 3a).
    // ML queue is best-effort — a 503 or auth error there must NOT erase the
    // Admin 2.0 rows (the historical contract of `load()`).
    const [adminRes, mlRes] = await Promise.all([
      apiFetch(token, `/api/wolfboard/pendientes${q}`),
      apiFetch(token, `/api/crm/cockpit/ml-queue`).catch(() => ({ ok: false, status: 0, data: {} })),
    ]);
    setLoading(false);

    if (!adminRes.ok) {
      setError(adminRes.data?.error || `HTTP ${adminRes.status}`);
      setRows([]);
      setSheetRowCount(null);
      return;
    }

    const adminRows = (Array.isArray(adminRes.data.data) ? adminRes.data.data : [])
      .map((r) => ({ ...r, source: "admin" }));
    const mlRowsRaw = mlRes.ok && Array.isArray(mlRes.data?.items) ? mlRes.data.items : [];

    // Dedupe: if an ML question already has an Admin row with matching ID,
    // prefer the Admin row (it has rowNum + supports the standard actions).
    const adminIds = new Set(adminRows.map((r) => String(r.id || "").trim()).filter(Boolean));
    const mlRows = mlRowsRaw
      .map(mapCrmMlItemToRow)
      .filter((r) => !adminIds.has(String(r.id || "").trim()));

    setRows([...adminRows, ...mlRows]);
    setSheetRowCount(typeof adminRes.data.sheetRowCount === "number" ? adminRes.data.sheetRowCount : null);
    setSelected(new Set());
  }, [token, scope]);

  // Refetch on token/scope change.
  useEffect(() => {
    if (!token) { setRows([]); setSheetRowCount(null); return; }
    load();
  }, [token, scope, load]);

  const saveRow = useCallback(async (adminRow, patch) => {
    if (!token) return { ok: false };
    setBusyOp("save");
    // Step 6 of F1 (Gap 4b): if the operator picked a Responsable in the
    // drawer, PATCH it to CRM_Operativo. The Sheets column is wired by
    // `bmcDashboard.js:879` (`ASIGNADO_A` → `Responsable`). Best-effort —
    // failures here don't block the Admin write.
    const { responsable, cotizacionId, ...adminPatch } = patch || {};
    const body = { adminRow, ...adminPatch };
    const { ok, status, data } = await apiFetch(token, "/api/wolfboard/row", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!ok) {
      setBusyOp(null);
      showToast(data?.error || `Error al guardar (HTTP ${status})`);
      return { ok: false, data };
    }

    let responsableNote = "";
    if (responsable && cotizacionId) {
      const patchRes = await apiFetch(token, `/api/cotizaciones/${encodeURIComponent(cotizacionId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ASIGNADO_A: responsable }),
      });
      if (patchRes.ok) {
        responsableNote = ` · Resp=${responsable}`;
      } else {
        // Don't fail the whole save — Admin write already succeeded.
        responsableNote = ` · Resp no persistió (CRM ${patchRes.status})`;
      }
    }

    setBusyOp(null);
    const dry = data.dryRun ? " [dry-run]" : "";
    showToast(
      `Guardado${dry} · Fila ${data.adminRow}` +
      (data.crmRow ? ` · CRM ${data.crmRow}` : "") +
      responsableNote
    );
    await load();
    return { ok: true, data };
  }, [token, load, showToast]);

  const approve = useCallback(async (adminRow) => {
    if (!token) return { ok: false };
    setBusyOp("approve");
    const { ok, status, data } = await apiFetch(token, "/api/wolfboard/row", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminRow, aprobado: true }),
    });
    setBusyOp(null);
    if (!ok) { showToast(data?.error || `Error al aprobar (HTTP ${status})`); return { ok: false, data }; }
    showToast(`Aprobado · Fila ${adminRow}${data.crmRow ? ` · CRM ${data.crmRow}` : ""}`);
    await load();
    return { ok: true, data };
  }, [token, load, showToast]);

  const markEnviado = useCallback(async (adminRow) => {
    if (!token) return { ok: false };
    setBusyOp("enviado");
    const { ok, status, data } = await apiFetch(token, "/api/wolfboard/enviados", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminRow }),
    });
    setBusyOp(null);
    if (!ok) { showToast(data?.error || `Error al marcar enviado (HTTP ${status})`); return { ok: false, data }; }
    const dry = data.dryRun ? " [dry-run]" : "";
    showToast(`Fila ${adminRow} → Enviados${dry}`);
    await load();
    return { ok: true, data };
  }, [token, load, showToast]);

  const markEnviadoSeries = useCallback(async (adminRows) => {
    if (!token || adminRows.length === 0) return;
    setBusyOp("enviado-series");
    let done = 0;
    let failed = 0;
    for (const adminRow of adminRows) {
      const { ok } = await apiFetch(token, "/api/wolfboard/enviados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminRow }),
      });
      if (ok) done += 1; else failed += 1;
      showToast(`Enviando ${done + failed}/${adminRows.length}…`);
    }
    setBusyOp(null);
    showToast(`Enviados: ${done}${failed ? ` · fallidos: ${failed}` : ""}`);
    await load();
  }, [token, load, showToast]);

  const runSync = useCallback(async () => {
    if (!token) return;
    setBusyOp("sync");
    const { ok, status, data } = await apiFetch(token, "/api/wolfboard/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setBusyOp(null);
    if (!ok) { showToast(data?.error || `Error al sincronizar (HTTP ${status})`); return; }
    const dry = data.dryRun ? " [dry-run]" : "";
    showToast(`Sync OK${dry} · CRM: ${data.updatedCrm ?? 0} · Omitidos: ${data.skipped ?? 0}`);
    await load();
  }, [token, load, showToast]);

  const runBatch = useCallback(async (opts) => {
    if (!token) return;
    setBusyOp("batch");
    const body = opts || batchOpts;
    const { ok, status, data } = await apiFetch(token, "/api/wolfboard/quote-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusyOp(null);
    if (!ok) { showToast(data?.error || `Error en batch IA (HTTP ${status})`); return; }
    showToast(`IA: ${data.successful ?? 0} generadas · ${data.failed ?? 0} fallidas · ${data.skipped ?? 0} omitidas`);
    await load();
  }, [token, load, showToast, batchOpts]);

  /**
   * Per-row AI suggestion. Calls `/api/crm/suggest-response` (4-LLM fallback with
   * KB + history injection — see `server/routes/bmcDashboard.js:2134`).
   *
   * Returns `{ ok, data: { respuesta, provider } | { error } }`. Does NOT persist
   * the result — the caller (DetailDrawer) sets the textarea so the operator can
   * edit before "Guardar".
   *
   * 60s timeout is wider than the default 45s because the LLM cascade (Claude
   * Haiku → OpenAI 4o-mini → Grok-3 → Gemini 2.0) can stack on cold paths.
   */
  const requestSuggestion = useCallback(async (row) => {
    if (!token) return { ok: false, data: { error: "Falta token (cockpit)." } };
    if (!row?.consulta) return { ok: false, data: { error: "La fila no tiene consulta para sugerir." } };
    setBusyOp("suggest");
    const body = {
      consulta: row.consulta,
      origen: row.origen || row.canal || "",
      cliente: row.cliente || "",
      observaciones: row.zona || "",
      itemId: row.id || "",
    };
    const { ok, status, data } = await apiFetch(token, "/api/crm/suggest-response", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      timeoutMs: 60000,
    });
    setBusyOp(null);
    if (!ok) {
      showToast(data?.error || `Error en sugerencia IA (HTTP ${status})`);
      return { ok: false, data };
    }
    const respuesta = String(data?.respuesta || "").trim();
    if (!respuesta) {
      showToast("La IA no devolvió respuesta. Probá editar manualmente.");
      return { ok: false, data: { error: "Empty response" } };
    }
    showToast(`Sugerencia generada · ${data?.provider || "IA"}`);
    return { ok: true, data: { respuesta, provider: data?.provider } };
  }, [token, showToast]);

  /**
   * Append a new manually-captured cotización row to Admin 2.0.
   * Backed by `POST /api/wolfboard/row-create` (Step 4 of F1 / Gap 3c).
   *
   * `input` shape: `{ telefono, cliente, origen, zona, consulta }`. `consulta`
   * must be non-empty after trim; others are optional. On success, the row is
   * appended at the bottom with Estado="Pendiente" and ID="MAN-<timestamp>",
   * then the table reloads.
   *
   * Returns `{ ok, data: { id, adminRow, fecha } | { error } }`.
   */
  const createRow = useCallback(async (input) => {
    if (!token) return { ok: false, data: { error: "Falta el token (cockpit)." } };
    const consulta = String(input?.consulta ?? "").trim();
    if (!consulta) return { ok: false, data: { error: "Consulta requerida." } };
    setBusyOp("create");
    const body = {
      telefono: input?.telefono ?? "",
      cliente: input?.cliente ?? "",
      origen: input?.origen ?? "",
      zona: input?.zona ?? "",
      consulta,
    };
    const { ok, status, data } = await apiFetch(token, "/api/wolfboard/row-create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusyOp(null);
    if (!ok) {
      showToast(data?.error || `Error al crear (HTTP ${status})`);
      return { ok: false, data };
    }
    const dry = data?.dryRun ? " [dry-run]" : "";
    showToast(`Nueva consulta creada${dry} · ID ${data?.id || "?"}${data?.adminRow ? ` · Fila ${data.adminRow}` : ""}`);
    await load();
    return { ok: true, data };
  }, [token, load, showToast]);

  const exportCsvUrl = useCallback(() => {
    const base = getCalcApiBase().replace(/\/+$/, "");
    return `${base}/api/wolfboard/export?token=${encodeURIComponent(token)}&scope=${encodeURIComponent(scope)}`;
  }, [token, scope]);

  const filtered = useMemo(() => filterRows(rows, { statusFilter, search }), [rows, statusFilter, search]);
  const stats = useMemo(() => computeStats(rows), [rows]);

  return {
    // token
    token,
    tokenAutoLoaded,
    tokenLoadError,
    saveToken,
    clearToken,

    // data
    rows,
    filtered,
    sheetRowCount,
    stats,
    loading,
    busyOp,
    error,
    toast,
    showToast,

    // filters/state
    scope,
    setScope,
    statusFilter,
    setStatusFilter,
    search,
    setSearch,

    // selection
    selected,
    toggleSelect: (adminRow) => setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(adminRow)) next.delete(adminRow); else next.add(adminRow);
      return next;
    }),
    toggleSelectAll: () => setSelected((prev) => {
      // Only clear when *all* visible rows are selected; otherwise promote
      // none/partial selection to all-of-current-view.
      const allSelected = filtered.length > 0 && filtered.every((r) => prev.has(r.rowNum));
      if (allSelected) return new Set();
      return new Set(filtered.map((r) => r.rowNum));
    }),
    clearSelection: () => setSelected(new Set()),

    // batch options
    batchOpts,
    updateBatchOpts,
    resetBatchOpts,

    // actions
    load,
    saveRow,
    approve,
    markEnviado,
    markEnviadoSeries,
    runSync,
    runBatch,
    requestSuggestion,
    createRow,
    exportCsvUrl,
  };
}

/** Parse `DD/MM/YYYY` → Date or null. */
export function parseAdminFecha(s) {
  const m = String(s || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const mon = Number(m[2]) - 1;
  let yr = Number(m[3]);
  if (yr < 100) yr += 2000;
  const d = new Date(yr, mon, day);
  return Number.isFinite(d.getTime()) ? d : null;
}

/** Returns days since the parsed fecha (B); null if unparseable. */
export function ageDays(fechaStr, now = new Date()) {
  const d = parseAdminFecha(fechaStr);
  if (!d) return null;
  const ms = now.getTime() - d.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function healthLevel(fechaStr, estado) {
  if (String(estado || "").toLowerCase() === "enviado") return "ok";
  const age = ageDays(fechaStr);
  if (age == null) return "none";
  if (age >= 14) return "late";
  if (age >= 7) return "warn";
  return "ok";
}

export function computeStats(rows) {
  let pendientes = 0;
  let aprobadas = 0;
  let conError = 0;
  let edadAlta = 0;
  for (const r of rows) {
    const estado = String(r.estado || "").trim();
    const respuesta = String(r.respuesta || "");
    if (estado === "Aprobado") aprobadas += 1;
    if (estado === "" || estado !== "Aprobado") {
      if (estado !== "Enviado") pendientes += 1;
    }
    if (respuesta.startsWith("⚠")) conError += 1;
    if (estado !== "Enviado") {
      const age = ageDays(r.fecha);
      if (age != null && age >= 14) edadAlta += 1;
    }
  }
  return { pendientes, aprobadas, conError, edadAlta };
}

export function filterRows(rows, { statusFilter, search }) {
  const q = String(search || "").trim().toLowerCase();
  return rows.filter((r) => {
    if (q) {
      const hay = `${r.cliente || ""} ${r.consulta || ""} ${r.telefono || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    const estado = String(r.estado || "").trim();
    const respuesta = String(r.respuesta || "");
    switch (statusFilter) {
      case "pendientes":
        return estado !== "Aprobado" && estado !== "Enviado";
      case "aprobadas":
        return estado === "Aprobado";
      case "error":
        return respuesta.startsWith("⚠");
      case "atrasadas": {
        if (estado === "Enviado") return false;
        const age = ageDays(r.fecha);
        return age != null && age >= 14;
      }
      default:
        return true;
    }
  });
}
