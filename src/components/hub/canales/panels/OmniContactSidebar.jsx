import React from "react";

export default function OmniContactSidebar({ conversation }) {
  if (!conversation) {
    return (
      <aside style={styles.sidebar}>
        <p style={styles.muted}>Seleccioná una conversación</p>
      </aside>
    );
  }

  const crmLink = conversation.properties?.crm_row_id
    ? `/hub/cotizaciones?row=${conversation.properties.crm_row_id}`
    : null;

  return (
    <aside style={styles.sidebar}>
      <h3 style={styles.heading}>Contacto</h3>
      <dl style={styles.dl}>
        <dt>Nombre</dt>
        <dd>{conversation.contact_name || "—"}</dd>
        <dt>Canal</dt>
        <dd>{conversation.channel?.toUpperCase() || "—"}</dd>
        <dt>Email</dt>
        <dd>{conversation.email || "—"}</dd>
        <dt>WhatsApp</dt>
        <dd>{conversation.wa_phone || "—"}</dd>
        <dt>Estado</dt>
        <dd>{conversation.status || "open"}</dd>
      </dl>
      <div style={styles.links}>
        {conversation.channel === "wa" && (
          <a href="/hub/wa" style={styles.link}>
            Abrir WA Cockpit
          </a>
        )}
        {conversation.channel === "ml" && (
          <a href="/hub/ml" style={styles.link}>
            Abrir ML Manager
          </a>
        )}
        {crmLink && (
          <a href={crmLink} style={styles.link}>
            Fila CRM
          </a>
        )}
      </div>
    </aside>
  );
}

const styles = {
  sidebar: {
    width: 240,
    flexShrink: 0,
    borderLeft: "1px solid #e5e7eb",
    padding: "1rem",
    background: "#fafafa",
    fontSize: "0.875rem",
  },
  heading: { margin: "0 0 1rem", fontSize: "0.9375rem", fontWeight: 600 },
  muted: { color: "#6b7280", margin: 0 },
  dl: { margin: 0 },
  links: { marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" },
  link: { color: "#2563eb", textDecoration: "none", fontSize: "0.8125rem" },
};
