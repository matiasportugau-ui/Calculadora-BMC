// ═══════════════════════════════════════════════════════════════════════════
// ProductosMaestroEditor.jsx
// Hub visual centralizado de precio + stock (Productos Maestro)
// Vive en Config → "Productos"
// Permite: ver gaps, editar links, simular y escribir hacia planillas
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { RefreshCw, Send, Download } from 'lucide-react';
import { getCalcApiBase } from '../utils/calcApiBase.js';
import { C, FONT } from '../data/constants.js';

const API_BASE = getCalcApiBase();
const TOKEN_KEY = 'bmc_productos_maestro_token';

export default function ProductosMaestroEditor({ onSave }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [links, setLinks] = useState({});
  const [token, setToken] = useState(() => {
    try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
  });
  const [msg, setMsg] = useState(null);
  const [filter, setFilter] = useState('all'); // all | linked | matriz-only | stock-only
  const [search, setSearch] = useState('');

  const apiHeaders = () => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  async function refreshAll() {
    setLoading(true);
    setMsg(null);
    try {
      const [catRes, recRes, linksRes] = await Promise.all([
        fetch(`${API_BASE}/api/productos-maestro`),
        fetch(`${API_BASE}/api/productos-maestro/reconcile`),
        fetch(`${API_BASE}/api/productos-maestro/links`),
      ]);

      const cat = await catRes.json();
      const rec = await recRes.json();
      const lnk = await linksRes.json();

      setItems(cat.items || []);
      setReport(rec);
      setLinks(lnk.links || {});
    } catch (e) {
      setMsg({ type: 'error', text: 'Error cargando datos: ' + e.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshAll();
  }, []);

  function saveToken(t) {
    setToken(t);
    try { sessionStorage.setItem(TOKEN_KEY, t); } catch { /* ignore storage errors */ }
  }

  const filtered = items.filter((it) => {
    if (filter !== 'all' && it.linkStatus !== filter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (it.sku || '').toLowerCase().includes(q) ||
           (it.path || '').toLowerCase().includes(q) ||
           (it.codigo || '').toLowerCase().includes(q) ||
           (it.nombre || '').toLowerCase().includes(q);
  });

  async function saveLinks(newLinks) {
    try {
      const res = await fetch(`${API_BASE}/api/productos-maestro/links`, {
        method: 'PUT',
        headers: apiHeaders(),
        body: JSON.stringify({ links: newLinks }),
      });
      const j = await res.json();
      if (j.ok) {
        setLinks(j.links || newLinks);
        setMsg({ type: 'success', text: 'Links guardados' });
        setTimeout(refreshAll, 400);
      } else {
        throw new Error(j.error || 'Error');
      }
    } catch (e) {
      setMsg({ type: 'error', text: 'No se pudieron guardar los links: ' + e.message });
    }
  }

  function updateLink(sku, codigo) {
    const next = { ...links, [sku]: codigo.trim() || null };
    if (!codigo.trim()) delete next[sku];
    setLinks(next);
    // auto-guardar (UX simple)
    saveLinks(next);
  }

  async function doPush(dryRun) {
    if (!token) {
      setMsg({ type: 'error', text: 'Ingresa el API_AUTH_TOKEN para escribir' });
      return;
    }
    // Tomamos los items que tienen cambios locales (por ahora enviamos todo lo vinculado como ejemplo)
    const payloadItems = items
      .filter((i) => i.linkStatus === 'linked' || i.sku)
      .map((i) => ({
        sku: i.sku,
        codigo: i.codigo,
        precio: i.precio ? { ...i.precio } : undefined,
        stock: i.stock ? { actual: i.stock.actual, pedidoPendiente: i.stock.pedidoPendiente } : undefined,
      }));

    try {
      const res = await fetch(`${API_BASE}/api/productos-maestro/push`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ items: payloadItems, dryRun, token }),
      });
      const j = await res.json();
      if (j.ok) {
        setMsg({
          type: 'success',
          text: dryRun
            ? `Simulación OK — ${j.prepared?.summary?.precios || 0} precios / ${j.prepared?.summary?.stock || 0} stock listos`
            : 'Push enviado (ver logs del servidor)',
        });
        if (!dryRun) setTimeout(refreshAll, 1200);
      } else {
        throw new Error(j.error || 'Error en push');
      }
    } catch (e) {
      setMsg({ type: 'error', text: 'Error en push: ' + e.message });
    }
  }

  const statusColor = (s) => s === 'linked' ? '#16a34a' : s === 'matriz-only' ? '#ca8a04' : '#dc2626';

  return (
    <div style={{ fontFamily: FONT }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={refreshAll} disabled={loading} style={btnStyle()}>
          <RefreshCw size={14} /> {loading ? 'Cargando...' : 'Refrescar desde planillas'}
        </button>

        <button onClick={() => doPush(true)} style={btnStyle('#0ea5e9')}>
          <Download size={14} /> Simular envío
        </button>
        <button onClick={() => doPush(false)} style={btnStyle('#dc2626')}>
          <Send size={14} /> Escribir en planillas (real)
        </button>

        <input
          placeholder="API_AUTH_TOKEN (requerido para escribir)"
          value={token}
          onChange={(e) => saveToken(e.target.value)}
          style={{ ...inputStyle(), width: 280 }}
        />
      </div>

      {msg && (
        <div style={{ padding: '8px 12px', borderRadius: 8, marginBottom: 12, background: msg.type === 'error' ? '#fee2e2' : '#dcfce7', color: msg.type === 'error' ? '#991b1b' : '#166534', fontSize: 13 }}>
          {msg.text}
        </div>
      )}

      {report && (
        <div style={{ fontSize: 12, color: C.ts, marginBottom: 12, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <span>Total: <b>{report.summary?.total}</b></span>
          <span style={{ color: '#16a34a' }}>Vinculados: {report.summary?.linked}</span>
          <span style={{ color: '#ca8a04' }}>Solo MATRIZ: {report.summary?.matrizOnly}</span>
          <span style={{ color: '#dc2626' }}>Solo Stock: {report.summary?.stockOnly}</span>
          <span>Cobertura: {(report.summary?.linkCoverage * 100 || 0).toFixed(0)}%</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {['all', 'linked', 'matriz-only', 'stock-only'].map((f) => (
          <button key={f} onClick={() => setFilter(f)} style={tabBtn(filter === f)}>
            {f === 'all' ? 'Todos' : f}
          </button>
        ))}
        <input
          placeholder="Buscar SKU, path, código..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...inputStyle(), flex: 1, maxWidth: 320 }}
        />
      </div>

      <div style={{ maxHeight: 520, overflow: 'auto', border: `1px solid ${C.border}`, borderRadius: 10 }}>
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: C.surfaceAlt }}>
              <th style={thStyle()}>SKU / Código</th>
              <th style={thStyle()}>Path / Nombre</th>
              <th style={thStyle()}>Precio</th>
              <th style={thStyle()}>Stock</th>
              <th style={thStyle()}>Estado</th>
              <th style={thStyle()}>Link (CODIGO Stock)</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: C.ts }}>Sin datos o sin coincidencias.</td></tr>
            )}
            {filtered.map((it, idx) => (
              <tr key={idx} style={{ borderTop: `1px solid ${C.border}` }}>
                <td style={tdStyle()}><code style={{ fontSize: 11 }}>{it.sku || it.codigo || '—'}</code></td>
                <td style={tdStyle()}><span style={{ fontSize: 11 }}>{it.path || it.nombre}</span></td>
                <td style={tdStyle()}>
                  {it.precio ? (
                    <span style={{ fontSize: 11 }}>
                      ${it.precio.costo?.toFixed(2)} / ${it.precio.ventaLocal?.toFixed(2)} / ${it.precio.ventaWeb?.toFixed(2)}
                    </span>
                  ) : <span style={{ color: '#999' }}>—</span>}
                </td>
                <td style={tdStyle()}>
                  {it.stock ? (
                    <span style={{ fontSize: 11 }}>{it.stock.actual} (pend: {it.stock.pedidoPendiente})</span>
                  ) : <span style={{ color: '#999' }}>—</span>}
                </td>
                <td style={tdStyle()}>
                  <span style={{ color: statusColor(it.linkStatus), fontWeight: 600 }}>{it.linkStatus}</span>
                </td>
                <td style={tdStyle()}>
                  {it.sku ? (
                    <input
                      value={links[it.sku] || it.codigo || ''}
                      onChange={(e) => updateLink(it.sku, e.target.value)}
                      placeholder="CODIGO Stock"
                      style={{ fontSize: 11, padding: '2px 6px', width: '100%', maxWidth: 140, border: `1px solid ${C.border}`, borderRadius: 4 }}
                    />
                  ) : (
                    <span style={{ color: '#999', fontSize: 11 }}>sin SKU MATRIZ</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12, fontSize: 11, color: C.ts }}>
        Los links se guardan automáticamente. Usa <b>Simular envío</b> antes de <b>Escribir en planillas</b>. El push real requiere token y rol admin.
      </div>
    </div>
  );
}

function btnStyle(bg) {
  return {
    background: bg || C.brand,
    color: '#fff',
    border: 'none',
    padding: '8px 14px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  };
}

function inputStyle() {
  return {
    padding: '6px 10px',
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    fontSize: 12,
    fontFamily: FONT,
    background: C.surface,
  };
}

function tabBtn(active) {
  return {
    padding: '4px 10px',
    borderRadius: 999,
    border: `1px solid ${active ? C.brand : C.border}`,
    background: active ? C.brand : 'transparent',
    color: active ? '#fff' : C.ts,
    fontSize: 11,
    cursor: 'pointer',
  };
}

function thStyle() {
  return { padding: '8px 10px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: C.ts, borderBottom: `1px solid ${C.border}` };
}
function tdStyle() {
  return { padding: '6px 10px', verticalAlign: 'middle' };
}
