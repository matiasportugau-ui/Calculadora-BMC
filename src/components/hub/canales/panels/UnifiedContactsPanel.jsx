// ═══════════════════════════════════════════════════════════════════════════
// src/components/hub/canales/panels/UnifiedContactsPanel.jsx
// ───────────────────────────────────────────────────────────────────────────
// Unified Contacts panel — stub for Phase 3 integration.
// Will provide unified graph of contacts across all channels.
// ═══════════════════════════════════════════════════════════════════════════

import React from "react";

export default function UnifiedContactsPanel() {
  return (
    <div>
      <div style={styles.header}>
        <h2>Contactos Unificados</h2>
        <p style={styles.subtitle}>
          Vista unificada de contactos y entidades a través de todos los canales
          (WhatsApp, Email, CRM, etc.).
        </p>
      </div>

      <div style={styles.placeholder}>
        <div style={styles.placeholderContent}>
          <div style={styles.icon}>👥</div>
          <h3>Unified Contacts — Coming in Phase 3</h3>
          <p style={styles.placeholderText}>
            Esta funcionalidad estará disponible próximamente. Proporcionará una
            vista de grafo unificado de todos tus contactos y sus interacciones.
          </p>
          <div style={styles.roadmap}>
            <h4>Características planeadas</h4>
            <ul style={styles.roadmapList}>
              <li>Deduplicación inteligente de contactos</li>
              <li>Relaciones y vínculos entre entidades</li>
              <li>Historial de interacciones cruzadas</li>
              <li>Búsqueda y filtrado avanzado</li>
              <li>Integración de datos de múltiples fuentes</li>
            </ul>
          </div>
        </div>
      </div>

      <div style={styles.section}>
        <h3>Arquitectura del sistema</h3>
        <p style={styles.sectionText}>
          La vista unificada se construirá usando:
        </p>
        <ul style={styles.list}>
          <li>
            <strong>Grafo de conocimiento:</strong> pgvector + embeddings para
            deduplicación
          </li>
          <li>
            <strong>Sincronización:</strong> webhooks desde CRM, WA, Email y ML
          </li>
          <li>
            <strong>Búsqueda:</strong> índices de elasticsearch para queries rápidas
          </li>
          <li>
            <strong>API GraphQL:</strong> queries flexibles de relaciones complejas
          </li>
        </ul>
      </div>

      <div style={styles.infoBox}>
        <h4 style={{ margin: "0 0 0.5rem 0" }}>Nota técnica</h4>
        <p style={styles.infoText}>
          El sistema de Unified Contacts depende de la completitud de datos en
          ML Manager (Phase 1) y WA Inbox (Phase 2). Se espera que esté disponible
          en Q3 2026.
        </p>
      </div>
    </div>
  );
}

const styles = {
  header: {
    marginBottom: "1.5rem",
  },
  subtitle: {
    color: "#6b7280",
    fontSize: "0.9375rem",
    margin: "0.5rem 0 0 0",
  },
  placeholder: {
    padding: "3rem 2rem",
    background: "#dbeafe",
    border: "2px dashed #0ea5e9",
    borderRadius: 8,
    textAlign: "center",
    marginBottom: "2rem",
  },
  placeholderContent: {
    maxWidth: 500,
    margin: "0 auto",
  },
  icon: {
    fontSize: "3rem",
    marginBottom: "1rem",
  },
  placeholderText: {
    color: "#0c4a6e",
    fontSize: "0.9375rem",
    lineHeight: 1.6,
    margin: "1rem 0",
  },
  roadmap: {
    marginTop: "1.5rem",
    padding: "1rem",
    background: "rgba(255, 255, 255, 0.6)",
    borderRadius: 6,
    textAlign: "left",
  },
  roadmapList: {
    margin: "0.5rem 0 0 0",
    paddingLeft: "1.5rem",
    fontSize: "0.875rem",
    color: "#0369a1",
  },
  section: {
    marginTop: "2rem",
    padding: "1.5rem",
    background: "#ecfdf5",
    border: "1px solid #c6f6d5",
    borderLeft: "4px solid #10b981",
    borderRadius: 8,
  },
  sectionText: {
    color: "#6b7280",
    fontSize: "0.9375rem",
    margin: "0.5rem 0",
  },
  list: {
    margin: "1rem 0 0 0",
    paddingLeft: "1.5rem",
    color: "#111827",
    fontSize: "0.9375rem",
    lineHeight: 1.8,
  },
  infoBox: {
    marginTop: "2rem",
    padding: "1rem",
    background: "#f0f9ff",
    border: "1px solid #bfdbfe",
    borderRadius: 6,
    fontSize: "0.875rem",
    color: "#1e40af",
  },
  infoText: {
    margin: 0,
    lineHeight: 1.6,
  },
};
