import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getWorkflow } from './workflows.js';

const STORAGE_KEY = 'bmc_tutorial_mode';
const PROGRESS_KEY = 'bmc_tutorial_progress';
// Session-scoped dismissal: once the user closes the tutorial, suppress it
// (overlay + floating launcher) for the rest of the browser session. Lives in
// sessionStorage so it survives reloads but resets in a new tab/session.
const SESSION_DISMISS_KEY = 'bmc_tutorial_session_dismissed';

const TutorialContext = createContext(null);

export function TutorialProvider({ children }) {
  const [isTutorialMode, setIsTutorialMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) === 'true';
  });

  const [activeWorkflowId, setActiveWorkflowId] = useState(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [sessionDismissed, setSessionDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem(SESSION_DISMISS_KEY) === 'true';
  });
  const [completedWorkflows, setCompletedWorkflows] = useState(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const saved = localStorage.getItem(PROGRESS_KEY);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Persist tutorial mode
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, isTutorialMode ? 'true' : 'false');
    }
  }, [isTutorialMode]);

  // Persist completed workflows
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(Array.from(completedWorkflows)));
    }
  }, [completedWorkflows]);

  const activeWorkflow = useMemo(() => {
    return activeWorkflowId ? getWorkflow(activeWorkflowId) : null;
  }, [activeWorkflowId]);

  const currentStep = useMemo(() => {
    if (!activeWorkflow || !activeWorkflow.steps) return null;
    return activeWorkflow.steps[currentStepIndex] || null;
  }, [activeWorkflow, currentStepIndex]);

  const totalSteps = activeWorkflow?.steps?.length || 0;
  const progress = totalSteps > 0 ? Math.round(((currentStepIndex + 1) / totalSteps) * 100) : 0;

  // Limpia la marca de "cerrado en esta sesión". Todo arranque explícito de un
  // flujo es intención del usuario, así que des-descarta el tutorial.
  const clearSessionDismiss = useCallback(() => {
    if (typeof window !== 'undefined') sessionStorage.removeItem(SESSION_DISMISS_KEY);
    setSessionDismissed(false);
  }, []);

  const startWorkflow = useCallback((workflowId) => {
    const wf = getWorkflow(workflowId);
    if (!wf) {
      console.warn(`[Tutorial] Workflow no encontrado: ${workflowId}`);
      return;
    }
    clearSessionDismiss();
    setActiveWorkflowId(workflowId);
    setCurrentStepIndex(0);
    // Auto-activar modo tutorial al iniciar un flujo
    if (!isTutorialMode) setIsTutorialMode(true);
  }, [isTutorialMode, clearSessionDismiss]);

  // Salida "suave": cierra el flujo actual pero mantiene el modo tutorial
  // encendido para que el usuario pueda saltar entre flujos (usado por TutorialToggle).
  const exitTutorial = useCallback(() => {
    setActiveWorkflowId(null);
    setCurrentStepIndex(0);
    // Opcional: mantener modo tutorial activado o apagarlo
    // setIsTutorialMode(false); // Comentado para que el usuario pueda saltar entre flujos
  }, []);

  // Cierre "duro": apaga el modo tutorial y descarta el tutorial (overlay +
  // botón flotante) por el resto de la sesión. Usado por los botones de cierre
  // del cartel (× y "Salir del tutorial").
  const dismissTutorial = useCallback(() => {
    setActiveWorkflowId(null);
    setCurrentStepIndex(0);
    setIsTutorialMode(false);
    setSessionDismissed(true);
    if (typeof window !== 'undefined') sessionStorage.setItem(SESSION_DISMISS_KEY, 'true');
  }, []);

  const completeCurrentWorkflow = useCallback(() => {
    if (activeWorkflowId) {
      setCompletedWorkflows(prev => {
        const next = new Set(prev);
        next.add(activeWorkflowId);
        return next;
      });
    }
    exitTutorial();
  }, [activeWorkflowId, exitTutorial]);

  const nextStep = useCallback(() => {
    if (!activeWorkflow) return;

    const nextIndex = currentStepIndex + 1;
    if (nextIndex >= activeWorkflow.steps.length) {
      completeCurrentWorkflow();
    } else {
      setCurrentStepIndex(nextIndex);
    }
  }, [activeWorkflow, currentStepIndex, completeCurrentWorkflow]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  }, [currentStepIndex]);

  const toggleTutorialMode = useCallback(() => {
    const newMode = !isTutorialMode;
    setIsTutorialMode(newMode);
    if (newMode) {
      // Encender el modo es intención explícita: limpiar el descarte de sesión.
      clearSessionDismiss();
    } else {
      // Si apagan el modo, salir del flujo actual
      exitTutorial();
    }
  }, [isTutorialMode, exitTutorial, clearSessionDismiss]);

  const resetAllTutorials = useCallback(() => {
    setCompletedWorkflows(new Set());
    localStorage.removeItem(PROGRESS_KEY);
    exitTutorial();
  }, [exitTutorial]);

  // Listen for custom events from modules (e.g. "Start tutorial for Admin Cotizaciones")
  useEffect(() => {
    const handler = (e) => {
      if (e.type === 'start-admin-cot-tutorial') {
        startWorkflow('admin-cotizaciones-gestion');
      }
      if (e.type === 'start-calculator-tutorial') {
        startWorkflow('crear-cotizacion-completa');
      }
    };

    window.addEventListener('start-admin-cot-tutorial', handler);
    window.addEventListener('start-calculator-tutorial', handler);
    return () => {
      window.removeEventListener('start-admin-cot-tutorial', handler);
      window.removeEventListener('start-calculator-tutorial', handler);
    };
  }, [startWorkflow]);

  const value = useMemo(() => ({
    // Estado
    isTutorialMode,
    activeWorkflow,
    activeWorkflowId,
    currentStep,
    currentStepIndex,
    totalSteps,
    progress,
    completedWorkflows,
    sessionDismissed,

    // Acciones
    toggleTutorialMode,
    startWorkflow,
    nextStep,
    prevStep,
    exitTutorial,
    dismissTutorial,
    completeCurrentWorkflow,
    resetAllTutorials,
  }), [
    isTutorialMode,
    activeWorkflow,
    activeWorkflowId,
    currentStep,
    currentStepIndex,
    totalSteps,
    progress,
    completedWorkflows,
    sessionDismissed,
    toggleTutorialMode,
    startWorkflow,
    nextStep,
    prevStep,
    exitTutorial,
    dismissTutorial,
    completeCurrentWorkflow,
    resetAllTutorials,
  ]);

  return (
    <TutorialContext.Provider value={value}>
      {children}
    </TutorialContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- useTutorial hook colocated with its provider by design
export function useTutorial() {
  const context = useContext(TutorialContext);
  if (!context) {
    throw new Error('useTutorial debe usarse dentro de un TutorialProvider');
  }
  return context;
}
