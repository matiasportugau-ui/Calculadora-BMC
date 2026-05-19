// Module: market-intelligence | Owner: bmc-dev | Created: 2026-05-15

import React from 'react';
import Pagination from './Pagination.jsx';

const reasonLabel = {
  blocked:               'Sitio bloqueado',
  manual_request:        'Solicitud manual',
  recurring_parse_error: 'Error de parsing recurrente',
};

function TaskRow({ task }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 14px', background: '#fff', border: '1px solid #e5e5ea', borderRadius: 8, marginBottom: 6, transition: 'border-color 0.15s' }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 600, color: '#1a3a5c', fontSize: 13 }}>{task.competitor_name ?? task.competitor_id}</span>
          {task.domain && <span style={{ fontSize: 11, color: '#aaa' }}>{task.domain}</span>}
        </div>
        <p style={{ fontSize: 13, color: '#595959', margin: '2px 0 0' }}>{reasonLabel[task.reason] ?? task.reason}</p>
        {task.notes && <p style={{ fontSize: 11, color: '#aaa', margin: '2px 0 0', fontStyle: 'italic' }}>{task.notes}</p>}
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <span style={{ display: 'inline-block', padding: '2px 10px', fontSize: 11, fontWeight: 600, background: '#fff7e6', color: '#d46b08', border: '1px solid #ffd591', borderRadius: 20, textTransform: 'uppercase' }}>
          {task.status}
        </span>
        <p style={{ fontSize: 11, color: '#aaa', margin: '4px 0 0' }}>{new Date(task.created_at).toLocaleDateString('es-UY')}</p>
      </div>
    </div>
  );
}

export default function MysteryShoppingWidget({ data, currentPage, onPageChange }) {
  if (!data.total) {
    return <div style={{ background: '#fafafa', border: '1px solid #e5e5ea', borderRadius: 10, padding: 24, textAlign: 'center', fontSize: 13, color: '#888' }}>No hay tareas pendientes.</div>;
  }
  return (
    <div>
      <p style={{ fontSize: 11, color: '#aaa', marginBottom: 8 }}>
        Las tareas deben ser aprobadas y ejecutadas por un operador humano. El sistema nunca auto-aprueba visitas.
      </p>
      {data.data.map(t => <TaskRow key={t.id} task={t} />)}
      <Pagination currentPage={currentPage} totalPages={data.total_pages} onPageChange={onPageChange} />
    </div>
  );
}
