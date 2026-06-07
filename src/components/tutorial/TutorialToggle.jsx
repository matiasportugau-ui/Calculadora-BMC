import React from 'react';
import { useTutorial } from './useTutorial.js';
import { WORKFLOW_IDS } from './workflows.js';

/**
 * TutorialToggle + Launcher
 * Componente para activar/desactivar el Modo Tutorial y lanzar flujos específicos.
 * Se puede colocar en el HelpButton, en el header, o como floating action.
 */
export default function TutorialToggle({ compact = false }) {
  const {
    isTutorialMode,
    toggleTutorialMode,
    startWorkflow,
    activeWorkflowId,
    exitTutorial,
    completedWorkflows,
  } = useTutorial();

  if (compact) {
    return (
      <button
        onClick={toggleTutorialMode}
        style={{
          fontSize: 12,
          padding: '4px 10px',
          borderRadius: 6,
          border: isTutorialMode ? '1px solid #2563eb' : '1px solid #d1d5db',
          background: isTutorialMode ? '#eff6ff' : 'white',
          color: isTutorialMode ? '#1e40af' : '#374151',
          cursor: 'pointer',
        }}
        title={isTutorialMode ? 'Desactivar Modo Tutorial' : 'Activar Modo Tutorial'}
      >
        {isTutorialMode ? '✕ Tutorial' : '▶ Tutorial'}
      </button>
    );
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
          Modo Tutorial
        </label>
        <button
          onClick={toggleTutorialMode}
          style={{
            padding: '2px 10px',
            fontSize: 12,
            borderRadius: 999,
            border: 'none',
            background: isTutorialMode ? '#2563eb' : '#e5e7eb',
            color: isTutorialMode ? 'white' : '#374151',
            cursor: 'pointer',
          }}
        >
          {isTutorialMode ? 'Activado' : 'Desactivado'}
        </button>
      </div>

      {isTutorialMode && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
            Elige un flujo guiado:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {WORKFLOW_IDS.map((id) => {
              const isCompleted = completedWorkflows.has(id);
              const isActive = activeWorkflowId === id;

              return (
                <button
                  key={id}
                  onClick={() => {
                    if (isActive) {
                      exitTutorial();
                    } else {
                      startWorkflow(id);
                    }
                  }}
                  style={{
                    textAlign: 'left',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: isActive ? '2px solid #2563eb' : '1px solid #e5e7eb',
                    background: isActive ? '#eff6ff' : isCompleted ? '#f0fdf4' : 'white',
                    fontSize: 13,
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span>
                    {id === 'crear-cotizacion-basica' && '📐 '}
                    {id === 'admin-cotizaciones-gestion' && '📋 '}
                    {id === 'enviar-presupuesto-wa' && '💬 '}
                    {getWorkflowLabel(id)}
                  </span>
                  {isCompleted && <span style={{ color: '#16a34a', fontSize: 11 }}>✓</span>}
                </button>
              );
            })}
          </div>

          {activeWorkflowId && (
            <button
              onClick={exitTutorial}
              style={{
                marginTop: 10,
                width: '100%',
                padding: '6px',
                fontSize: 12,
                color: '#dc2626',
                background: 'none',
                border: '1px solid #fecaca',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Salir del flujo actual
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function getWorkflowLabel(id) {
  const labels = {
    'crear-cotizacion-basica': 'Crear cotización básica',
    'admin-cotizaciones-gestion': 'Gestionar cotizaciones entrantes',
    'enviar-presupuesto-wa': 'Enviar por WhatsApp',
  };
  return labels[id] || id;
}
