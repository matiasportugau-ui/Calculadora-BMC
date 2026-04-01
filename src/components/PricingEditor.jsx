// ═══════════════════════════════════════════════════════════════════════════
// PricingEditor.jsx — Editor de precios y costos en Config
// Edición individual y en masa
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useMemo, useRef, useEffect } from "react";
import { Search, Percent, RotateCcw, Download, Upload, RefreshCw, UploadCloud } from "lucide-react";
import {
  getPricingItemsFlat,
  getValueAtPath,
  getPricing,
  invalidatePricingCache,
} from "../data/pricing.js";
import {
  setPricingOverride,
  setPricingOverridesBulk,
  applyBulkPercent,
  resetPricingOverrides,
  getPricingOverrides,
} from "../utils/pricingOverrides.js";
import { C, FONT, IVA_MULT } from "../data/constants.js";
import { getCalcApiBase } from "../utils/calcApiBase.js";
import {
  findVentaColumnIndex,
  findVentaWebColumnIndex,
  findVentaWebIvaIncColumnIndex,
  parseCsvNumber,
  parseCsvRows,
  getDuplicatePathReportFromRows,
} from "../utils/csvPricingImport.js";

const MATRIZ_PUSH_TOKEN_KEY = "bmc_matriz_push_token";

export default function PricingEditor({ onSave }) {
  const [items, setItems] = useState(() => getPricingItemsFlat());
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [bulkPercent, setBulkPercent] = useState("");
  const [bulkField, setBulkField] = useState("web");
  const [editing, setEditing] = useState(null);
  const [importMsg, setImportMsg] = useState(null);
  const [cargandoMatriz, setCargandoMatriz] = useState(false);
  const [hoveredRow, setHoveredRow] = useState(null);
  const [pushMsg, setPushMsg] = useState(null);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushToken, setPushToken] = useState(() => {
    try {
      return sessionStorage.getItem(MATRIZ_PUSH_TOKEN_KEY) || "";
    } catch {
      return "";
    }
  });
  const fileInputRef = useRef(null);

  useEffect(() => {
    const env = typeof import.meta !== "undefined" ? import.meta.env?.VITE_BMC_API_AUTH_TOKEN : "";
    try {
      if (env && !sessionStorage.getItem(MATRIZ_PUSH_TOKEN_KEY)) {
        setPushToken(String(env));
      }
    } catch {
      /* ignore */
    }
  }, []);

  const persistPushToken = (t) => {
    setPushToken(t);
    try {
      sessionStorage.setItem(MATRIZ_PUSH_TOKEN_KEY, t);
    } catch {
      /* ignore */
    }
  };

  const handleMatrizPush = async (dryRun) => {
    const overrides = getPricingOverrides();
    const keys = Object.keys(overrides);
    if (keys.length === 0) {
      setPushMsg("No hay overrides guardados: editá celdas o importá CSV primero.");
      return;
    }
    const envTok = typeof import.meta !== "undefined" ? import.meta.env?.VITE_BMC_API_AUTH_TOKEN : "";
    const token = String(pushToken || envTok || "").trim();
    if (!token) {
      setPushMsg(
        "Falta token: pegá API_AUTH_TOKEN del servidor (mismo que CRM cockpit) o usá VITE_BMC_API_AUTH_TOKEN solo en build interno."
      );
      return;
    }
    setPushLoading(true);
    setPushMsg(null);
    const base = getCalcApiBase();
    try {
      const res = await fetch(`${base}/api/matriz/push-pricing-overrides`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ overrides, dryRun }),
      });
      let data = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }
      if (!res.ok) {
        setPushMsg("Error: " + (data.error || res.statusText));
        return;
      }
      const plannedCount = Array.isArray(data.planned) ? data.planned.length : 0;
      const skipped = data.skippedPaths || [];
      if (data.dryRun) {
        let msg = `Simulación: ${plannedCount} fila(s) MATRIZ coinciden; ${skipped.length} path(s) sin fila en pestañas configuradas.`;
        if (skipped.length) {
          msg += " Sin fila: " + skipped.slice(0, 10).join(", ") + (skipped.length > 10 ? "…" : "");
        }
        setPushMsg(msg);
        return;
      }
      let msg = `MATRIZ actualizada: ${data.updated ?? 0} celda(s); ${skipped.length} path(s) sin fila.`;
      if (skipped.length) {
        msg += " Sin fila: " + skipped.slice(0, 10).join(", ") + (skipped.length > 10 ? "…" : "");
      }
      setPushMsg(msg);
    } catch (err) {
      setPushMsg("Error de red: " + (err.message || String(err)));
    } finally {
      setPushLoading(false);
    }
  };

  const handleCargarDesdeMatriz = async () => {
    setCargandoMatriz(true);
    setImportMsg(null);
    const base = getCalcApiBase();
    try {
      const res = await fetch(`${base}/api/actualizar-precios-calculadora`);
      const text = await res.text();
      if (!res.ok) {
        let err = res.statusText;
        try {
          err = JSON.parse(text || "{}").error || err;
        } catch {
          err = text?.trim() || err;
        }
        throw new Error(err);
      }
      const rows = parseCsvRows(text.replace(/^\uFEFF/, ""));
      if (rows.length < 2) {
        setImportMsg("La MATRIZ no devolvió datos.");
        return;
      }
      const cols = rows[0].map((c) => String(c || "").trim());
      const pathIdx = cols.findIndex((c) => c.toLowerCase() === "path");
      const costoIdx = cols.findIndex((c) => /costo/i.test(c));
      const ventaIdx = findVentaColumnIndex(cols);
      const webIdx = findVentaWebColumnIndex(cols);
      const webIvaIdx = findVentaWebIvaIncColumnIndex(cols);
      if (pathIdx < 0) {
        setImportMsg("La MATRIZ no tiene columna 'path'.");
        return;
      }
      const updates = {};
      let count = 0;
      for (let i = 1; i < rows.length; i++) {
        const cells = rows[i];
        const path = cells[pathIdx]?.trim();
        if (!path) continue;
        if (costoIdx >= 0 && cells[costoIdx]) {
          const v = parseCsvNumber(cells[costoIdx]);
          if (v != null) { updates[`${path}.costo`] = v; count++; }
        }
        if (ventaIdx >= 0 && cells[ventaIdx]) {
          const v = parseCsvNumber(cells[ventaIdx]);
          if (v != null) { updates[`${path}.venta`] = v; count++; }
        }
        if (webIdx >= 0 && cells[webIdx]) {
          const v = parseCsvNumber(cells[webIdx]);
          if (v != null) { updates[`${path}.web`] = v; count++; }
        }
      }
      const dupReport = getDuplicatePathReportFromRows(rows, pathIdx);
      let msg = `Cargados ${count} valores desde MATRIZ (costo ex IVA, venta BMC ex IVA, venta web ex IVA).`;
      if (webIvaIdx >= 0) {
        msg += " Web c/IVA se recalcula en la UI desde Web ex IVA.";
      }
      if (dupReport.length) {
        const preview = dupReport.map((d) => d.path).slice(0, 5).join("; ");
        msg += ` Atención: ${dupReport.length} path(s) duplicado(s) — prevalece la última fila: ${preview}${dupReport.length > 5 ? "…" : ""}`;
      }
      setPricingOverridesBulk(updates);
      invalidatePricingCache();
      refresh();
      setImportMsg(msg);
      onSave?.();
    } catch (err) {
      setImportMsg("Error: " + (err.message || "no se pudo cargar la MATRIZ"));
    } finally {
      setCargandoMatriz(false);
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      (i) =>
        i.label?.toLowerCase().includes(q) ||
        i.path?.toLowerCase().includes(q) ||
        i.categoria?.toLowerCase().includes(q)
    );
  }, [items, search]);

  const displayRows = useMemo(
    () =>
      filtered.map((item) => ({
        ...item,
        ventaIvaInc:
          item.venta != null ? +((Number(item.venta) || 0) * IVA_MULT).toFixed(2) : null,
        webIvaInc:
          item.web != null ? +((Number(item.web) || 0) * IVA_MULT).toFixed(2) : null,
      })),
    [filtered]
  );

  const refresh = () => {
    invalidatePricingCache();
    setItems(getPricingItemsFlat());
  };

  const handleCellChange = (path, field, value) => {
    const fullPath = `${path}.${field}`;
    if (value === "" || value == null) {
      setPricingOverride(fullPath, null);
    } else {
      const num = parseFloat(value);
      if (isNaN(num) || num < 0) return;
      setPricingOverride(fullPath, num);
    }
    refresh();
    setEditing(null);
    onSave?.();
  };

  const handleBulkApply = () => {
    const pct = parseFloat(bulkPercent);
    if (isNaN(pct) || selected.size === 0) return;
    const paths = [...selected];
    const pricing = getPricing();
    const getCurrent = (fullPath) => getValueAtPath(pricing, fullPath);
    applyBulkPercent(paths, bulkField, pct, getCurrent);
    invalidatePricingCache();
    refresh();
    setItems(getPricingItemsFlat());
    setBulkPercent("");
    setSelected(new Set());
    onSave?.();
  };

  const handleReset = () => {
    if (!confirm("¿Restaurar todos los precios a los valores por defecto? Se perderán los cambios.")) return;
    resetPricingOverrides();
    invalidatePricingCache();
    refresh();
    setSelected(new Set());
    onSave?.();
  };

  const toggleSelect = (path) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((i) => i.path)));
  };

  const handleDownloadPlanilla = () => {
    const headers = ["path", "label", "categoria", "costo", "venta_bmc_local", "venta_web", "venta_web_iva_inc", "unidad"];
    const rows = items.map((i) => [
      i.path,
      (i.label || "").replace(/"/g, '""'),
      (i.categoria || "").replace(/"/g, '""'),
      i.costo != null ? String(i.costo) : "",
      i.venta != null ? String(i.venta) : "",
      i.web != null ? String(i.web) : "",
      i.web != null ? String(+((Number(i.web) || 0) * IVA_MULT).toFixed(2)) : "",
      (i.unidad || "").replace(/"/g, '""'),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => (c.includes(",") || c.includes('"') ? `"${c}"` : c)).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bmc-precios-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportPlanilla = (e) => {
    const file = e?.target?.files?.[0];
    if (!file) return;
    setImportMsg(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result);
        const rows = parseCsvRows(text.replace(/^\uFEFF/, ""));
        if (rows.length < 2) {
          setImportMsg("El archivo está vacío o no tiene datos.");
          return;
        }
        const cols = rows[0].map((c) => String(c || "").trim());
        const pathIdx = cols.findIndex((c) => c.toLowerCase() === "path");
        const costoIdx = cols.findIndex((c) => /costo/i.test(c));
        const ventaIdx = findVentaColumnIndex(cols);
        const webIdxExact = findVentaWebColumnIndex(cols);
        const webIdx =
          webIdxExact >= 0 ? webIdxExact : cols.findIndex((c) => String(c || "").trim().toLowerCase() === "web");
        const webIvaIdx = findVentaWebIvaIncColumnIndex(cols);
        if (pathIdx < 0) {
          setImportMsg("La planilla debe tener columna 'path'.");
          return;
        }
        const updates = {};
        let count = 0;
        for (let i = 1; i < rows.length; i++) {
          const cells = rows[i];
          const path = cells[pathIdx]?.trim();
          if (!path) continue;
          if (costoIdx >= 0 && cells[costoIdx]) {
            const v = parseCsvNumber(cells[costoIdx]);
            if (v != null) { updates[`${path}.costo`] = v; count++; }
          }
          if (ventaIdx >= 0 && cells[ventaIdx]) {
            const v = parseCsvNumber(cells[ventaIdx]);
            if (v != null) { updates[`${path}.venta`] = v; count++; }
          }
          if (webIdx >= 0 && cells[webIdx]) {
            const v = parseCsvNumber(cells[webIdx]);
            if (v != null) { updates[`${path}.web`] = v; count++; }
          }
        }
        const dupReport = getDuplicatePathReportFromRows(rows, pathIdx);
        let msg = `Importados ${count} valores correctamente.`;
        if (webIvaIdx >= 0) {
          msg += " Web c/IVA se recalcula desde Web ex IVA.";
        }
        if (dupReport.length) {
          const preview = dupReport.map((d) => d.path).slice(0, 5).join("; ");
          msg += ` Atención: ${dupReport.length} path(s) duplicado(s) — prevalece la última fila: ${preview}${dupReport.length > 5 ? "…" : ""}`;
        }
        setPricingOverridesBulk(updates);
        invalidatePricingCache();
        refresh();
        setImportMsg(msg);
        onSave?.();
        if (fileInputRef.current) fileInputRef.current.value = "";
      } catch (err) {
        setImportMsg("Error al leer el archivo: " + (err.message || "formato inválido"));
      }
    };
    reader.readAsText(file, "UTF-8");
  };

  const inputS = {
    width: 70,
    padding: "6px 8px",
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    fontSize: 13,
    textAlign: "right",
    fontFamily: "inherit",
  };
  const labelS = { fontSize: 11, fontWeight: 600, color: C.ts, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Descripción clara */}
      <div style={{ padding: 12, background: C.primarySoft, borderRadius: 12, border: `1px solid ${C.primary}`, fontSize: 12, color: C.tp, lineHeight: 1.5 }}>
        <strong>Editar costos y precios de venta</strong>
        <p style={{ margin: "6px 0 0 0" }}>Clic en cualquier celda para editar. Aplica a todos los productos y servicios.</p>
        <ul style={{ margin: "8px 0 0 16px", padding: 0 }}>
          <li>
            <strong>Costo / Venta BMC / Venta Web</strong> — <strong>USD sin IVA</strong> (el total del presupuesto suma IVA una sola vez al final).
          </li>
          <li>
            <strong>Derivados c/IVA:</strong> <strong>Venta BMC c/IVA</strong> y <strong>Web c/IVA</strong> se calculan en esta UI como <strong>ex IVA × 1,22</strong>.
          </li>
          <li>
            <strong>MATRIZ — columnas operativas:</strong> <strong>F</strong> = costo ex IVA, <strong>L</strong> = Venta BMC ex IVA, <strong>T</strong> = Venta Web ex IVA. La UI calcula automáticamente las columnas c/IVA.
          </li>
        </ul>
      </div>

      {/* Button groups: MATRIZ | Download/Import */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 11, color: C.ts }}>Editar en Excel o Google Sheets y reimportar para modificación en masa.</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", paddingRight: 12, borderRight: `1px solid ${C.border}` }}>
        <button
          onClick={handleCargarDesdeMatriz}
          disabled={cargandoMatriz}
          style={{
            padding: "10px 16px",
            borderRadius: 10,
            border: `1px solid ${C.primary}`,
            background: C.primarySoft,
            color: C.primary,
            fontSize: 13,
            fontWeight: 600,
            cursor: cargandoMatriz ? "wait" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            opacity: cargandoMatriz ? 0.7 : 1,
          }}
          title="Cargar desde MATRIZ: costo ex IVA, venta BMC ex IVA y venta web ex IVA"
        >
          <RefreshCw size={16} />
          {cargandoMatriz ? "Cargando..." : "Cargar desde MATRIZ"}
        </button>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <a
          href={`${getCalcApiBase()}/api/actualizar-precios-calculadora`}
          download="bmc-precios-matriz.csv"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            padding: "10px 16px",
            borderRadius: 10,
            border: `1px solid ${C.border}`,
            background: C.surface,
            color: C.primary,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            textDecoration: "none",
          }}
        >
          <Download size={16} />
          Descargar CSV de MATRIZ
        </a>
        <button
          onClick={handleDownloadPlanilla}
          style={{
            padding: "10px 16px",
            borderRadius: 10,
            border: `1px solid ${C.primary}`,
            background: C.surface,
            color: C.primary,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Download size={16} />
          Descargar planilla editable (CSV)
        </button>
        <label style={{
          padding: "10px 16px",
          borderRadius: 10,
          border: `1px solid ${C.border}`,
          background: C.surface,
          color: C.tp,
          fontSize: 13,
          fontWeight: 500,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}>
          <Upload size={16} />
          Importar planilla modificada
          <input ref={fileInputRef} type="file" accept=".csv" onChange={handleImportPlanilla} style={{ display: "none" }} />
        </label>
        </div>
        </div>
        {importMsg && <span style={{ fontSize: 12, color: importMsg.includes("Error") ? C.danger : C.primary, display: "block", marginTop: 8 }}>{importMsg}</span>}

        <div style={{ marginTop: 16, padding: 12, borderRadius: 12, border: `1px solid ${C.border}`, background: C.surface }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.tp, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Sincronizar overrides → MATRIZ (Google Sheets)
          </div>
          <div style={{ fontSize: 11, color: C.ts, marginBottom: 8, lineHeight: 1.45 }}>
            Usa el mismo <code style={{ fontSize: 10 }}>API_AUTH_TOKEN</code> que el CRM cockpit. Primero <strong>simular</strong>, luego escribir.
            Solo actualiza filas cuyo SKU (col D) está en el mapeo y en pestañas configuradas en el servidor (p. ej. BROMYROS).
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 8 }}>
            <input
              type="password"
              autoComplete="off"
              placeholder="API_AUTH_TOKEN (se guarda en esta sesión del navegador)"
              value={pushToken}
              onChange={(e) => persistPushToken(e.target.value)}
              style={{
                flex: "1 1 220px",
                minWidth: 200,
                padding: "8px 10px",
                borderRadius: 8,
                border: `1px solid ${C.border}`,
                fontSize: 12,
              }}
            />
            <button
              type="button"
              disabled={pushLoading}
              onClick={() => handleMatrizPush(true)}
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                border: `1px solid ${C.border}`,
                background: C.surface,
                fontSize: 12,
                fontWeight: 600,
                cursor: pushLoading ? "wait" : "pointer",
              }}
            >
              Simular envío
            </button>
            <button
              type="button"
              disabled={pushLoading}
              onClick={() => {
                if (!confirm("¿Escribir en la MATRIZ los valores de overrides actuales? Esto modifica la planilla en Google.")) return;
                handleMatrizPush(false);
              }}
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                border: `1px solid ${C.primary}`,
                background: C.primarySoft,
                color: C.primary,
                fontSize: 12,
                fontWeight: 600,
                cursor: pushLoading ? "wait" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <UploadCloud size={14} />
              Escribir en MATRIZ
            </button>
          </div>
          {pushMsg && (
            <span style={{ fontSize: 12, color: /^(Error|Falta token)/i.test(pushMsg) ? C.danger : C.primary, display: "block" }}>{pushMsg}</span>
          )}
        </div>
      </div>

      {/* Buscador */}
      <div style={{ position: "relative" }}>
        <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.ts }} />
        <input
          type="text"
          placeholder="Buscar por nombre, SKU o categoría..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 12px 10px 40px",
            borderRadius: 10,
            border: `1px solid ${C.border}`,
            fontSize: 14,
            outline: "none",
          }}
        />
      </div>

      {/* Edición en masa */}
      {selected.size > 0 && (
        <div style={{ padding: 12, background: C.primarySoft, borderRadius: 12, border: `1px solid ${C.primary}` }}>
          <div style={{ ...labelS, marginBottom: 8 }}>Edición en masa ({selected.size} ítems)</div>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 10, color: C.ts, marginBottom: 2 }}>Campo</div>
              <select
                value={bulkField}
                onChange={(e) => setBulkField(e.target.value)}
                style={{ ...inputS, width: 140 }}
              >
                <option value="costo">Costo</option>
                <option value="venta">Precio Venta BMC (Local)</option>
                <option value="web">Precio Venta Web</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 10, color: C.ts, marginBottom: 2 }}>Variación %</div>
              <input
                type="number"
                placeholder="ej. 10"
                value={bulkPercent}
                onChange={(e) => setBulkPercent(e.target.value)}
                style={inputS}
              />
            </div>
            <button
              onClick={handleBulkApply}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                background: C.primary,
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Percent size={14} />
              Aplicar
            </button>
            <button onClick={() => setSelected(new Set())} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface, fontSize: 12, cursor: "pointer" }}>
              Deseleccionar
            </button>
          </div>
        </div>
      )}

      {/* Tabla */}
      <div style={{ overflowX: "auto", maxHeight: 400, overflowY: "auto", borderRadius: 12, border: `1px solid ${C.border}`, fontFamily: FONT }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead style={{ position: "sticky", top: 0, background: C.brand, color: "#fff", zIndex: 1, boxShadow: "0 2px 4px rgba(0,0,0,0.06)" }}>
            <tr>
              <th style={{ padding: "12px 10px", textAlign: "left", borderBottom: "none", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll} />
              </th>
              <th style={{ padding: "12px 10px", textAlign: "left", borderBottom: "none", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Ítem</th>
              <th style={{ padding: "12px 10px", textAlign: "right", borderBottom: "none", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }} title="Costo unitario USD s/IVA">Costo</th>
              <th style={{ padding: "12px 10px", textAlign: "right", borderBottom: "none", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }} title="Precio venta directa BMC USD s/IVA">Venta BMC ex IVA</th>
              <th style={{ padding: "12px 10px", textAlign: "right", borderBottom: "none", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }} title="Precio venta directa BMC USD c/IVA">Venta BMC c/IVA</th>
              <th style={{ padding: "12px 10px", textAlign: "right", borderBottom: "none", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }} title="Precio venta web USD s/IVA">Venta Web ex IVA</th>
              <th style={{ padding: "12px 10px", textAlign: "right", borderBottom: "none", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }} title="Precio venta web USD c/IVA calculado desde Web ex IVA">Web c/IVA</th>
              <th style={{ padding: "12px 10px", textAlign: "center", borderBottom: "none", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Unidad</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row) => (
                <tr
                  key={row.path}
                  onMouseEnter={() => setHoveredRow(row.path)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{
                    background: selected.has(row.path) ? C.primarySoft : hoveredRow === row.path ? C.surfaceAlt : "transparent",
                    transition: "background 120ms ease",
                  }}
                >
                  <td style={{ padding: "6px" }}>
                    <input type="checkbox" checked={selected.has(row.path)} onChange={() => toggleSelect(row.path)} />
                  </td>
                  <td style={{ padding: "6px", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }} title={row.path}>
                    <span style={{ fontWeight: 500 }}>{row.label}</span>
                    <div style={{ fontSize: 10, color: C.ts }}>{row.categoria}</div>
                  </td>
                  {["costo", "venta"].map((field) => {
                    const val = row[field];
                    const key = `${row.path}.${field}`;
                    const isEditing = editing === key;
                    return (
                      <td key={field} style={{ padding: "4px 6px", textAlign: "right" }}>
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            defaultValue={val}
                            autoFocus
                            onBlur={(e) => handleCellChange(row.path, field, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleCellChange(row.path, field, e.target.value);
                              if (e.key === "Escape") setEditing(null);
                            }}
                            style={inputS}
                          />
                        ) : (
                          <span
                            onClick={() => setEditing(key)}
                            style={{
                              cursor: "pointer",
                              padding: "4px 8px",
                              borderRadius: 6,
                              display: "inline-block",
                              minWidth: 50,
                            }}
                            title="Clic para editar"
                          >
                            {val != null ? Number(val).toFixed(2) : "—"}
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td style={{ padding: "4px 6px", textAlign: "right" }}>
                    <span style={{ padding: "4px 8px", borderRadius: 6, display: "inline-block", minWidth: 50, color: C.ts }}>
                      {row.ventaIvaInc != null ? Number(row.ventaIvaInc).toFixed(2) : "—"}
                    </span>
                  </td>
                  {["web"].map((field) => {
                    const val = row[field];
                    const key = `${row.path}.${field}`;
                    const isEditing = editing === key;
                    return (
                      <td key={field} style={{ padding: "4px 6px", textAlign: "right" }}>
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            defaultValue={val}
                            autoFocus
                            onBlur={(e) => handleCellChange(row.path, field, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleCellChange(row.path, field, e.target.value);
                              if (e.key === "Escape") setEditing(null);
                            }}
                            style={inputS}
                          />
                        ) : (
                          <span
                            onClick={() => setEditing(key)}
                            style={{ cursor: "pointer", padding: "4px 8px", borderRadius: 6, display: "inline-block", minWidth: 50 }}
                            title="Clic para editar"
                          >
                            {val != null ? Number(val).toFixed(2) : "—"}
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td style={{ padding: "4px 6px", textAlign: "right" }}>
                    <span style={{ padding: "4px 8px", borderRadius: 6, display: "inline-block", minWidth: 50, color: C.ts }}>
                      {row.webIvaInc != null ? Number(row.webIvaInc).toFixed(2) : "—"}
                    </span>
                  </td>
                  <td style={{ padding: "6px", textAlign: "center", fontSize: 11, color: C.ts }}>{row.unidad || "—"}</td>
                </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Acciones */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
        <span style={{ fontSize: 11, color: C.ts }}>{displayRows.length} ítems · {getPricingOverrides() && Object.keys(getPricingOverrides()).length} con override</span>
        <button
          onClick={handleReset}
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            border: `1px solid ${C.border}`,
            background: C.surface,
            fontSize: 12,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <RotateCcw size={14} />
          Restaurar precios
        </button>
      </div>
    </div>
  );
}
