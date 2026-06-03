import { useContext } from 'react';
import { TutorialContext } from './tutorialContext.js';

export function useTutorial() {
  const context = useContext(TutorialContext);
  if (!context) {
    throw new Error('useTutorial debe usarse dentro de un TutorialProvider');
  }
  return context;
}

// Re-exports for convenience
export { TutorialProvider } from './TutorialProvider.jsx';
export { TUTORIAL_WORKFLOWS, WORKFLOW_IDS, getWorkflow } from './workflows.js';
