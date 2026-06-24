import React, { useState, useEffect } from 'react';
import {
  useListings,
  useItem,
  useUpdateItem,
  useUpdateDescription,
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

function EditDrawer({ id, onClose }) {
  const item = useItem(id);
  const updateItem = useUpdateItem();
  const updateDescription = useUpdateDescription();

  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [status, setStatus] = useState('active');
  const [imagesText, setImagesText] = useState('');
  const [descriptionText, setDescriptionText] = useState('');
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (item.data) {
      setPrice(item.data.price ?? '');
      setQuantity(item.data.available_quantity ?? '');
      setStatus(item.data.status === 'paused' ? 'paused' : 'active');
    }
  }, [item.data]);

  const saving = updateItem.isPending || updateDescription.isPending;
  const saveError = updateItem.error || updateDescription.error;
  const saveOk = updateItem.isSuccess && (!descriptionText.trim() || updateDescription.isSuccess);

  const handleSave = () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    const updates = {};
    if (price !== '' && Number(price) !== item.data?.price) {
      updates.price = Number(price);
    }
    if (quantity !== '' && Number(quantity) !== item.data?.available_quantity) {
      updates.available_quantity = Number(quantity);
    }
    if (status && status !== item.data?.status) {
      updates.status = status;
    }
    const urls = imagesText
      .split('\n')
      .map((u) => u.trim())
      .filter(Boolean);
    if (urls.length) {
      updates.pictures = urls.map((url) => ({ source: url }));
    }

    if (Object.keys(updates).length) {
      updateItem.mutate({ id, updates });
    }
    if (descriptionText.trim()) {
      updateDescription.mutate({ id, text: descriptionText });
    }
    setConfirming(false);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '420px',
        maxWidth: '100vw',
        background: 'var(--ac-surface)',
        borderLeft: '1px solid var(--ac-border)',
        boxShadow: '-4px 0 24px rgba(0,0,0,.12)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--ac-border)' }}>
        <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--ac-text)' }}>Editar publicación</span>
        <button
          onClick={onClose}
          style={{ border: 'none', background: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--ac-text-2)', lineHeight: 1 }}
        >
          ✕
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '18px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {item.isLoading && <div style={{ color: 'var(--ac-text-2)', fontSize: '13px' }}>Cargando…</div>}
        {item.error && <div style={{ color: 'var(--ac-error)', fontSize: '13px' }}>Error al cargar la publicación.</div>}

        {item.data && (
          <>
            <div>
              <span style={fieldLabel}>Título</span>
              <div style={{ fontSize: '13px', color: 'var(--ac-text)', lineHeight: 1.4 }}>{item.data.title}</div>
              <div style={{ fontSize: '11px', color: 'var(--ac-text-2)', marginTop: '2px' }}>{item.data.id}</div>
            </div>

            <div>
              <label style={fieldLabel} htmlFor="ml-price">Precio</label>
              <input id="ml-price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} style={inputStyle} />
            </div>

            <div>
              <label style={fieldLabel} htmlFor="ml-qty">Stock disponible</label>
              <input id="ml-qty" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} style={inputStyle} />
            </div>

            <div>
              <label style={fieldLabel} htmlFor="ml-status">Estado</label>
              <select id="ml-status" value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}>
                <option value="active">Activa</option>
                <option value="paused">Pausada</option>
              </select>
            </div>

            <div>
              <span style={fieldLabel}>Fotos actuales</span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                {item.data.pictures?.length ? (
                  item.data.pictures.map((p) => (
                    <img
                      key={p.id || p.secure_url}
                      src={p.secure_url || p.url}
                      alt=""
                      style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--ac-border)' }}
                    />
                  ))
                ) : (
                  <span style={{ fontSize: '12px', color: 'var(--ac-text-2)' }}>Sin fotos</span>
                )}
              </div>
              <label style={fieldLabel} htmlFor="ml-images">Reemplazar fotos (una URL por línea)</label>
              <textarea
                id="ml-images"
                value={imagesText}
                onChange={(e) => setImagesText(e.target.value)}
                rows={4}
                placeholder="https://…&#10;https://…"
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            <div>
              <label style={fieldLabel} htmlFor="ml-desc">Nueva descripción (opcional)</label>
              <textarea
                id="ml-desc"
                value={descriptionText}
                onChange={(e) => setDescriptionText(e.target.value)}
                rows={5}
                placeholder="Escribí la nueva descripción…"
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            {saveError && (
              <div style={{ fontSize: '12px', color: 'var(--ac-error)' }}>
                Error al guardar: {saveError.message || 'intentá de nuevo.'}
              </div>
            )}
            {saveOk && !saving && (
              <div style={{ fontSize: '12px', color: 'var(--ac-success)' }}>Cambios guardados correctamente.</div>
            )}
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
                <th style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '.4px', color: 'var(--ac-text-2)', padding: '10px 12px', textAlign: 'left', borderBottom: '1.5px solid var(--ac-border)' }}>ID</th>
                <th style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '.4px', color: 'var(--ac-text-2)', padding: '10px 12px', textAlign: 'right', borderBottom: '1.5px solid var(--ac-border)' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {listings.isLoading ? (
                <tr><td colSpan="2" style={{ padding: '40px 12px', textAlign: 'center', color: 'var(--ac-text-2)' }}>Cargando…</td></tr>
              ) : results.length ? (
                results.map((id) => (
                  <tr key={id} style={{ borderBottom: '1px solid var(--ac-border)' }}>
                    <td style={{ padding: '11px 12px', fontFamily: 'monospace', color: 'var(--ac-text)' }}>{id}</td>
                    <td style={{ padding: '11px 12px', textAlign: 'right' }}>
                      <button
                        onClick={() => setEditingId(id)}
                        style={{ padding: '5px 12px', fontSize: '11px', borderRadius: '6px', background: 'transparent', color: 'var(--ac-accent)', border: '1.5px solid var(--ac-border)', cursor: 'pointer', fontWeight: '600' }}
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="2" style={{ padding: '40px 12px', textAlign: 'center', color: 'var(--ac-text-2)' }}>Sin publicaciones</td></tr>
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
