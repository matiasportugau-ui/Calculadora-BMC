import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";

import "../../src/styles/applied-ai.css";
import "../../src/styles/bmc-mobile.css";
import "../styles/applied-ai-overrides.css";

import PanelinCalculadora from "../../src/components/PanelinCalculadoraV3_backup.jsx";

if (typeof window !== "undefined") {
  window.__BMC_ARTIFACT_MODE__ = true;
}

const container = document.getElementById("root");
createRoot(container).render(
  <React.StrictMode>
    <div className="aa-shell">
      <MemoryRouter initialEntries={["/"]}>
        <PanelinCalculadora />
      </MemoryRouter>
    </div>
  </React.StrictMode>,
);
