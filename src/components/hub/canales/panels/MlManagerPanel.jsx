// ═══════════════════════════════════════════════════════════════════════════
// src/components/hub/canales/panels/MlManagerPanel.jsx
// ───────────────────────────────────────────────────────────────────────────
// ML Manager panel — the MercadoLibre seller dashboard inside the Canales hub.
// "ML" here means MercadoLibre (the marketplace), not machine-learning models.
// Reuses the standalone MlManagerModule (also served at /hub/ml-manager) in
// `embedded` mode, so there is a single source of truth for the connector UI
// (Resumen / Publicaciones / Preguntas / Pedidos) backed by useMlConnector +
// the live /ml/* API routes.
//
// The `token` prop is accepted for signature stability but unused: the ML tabs
// authenticate via mlFetch/ensureOperatorToken, and the read-only /ml/* routes
// hold the seller OAuth token server-side.
// ═══════════════════════════════════════════════════════════════════════════

import React from "react";
import MlManagerModule from "../../ml/MlManagerModule.jsx";

export default function MlManagerPanel() {
  return <MlManagerModule embedded />;
}
