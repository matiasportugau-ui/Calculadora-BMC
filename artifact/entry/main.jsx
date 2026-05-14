import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";

import "../../src/styles/applied-ai.css";
import "../../src/styles/bmc-mobile.css";

import PanelinCalculadora from "../../src/components/PanelinCalculadoraV3_backup.jsx";

if (typeof window !== "undefined") {
  window.__BMC_ARTIFACT_MODE__ = true;
}

const container = document.getElementById("root");
createRoot(container).render(
  <React.StrictMode>
    <MemoryRouter initialEntries={["/"]}>
      <PanelinCalculadora />
    </MemoryRouter>
  </React.StrictMode>,
);
