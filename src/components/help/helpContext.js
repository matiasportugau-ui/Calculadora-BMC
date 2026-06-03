import { createContext } from "react";

export const HelpContext = createContext({
  steps: new Map(),
  dismissed: new Set(),
  dismiss: () => {},
  reset: () => {},
});
