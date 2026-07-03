import React, { useRef, useEffect } from 'react';
import { usePresupuestoLibre } from '../contexts/PresupuestoLibreContext';
import { PresupuestoLibrePanelContent } from './PresupuestoLibrePanelContent';
import './PresupuestoLibrePanel.css';

export function PresupuestoLibrePanel() {
  const { isOpen, setIsOpen } = usePresupuestoLibre();
  const panelRef = useRef(null);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, setIsOpen]);

  if (!isOpen) {
    return (
      <button
        className="pl-panel__fab"
        onClick={() => setIsOpen(true)}
        aria-label="Abrir Presupuesto Libre"
        title="Presupuesto Libre"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M12 5v14M5 12h14" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    );
  }

  return (
    <div className="pl-panel__overlay" onClick={() => setIsOpen(false)}>
      <div
        className="pl-panel"
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="pl-panel__header">
          <h2 className="pl-panel__title">Presupuesto Libre</h2>
          <button
            className="pl-panel__close"
            onClick={() => setIsOpen(false)}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="pl-panel__body">
          <PresupuestoLibrePanelContent />
        </div>
      </div>
    </div>
  );
}
