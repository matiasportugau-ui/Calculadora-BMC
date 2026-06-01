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

export default function ProductosMaestroEditor() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [links, setLinks] = useState({});
  const [token, setToken] = useState(() => {
    try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
  });
  const [msg, setMsg] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Local edits for push (dirty changes)
  const [edits, setEdits] = useState({}); // key = id or sku/codigo, value = partial {precio, stock}

  // Confirmation state for real writes
  const [showConfirm, setShowConfirm] = useState(false);

  // Derived pending changes (for banner + confirmation)
  const pendingChanges = Object.keys(edits).length;
  const hasPendingChanges = pendingChanges > 0;

  function revertEdit(key) {
    const next = { ...edits };
    delete next[key];
    setEdits(next);
  }

  function getEditKey(it) {
    return it.id || it.sku || it.codigo;
  }

  // Editing helpers — declared early so JSX render can use them without TDZ issues
  function setEdit(id, field, value) {
    setEdits(prev => {
      const current = prev[id] || { precio: {}, stock: {} };
      const [group, key] = field.includes('.') ? field.split('.') : [field, null];
      if (group === 'precio') {
        return { ...prev, [id]: { ...current, precio: { ...current.precio, [key || 'costo']: parseFloat(value) || 0 } } };
      }
      if (group === 'stock') {
        return { ...prev, [id]: { ...current, stock: { ...current.stock, [key || 'actual']: parseFloat(value) || 0 } } };
      }
      return prev;
    });
  }

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
    saveLinks(next);
  }



  function getEffectiveItem(it) {
    const edit = edits[it.id] || edits[it.sku] || edits[it.codigo] || {};
    return {
      ...it,
      precio: edit.precio ? { ...it.precio, ...edit.precio } : it.precio,
      stock: edit.stock ? { ...it.stock, ...edit.stock } : it.stock,
    };
  }

  async function doPush(dryRun) {
    if (!token) {
      setMsg({ type: 'error', text: 'Ingresa el API_AUTH_TOKEN para escribir' });
      return;
    }

    // Build payload from effective (edited) items + only those that have sku or codigo
    const payloadItems = items
      .filter((i) => i.sku || i.codigo)
      .map((raw) => {
        const it = getEffectiveItem(raw);
        return {
          sku: it.sku,
          codigo: it.codigo,
          precio: it.precio ? { ...it.precio } : undefined,
          stock: it.stock ? { actual: it.stock.actual, pedidoPendiente: it.stock.pedidoPendiente } : undefined,
        };
      });

    try {
      const res = await fetch(`${API_BASE}/api/productos-maestro/push`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ items: payloadItems, dryRun, token }),
      });
      const j = await res.json();
      if (j.ok) {
        const note = dryRun
          ? `Simulación OK — ${j.prepared?.summary?.precios || 0} precios / ${j.prepared?.summary?.stock || 0} stock`
          : `Escritura real completada — precios: ${j.results?.prices?.updated || 0}, stock: ${j.summary?.stockTouched || 0}`;
        setMsg({ type: 'success', text: note });
        setEdits({}); // clear local edits after successful operation
        if (!dryRun) setTimeout(refreshAll, 1400);
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
        <button 
          onClick={() => hasPendingChanges ? setShowConfirm(true) : doPush(false)} 
          disabled={!hasPendingChanges}
          style={btnStyle(hasPendingChanges ? '#dc2626' : '#9ca3af')}
          title={hasPendingChanges ? 'Escribir cambios reales' : 'Edita precios o stock para habilitar'}
        >
          <Send size={14} /> Escribir en planillas (real)
        </button>

        <input
          placeholder="API_AUTH_TOKEN (requerido para escribir)"
          value={token}
          onChange={(e) => saveToken(e.target.value)}
          style={{ ...inputStyle(), width: 280 }}
        />
      </div>

      {/* Pending changes banner */}
      {hasPendingChanges && (
        <div style={{
          background: '#fef3c7',
          border: '1px solid #f59e0b',
          borderRadius: 8,
          padding: '8px 12px',
          marginBottom: 12,
          fontSize: 13,
          color: '#92400e',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap'
        }}>
          <span>
            ⚠️ <strong>{pendingChanges}</strong> cambio(s) local(es) pendiente(s)
          </span>
          <button 
            onClick={() => setEdits({})}
            style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, border: '1px solid #d97706', background: 'white', cursor: 'pointer' }}
          >
            Descartar todo
          </button>
        </div>
      )}

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
                    <div style={{ display: 'flex', gap: 4, fontSize: 10, alignItems: 'center' }}>
                      <input type="number" step="0.01" value={getEffectiveItem(it).precio?.costo ?? ''} onChange={e => setEdit(getEditKey(it), 'precio.costo', e.target.value)} style={{width:58, background: edits[getEditKey(it)]?.precio?.costo != null ? '#fef3c7' : 'white'}} />
                      <input type="number" step="0.01" value={getEffectiveItem(it).precio?.ventaLocal ?? ''} onChange={e => setEdit(getEditKey(it), 'precio.ventaLocal', e.target.value)} style={{width:58, background: edits[getEditKey(it)]?.precio?.ventaLocal != null ? '#fef3c7' : 'white'}} />
                      <input type="number" step="0.01" value={getEffectiveItem(it).precio?.ventaWeb ?? ''} onChange={e => setEdit(getEditKey(it), 'precio.ventaWeb', e.target.value)} style={{width:58, background: edits[getEditKey(it)]?.precio?.ventaWeb != null ? '#fef3c7' : 'white'}} />
                      {edits[getEditKey(it)] && (
                        <button onClick={() => revertEdit(getEditKey(it))} style={{ fontSize: 10, padding: '0 4px', cursor: 'pointer', border: 'none', background: 'transparent', color: '#b45309' }} title="Revertir cambios de esta fila">↩</button>
                      )}
                    </div>
                  ) : <span style={{ color: '#999', fontSize: 11 }}>—</span>}
                </td>
                <td style={tdStyle()}>
                  {it.stock ? (
                    <div style={{ display: 'flex', gap: 4, fontSize: 10, alignItems: 'center' }}>
                      <input type="number" value={getEffectiveItem(it).stock?.actual ?? ''} onChange={e => setEdit(getEditKey(it), 'stock.actual', e.target.value)} style={{width:52, background: edits[getEditKey(it)]?.stock?.actual != null ? '#fef3c7' : 'white'}} />
                      <input type="number" value={getEffectiveItem(it).stock?.pedidoPendiente ?? ''} onChange={e => setEdit(getEditKey(it), 'stock.pedidoPendiente', e.target.value)} style={{width:52, background: edits[getEditKey(it)]?.stock?.pedidoPendiente != null ? '#fef3c7' : 'white'}} />
                      {edits[getEditKey(it)] && (
                        <button onClick={() => revertEdit(getEditKey(it))} style={{ fontSize: 10, padding: '0 4px', cursor: 'pointer', border: 'none', background: 'transparent', color: '#b45309' }} title="Revertir cambios de esta fila">↩</button>
                      )}
                    </div>
                  ) : <span style={{ color: '#999', fontSize: 11 }}>—</span>}
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

      {/* Confirmation Modal for real writes */}
      {showConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: C.bg, borderRadius: 12, padding: 24, maxWidth: 420, width: '90%', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}>
            <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 18 }}>¿Confirmas la escritura real?</h3>
            
            <p style={{ fontSize: 14, color: C.ts, marginBottom: 16 }}>
              Se enviarán <strong>{pendingChanges}</strong> cambio(s) a las planillas de MATRIZ y/o Stock.
              Esta acción modifica datos operativos.
            </p>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setShowConfirm(false)}
                style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  setShowConfirm(false);
                  doPush(false);
                }}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#dc2626', color: 'white', fontWeight: 600, cursor: 'pointer' }}
              >
                Sí, escribir cambios reales
              </button>
            </div>
          </div>
        </div>
      )}
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
