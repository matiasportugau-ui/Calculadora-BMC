// ═══════════════════════════════════════════════════════════════════════════
// src/components/hub/canales/panels/WaInboxPanel.jsx
// ───────────────────────────────────────────────────────────────────────────
// WA Inbox panel — stub for Phase 2 integration.
// Will integrate with WhatsApp Cloud API and WA Cockpit.
// ═══════════════════════════════════════════════════════════════════════════

import React from "react";

export default function WaInboxPanel() {
  return (
    <div>
      <div style={styles.header}>
        <h2>WhatsApp Inbox</h2>
        <p style={styles.subtitle}>
          Gestión centralizada de conversaciones por WhatsApp Business.
        </p>
      </div>

      <div style={styles.placeholder}>
        <div style={styles.placeholderContent}>
          <div style={styles.icon}>💬</div>
          <h3>WA Inbox — Coming in Phase 2</h3>
          <p style={styles.placeholderText}>
            Esta funcionalidad estará disponible próximamente. Se integrará con la
            WhatsApp Cloud API para gestionar mensajes, contactos y conversaciones.
          </p>
          <div style={styles.roadmap}>
            <h4>Roadmap</h4>
            <ul style={styles.roadmapList}>
              <li>Conexión a WhatsApp Cloud API</li>
              <li>Sincronización de mensajes en tiempo real</li>
              <li>Historial de conversaciones</li>
              <li>Automatización de respuestas</li>
              <li>Integración con Unified Contacts</li>
            </ul>
          </div>
        </div>
      </div>

      <div style={styles.section}>
        <h3>Requisitos de configuración</h3>
        <p style={styles.sectionText}>
          Para activar WA Inbox, deberá:
        </p>
        <ol style={styles.list}>
          <li>Registrar una empresa en Meta Business</li>
          <li>Crear una aplicación de WhatsApp Business</li>
          <li>Obtener token de acceso a la Cloud API</li>
          <li>Verificar el número de teléfono</li>
          <li>Configurar webhooks para mensajes entrantes</li>
        </ol>
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
    background: "#fef3c7",
    border: "2px dashed #fbbf24",
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
    color: "#6b7280",
    fontSize: "0.9375rem",
    lineHeight: 1.6,
    margin: "1rem 0",
  },
  roadmap: {
    marginTop: "1.5rem",
    padding: "1rem",
    background: "rgba(255, 255, 255, 0.5)",
    borderRadius: 6,
    textAlign: "left",
  },
  roadmapList: {
    margin: "0.5rem 0 0 0",
    paddingLeft: "1.5rem",
    fontSize: "0.875rem",
    color: "#92400e",
  },
  section: {
    marginTop: "2rem",
    padding: "1.5rem",
    background: "#f5f3ff",
    border: "1px solid #e9d5ff",
    borderLeft: "4px solid #a855f7",
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
};
