// ═══════════════════════════════════════════════════════════════════════════
// ProductQuickAddDrawer — Menú desplegable "Agregar producto" siempre disponible
// en la calculadora. Un solo buscador sobre TODO el catálogo (paneles, perfilería,
// tornillería/fijaciones, selladores). Escribe en el estado "presupuesto libre"
// existente, que ya se fusiona al BOM de cualquier escenario (additiveLibreGroups
// + mergeLibreGroups) y fluye a totales/PDF/WhatsApp/guardado sin cambios extra.
//
// Patrones reutilizados:
//   - FAB + open/localStorage + truco pointerEvents → BmcChatPanel.jsx
//   - Backdrop + <aside role="dialog"> + Escape-to-close → admin/users/UserDetailDrawer.jsx
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo, useCallback } from "react";
import { rowPriceHint } from "../utils/productCatalogIndex.js";

const STORAGE_KEY = "bmc_quickadd_open";
const Z = 9997; // bajo Tutorial (9999) y Chat (9998)

const CATEGORY_COLORS = {
  PANELES: "#1a73e8",
  "PERFILERÍA": "#8430ce",
  "TORNILLERÍA": "#b06000",
  SELLADORES: "#188038",
};

function readStoredOpen() {
  try { return localStorage.getItem(STORAGE_KEY) === "true"; } catch { return false; }
}

const fmtUsd = (n) => `US$ ${(Number(n) || 0).toFixed(2)}`;

