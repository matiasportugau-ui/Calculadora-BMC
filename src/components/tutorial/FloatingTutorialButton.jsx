import React from 'react';
import { useTutorial } from './useTutorial.js';

/**
 * Botón flotante discreto para activar el Modo Tutorial.
 * Solo visible cuando el tutorial no está activo.
 */
export default function FloatingTutorialButton() {
  const { isTutorialMode, activeWorkflowId } = useTutorial();

  // No mostrar si ya está en un tutorial activo
  if (isTutorialMode && activeWorkflowId) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9999,
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: 999,
        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
        padding: '6px 10px 6px 6px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <button
        onClick={() => {
          // Abrir el panel de tutoriales (esto abre el toggle)
          const event = new CustomEvent('open-tutorial-panel');
          window.dispatchEvent(event);
        }}
        style={{
          background: '#f8fafc',
          border: 'none',
          borderRadius: 999,
          padding: '6px 14px',
          fontSize: 12,
          fontWeight: 600,
          color: '#334155',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span>🎓</span>
        <span>Modo Tutorial</span>
      </button>
    </div>
  );
}
