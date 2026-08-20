// Tenant sale matrix — one localStorage key per WHITELABEL slug.
import { useMemo, useRef, useState } from "react";
import { Search, Download, Upload, RotateCcw, Percent } from "lucide-react";
import { invalidatePricingCache } from "../data/pricing.js";
import {
  jenerikRowsForUi,
  setJenerikSale,
  applyJenerikBulkPercent,
  resetJenerikMatrizToSeed,
  exportJenerikCsv,
  parseJenerikCsv,
  setJenerikSalesBulk,
  tenantMatrizCopy,
} from "../utils/jenerikMatriz.js";
import { C, FONT } from "../data/constants.js";

export default function JenerikMatrizEditor({ onSave }) {
  const copy = tenantMatrizCopy();
  const [rows, setRows] = useState(() => jenerikRowsForUi());
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [pct, setPct] = useState("");
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState(null);
  const fileRef = useRef(null);

  const refresh = () => {
    invalidatePricingCache();
    setRows(jenerikRowsForUi());
    onSave?.();
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      `${r.label} ${r.path} ${r.categoria}`.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const handleCell = (path, value) => {
    if (value === "" || value == null) return;
    const n = parseFloat(value);
    if (Number.isNaN(n) || n < 0) return;
    setJenerikSale(path, n);
    setEditing(null);
    setMsg(copy.saved);
    refresh();
  };

  const handleBulk = () => {
    const n = parseFloat(pct);
    if (Number.isNaN(n) || selected.size === 0) return;
    applyJenerikBulkPercent([...selected], n);
    setPct("");
    setSelected(new Set());
    setMsg(copy.bulk(n, selected.size));
    refresh();
  };

  const handleReset = () => {
    if (!confirm(copy.resetConfirm)) return;
    resetJenerikMatrizToSeed();
    setSelected(new Set());
    setMsg(copy.resetDone);
    refresh();
  };

  const handleDownload = () => {
    const blob = new Blob([exportJenerikCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = copy.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e) => {
    const file = e?.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const updates = parseJenerikCsv(String(reader.result || ""));
      const n = Object.keys(updates).length;
      if (!n) {
        setMsg(copy.csvNeed);
        return;
      }
      setJenerikSalesBulk(updates);
      setMsg(copy.imported(n));
      refresh();
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const toggle = (path) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  return (
    <div style={{ fontFamily: FONT }}>
      <h3 style={{ margin: "0 0 6px", fontSize: 16, color: C.tp }}>{copy.title}</h3>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: C.ts, lineHeight: 1.45 }}>
        {copy.body}
      </p>
      {msg ? <p style={{ fontSize: 13, color: "#3f6212", marginTop: 0 }}>{msg}</p> : null}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <button type="button" onClick={handleDownload} style={btn()}>
          <Download size={14} /> {copy.download}
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} style={btn()}>
          <Upload size={14} /> Importar CSV
        </button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={handleImport} />
        <button type="button" onClick={handleReset} style={btn()}>
          <RotateCcw size={14} /> {copy.reset}
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <label style={{ flex: 1, minWidth: 180, position: "relative" }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: 11, color: C.ts }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar ítem…"
            style={{ ...inp(), paddingLeft: 28 }}
          />
        </label>
        <input
          value={pct}
          onChange={(e) => setPct(e.target.value)}
          placeholder="% lote"
          style={{ ...inp(), width: 88 }}
        />
        <button type="button" onClick={handleBulk} disabled={!selected.size} style={btn()}>
          <Percent size={14} /> Aplicar a {selected.size || "…"}
        </button>
      </div>

      <div style={{ overflow: "auto", border: `1px solid ${C.border}`, borderRadius: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#211E17", color: "#FBF6E9" }}>
              <th style={th()}>
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && selected.size === filtered.length}
                  onChange={() => {
                    if (selected.size === filtered.length) setSelected(new Set());
                    else setSelected(new Set(filtered.map((r) => r.path)));
                  }}
                />
              </th>
              <th style={th(true)}>Ítem</th>
              <th style={th()}>Tu venta USD s/IVA</th>
              <th style={th()}>c/IVA</th>
              <th style={th()}>Unidad</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.path} style={{ background: r.dirty ? "#FBF6E9" : "#fff" }}>
                <td style={td()}>
                  <input type="checkbox" checked={selected.has(r.path)} onChange={() => toggle(r.path)} />
                </td>
                <td style={td(true)}>
                  <div style={{ fontWeight: 600 }}>{r.label}</div>
                  <div style={{ fontSize: 11, color: C.ts }}>{r.categoria}</div>
                </td>
                <td style={td()}>
                  {editing === r.path ? (
                    <input
                      autoFocus
                      defaultValue={r.venta}
                      onBlur={(e) => handleCell(r.path, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCell(r.path, e.currentTarget.value);
                        if (e.key === "Escape") setEditing(null);
                      }}
                      style={{ ...inp(), width: 96 }}
                    />
                  ) : (
                    <button type="button" onClick={() => setEditing(r.path)} style={cellBtn()}>
                      {Number(r.venta).toFixed(2)}
                    </button>
                  )}
                </td>
                <td style={{ ...td(), color: C.ts }}>{Number(r.ventaIva).toFixed(2)}</td>
                <td style={td()}>{r.unidad}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function th(left) {
  return { textAlign: left ? "left" : "center", padding: "10px 8px", fontWeight: 600, fontSize: 12 };
}
function td(left) {
  return { textAlign: left ? "left" : "center", padding: "8px", borderTop: "1px solid #eee" };
}
function inp() {
  return {
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #d6d3d1",
    fontFamily: FONT,
    fontSize: 13,
  };
}
function btn() {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #d6d3d1",
    background: "#fff",
    cursor: "pointer",
    fontSize: 13,
    fontFamily: FONT,
  };
}
function cellBtn() {
  return {
    border: "1px dashed #d6d3d1",
    background: "transparent",
    borderRadius: 6,
    padding: "4px 8px",
    cursor: "pointer",
    fontFamily: FONT,
    fontVariantNumeric: "tabular-nums",
  };
}
