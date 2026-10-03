import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToken } from "./admin-cotizaciones/useToken.js";
import { useBatchOpts } from "./admin-cotizaciones/useBatchOpts.js";
import { useRowActions } from "./admin-cotizaciones/useRowActions.js";

/**
 * Hook orchestrating the Administrador de Cotizaciones v2 module.
 * Composer over three slices: useToken, useBatchOpts, useRowActions.
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
  } = useToken();

  const [scope, setScopeState] = useState("consulta"); // "consulta" | "admin"
  const [statusFilter, setStatusFilterState] = useState("todas");
  const [search, setSearchState] = useState("");
  const [selected, setSelected] = useState(() => new Set());

  const [toast, setToastState] = useState("");

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

  const { batchOpts, updateBatchOpts, resetBatchOpts } = useBatchOpts();
  const {
    rows,
    sheetRowCount,
    loading,
    busyOp,
    error,
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
    assignTo,
    getBorradorInfo,
    openBorrador,
  } = useRowActions({ token, scope, batchOpts, showToast, setSelected });

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
