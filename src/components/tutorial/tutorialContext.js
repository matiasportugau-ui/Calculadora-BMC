import { createContext } from "react";

export const TutorialContext = createContext({
  currentWorkflow: null,
  workflowSteps: [],
  stepIndex: 0,
  error: null,
  isAnimating: false,
  startWorkflow: () => {},
  nextStep: () => {},
  prevStep: () => {},
  exitTutorial: () => {},
});
