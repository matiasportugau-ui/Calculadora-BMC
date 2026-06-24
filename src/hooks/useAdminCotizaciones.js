import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCalcApiBase } from "../utils/calcApiBase.js";
import { addBugLog, addErrorToBugLog } from "../utils/bugCapture.js";
import { mapCockpitAuthError } from "../utils/operatorApiClient.js";
import { useCockpitOperatorAuth } from "./useCockpitOperatorAuth.js";

// TODO refactor split (no behavior change, ~407 LOC today): three slice hooks
//   useToken          — identity JWT via useCockpitOperatorAuth (S5 Phase B)
//   useBatchOpts      — persist batch flags in localStorage[bmc_admin_quote_batch_opts]
//   useRowActions     — load/sync/save/approve/markEnviado bulk + per-row mutations
// Keep this hook as composer until slices land in a follow-up PR.

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
      addBugLog("error", "wolfboard_api_timeout", { path, timeoutMs });
      return { ok: false, status: 0, data: { error: `Request timed out after ${Math.round(timeoutMs / 1000)}s` } };
    }
    addErrorToBugLog(e, { module: "wolfboard", path });
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
  const {
    token,
    tokenAutoLoaded,
    tokenLoadError,
    tokenInput,
    setTokenInput,
    saveToken,
    clearToken,
    isJwt,
    login,
    user,
    authReady,
    tokenReady,
    refreshAccess,
  } = useCockpitOperatorAuth({ role: "admin" });

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
      // Borrador integration from Cotizar button work (hybrid model)
      borradorPdf: p.borradorPdf || p["Borrador PDF"] || "",
      borradorExplicacion: p.borradorExplicacion || p["Borrador Explicación"] || "",
      responsable: p.responsable || p.ASIGNADO_A || p.asignado || "",
      replaySnapshotUrl: "",
      sheetUrl: p.sheetUrl || "",
    };
  }

  const load = useCallback(async ({ retryAfterRefresh = false } = {}) => {
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
      if (
        adminRes.status === 401 &&
        isJwt &&
        !retryAfterRefresh &&
        typeof refreshAccess === "function"
      ) {
        const refreshed = await refreshAccess();
        if (refreshed) return;
      }
      setError(mapCockpitAuthError(adminRes.data?.error, adminRes.status));
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

    // Enrich with any borrador/responsable data that may come from the sheet via wolfboard
    const enrichedAdminRows = adminRows.map(r => ({
      ...r,
      borradorPdf: r.borradorPdf || r["Borrador PDF"] || r.borrador_pdf || "",
      borradorExplicacion: r.borradorExplicacion || r["Borrador Explicación"] || "",
      responsable: r.responsable || r.ASIGNADO_A || r.asignado || r.responsable || "",
    }));

    setRows([...enrichedAdminRows, ...mlRows]);
    setSheetRowCount(typeof adminRes.data.sheetRowCount === "number" ? adminRes.data.sheetRowCount : null);
    setSelected(new Set());
  }, [token, scope, isJwt, refreshAccess]);

  // Refetch on token/scope change — wait until identity JWT refresh completes.
  useEffect(() => {
    if (!authReady || !tokenReady) return;
    if (!token) { setRows([]); setSheetRowCount(null); return; }
    load();
  }, [token, scope, load, authReady, tokenReady]);

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
    if (!ok) addBugLog("error", "wolfboard_batch_api_error", { status, err: data?.error });
    setBusyOp(null);
    if (!ok) { showToast(data?.error || `Error en batch IA (HTTP ${status})`); return; }
    showToast(`IA: ${data.successful ?? 0} generadas · ${data.failed ?? 0} fallidas · ${data.skipped ?? 0} omitidas`);
    await load();
  }, [token, load, showToast, batchOpts]);

  // =====================================================
  // TANDA 1: Ownership + Borrador Integration + Quick Actions
  // =====================================================

  const assignTo = useCallback(async (row, responsable) => {
    if (!token || !row) return { ok: false };
    setBusyOp("assign");
    const body = {
      adminRow: row.rowNum,
      responsable: responsable || "",
    };
    const { ok, status, data } = await apiFetch(token, "/api/wolfboard/row", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusyOp(null);
    if (!ok) {
      showToast(data?.error || `Error al asignar (HTTP ${status})`);
      return { ok: false };
    }
    await load();
    showToast(`Asignado a ${responsable || "(sin responsable)"}`);
    return { ok: true };
  }, [token, load, showToast]);

  const getBorradorInfo = useCallback((row) => {
    if (!row) return { hasBorrador: false };
    const pdf = row.borradorPdf || row["Borrador PDF"] || row.borrador_pdf || "";
    const explic = row.borradorExplicacion || row["Borrador Explicación"] || "";
    return {
      hasBorrador: !!(pdf || explic),
      pdfLink: pdf,
      explicacion: explic,
      fecha: row.fechaBorrador || row["Fecha Generación Borrador"] || "",
    };
  }, []);

  const openBorrador = useCallback((row) => {
    const info = getBorradorInfo(row);
    if (info.pdfLink) {
      window.open(info.pdfLink, "_blank");
    } else if (row.sheetUrl) {
      window.open(row.sheetUrl, "_blank");
    }
  }, [getBorradorInfo]);

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

  const downloadExportCsv = useCallback(async () => {
    if (!token) {
      showToast("Iniciá sesión para exportar.");
      return;
    }
    const base = getCalcApiBase().replace(/\/+$/, "");
    const q = `?scope=${encodeURIComponent(scope)}`;
    try {
      const res = await fetch(`${base}/api/wolfboard/export${q}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        showToast(d?.error || `Export falló (HTTP ${res.status})`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wolfboard-pendientes-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      showToast(e?.message || "Error al exportar CSV");
    }
  }, [token, scope, showToast]);

  const filtered = useMemo(() => filterRows(rows, { statusFilter, search }), [rows, statusFilter, search]);
  const stats = useMemo(() => computeStats(rows), [rows]);

  return {
    // token
    token,
    tokenAutoLoaded,
    tokenLoadError,
    tokenInput,
    setTokenInput,
    saveToken,
    clearToken,
    isJwt,
    login,
    userEmail: user?.email || "",

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
    downloadExportCsv,

    // Tanda 1 - New best-practice lead management actions
    assignTo,
    getBorradorInfo,
    openBorrador,
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
  let borrador = 0;
  let revision = 0;
  let aprobadas = 0;
  let enviadas = 0;
  let conError = 0;
  let urgentes = 0;

  for (const r of rows) {
    const estado = String(r.estado || "").trim().toLowerCase();
    const respuesta = String(r.respuesta || "");
    const age = ageDays(r.fecha);

    if (estado.includes("aprobado")) aprobadas += 1;
    else if (estado.includes("enviado")) enviadas += 1;
    else if (estado.includes("borrador")) borrador += 1;
    else if (estado.includes("revis")) revision += 1;
    else pendientes += 1;

    if (respuesta.startsWith("⚠")) conError += 1;

    if (!estado.includes("enviado") && age != null && age >= 7) urgentes += 1;
  }

  return { pendientes, borrador, revision, aprobadas, enviadas, conError, urgentes };
}

export function filterRows(rows, { statusFilter, search }) {
  const q = String(search || "").trim().toLowerCase();
  return rows.filter((r) => {
    if (q) {
      const hay = `${r.cliente || ""} ${r.consulta || ""} ${r.telefono || ""} ${r.respuesta || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    const estado = String(r.estado || "").trim().toLowerCase();
    const respuesta = String(r.respuesta || "");
    const age = ageDays(r.fecha);

    switch (statusFilter) {
      case "nuevas":
        return age != null && age <= 2; // últimas 48h
      case "pendientes":
        return !estado.includes("aprobado") && !estado.includes("enviado") && !estado.includes("borrador") && !estado.includes("revis");
      case "borrador":
        return estado.includes("borrador");
      case "revision":
        return estado.includes("revis");
      case "aprobadas":
        return estado.includes("aprobado");
      case "enviadas":
        return estado.includes("enviado");
      case "urgentes": {
        if (estado.includes("enviado")) return false;
        return age != null && age >= 7; // 7+ días sin cerrar = urgente
      }
      case "error":
        return respuesta.startsWith("⚠");
      case "atrasadas": {
        if (estado.includes("enviado")) return false;
        return age != null && age >= 14;
      }
      default:
        return true;
    }
  });
}
