// ═══════════════════════════════════════════════════════════════════════════
// ProductosMaestroEditor.jsx — Catálogo unificado precio + stock (Config)
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useMemo, useCallback, useEffect } from "react";
import { RefreshCw, UploadCloud, Search, Link2, AlertTriangle } from "lucide-react";
import { C, FONT } from "../data/constants.js";
import { getCalcApiBase } from "../utils/calcApiBase.js";
import {
  setPricingOverridesBulk,
} from "../utils/pricingOverrides.js";
import { invalidatePricingCache } from "../data/pricing.js";

const TOKEN_KEY = "bmc_matriz_push_token";

const ESTADO_STYLE = {
  ok: { bg: C.successSoft, color: C.success, label: "OK" },
  sin_matriz: { bg: C.warningSoft, color: C.warning, label: "Sin MATRIZ" },
  sin_stock_link: { bg: C.dangerSoft, color: C.danger, label: "Sin stock" },
  precio_desalineado: { bg: C.warningSoft, color: C.warning, label: "Precio ≠" },
  bajo_stock: { bg: C.warningSoft, color: C.warning, label: "Bajo stock" },
};

function authHeaders(token) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

function resolveToken(pushToken) {
  const envTok = typeof import.meta !== "undefined" ? import.meta.env?.VITE_BMC_API_AUTH_TOKEN : "";
  return String(pushToken || envTok || "").trim();
}

