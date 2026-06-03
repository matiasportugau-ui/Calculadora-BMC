import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTutorial } from './useTutorial.js';

/**
 * TutorialOverlay
 * Renderiza un spotlight + tarjeta de paso interactivo cuando hay un workflow activo.
 * Usa data-tutorial-id en los elementos de la UI como targets.
 */
export default function TutorialOverlay() {
  const {
    isTutorialMode,
    activeWorkflow,
    currentStep,
    currentStepIndex,
    totalSteps,
    progress,
    nextStep,
    prevStep,
    exitTutorial,
  } = useTutorial();

  const [targetRect, setTargetRect] = useState(null);
  const cardRef = useRef(null);

  // Encontrar y resaltar el elemento objetivo
  useEffect(() => {
    if (!currentStep?.target || !isTutorialMode) {
      setTargetRect(null);
      return;
    }

    const findTarget = () => {
      // Soporta tanto data-tutorial-id como los anchors existentes del sistema de ayuda
      const selector = `[data-tutorial-id="${currentStep.target}"], [data-help-id="${currentStep.target}"]`;
      const el = document.querySelector(selector);
      
      if (el) {
        const rect = el.getBoundingClientRect();
        setTargetRect(rect);

        // Scroll suave hacia el elemento si está fuera de vista
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      } else {
        // Si no encuentra el target, mostramos la tarjeta centrada
        setTargetRect(null);
      }
    };

    // Pequeño delay para que el DOM se actualice (útil en rutas lazy)
    const timeout = setTimeout(findTarget, 120);

    // Re-calcular en resize / scroll
    const handleResize = () => findTarget();
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [currentStep, isTutorialMode]);

  if (!isTutorialMode || !activeWorkflow || !currentStep) {
    return null;
  }

  const isLastStep = currentStepIndex === totalSteps - 1;

  // Posicionamiento inteligente de la tarjeta
  const getCardStyle = () => {
    if (!targetRect) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        maxWidth: '420px',
      };
    }

    const cardWidth = 380;
    const padding = 16;
    let top = targetRect.bottom + padding;
    let left = targetRect.left;

    // Ajustes según placement
    if (currentStep.placement === 'top') {
      top = targetRect.top - 180;
    }
    if (currentStep.placement === 'left') {
      left = targetRect.left - cardWidth - padding;
    }
    if (currentStep.placement === 'right') {
      left = targetRect.right + padding;
    }

    // Evitar que se salga de la pantalla
    const maxLeft = window.innerWidth - cardWidth - 16;
    left = Math.max(16, Math.min(left, maxLeft));
    top = Math.max(16, Math.min(top, window.innerHeight - 200));

    return {
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      maxWidth: `${cardWidth}px`,
      zIndex: 99999,
    };
  };

  const cardStyle = getCardStyle();

  return createPortal(
    <>
      {/* Overlay oscuro con agujero (spotlight) */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.55)',
          zIndex: 99990,
          pointerEvents: 'none',
          transition: 'opacity 0.2s ease',
        }}
      >
        {/* Spotlight (agujero alrededor del target) */}
        {targetRect && (
          <div
            style={{
              position: 'absolute',
              left: targetRect.left - 8,
              top: targetRect.top - 8,
              width: targetRect.width + 16,
              height: targetRect.height + 16,
              borderRadius: 12,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
              border: '2px solid #2563eb',
              pointerEvents: 'none',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        )}
      </div>

      {/* Tarjeta de instrucción */}
      <div
        ref={cardRef}
        style={{
          ...cardStyle,
          background: 'white',
          borderRadius: 14,
          boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
          border: '1px solid #e5e7eb',
          padding: '20px 22px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>
              {activeWorkflow.title} • Paso {currentStepIndex + 1} de {totalSteps}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginTop: 2 }}>
              {currentStep.title}
            </div>
          </div>
          <button
            onClick={exitTutorial}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 18,
              cursor: 'pointer',
              color: '#9ca3af',
              lineHeight: 1,
            }}
            aria-label="Cerrar tutorial"
          >
            ×
          </button>
        </div>

        {/* Contenido */}
        <div style={{ fontSize: 14, lineHeight: 1.5, color: '#374151', marginBottom: 16 }}>
          {Array.isArray(currentStep.content)
            ? currentStep.content.map((p, i) => <p key={i} style={{ margin: '6px 0' }}>{p}</p>)
            : currentStep.content}
        </div>

        {currentStep.action && (
          <div style={{
            background: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 13,
            color: '#0369a1',
            marginBottom: 16,
          }}>
            → {currentStep.action}
          </div>
        )}

        {/* Barra de progreso */}
        <div style={{
          height: 4,
          background: '#f3f4f6',
          borderRadius: 999,
          marginBottom: 14,
          overflow: 'hidden',
        }}>
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              background: '#2563eb',
              transition: 'width 0.3s ease',
            }}
          />
        </div>

        {/* Controles */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
          <button
            onClick={prevStep}
            disabled={currentStepIndex === 0}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid #d1d5db',
              background: currentStepIndex === 0 ? '#f9fafb' : 'white',
              color: currentStepIndex === 0 ? '#9ca3af' : '#374151',
              fontSize: 13,
              cursor: currentStepIndex === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            Anterior
          </button>

          <button
            onClick={nextStep}
            style={{
              padding: '8px 20px',
              borderRadius: 8,
              border: 'none',
              background: isLastStep ? '#16a34a' : '#2563eb',
              color: 'white',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {isLastStep ? 'Finalizar flujo' : 'Siguiente'}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 10 }}>
          <button
            onClick={exitTutorial}
            style={{
              fontSize: 12,
              color: '#9ca3af',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Salir del tutorial
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}
