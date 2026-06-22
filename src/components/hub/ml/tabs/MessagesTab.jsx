import React from 'react';

export default function MessagesTab() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '16px', height: '440px' }}>
      <div style={{ border: '1px solid #e5e5ea', borderRadius: '12px', overflow: 'y-auto', background: '#fff' }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid #e5e5ea', cursor: 'pointer', background: '#eff6ff' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#1d1d1f' }}>Carlos M.</div>
          <div style={{ fontSize: '12px', color: '#6e6e73', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>¿El panel incluye soporte?</div>
        </div>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid #e5e5ea', cursor: 'pointer' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#1d1d1f' }}>Ana L.</div>
          <div style={{ fontSize: '12px', color: '#6e6e73', marginTop: '2px' }}>¿Cuánto demora el envío?</div>
        </div>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid #e5e5ea', cursor: 'pointer', opacity: 0.6 }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#1d1d1f' }}>Pedro R.</div>
          <div style={{ fontSize: '12px', color: '#6e6e73', marginTop: '2px' }}>Gracias, lo recibí</div>
        </div>
      </div>

      <div style={{ border: '1px solid #e5e5ea', borderRadius: '12px', display: 'flex', flexDirection: 'column', background: '#fff', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e5ea', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><div style={{ fontSize: '14px', fontWeight: '700' }}>Carlos M.</div></div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' }}>Sin responder</span>
        </div>
        <div style={{ flex: 1, overflow: 'y-auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ maxWidth: '70%', padding: '9px 13px', borderRadius: '14px 14px 14px 4px', background: '#f5f5f7', border: '1px solid #e5e5ea', fontSize: '13px', lineHeight: '1.45' }}>
            ¿El panel incluye soporte de montaje?
          </div>
        </div>
        <div style={{ padding: '10px 14px', borderTop: '1px solid #e5e5ea', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#1d4ed8' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.4px', color: '#0071e3', marginBottom: '4px' }}>🤖 Sugerencia IA</div>
            Sí, incluye soporte compatible para techo plano e inclinado.
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input type="text" value="Sí, incluye soporte compatible para techo plano e inclinado." style={{ flex: 1, padding: '7px 12px', border: '1.5px solid #e5e5ea', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit' }} />
            <button style={{ padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', background: '#0071e3', color: '#fff', border: 'none', cursor: 'pointer' }}>Enviar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