export default function ProductQuickAddDrawer({
  catalogIndex = [],
  currentQty = { perfilQty: {}, fijQty: {}, sellQty: {} },
  onAddPerfil,
  onAddFijacion,
  onAddSellador,
  onAddPanel,
  listaPrecios = "web",
}) {
  const [open, setOpen] = useState(readStoredOpen);
  const [query, setQuery] = useState("");
  const [qtyDraft, setQtyDraft] = useState({}); // { rowId: number }
  const [flash, setFlash] = useState(null); // rowId recién agregado (feedback)

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, open ? "true" : "false"); } catch { /* ignore */ }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = q ? catalogIndex.filter((r) => r.searchText.includes(q)) : catalogIndex;
    return rows.slice(0, 60); // acota el render; el buscador refina
  }, [catalogIndex, query]);

  const qtyOf = (id) => {
    const v = qtyDraft[id];
    return v == null ? 1 : v;
  };
  // Paneles: la cantidad es m² (admite decimales); el resto son unidades enteras.
  const setQty = (id, v, isPanel) => setQtyDraft((d) => {
    const num = Number(v);
    const clean = isPanel
      ? Math.max(0.1, Number.isFinite(num) ? num : 1)
      : Math.max(1, Math.round(Number.isFinite(num) ? num : 1));
    return { ...d, [id]: clean };
  });

  const doFlash = useCallback((id) => {
    setFlash(id);
    setTimeout(() => setFlash((cur) => (cur === id ? null : cur)), 900);
  }, []);

  const handleAdd = (row) => {
    const n = qtyOf(row.id);
    if (row.addBy === "perfilQty") onAddPerfil?.(row.key, n);
    else if (row.addBy === "fijQty") onAddFijacion?.(row.key, n);
    else if (row.addBy === "sellQty") onAddSellador?.(row.key, n);
    else if (row.addBy === "panelLine") onAddPanel?.({ familia: row.familia, espesor: row.espesor, color: row.colorDefault, m2: n });
    doFlash(row.id);
  };

  // Cantidad ya en el presupuesto (para el badge "en presupuesto") — solo perfil/fij/sell.
  const inQuoteQty = (row) => {
    if (row.addBy === "perfilQty") return currentQty.perfilQty?.[row.key] || 0;
    if (row.addBy === "fijQty") return currentQty.fijQty?.[row.key] || 0;
    if (row.addBy === "sellQty") return currentQty.sellQty?.[row.key] || 0;
    return 0;
  };

  const addedCount = useMemo(() => {
    const count = (m) => Object.values(m || {}).filter((v) => Number(v) > 0).length;
    return count(currentQty.perfilQty) + count(currentQty.fijQty) + count(currentQty.sellQty);
  }, [currentQty]);

  const surface = "var(--ac-surface, #ffffff)";
  const border = "var(--ac-border, #dadce0)";
  const text = "var(--ac-text, #202124)";
  const text2 = "var(--ac-text-2, #5f6368)";

  return (
    <>
      <style>{`
        @keyframes bmcQuickAddIn { from { transform: translateX(24px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes bmcQuickAddFlash { 0% { background: rgba(24,128,56,0.18); } 100% { background: transparent; } }
      `}</style>

      {/* FAB — pestaña vertical en el borde derecho, siempre visible */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="bmc-quickadd-panel"
        title={open ? "Cerrar agregar producto" : "Agregar producto al presupuesto"}
        style={{
          position: "fixed",
          right: 0,
          top: "42%",
          transform: "translateY(-50%)",
          zIndex: Z,
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "12px 10px",
          border: `1px solid ${border}`,
          borderRight: "none",
          borderRadius: "10px 0 0 10px",
          background: "var(--ac-surface, #1a73e8)",
          color: "var(--ac-text, #ffffff)",
          boxShadow: "var(--ac-shadow-2, 0 4px 16px rgba(0,0,0,0.18))",
          cursor: "pointer",
          writingMode: "vertical-rl",
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: 0.3,
        }}
      >
        <span aria-hidden style={{ writingMode: "horizontal-tb", fontSize: 16 }}>＋</span>
        Agregar producto
        {addedCount > 0 && (
          <span
            aria-label={`${addedCount} agregados`}
            style={{
              writingMode: "horizontal-tb",
              background: "#188038", color: "#fff", borderRadius: 10,
              fontSize: 11, fontWeight: 700, padding: "1px 6px", marginTop: 2,
            }}
          >
            {addedCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", backdropFilter: "blur(2px)", zIndex: Z }}
          />
          <aside
            id="bmc-quickadd-panel"
            role="dialog"
            aria-labelledby="bmc-quickadd-title"
            style={{
              position: "fixed", top: 0, right: 0, bottom: 0,
              width: "min(420px, 100vw)",
              background: surface, color: text,
              boxShadow: "var(--ac-shadow-2, -8px 0 32px rgba(0,0,0,0.18))",
              zIndex: Z + 1,
              display: "flex", flexDirection: "column", overflow: "hidden",
              animation: "bmcQuickAddIn 180ms ease-out",
            }}
          >
            <header style={{ padding: "14px 16px", borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", gap: 10 }}>
              <h2 id="bmc-quickadd-title" style={{ margin: 0, fontSize: 16, fontWeight: 700, color: text, flex: 1 }}>
                Agregar producto
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                title="Cerrar"
                style={{ border: "none", background: "transparent", color: text2, fontSize: 20, lineHeight: 1, cursor: "pointer", padding: "2px 6px" }}
              >
                ✕
              </button>
            </header>

            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${border}` }}>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar producto por nombre o SKU…"
                autoFocus
                style={{
                  width: "100%", boxSizing: "border-box", padding: "10px 12px",
                  border: `1px solid ${border}`, borderRadius: 8, fontSize: 14,
                  background: "var(--ac-surface, #fff)", color: text,
                }}
              />
              <div style={{ marginTop: 6, fontSize: 12, color: text2 }}>
                {filtered.length} resultado{filtered.length === 1 ? "" : "s"}
                {catalogIndex.length > filtered.length ? ` · refiná la búsqueda para ver más` : ""}
                {addedCount > 0 ? ` · ${addedCount} en el presupuesto` : ""}
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "8px 8px 16px" }}>
              {filtered.length === 0 && (
                <p style={{ color: text2, fontSize: 13, padding: "12px 8px" }}>Sin coincidencias.</p>
              )}
              {filtered.map((row) => {
                const already = inQuoteQty(row);
                const isPanel = row.addBy === "panelLine";
                return (
                  <div
                    key={row.id}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "8px 8px", borderRadius: 8,
                      borderBottom: `1px solid ${border}`,
                      animation: flash === row.id ? "bmcQuickAddFlash 900ms ease-out" : "none",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span
                          aria-hidden
                          style={{
                            fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
                            color: "#fff", background: CATEGORY_COLORS[row.category] || "#5f6368",
                            borderRadius: 4, padding: "1px 5px",
                          }}
                        >
                          {row.category}
                        </span>
                        {already > 0 && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: "#188038" }}>
                            ✓ {already} en presupuesto
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 13, color: text, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={row.label}>
                        {row.label}
                      </div>
                      <div style={{ fontSize: 11, color: text2 }}>
                        {fmtUsd(rowPriceHint(row, listaPrecios))} / {row.unidad}
                        {isPanel ? " · cantidad en m²" : ""}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", border: `1px solid ${border}`, borderRadius: 8, overflow: "hidden" }}>
                      <button type="button" aria-label="Menos" onClick={() => setQty(row.id, qtyOf(row.id) - 1, isPanel)} style={stepBtn(text2)}>−</button>
                      <input
                        type="number" min={isPanel ? 0.1 : 1} step={isPanel ? 0.5 : 1} value={qtyOf(row.id)}
                        onChange={(e) => setQty(row.id, e.target.value, isPanel)}
                        aria-label={`Cantidad de ${row.label}${isPanel ? " en m²" : ""}`}
                        style={{ width: 48, textAlign: "center", border: "none", fontSize: 13, background: "transparent", color: text, MozAppearance: "textfield" }}
                      />
                      <button type="button" aria-label="Más" onClick={() => setQty(row.id, qtyOf(row.id) + 1, isPanel)} style={stepBtn(text2)}>+</button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAdd(row)}
                      style={{
                        border: "none", background: "#1a73e8", color: "#fff",
                        borderRadius: 8, padding: "7px 12px", fontSize: 13, fontWeight: 600,
                        cursor: "pointer", flexShrink: 0,
                      }}
                    >
                      Agregar
                    </button>
                  </div>
                );
              })}
            </div>
          </aside>
        </>
      )}
    </>
  );
}

function stepBtn(color) {
  return {
    border: "none", background: "transparent", color,
    width: 28, height: 32, fontSize: 16, lineHeight: 1, cursor: "pointer",
  };
}
