import React, { useEffect, useState } from 'react';

/**
 * PanelinHubPanel — Realtime integration for the main /hub.
 * Subscribes to the Fase 6 SSE endpoint (/api/panelin/events) for live
 * stock.movement and invoice.upserted pushed from FacturaExpress webhooks/syncs.
 *
 * Mirrors the logic from the standalone platform dashboard (panelin-platform/frontend/dashboard.html)
 * but as a native React component inside the authenticated hub.
 *
 * Usage: add route + nav link. Configurable API base for dev/prod.
 * Events auto-update the list (no polling for live changes).
 *
 * To use full features (products table with editable cost, full tables, acks, sync buttons):
 * click "Open Full Platform Dashboard" (the self-contained HTML one).
 */

export default function PanelinHubPanel() {
  const [events, setEvents] = useState([]);
  const [connected, setConnected] = useState(false);
  const [base, setBase] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('panelin_hub_base') || (import.meta.env.VITE_API_BASE || '');
    }
    return import.meta.env.VITE_API_BASE || '';
  });

  // Rich meta editor state (step 3 / Phase 2): description + meta (tech/images/channels) persisted via PATCH
  const [editSku, setEditSku] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editMeta, setEditMeta] = useState('{}');
  const [editLoading, setEditLoading] = useState(false);
  const [editResult, setEditResult] = useState(null);

  // Hoisted pushEvent (used by SSE handlers + by meta editor to make save updates visible in realtime in the events log + summary table)
  const pushEvent = (type, payload) => {
    setEvents((prev) => {
      const next = [{ type, payload, ts: Date.now() }, ...prev];
      return next.slice(0, 30); // keep recent
    });
  };

  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('panelin_hub_base', base);
    }

    const url = base ? `${base.replace(/\/$/, '')}/api/panelin/events` : '/api/panelin/events';
    let es;
    try {
      es = new EventSource(url);
    } catch (e) {
      console.warn('[PanelinHub] EventSource failed to init', e);
      setConnected(false);
      return;
    }

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    // pushEvent is now hoisted at component level (for SSE + editor realtime visibility)
    const handle = (evType) => (ev) => {
      try {
        const p = JSON.parse(ev.data || '{}');
        pushEvent(evType, p);
      } catch (err) {
        pushEvent(evType, { raw: ev.data, err: String(err) });
      }
    };

    es.addEventListener('stock.movement', handle('stock.movement'));
    es.addEventListener('invoice.upserted', handle('invoice.upserted'));

    // generic wrapper from the bus
    es.addEventListener('event', (ev) => {
      try {
        const d = JSON.parse(ev.data || '{}');
        if (d.type) {
          pushEvent(d.type, d.payload || d);
        }
      } catch {
        /* best-effort, ignore parse errors per Fase 6 */
      }
    });

    return () => {
      try { es.close(); } catch {
        /* best-effort close */
      }
    };
  }, [base]);

  const openFullDashboard = () => {
    const dashUrl = base
      ? `${base.replace(/\/$/, '')}/panelin-platform/frontend/dashboard.html`
      : '/panelin-platform/frontend/dashboard.html';
    window.open(dashUrl, '_blank');
  };

  const getBaseUrl = () => (base ? `${base.replace(/\/$/, '')}` : '');

  // Rich meta editor handlers — use existing PATCH /products/:sku (supports description + meta deep-merge per server/routes/panelin.js:259-271)
  // Load via GET /products/:sku (returns meta, description); Save sends PATCH; pushes 'product.updated' to local events for immediate realtime visibility in log/summary (no backend emit needed for UI demo; future product.updated events would arrive via SSE)
  const loadForEdit = async () => {
    const sku = (editSku || '').trim();
    if (!sku) {
      setEditResult({ error: 'sku_required' });
      return;
    }
    setEditLoading(true);
    setEditResult(null);
    try {
      const url = `${getBaseUrl()}/api/panelin/products/${encodeURIComponent(sku)}`;
      const r = await fetch(url);
      const j = await r.json();
      if (j.ok && j.product) {
        setEditDesc(j.product.description || '');
        setEditMeta(JSON.stringify(j.product.meta || {}, null, 2));
        setEditResult({ loaded: true, sku, from: 'GET /products/:sku' });
      } else {
        setEditResult({ error: j.error || 'load_failed', detail: j });
      }
    } catch (e) {
      setEditResult({ err: String(e) });
    } finally {
      setEditLoading(false);
    }
  };

  const saveEdit = async () => {
    const sku = (editSku || '').trim();
    if (!sku) {
      setEditResult({ error: 'sku_required' });
      return;
    }
    setEditLoading(true);
    try {
      let metaObj = {};
      try {
        metaObj = JSON.parse(editMeta || '{}');
      } catch (parseErr) {
        setEditResult({ error: 'invalid_meta_json', message: parseErr.message });
        setEditLoading(false);
        return;
      }
      const patchUrl = `${getBaseUrl()}/api/panelin/products/${encodeURIComponent(sku)}`;
      const r = await fetch(patchUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: editDesc, meta: metaObj }),
      });
      const j = await r.json();
      setEditResult(j);
      // Realtime visible update: synthetic event appears instantly in the events log + Live Summary table above
      pushEvent('product.updated', {
        sku,
        source: 'rich-meta-editor',
        via: 'PATCH /api/panelin/products/:sku',
        ok: !!j.ok,
        descriptionUpdated: editDesc != null,
        metaKeys: Object.keys(metaObj || {}),
        ts: Date.now(),
      });
      if (j.ok) {
        // re-load to confirm persisted values (shows deep merge worked)
        setTimeout(() => loadForEdit(), 250);
      }
    } catch (e) {
      setEditResult({ err: String(e) });
    } finally {
      setEditLoading(false);
    }
  };

  // Quick meta helpers (tech/images/channels examples for form)
  const setExampleMeta = (which) => {
    try {
      let m = {};
      try { m = JSON.parse(editMeta || '{}'); } catch { /* best-effort parse */ }
      if (which === 'tech') {
        m.tech = { ...(m.tech || {}), material: 'EPS', thickness_mm: 50, lambda: 0.032, fire_class: 'E' };
      } else if (which === 'images') {
        m.images = Array.isArray(m.images) ? m.images : [];
        if (!m.images.some(i => i && i.role === 'main')) m.images.push({ role: 'main', url: 'https://cdn.example.com/panel-BMC-001-main.jpg', alt: 'Vista principal' });
        if (!m.images.some(i => i && i.role === 'tech')) m.images.push({ role: 'tech', url: 'https://cdn.example.com/panel-BMC-001-tech.png' });
      } else if (which === 'channels') {
        m.channels = {
          ...(m.channels || {}),
          shopify: { product_id: 'gid://shopify/Product/123', variant_id: 'gid://shopify/ProductVariant/456', last_collected: new Date().toISOString() },
        };
      }
      setEditMeta(JSON.stringify(m, null, 2));
    } catch { /* best-effort meta example */ }
  };

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Panelin Realtime</h2>
        <span
          style={{
            padding: '2px 8px',
            borderRadius: 999,
            fontSize: 12,
            background: connected ? '#e6f7e6' : '#ffe6e6',
            color: connected ? '#1a7f1a' : '#b33',
            border: `1px solid ${connected ? '#1a7f1a' : '#b33'}`,
          }}
        >
          {connected ? '● LIVE' : '○ OFFLINE'}
        </span>
        <button onClick={openFullDashboard} style={{ marginLeft: 'auto' }}>
          Open Full Platform Dashboard
        </button>
      </div>

      <div style={{ marginBottom: 8, fontSize: 13, color: '#555' }}>
        API Base:{' '}
        <input
          value={base}
          onChange={(e) => setBase(e.target.value)}
          placeholder="http://localhost:3001 (or leave empty for relative /api)"
          style={{ width: 320, padding: 4 }}
        />
        <span style={{ marginLeft: 8, fontSize: 11 }}>(persisted in localStorage; same as standalone dashboard)</span>
      </div>

      <p style={{ fontSize: 13, color: '#444' }}>
        Live push from FacturaExpress webhooks / syncs (stock movements + invoices).
        No polling required for updates. This is the Fase 6 SSE integration in the main hub.
      </p>

      <div
        style={{
          maxHeight: 420,
          overflow: 'auto',
          border: '1px solid #e5e5e5',
          borderRadius: 6,
          background: '#fafafa',
          padding: 8,
          fontFamily: 'monospace',
          fontSize: 12,
        }}
      >
        {events.length === 0 && (
          <div style={{ color: '#888', padding: 8 }}>
            No events yet. Trigger a FacturaExpress webhook, a /sync/facturaexpress/* call,
            or a manual stock movement to see live updates here.
          </div>
        )}
        {events.map((ev, idx) => (
          <div
            key={idx}
            style={{
              padding: '6px 8px',
              borderBottom: '1px solid #eee',
              background: idx === 0 ? '#fffbeb' : 'transparent',
            }}
          >
            <span style={{ color: '#666' }}>
              {new Date(ev.ts).toLocaleTimeString()}
            </span>{' '}
            <strong>{ev.type}</strong>: {JSON.stringify(ev.payload)}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12, fontSize: 12, color: '#666' }}>
        Tip: Use the full standalone dashboard (button above) for editable products, full tables, alerts ack, and sync buttons.
        This panel shows the raw live event stream for the hub.
      </div>

      {/* Simple live stock/invoice summary table refresh on events (Fase 6 polish; in real would fetch /api/panelin/* on 'stock.movement'/'invoice.upserted' and re-render. Mirrors standalone dashboard table patterns. */}
      <div style={{ marginTop: 16 }}>
        <h4 style={{ margin: 0, fontSize: 13 }}>Live Summary (refreshes on events)</h4>
        <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse', marginTop: 4 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <th style={{ textAlign: 'left', padding: 4 }}>Type</th>
              <th style={{ textAlign: 'left', padding: 4 }}>Last SKU/Delta</th>
              <th style={{ textAlign: 'right', padding: 4 }}>TS</th>
            </tr>
          </thead>
          <tbody>
            {events.slice(0, 5).map((ev, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f5f5f5' }}>
                <td style={{ padding: 4 }}>{ev.type}</td>
                <td style={{ padding: 4, fontFamily: 'monospace' }}>{ev.payload?.sku || ev.payload?.delta || JSON.stringify(ev.payload).slice(0,40)}</td>
                <td style={{ padding: 4, textAlign: 'right' }}>{new Date(ev.ts).toLocaleTimeString()}</td>
              </tr>
            ))}
            {events.length === 0 && <tr><td colSpan={3} style={{ padding: 4, color: '#888' }}>No events yet — trigger FE webhook or sync to populate + refresh.</td></tr>}
          </tbody>
        </table>
        <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>Auto-refreshes on SSE push (stock/invoice events). Full tables in standalone dashboard.</div>
      </div>

      {/* Rich Meta Editor (added for step 3): form targeting description + meta (tech, images[], channels) using existing PATCH /api/panelin/products/:sku.
          - Load current via GET /products/:sku (returns full meta/desc from Panelin PG).
          - Edit + Save calls PATCH (deep merge on meta to preserve e.g. existing channels/images; see server/routes/panelin.js:259-271).
          - On success: result shown; synthetic 'product.updated' pushed via pushEvent → instantly visible in events log + Live Summary table above (realtime UI update).
          - Quick buttons populate tech/images/channels sub-structures (JSON editor for full control).
          - Persist + refresh confirms. No new endpoints. Matches plan step 3 + scout §4/51/74 (hub panel was realtime-only; backend was ready).
          - Tip: for production images gallery UI / full products table use the "Open Full Platform Dashboard" (or enhance standalone later).
       */}
      <div style={{ marginTop: 16, border: '1px solid #d1d5db', borderRadius: 6, padding: 12, background: '#fff' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: 13 }}>Rich Meta Editor — description + meta (tech / images[] / channels)</h4>
        <div style={{ fontSize: 12, color: '#555', marginBottom: 8 }}>
          SKU (e.g. TECHO-001):{' '}
          <input
            value={editSku}
            onChange={(e) => setEditSku(e.target.value.toUpperCase().trim())}
            placeholder="TECHO-001"
            style={{ width: 160, padding: '2px 6px', fontFamily: 'monospace' }}
          />{' '}
          <button onClick={loadForEdit} disabled={editLoading || !editSku} style={{ padding: '2px 8px' }}>
            {editLoading ? '...' : 'Load (GET)'}
          </button>
          <span style={{ marginLeft: 8, fontSize: 10, color: '#888' }}>Loads current description + meta from Panelin</span>
        </div>

        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 2 }}>Description</div>
          <textarea
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            placeholder="Descripción técnica del producto..."
            style={{ width: '100%', height: 48, fontSize: 12, padding: 4, boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 2 }}>
            Meta (full JSON — edit tech, images[], channels directly)
          </div>
          <textarea
            value={editMeta}
            onChange={(e) => setEditMeta(e.target.value)}
            spellCheck={false}
            style={{ width: '100%', height: 90, fontSize: 11, fontFamily: 'monospace', padding: 4, boxSizing: 'border-box', background: '#f8f8f8' }}
          />
          <div style={{ fontSize: 10, margin: '2px 0 4px' }}>
            Quick fills:{' '}
            <button onClick={() => setExampleMeta('tech')} style={{ fontSize: 10, padding: '1px 4px' }}>Add tech</button>{' '}
            <button onClick={() => setExampleMeta('images')} style={{ fontSize: 10, padding: '1px 4px' }}>Add images[]</button>{' '}
            <button onClick={() => setExampleMeta('channels')} style={{ fontSize: 10, padding: '1px 4px' }}>Add channels.shopify</button>
            <span style={{ marginLeft: 6, color: '#666' }}>
              (Parsed preview:{' '}
              {(() => {
                try {
                  const m = JSON.parse(editMeta || '{}');
                  const parts = [];
                  if (m.tech) parts.push('tech✓');
                  if (Array.isArray(m.images)) parts.push(`images[${m.images.length}]`);
                  if (m.channels) parts.push(`channels:${Object.keys(m.channels).join(',')}`);
                  return parts.length ? parts.join(' ') : '—';
                } catch {
                  return <span style={{ color: '#c00' }}>invalid JSON</span>;
                }
              })()})
            </span>
          </div>
        </div>

        <div>
          <button
            onClick={saveEdit}
            disabled={editLoading || !editSku}
            style={{ padding: '4px 12px', fontWeight: 600, background: '#0a66c2', color: '#fff', border: 'none', borderRadius: 4 }}
          >
            {editLoading ? 'Saving...' : `Save via PATCH /api/panelin/products/${editSku || ':sku'}`}
          </button>
          <span style={{ marginLeft: 8, fontSize: 10, color: '#666' }}>Deep-merges meta; realtime update pushed to events log below header.</span>
        </div>

        {editResult && (
          <pre
            style={{
              marginTop: 8,
              padding: 6,
              background: '#f0f0f0',
              fontSize: 10,
              maxHeight: 110,
              overflow: 'auto',
              border: '1px solid #ddd',
            }}
          >
            {JSON.stringify(editResult, null, 2)}
          </pre>
        )}

        <div style={{ fontSize: 10, color: '#666', marginTop: 6 }}>
          Updates visible in realtime in the &quot;Panelin Realtime&quot; events log + Live Summary table (via local pushEvent on successful PATCH). Persisted server-side (Panelin PG). Open full dashboard for richer table/gallery views.
        </div>
      </div>
    </div>
  );
}
