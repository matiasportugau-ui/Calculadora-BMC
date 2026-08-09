import React, { useState, useEffect } from 'react';
import {
  useListings,
  useItem,
  useUpdateItem,
  useUpdateDescription,
  useAuditListing,
} from '../hooks/useMlConnector.js';

const PAGE_SIZE = 50;

const STATUS_FILTERS = [
  { label: 'Todas', value: '' },
  { label: 'Activas', value: 'active' },
  { label: 'Pausadas', value: 'paused' },
];

const inputStyle = {
  width: '100%',
  padding: '7px 10px',
  fontSize: '13px',
  border: '1.5px solid var(--ac-border)',
  borderRadius: '8px',
  fontFamily: 'inherit',
  background: 'var(--ac-bg)',
  color: 'var(--ac-text)',
  boxSizing: 'border-box',
};

const fieldLabel = {
  display: 'block',
  fontSize: '11px',
  fontWeight: '600',
  textTransform: 'uppercase',
  letterSpacing: '.4px',
  color: 'var(--ac-text-2)',
  marginBottom: '5px',
};

// Attributes ML treats as read-only / system — never send these back.
const READONLY_ATTRS = new Set([
  'ITEM_CONDITION', 'GTIN', // handled via dedicated fields below
]);
const saleTermValue = (d, id) => (d?.sale_terms || []).find((t) => t.id === id)?.value_name || '';

