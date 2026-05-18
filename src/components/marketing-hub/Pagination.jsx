// Module: market-intelligence | Owner: bmc-dev | Created: 2026-05-15

import React from 'react';

export default function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const btn = (disabled) => ({
    padding: '6px 14px', fontSize: 13,
    border: '1.5px solid #e5e5ea', borderRadius: 8,
    background: disabled ? '#f5f5f5' : '#fff',
    color: disabled ? '#bbb' : '#1a3a5c',
    cursor: disabled ? 'default' : 'pointer',
    fontWeight: 500,
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 12 }}>
      <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} style={btn(currentPage === 1)}>
        ← Anterior
      </button>
      <span style={{ fontSize: 13, color: '#888' }}>Página {currentPage} de {totalPages}</span>
      <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} style={btn(currentPage === totalPages)}>
        Siguiente →
      </button>
    </div>
  );
}