export default function ProductosMaestroEditor({ onSave }) {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [pushLoading, setPushLoading] = useState(false);
  const [pushToken, setPushToken] = useState(() => {
    try {
      return sessionStorage.getItem(TOKEN_KEY) || "";
    } catch {
      return "";
    }
  });
  const [linkModal, setLinkModal] = useState(null);
  const [linkCode, setLinkCode] = useState("");
  const [dirtyPaths, setDirtyPaths] = useState(() => new Set());

  const persistToken = (t) => {
    setPushToken(t);
    try {
      sessionStorage.setItem(TOKEN_KEY, t);
    } catch {
      /* ignore */
    }
  };

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    const base = getCalcApiBase();
    const token = resolveToken(pushToken);
    try {
      const res = await fetch(`${base}/api/productos-maestro`, {
        cache: "no-store",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || res.statusText);
        return;
      }
      setItems(data.items || []);
      setSummary(data.summary || null);
      setDirtyPaths(new Set());
    } catch (e) {
      setMsg("Error: " + (e.message || String(e)));
    } finally {
      setLoading(false);
    }
  }, [pushToken]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const filtered = useMemo(() => {
    let list = items;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (i) =>
          i.path?.toLowerCase().includes(q) ||
          i.sku?.toLowerCase().includes(q) ||
          i.nombre?.toLowerCase().includes(q) ||
          i.codigo_stock?.toLowerCase().includes(q),
      );
    }
    if (filter === "gaps") list = list.filter((i) => i.estado !== "ok");
    else if (filter === "bajo_stock") list = list.filter((i) => i.estados?.includes("bajo_stock"));
    else if (filter === "web") list = list.filter((i) => i.venta_web != null);
    return list;
  }, [items, search, filter]);

  const markDirty = (path) => {
    setDirtyPaths((prev) => new Set(prev).add(path));
  };

  const updateItem = (path, patch) => {
    setItems((prev) => prev.map((i) => (i.path === path ? { ...i, ...patch } : i)));
    markDirty(path);
  };

  const saveLink = async () => {
    if (!linkModal) return;
    const token = resolveToken(pushToken);
    if (!token) {
      setMsg("Falta API_AUTH_TOKEN para guardar links.");
      return;
    }
    const base = getCalcApiBase();
    try {
      const res = await fetch(`${base}/api/productos-maestro/links`, {
        method: "PUT",
        headers: authHeaders(token),
        body: JSON.stringify({ links: { [linkModal.path]: linkCode.trim() } }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || res.statusText);
        return;
      }
      updateItem(linkModal.path, { codigo_stock: linkCode.trim() });
      setLinkModal(null);
      setLinkCode("");
      setMsg("Link guardado.");
      await loadCatalog();
    } catch (e) {
      setMsg("Error: " + (e.message || String(e)));
    }
  };

  const applyLocalPricingOverrides = (dirtyItems) => {
    const bulk = {};
    for (const item of dirtyItems) {
      if (item.costo != null) bulk[`${item.path}.costo`] = item.costo;
      if (item.venta_local != null) bulk[`${item.path}.venta`] = item.venta_local;
      if (item.venta_web != null) bulk[`${item.path}.web`] = item.venta_web;
    }
    if (Object.keys(bulk).length) {
      setPricingOverridesBulk(bulk);
      invalidatePricingCache();
      onSave?.();
    }
  };

  const handlePush = async (dryRun) => {
    const token = resolveToken(pushToken);
    if (!token) {
      setMsg("Falta token API (API_AUTH_TOKEN). Pegalo abajo o usá VITE_BMC_API_AUTH_TOKEN.");
      return;
    }
    const dirtyItems = items.filter((i) => dirtyPaths.has(i.path));
    if (dirtyItems.length === 0) {
      setMsg("No hay cambios pendientes.");
      return;
    }
    setPushLoading(true);
    setMsg(null);
    const base = getCalcApiBase();
    const payload = {
      dryRun,
      items: dirtyItems.map((i) => ({
        path: i.path,
        costo: i.costo,
        venta_local: i.venta_local,
        venta_web: i.venta_web,
        stock: i.stock,
        pedido_pendiente: i.pedido_pendiente,
        codigo_stock: i.codigo_stock,
      })),
    };
    try {
      const res = await fetch(`${base}/api/productos-maestro/push`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || res.statusText);
        return;
      }
      const matrizN = data.matriz?.planned?.length ?? data.matriz?.updated ?? 0;
      const stockN = dryRun ? data.stock?.planned?.length ?? 0 : data.stock?.applied?.filter((x) => x.ok)?.length ?? 0;
      setMsg(
        dryRun
          ? `Simulación: ${matrizN} celda(s) MATRIZ · ${stockN} fila(s) stock.`
          : `Escrito: MATRIZ ${matrizN} · Stock ${stockN}.`,
      );
      if (!dryRun) {
        applyLocalPricingOverrides(dirtyItems);
        await loadCatalog();
      }
    } catch (e) {
      setMsg("Error: " + (e.message || String(e)));
    } finally {
      setPushLoading(false);
    }
  };

  const inputS = {
    width: "100%",
    padding: "6px 8px",
    borderRadius: 6,
    border: `1px solid ${C.border}`,
    fontSize: 12,
    fontFamily: FONT,
  };

  return (
    <div style={{ fontFamily: FONT }}>
      {summary && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 16,
            padding: 12,
            background: C.surfaceAlt,
            borderRadius: 10,
            border: `1px solid ${C.border}`,
            fontSize: 12,
          }}
        >
          <span>
            <strong>{summary.total}</strong> productos
          </span>
          <span style={{ color: C.success }}>OK {summary.ok}</span>
          <span style={{ color: C.danger }}>Sin stock {summary.gaps?.sin_stock_link ?? 0}</span>
          <span style={{ color: C.warning }}>Desalineados {summary.gaps?.precio_desalineado ?? 0}</span>
          <span style={{ color: C.warning }}>Bajo stock {summary.gaps?.bajo_stock ?? 0}</span>
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12, alignItems: "center" }}>
        <div style={{ flex: 1, minWidth: 160, position: "relative" }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: 10, color: C.ts }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar path, SKU, nombre…"
            style={{ ...inputS, paddingLeft: 32 }}
          />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ ...inputS, width: "auto" }}>
          <option value="all">Todos</option>
          <option value="gaps">Solo gaps</option>
          <option value="bajo_stock">Bajo stock</option>
          <option value="web">Con precio web</option>
        </select>
        <button
          type="button"
          onClick={loadCatalog}
          disabled={loading}
          style={btnStyle(C.primary)}
          title="Refrescar desde planillas"
        >
          <RefreshCw size={14} /> {loading ? "…" : "Refrescar"}
        </button>
        <button type="button" onClick={() => handlePush(true)} disabled={pushLoading} style={btnStyle(C.ts)}>
          <UploadCloud size={14} /> Simular envío
        </button>
        <button type="button" onClick={() => handlePush(false)} disabled={pushLoading} style={btnStyle(C.brand)}>
          Escribir en planillas
        </button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: C.ts, display: "block", marginBottom: 4 }}>API_AUTH_TOKEN (push)</label>
        <input
          type="password"
          value={pushToken}
          onChange={(e) => persistToken(e.target.value)}
          placeholder="Bearer token servidor"
          style={inputS}
        />
      </div>

      {msg && (
        <div
          style={{
            marginBottom: 12,
            padding: 10,
            borderRadius: 8,
            background: msg.startsWith("Error") ? C.dangerSoft : C.successSoft,
            fontSize: 12,
          }}
        >
          {msg}
        </div>
      )}

      <div style={{ overflowX: "auto", maxHeight: "55vh", border: `1px solid ${C.border}`, borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ background: C.brand, color: "#fff", position: "sticky", top: 0 }}>
              {["Estado", "Path", "SKU", "Nombre", "Costo", "Venta", "Web", "Stock", "Cód. stock", ""].map((h) => (
                <th key={h} style={{ padding: "8px 6px", textAlign: "left", fontWeight: 600 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => {
              const st = ESTADO_STYLE[row.estado] || ESTADO_STYLE.ok;
              const isDirty = dirtyPaths.has(row.path);
              return (
                <tr
                  key={row.path}
                  style={{
                    borderBottom: `1px solid ${C.border}`,
                    background: isDirty ? C.primarySoft : "transparent",
                  }}
                >
                  <td style={{ padding: 6 }}>
                    <span
                      style={{
                        padding: "2px 6px",
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 700,
                        background: st.bg,
                        color: st.color,
                      }}
                      title={row.warnings?.join("; ")}
                    >
                      {st.label}
                    </span>
                  </td>
                  <td style={{ padding: 6, maxWidth: 180, wordBreak: "break-all" }}>{row.path}</td>
                  <td style={{ padding: 6 }}>{row.sku || "—"}</td>
                  <td style={{ padding: 6, maxWidth: 120 }}>{row.nombre || "—"}</td>
                  <td style={{ padding: 4 }}>
                    <NumInput value={row.costo} onChange={(v) => updateItem(row.path, { costo: v })} />
                  </td>
                  <td style={{ padding: 4 }}>
                    <NumInput value={row.venta_local} onChange={(v) => updateItem(row.path, { venta_local: v })} />
                  </td>
                  <td style={{ padding: 4 }}>
                    <NumInput value={row.venta_web} onChange={(v) => updateItem(row.path, { venta_web: v })} />
                  </td>
                  <td style={{ padding: 4 }}>
                    <NumInput value={row.stock} onChange={(v) => updateItem(row.path, { stock: v })} />
                  </td>
                  <td style={{ padding: 6 }}>{row.codigo_stock || "—"}</td>
                  <td style={{ padding: 4 }}>
                    <button
                      type="button"
                      title="Vincular código stock"
                      onClick={() => {
                        setLinkModal(row);
                        setLinkCode(row.codigo_stock || "");
                      }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: C.primary }}
                    >
                      <Link2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && !loading && (
        <p style={{ fontSize: 12, color: C.ts, marginTop: 12 }}>
          <AlertTriangle size={14} style={{ verticalAlign: "middle" }} /> Sin resultados. ¿API arriba y token configurado?
        </p>
      )}

      {linkModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 300,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ background: C.surface, padding: 24, borderRadius: 12, width: 360, maxWidth: "90vw" }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Vincular stock</div>
            <div style={{ fontSize: 11, color: C.ts, marginBottom: 12, wordBreak: "break-all" }}>{linkModal.path}</div>
            <input
              value={linkCode}
              onChange={(e) => setLinkCode(e.target.value)}
              placeholder="CODIGO en planilla Stock"
              style={{ ...inputS, marginBottom: 12 }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setLinkModal(null)} style={btnStyle(C.ts)}>
                Cancelar
              </button>
              <button type="button" onClick={saveLink} style={btnStyle(C.brand)}>
                Guardar link
              </button>
            </div>
          </div>
        </div>
      )}

      <p style={{ fontSize: 10, color: C.tt, marginTop: 12 }}>
        Precios → MATRIZ (F/L/T). Stock → planilla E-Commerce. Overrides locales se aplican tras escribir en planillas.
        Links en servidor (.runtime/product-links.json).
      </p>
    </div>
  );
}

function NumInput({ value, onChange }) {
  return (
    <input
      type="number"
      step="0.01"
      value={value ?? ""}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === "" ? null : parseFloat(v));
      }}
      style={{
        width: 72,
        padding: "4px 6px",
        borderRadius: 4,
        border: `1px solid ${C.border}`,
        fontSize: 11,
      }}
    />
  );
}

function btnStyle(bg) {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 12px",
    borderRadius: 8,
    border: "none",
    background: bg,
    color: bg === C.ts ? C.tp : "#fff",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  };
}
