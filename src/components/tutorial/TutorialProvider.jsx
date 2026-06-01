import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { TUTORIAL_WORKFLOWS, getWorkflow } from './workflows.js';

const STORAGE_KEY = 'bmc_tutorial_mode';
const PROGRESS_KEY = 'bmc_tutorial_progress';

const TutorialContext = createContext(null);

export function TutorialProvider({ children }) {
  const [isTutorialMode, setIsTutorialMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) === 'true';
  });

  const [activeWorkflowId, setActiveWorkflowId] = useState(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
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

  const startWorkflow = useCallback((workflowId) => {
    const wf = getWorkflow(workflowId);
    if (!wf) {
      console.warn(`[Tutorial] Workflow no encontrado: ${workflowId}`);
      return;
    }
    setActiveWorkflowId(workflowId);
    setCurrentStepIndex(0);
    // Auto-activar modo tutorial al iniciar un flujo
    if (!isTutorialMode) setIsTutorialMode(true);
  }, [isTutorialMode]);

  const exitTutorial = useCallback(() => {
    setActiveWorkflowId(null);
    setCurrentStepIndex(0);
    // Opcional: mantener modo tutorial activado o apagarlo
    // setIsTutorialMode(false); // Comentado para que el usuario pueda saltar entre flujos
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
      // Finalizar workflow
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
    if (!newMode) {
      // Si apagan el modo, salir del flujo actual
      exitTutorial();
    }
  }, [isTutorialMode, exitTutorial]);

  const resetAllTutorials = useCallback(() => {
    setCompletedWorkflows(new Set());
    localStorage.removeItem(PROGRESS_KEY);
    exitTutorial();
  }, [exitTutorial]);

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

    // Acciones
    toggleTutorialMode,
    startWorkflow,
    nextStep,
    prevStep,
    exitTutorial,
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
    toggleTutorialMode,
    startWorkflow,
    nextStep,
    prevStep,
    exitTutorial,
    completeCurrentWorkflow,
    resetAllTutorials,
  ]);

  return (
    <TutorialContext.Provider value={value}>
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const context = useContext(TutorialContext);
  if (!context) {
    throw new Error('useTutorial debe usarse dentro de un TutorialProvider');
  }
  return context;
}
