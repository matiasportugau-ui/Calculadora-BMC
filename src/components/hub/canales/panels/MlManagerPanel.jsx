// ═══════════════════════════════════════════════════════════════════════════
// src/components/hub/canales/panels/MlManagerPanel.jsx
// ───────────────────────────────────────────────────────────────────────────
// ML Manager panel — placeholder for Phase 1 integration.
// Can lazy-load from existing /hub/ml-manager or implement inline.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from "react";

export default function MlManagerPanel({ token }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  useEffect(() => {
    // Placeholder: would fetch from /api/ml/manager with token
    setLoading(false);
    setData({
      models: [
        { id: "model_1", name: "Classifier v1", accuracy: 0.94 },
        { id: "model_2", name: "Sentiment v2", accuracy: 0.87 },
      ],
    });
  }, [token]);

  if (loading) {
    return <div style={styles.loading}>Cargando ML Manager...</div>;
  }

  return (
    <div>
      <div style={styles.header}>
        <h2>ML Manager</h2>
        <p style={styles.subtitle}>
          Gestión centralizada de modelos de machine learning y análisis de datos.
        </p>
      </div>

      {data && data.models.length > 0 ? (
        <div style={styles.grid}>
          {data.models.map((model) => (
            <div key={model.id} style={styles.card}>
              <h3 style={styles.cardTitle}>{model.name}</h3>
              <div style={styles.stat}>
                <span style={styles.statLabel}>Precisión:</span>
                <span style={styles.statValue}>
                  {(model.accuracy * 100).toFixed(1)}%
                </span>
              </div>
              <button style={styles.button}>Ver detalles</button>
            </div>
          ))}
        </div>
      ) : (
        <div style={styles.empty}>
          <p>No hay modelos configurados aún.</p>
        </div>
      )}

      <div style={styles.section}>
        <h3>Próximos pasos</h3>
        <ul style={styles.list}>
          <li>Cargar matriz de entrenamiento</li>
          <li>Validar precisión en dataset de prueba</li>
          <li>Desplegar en producción</li>
        </ul>
      </div>
    </div>
  );
}

const styles = {
  loading: {
    padding: "2rem",
    textAlign: "center",
    color: "#6b7280",
  },
  header: {
    marginBottom: "1.5rem",
  },
  subtitle: {
    color: "#6b7280",
    fontSize: "0.9375rem",
    margin: "0.5rem 0 0 0",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "1rem",
    marginBottom: "2rem",
  },
  card: {
    padding: "1.25rem",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    background: "#f9fafb",
  },
  cardTitle: {
    margin: "0 0 0.75rem 0",
    fontSize: "1rem",
    fontWeight: 600,
    color: "#111827",
  },
  stat: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0.75rem 0",
    borderTop: "1px solid #e5e7eb",
    borderBottom: "1px solid #e5e7eb",
    marginBottom: "1rem",
  },
  statLabel: {
    fontSize: "0.875rem",
    color: "#6b7280",
  },
  statValue: {
    fontSize: "1.125rem",
    fontWeight: 600,
    color: "#059669",
  },
  button: {
    width: "100%",
    padding: "0.5rem",
    background: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: "0.875rem",
    fontWeight: 500,
  },
  empty: {
    padding: "2rem",
    textAlign: "center",
    color: "#9ca3af",
    background: "#f9fafb",
    borderRadius: 8,
    border: "1px solid #e5e7eb",
    marginBottom: "2rem",
  },
  section: {
    marginTop: "2rem",
    padding: "1.5rem",
    background: "#f0f9ff",
    borderLeft: "4px solid #0ea5e9",
    borderRadius: 8,
  },
  list: {
    margin: "0.75rem 0 0 0",
    paddingLeft: "1.5rem",
    color: "#1e40af",
    fontSize: "0.9375rem",
  },
};