function EditDrawer({ id, onClose }) {
  const item = useItem(id);
  const updateItem = useUpdateItem();
  const updateDescription = useUpdateDescription();
  const auditListing = useAuditListing();

  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [status, setStatus] = useState('active');
  const [sku, setSku] = useState('');
  const [condition, setCondition] = useState('new');
  const [warranty, setWarranty] = useState('');
  const [attrs, setAttrs] = useState({});        // { [attrId]: value_name }
  const [imagesText, setImagesText] = useState('');
  const [descriptionText, setDescriptionText] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [auditResult, setAuditResult] = useState(null);

  useEffect(() => {
    const d = item.data;
    if (!d) return;
    setTitle(d.title ?? '');
    setPrice(d.price ?? '');
    setQuantity(d.available_quantity ?? '');
    setStatus(d.status === 'paused' ? 'paused' : 'active');
    setSku(d.seller_custom_field || (d.attributes || []).find((a) => a.id === 'SELLER_SKU')?.value_name || '');
    setCondition((d.attributes || []).find((a) => a.id === 'ITEM_CONDITION')?.value_id === '2230581' ? 'used' : (d.condition || 'new'));
    setWarranty(saleTermValue(d, 'WARRANTY_TIME'));
    const seed = {};
    for (const a of d.attributes || []) {
      if (a.id && a.value_name != null && !READONLY_ATTRS.has(a.id)) seed[a.id] = a.value_name;
    }
    setAttrs(seed);
  }, [item.data]);

  const d = item.data;
  const editableAttrs = (d?.attributes || []).filter((a) => a.id && !READONLY_ATTRS.has(a.id) && a.name);
  const saving = updateItem.isPending || updateDescription.isPending;
  const saveError = updateItem.error || updateDescription.error;
  const saveOk = updateItem.isSuccess && (!descriptionText.trim() || updateDescription.isSuccess);
  const heroPic = d?.pictures?.[0]?.secure_url || d?.pictures?.[0]?.url;
  const penalty = !!d?.tags?.includes?.('moderation_penalty');

  const handleSave = () => {
    if (!confirming) { setConfirming(true); return; }
    const updates = {};
    if (title.trim() && title.trim() !== d?.title) updates.title = title.trim();
    if (price !== '' && Number(price) !== d?.price) updates.price = Number(price);
    if (quantity !== '' && Number(quantity) !== d?.available_quantity) updates.available_quantity = Number(quantity);
    if (status && status !== d?.status) updates.status = status;
    if (sku.trim() && sku.trim() !== (d?.seller_custom_field || '')) updates.seller_custom_field = sku.trim();

    // Changed attributes → ML expects [{id, value_name}]
    const changedAttrs = [];
    for (const a of editableAttrs) {
      const next = attrs[a.id];
      if (next != null && next !== a.value_name) changedAttrs.push({ id: a.id, value_name: next });
    }
    if (changedAttrs.length) updates.attributes = changedAttrs;

    // Warranty via sale_terms
    if (warranty.trim() && warranty.trim() !== saleTermValue(d, 'WARRANTY_TIME')) {
      updates.sale_terms = [
        { id: 'WARRANTY_TYPE', value_name: saleTermValue(d, 'WARRANTY_TYPE') || 'Garantía del vendedor' },
        { id: 'WARRANTY_TIME', value_name: warranty.trim() },
      ];
    }

    const urls = imagesText.split('\n').map((u) => u.trim()).filter(Boolean);
    if (urls.length) updates.pictures = urls.map((url) => ({ source: url }));

    if (Object.keys(updates).length) updateItem.mutate({ id, updates });
    if (descriptionText.trim()) updateDescription.mutate({ id, text: descriptionText });
    setConfirming(false);
  };

  const handleAudit = () => {
    setAuditResult(null);
    auditListing.mutate(
      { itemId: id },
      {
        onSuccess: (data) => setAuditResult(data),
      },
    );
  };

  const applyAuditSuggestions = () => {
    const audit = auditResult?.audit;
    const patches = audit?.suggested_patches;
    if (!patches) return;
    if (patches.title) setTitle(String(patches.title).slice(0, 60));
    if (patches.description) setDescriptionText(String(patches.description));
    if (Array.isArray(patches.attributes)) {
      setAttrs((prev) => {
        const next = { ...prev };
        for (const a of patches.attributes) {
          if (a?.id && a.value_name != null) next[a.id] = a.value_name;
        }
        return next;
      });
    }
  };

  const audit = auditResult?.audit;
  const auditError = auditListing.error;

  return (
    <div
      style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: '460px', maxWidth: '100vw',
        background: 'var(--ac-surface)', borderLeft: '1px solid var(--ac-border)',
        boxShadow: '-4px 0 24px rgba(0,0,0,.12)', zIndex: 1000,
        display: 'flex', flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--ac-border)' }}>
        <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--ac-text)' }}>Editar publicación</span>
        <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--ac-text-2)', lineHeight: 1 }}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '18px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {item.isLoading && <div style={{ color: 'var(--ac-text-2)', fontSize: '13px' }}>Cargando…</div>}
        {item.error && <div style={{ color: 'var(--ac-error)', fontSize: '13px' }}>Error al cargar la publicación.</div>}

        {d && (
          <>
            {/* ── Visualización tipo Mercado Libre ── */}
            <a href={d.permalink} target="_blank" rel="noreferrer"
               style={{ display: 'flex', gap: '12px', textDecoration: 'none', color: 'inherit', padding: '12px', borderRadius: '12px', background: 'var(--ac-bg)', border: '1px solid var(--ac-border)' }}>
              {heroPic
                ? <img src={heroPic} alt="" style={{ width: '76px', height: '76px', objectFit: 'cover', borderRadius: '10px', flexShrink: 0, border: '1px solid var(--ac-border)' }} />
                : <div style={{ width: '76px', height: '76px', borderRadius: '10px', background: 'var(--ac-border)', flexShrink: 0 }} />}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, lineHeight: 1.3, color: 'var(--ac-text)' }}>{d.title}</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ac-text)', margin: '4px 0' }}>{d.currency_id} {d.price}</div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <StatusBadge status={d.status} penalty={penalty} />
                  <span style={{ fontSize: '11px', color: 'var(--ac-text-2)' }}>{d.sold_quantity} vendidas · salud {typeof d.health === 'number' ? d.health.toFixed(2) : '—'}</span>
                </div>
                <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--ac-accent)', marginTop: '3px' }}>{d.id} ↗</div>
              </div>
            </a>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                onClick={handleAudit}
                disabled={auditListing.isPending}
                style={{
                  padding: '7px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: '600',
                  background: 'var(--ac-bg)',
                  color: 'var(--ac-accent)',
                  border: '1.5px solid var(--ac-accent)',
                  cursor: auditListing.isPending ? 'wait' : 'pointer',
                }}
              >
                {auditListing.isPending ? 'Auditando…' : 'Auditar IA'}
              </button>
              {audit?.scores && (
                <span style={{ fontSize: '11px', color: 'var(--ac-text-2)' }}>
                  Score {audit.scores.overall}/10
                  {auditResult?.provider ? ` · ${auditResult.provider}` : ''}
                </span>
              )}
            </div>

            {auditError && (
              <div style={{ fontSize: '12px', color: 'var(--ac-error)', padding: '10px', borderRadius: '8px', background: '#fff1f0' }}>
                {auditError.payload?.error || auditError.message || 'No se pudo auditar.'}
                {auditError.payload?.code === 'IA_NOT_CONFIGURED' && ' Configurá claves IA en el servidor.'}
              </div>
            )}

            {audit && (
              <div style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--ac-border)', background: 'var(--ac-bg)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--ac-text)' }}>Auditoría IA</div>
                {audit.summary && <div style={{ fontSize: '12px', color: 'var(--ac-text-2)', lineHeight: 1.4 }}>{audit.summary}</div>}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '11px' }}>
                  {['title', 'images', 'attributes', 'description'].map((k) => (
                    <span key={k} style={{ padding: '2px 8px', borderRadius: '12px', background: 'var(--ac-surface)', border: '1px solid var(--ac-border)' }}>
                      {k}: {audit.scores?.[k] ?? '—'}/10
                    </span>
                  ))}
                </div>
                {audit.issues?.length > 0 && (
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '11px', color: 'var(--ac-text-2)' }}>
                    {audit.issues.slice(0, 5).map((issue, idx) => (
                      <li key={idx}>
                        <strong>{issue.area}</strong> ({issue.severity}): {issue.message}
                      </li>
                    ))}
                  </ul>
                )}
                {audit.suggested_patches?.image_notes && (
                  <div style={{ fontSize: '11px', color: 'var(--ac-text-2)' }}>
                    Fotos: {audit.suggested_patches.image_notes}
                  </div>
                )}
                {(audit.suggested_patches?.title || audit.suggested_patches?.description || audit.suggested_patches?.attributes?.length > 0) && (
                  <button
                    type="button"
                    onClick={applyAuditSuggestions}
                    style={{
                      alignSelf: 'flex-start',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontWeight: '600',
                      background: 'var(--ac-accent)',
                      color: '#fff',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Aplicar sugerencias al formulario
                  </button>
                )}
                <div style={{ fontSize: '10px', color: 'var(--ac-warn)' }}>
                  Revisá y guardá manualmente — no se publica en ML sin confirmación.
                </div>
              </div>
            )}

            <div>
              <label style={fieldLabel} htmlFor="ml-title">Título</label>
              <textarea id="ml-title" value={title} onChange={(e) => setTitle(e.target.value)} rows={2} maxLength={60} style={{ ...inputStyle, resize: 'vertical' }} />
              <div style={{ fontSize: '10px', color: 'var(--ac-text-2)', textAlign: 'right' }}>{title.length}/60</div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={fieldLabel} htmlFor="ml-price">Precio ({d.currency_id})</label>
                <input id="ml-price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={fieldLabel} htmlFor="ml-qty">Stock disponible</label>
                <input id="ml-qty" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} style={inputStyle} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={fieldLabel} htmlFor="ml-status">Estado</label>
                <select id="ml-status" value={status} onChange={(e) => setStatus(e.target.value)}
                        disabled={penalty && status === 'paused'} style={inputStyle}>
                  <option value="active">Activa</option>
                  <option value="paused">Pausada</option>
                </select>
                {penalty && <div style={{ fontSize: '10px', color: 'var(--ac-error)', marginTop: '3px' }}>Penalizada por moderación — corregí la calidad antes de activar.</div>}
              </div>
              <div style={{ flex: 1 }}>
                <label style={fieldLabel} htmlFor="ml-cond">Condición</label>
                <select id="ml-cond" value={condition} onChange={(e) => setCondition(e.target.value)} style={inputStyle}>
                  <option value="new">Nuevo</option>
                  <option value="used">Usado</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={fieldLabel} htmlFor="ml-sku">SKU (código interno)</label>
                <input id="ml-sku" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="—" style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={fieldLabel} htmlFor="ml-warr">Garantía</label>
                <input id="ml-warr" value={warranty} onChange={(e) => setWarranty(e.target.value)} placeholder="ej: 12 meses" style={inputStyle} />
              </div>
            </div>

            {/* ── Características (atributos) ── */}
            {editableAttrs.length > 0 && (
              <div>
                <span style={fieldLabel}>Características</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                  {editableAttrs.map((a) => (
                    <div key={a.id} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: 'var(--ac-text-2)', width: '38%', flexShrink: 0 }} title={a.name}>{a.name}</span>
                      <input
                        value={attrs[a.id] ?? ''}
                        onChange={(e) => setAttrs((p) => ({ ...p, [a.id]: e.target.value }))}
                        style={{ ...inputStyle, fontSize: '12px', padding: '5px 8px' }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <span style={fieldLabel}>Fotos actuales ({d.pictures?.length || 0})</span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                {d.pictures?.length ? (
                  d.pictures.map((p) => (
                    <img key={p.id || p.secure_url} src={p.secure_url || p.url} alt=""
                         style={{ width: '52px', height: '52px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--ac-border)' }} />
                  ))
                ) : (
                  <span style={{ fontSize: '12px', color: 'var(--ac-text-2)' }}>Sin fotos</span>
                )}
              </div>
              <label style={fieldLabel} htmlFor="ml-images">Reemplazar fotos (una URL por línea)</label>
              <textarea id="ml-images" value={imagesText} onChange={(e) => setImagesText(e.target.value)} rows={3}
                        placeholder="https://…&#10;https://…" style={{ ...inputStyle, resize: 'vertical' }} />
            </div>

            <div>
              <label style={fieldLabel} htmlFor="ml-desc">Nueva descripción (opcional)</label>
              <textarea id="ml-desc" value={descriptionText} onChange={(e) => setDescriptionText(e.target.value)} rows={5}
                        placeholder="Escribí la nueva descripción…" style={{ ...inputStyle, resize: 'vertical' }} />
            </div>

            {saveError && <div style={{ fontSize: '12px', color: 'var(--ac-error)' }}>Error al guardar: {saveError.message || 'intentá de nuevo.'}</div>}
            {saveOk && !saving && <div style={{ fontSize: '12px', color: 'var(--ac-success)' }}>Cambios guardados correctamente.</div>}
          </>
        )}
      </div>

      {item.data && (
        <div style={{ padding: '14px 18px', borderTop: '1px solid var(--ac-border)', display: 'flex', gap: '8px', alignItems: 'center' }}>
          {confirming && (
            <span style={{ fontSize: '12px', color: 'var(--ac-warn)', flex: 1 }}>
              Esto modifica la publicación en vivo en Mercado Libre.
            </span>
          )}
          {confirming && (
            <button
              onClick={() => setConfirming(false)}
              disabled={saving}
              style={{ padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', background: 'transparent', color: 'var(--ac-text-2)', border: '1.5px solid var(--ac-border)', cursor: 'pointer' }}
            >
              Cancelar
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '7px 16px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '600',
              background: confirming ? 'var(--ac-warn)' : 'var(--ac-accent)',
              color: '#fff',
              border: 'none',
              cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.6 : 1,
              marginLeft: confirming ? 0 : 'auto',
            }}
          >
            {saving ? 'Guardando…' : confirming ? 'Confirmar cambios' : 'Guardar'}
          </button>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status, penalty }) {
  const map = {
    active: { bg: '#e6f4ea', fg: '#137333', label: 'Activa' },
    paused: { bg: '#fef7e0', fg: '#9a6700', label: 'Pausada' },
    closed: { bg: '#fce8e6', fg: '#c5221f', label: 'Cerrada' },
  };
  const s = map[status] || { bg: 'var(--ac-bg)', fg: 'var(--ac-text-2)', label: status || '—' };
  return (
    <span style={{ display: 'inline-flex', gap: '5px', alignItems: 'center' }}>
      <span style={{ background: s.bg, color: s.fg, fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '999px' }}>{s.label}</span>
      {penalty && <span title="Penalizada por moderación" style={{ background: '#fce8e6', color: '#c5221f', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '999px' }}>⚠ penalizada</span>}
    </span>
  );
}

/** One listing row: fetches its own detail (only IDs come from /ml/listings) so the
 *  table is scannable, and offers a one-click pause/activate that respects the same
 *  guardrail as the backend (never reactivate a penalized or zero-stock listing). */
function ListingRow({ id, onEdit }) {
  const item = useItem(id);
  const updateItem = useUpdateItem();
  const d = item.data;
  const penalty = !!d?.tags?.includes?.('moderation_penalty');
  const isActive = d?.status === 'active';
  const canActivate = !isActive && !penalty && (d?.available_quantity || 0) > 0;

  const cell = { padding: '11px 12px', borderBottom: '1px solid var(--ac-border)', color: 'var(--ac-text)' };

  if (item.isLoading || !d) {
    return <tr><td colSpan="5" style={{ ...cell, color: 'var(--ac-text-2)', fontFamily: 'monospace', fontSize: '12px' }}>{id}…</td></tr>;
  }

  const toggle = () => {
    if (isActive) updateItem.mutate({ id, updates: { status: 'paused' } });
    else if (canActivate) updateItem.mutate({ id, updates: { status: 'active' } });
  };

  return (
    <tr>
      <td style={cell}>
        <div style={{ fontSize: '13px', lineHeight: 1.3 }}>{d.title}</div>
        <div style={{ fontSize: '11px', color: 'var(--ac-text-2)', fontFamily: 'monospace' }}>{d.id} · salud {typeof d.health === 'number' ? d.health.toFixed(2) : '—'}</div>
      </td>
      <td style={cell}><StatusBadge status={d.status} penalty={penalty} /></td>
      <td style={{ ...cell, textAlign: 'right', whiteSpace: 'nowrap' }}>{d.price} {d.currency_id || ''}</td>
      <td style={{ ...cell, textAlign: 'right' }}>{d.available_quantity} <span style={{ color: 'var(--ac-text-2)', fontSize: '11px' }}>({d.sold_quantity} vend.)</span></td>
      <td style={{ ...cell, textAlign: 'right', whiteSpace: 'nowrap' }}>
        <button
          onClick={toggle}
          disabled={updateItem.isPending || (!isActive && !canActivate)}
          title={!isActive && !canActivate ? (penalty ? 'No reactivar: penalizada por moderación' : 'Sin stock') : ''}
          style={{ padding: '5px 10px', fontSize: '11px', borderRadius: '6px', marginRight: '6px', fontWeight: 600, cursor: updateItem.isPending || (!isActive && !canActivate) ? 'default' : 'pointer', opacity: !isActive && !canActivate ? 0.45 : 1, border: '1.5px solid var(--ac-border)', background: 'transparent', color: isActive ? 'var(--ac-warn)' : 'var(--ac-success, #137333)' }}
        >
          {updateItem.isPending ? '…' : isActive ? 'Pausar' : 'Activar'}
        </button>
        <button
          onClick={() => onEdit(id)}
          style={{ padding: '5px 12px', fontSize: '11px', borderRadius: '6px', background: 'transparent', color: 'var(--ac-accent)', border: '1.5px solid var(--ac-border)', cursor: 'pointer', fontWeight: 600 }}
        >
          Editar
        </button>
      </td>
    </tr>
  );
}

export default function ListingsTab() {
  const [statusFilter, setStatusFilter] = useState('');
  const [offset, setOffset] = useState(0);
  const [editingId, setEditingId] = useState(null);

  const listings = useListings({ status: statusFilter, limit: PAGE_SIZE, offset });

  const results = listings.data?.results || [];
  const total = listings.data?.paging?.total ?? 0;

  const onFilterChange = (value) => {
    setStatusFilter(value);
    setOffset(0);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap' }}>
        <select
          value={statusFilter}
          onChange={(e) => onFilterChange(e.target.value)}
          style={{ padding: '7px 10px', fontSize: '13px', border: '1.5px solid var(--ac-border)', borderRadius: '8px', fontFamily: 'inherit', background: 'var(--ac-surface)', color: 'var(--ac-text)' }}
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
        <span style={{ fontSize: '12px', color: 'var(--ac-text-2)', marginLeft: 'auto' }}>
          {total} publicaciones
        </span>
      </div>

      {listings.error ? (
        <div style={{ padding: '40px', color: 'var(--ac-error)', textAlign: 'center' }}>
          Error al cargar las publicaciones.
        </div>
      ) : (
        <div style={{ background: 'var(--ac-surface)', border: '1px solid var(--ac-border)', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'var(--ac-bg)' }}>
                {['Publicación', 'Estado', 'Precio', 'Stock', 'Acciones'].map((h, i) => (
                  <th key={h} style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '.4px', color: 'var(--ac-text-2)', padding: '10px 12px', textAlign: i >= 2 ? 'right' : 'left', borderBottom: '1.5px solid var(--ac-border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {listings.isLoading ? (
                <tr><td colSpan="5" style={{ padding: '40px 12px', textAlign: 'center', color: 'var(--ac-text-2)' }}>Cargando…</td></tr>
              ) : results.length ? (
                results.map((id) => (
                  <ListingRow key={id} id={id} onEdit={setEditingId} />
                ))
              ) : (
                <tr><td colSpan="5" style={{ padding: '40px 12px', textAlign: 'center', color: 'var(--ac-text-2)' }}>Sin publicaciones</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center', marginTop: '14px' }}>
        <button
          onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          disabled={offset === 0}
          style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '8px', background: 'transparent', color: 'var(--ac-text-2)', border: '1.5px solid var(--ac-border)', cursor: offset === 0 ? 'default' : 'pointer', opacity: offset === 0 ? 0.5 : 1 }}
        >
          ‹ Anterior
        </button>
        <span style={{ fontSize: '12px', color: 'var(--ac-text-2)' }}>
          {total ? `${offset + 1}–${Math.min(offset + PAGE_SIZE, total)} de ${total}` : '—'}
        </span>
        <button
          onClick={() => setOffset(offset + PAGE_SIZE)}
          disabled={offset + PAGE_SIZE >= total}
          style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '8px', background: 'transparent', color: 'var(--ac-text-2)', border: '1.5px solid var(--ac-border)', cursor: offset + PAGE_SIZE >= total ? 'default' : 'pointer', opacity: offset + PAGE_SIZE >= total ? 0.5 : 1 }}
        >
          Siguiente ›
        </button>
      </div>

      {editingId && <EditDrawer id={editingId} onClose={() => setEditingId(null)} />}
    </div>
  );
}
