// ═══════════════════════════════════════════════════════════════════════════
// DimensioningFormulasEditor.jsx — Descargar/upload fórmulas de dimensionamiento
// Parámetros que determinan cantidades de productos (fijaciones, selladores, etc.)
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useMemo, useRef } from "react";
import { Search, Download, Upload, RotateCcw } from "lucide-react";
import {
  getDimensioningItemsFlat,
  applyDimensioningImport,
} from "../utils/dimensioningFormulas.js";
import {
  setDimensioningOverride,
  setDimensioningFormulaOverride,
  setDimensioningFormulaOverridesBulk,
  resetDimensioningOverrides,
  getDimensioningOverrides,
  getDimensioningFormulaOverrides,
} from "../utils/dimensioningFormulasOverrides.js";
import { invalidatePricingCache } from "../data/pricing.js";
import { C, FONT } from "../data/constants.js";

export default function DimensioningFormulasEditor({ onSave }) {
  const [items, setItems] = useState(() => getDimensioningItemsFlat());
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [editingFormula, setEditingFormula] = useState(null);
  const [importMsg, setImportMsg] = useState(null);
  const [hoveredRow, setHoveredRow] = useState(null);
  const fileInputRef = useRef(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      (i) =>
        i.label?.toLowerCase().includes(q) ||
        i.path?.toLowerCase().includes(q) ||
        i.categoria?.toLowerCase().includes(q) ||
        i.formula?.toLowerCase().includes(q)
    );
  }, [items, search]);

  const refresh = () => {
    invalidatePricingCache();
    setItems(getDimensioningItemsFlat());
  };

  const handleCellChange = (path, value) => {
    const num = parseFloat(value);
    if (value === "" || value == null) {
      setDimensioningOverride(path, null);
    } else if (!isNaN(num) && num >= 0) {
      setDimensioningOverride(path, num);
    }
    refresh();
    setEditing(null);
    onSave?.();
  };

  const handleFormulaChange = (path, formula) => {
    setDimensioningFormulaOverride(path, formula);
    refresh();
    setEditingFormula(null);
    onSave?.();
  };

  const handleReset = () => {
    if (!confirm("¿Restaurar todas las fórmulas a los valores por defecto?")) return;
    resetDimensioningOverrides();
    invalidatePricingCache();
    refresh();
    onSave?.();
  };

  const handleDownload = () => {
    const headers = ["path", "label", "categoria", "formula", "valor", "default", "unidad"];
    const rows = items.map((i) => [
      i.path,
      (i.label || "").replace(/"/g, '""'),
      (i.categoria || "").replace(/"/g, '""'),
      (i.formula || "").replace(/"/g, '""'),
      i.valor != null ? String(i.valor) : "",
      i.default != null ? String(i.default) : "",
      (i.unidad || "").replace(/"/g, '""'),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => (c.includes(",") || c.includes('"') ? `"${c}"` : c)).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bmc-formulas-dimensionamiento-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e) => {
    const file = e?.target?.files?.[0];
    if (!file) return;
    setImportMsg(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result);
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        if (lines.length < 2) {
          setImportMsg("El archivo está vacío o no tiene datos.");
          return;
        }
        const cols = lines[0].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
        const pathIdx = cols.findIndex((c) => c.toLowerCase() === "path");
        const valorIdx = cols.findIndex((c) => /valor|value/i.test(c));
        const formulaIdx = cols.findIndex((c) => /formula|uso/i.test(c));
        if (pathIdx < 0) {
          setImportMsg("El archivo debe tener columna 'path'.");
          return;
        }
        const valueUpdates = {};
        const formulaUpdates = {};
        for (let i = 1; i < lines.length; i++) {
          const row = lines[i];
          const cells = row.match(/("(?:[^"]|"")*"|[^,]*)/g)?.map((c) => c.replace(/^"|"$/g, "").replace(/""/g, '"').trim()) || row.split(",");
          const path = cells[pathIdx]?.trim();
          if (!path) continue;
          const valCol = valorIdx >= 0 ? valorIdx : cols.findIndex((c) => /valor|default/i.test(c));
          const rawVal = valCol >= 0 ? cells[valCol] : cells[pathIdx + 1];
          const v = parseFloat(String(rawVal || "").replace(/["\s]/g, "").replace(",", "."));
          if (!isNaN(v) && v >= 0) valueUpdates[path] = v;
          if (formulaIdx >= 0 && cells[formulaIdx] != null && String(cells[formulaIdx]).trim() !== "") {
            formulaUpdates[path] = String(cells[formulaIdx]).trim();
          }
        }
        applyDimensioningImport(valueUpdates);
        if (Object.keys(formulaUpdates).length > 0) {
          setDimensioningFormulaOverridesBulk(formulaUpdates);
        }
        invalidatePricingCache();
        refresh();
        const msgVal = Object.keys(valueUpdates).length;
        const msgForm = Object.keys(formulaUpdates).length;
        setImportMsg(msgForm > 0 ? `Importados ${msgVal} valores y ${msgForm} fórmulas.` : `Importados ${msgVal} valores correctamente.`);
        onSave?.();
        if (fileInputRef.current) fileInputRef.current.value = "";
      } catch (err) {
        setImportMsg("Error al leer el archivo: " + (err.message || "formato inválido"));
      }
    };
    reader.readAsText(file, "UTF-8");
  };

  const inputS = {
    width: 80,
    padding: "6px 8px",
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    fontSize: 13,
    textAlign: "right",
    fontFamily: FONT,
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, fontFamily: FONT }}>
      <div style={{ padding: 12, background: C.primarySoft, borderRadius: 12, border: `1px solid ${C.primary}`, fontSize: 12, color: C.tp, lineHeight: 1.5 }}>
        <strong>Fórmulas de dimensionamiento</strong>
        <p style={{ margin: "6px 0 0 0" }}>Parámetros y texto de fórmula editables. Clic en valor o en fórmula para editar. También podés descargar CSV, editar en Excel y reimportar.</p>
      </div>

      {/* Button group: Download | Import — consistent with PricingEditor */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button
          onClick={handleDownload}
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
          Descargar CSV
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
          Importar CSV modificado
          <input ref={fileInputRef} type="file" accept=".csv" onChange={handleImport} style={{ display: "none" }} />
        </label>
        {importMsg && <span style={{ fontSize: 12, color: importMsg.includes("Error") ? C.danger : C.primary, width: "100%" }}>{importMsg}</span>}
      </div>

      <div style={{ position: "relative" }}>
        <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.ts }} />
        <input
          type="text"
          placeholder="Buscar por nombre, categoría o fórmula..."
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

      <div style={{ overflowX: "auto", maxHeight: 400, overflowY: "auto", borderRadius: 12, border: `1px solid ${C.border}` }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead style={{ position: "sticky", top: 0, background: C.brand, color: "#fff", zIndex: 1, boxShadow: "0 2px 4px rgba(0,0,0,0.06)" }}>
            <tr>
              <th style={{ padding: "12px 10px", textAlign: "left", borderBottom: "none", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Parámetro</th>
              <th style={{ padding: "12px 10px", textAlign: "left", borderBottom: "none", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Fórmula / Uso</th>
              <th style={{ padding: "12px 10px", textAlign: "right", borderBottom: "none", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Valor</th>
              <th style={{ padding: "12px 10px", textAlign: "center", borderBottom: "none", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Unidad</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => {
              const key = row.path;
              const isEditing = editing === key;
              return (
                <tr
                  key={key}
                  onMouseEnter={() => setHoveredRow(key)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{
                    background: hoveredRow === key ? C.surfaceAlt : "transparent",
                    transition: "background 120ms ease",
                  }}
                >
                  <td style={{ padding: "6px", maxWidth: 220 }}>
                    <span style={{ fontWeight: 500 }}>{row.label}</span>
                    <div style={{ fontSize: 10, color: C.ts }}>{row.categoria}</div>
                  </td>
                  <td style={{ padding: "4px 6px", maxWidth: 240 }}>
                    {editingFormula === key ? (
                      <input
                        type="text"
                        defaultValue={row.formula}
                        autoFocus
                        onBlur={(e) => handleFormulaChange(row.path, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleFormulaChange(row.path, e.target.value);
                          if (e.key === "Escape") setEditingFormula(null);
                        }}
                        style={{
                          width: "100%",
                          minWidth: 140,
                          padding: "6px 8px",
                          borderRadius: 8,
                          border: `1px solid ${C.primary}`,
                          fontSize: 11,
                          fontFamily: FONT,
                        }}
                      />
                    ) : (
                      <span
                        onClick={() => setEditingFormula(key)}
                        style={{
                          cursor: "pointer",
                          padding: "4px 6px",
                          borderRadius: 6,
                          display: "block",
                          fontSize: 11,
                          color: C.ts,
                        }}
                        title="Clic para editar fórmula / uso"
                      >
                        {row.formula || "—"}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "4px 6px", textAlign: "right" }}>
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={row.valor}
                        autoFocus
                        onBlur={(e) => handleCellChange(row.path, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleCellChange(row.path, e.target.value);
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
                          minWidth: 60,
                        }}
                        title="Clic para editar"
                      >
                        {row.valor != null ? Number(row.valor) : "—"}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "6px", textAlign: "center", fontSize: 11, color: C.ts }}>{row.unidad || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
        <span style={{ fontSize: 11, color: C.ts }}>{filtered.length} parámetros · {Object.keys(getDimensioningOverrides()).length} valor modificado · {Object.keys(getDimensioningFormulaOverrides()).length} fórmula modificada</span>
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
          Restaurar valores
        </button>
      </div>
    </div>
  );
}
