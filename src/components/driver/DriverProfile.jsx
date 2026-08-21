import { useState } from "react";

export default function DriverProfile({ profile, pendingCount, online, onSave, onLogout }) {
  const [name, setName] = useState(profile.name || "");
  const [phone, setPhone] = useState(profile.phone || "");
  const [email, setEmail] = useState(profile.email || "");

  return (
    <div className="drv-app drv-light" style={{ minHeight: "100%" }}>
      <div style={{ background: "#0b1a2e", color: "#fff", padding: "20px 16px 24px" }}>
        <div style={{ fontSize: 22, fontWeight: 700 }}>{name || "Chofer BMC"}</div>
        <div style={{ opacity: 0.8, fontSize: 14 }}>Chofer · BMC Uruguay</div>
        <div style={{ fontSize: 12, marginTop: 6, color: "#86efac" }}>
          ID Conductor: {profile.conductorId || "sesión activa"}
        </div>
      </div>
      <div className="drv-scroll" style={{ background: "#f4f6f8" }}>
        <div className="drv-card">
          <strong>Datos del conductor</strong>
          <label className="drv-label">Nombre completo</label>
          <input className="drv-input" style={{ background: "#fff", color: "#111" }} value={name} onChange={(e) => setName(e.target.value)} />
          <label className="drv-label">Teléfono</label>
          <input className="drv-input" style={{ background: "#fff", color: "#111" }} value={phone} onChange={(e) => setPhone(e.target.value)} />
          <label className="drv-label">Email</label>
          <input className="drv-input" style={{ background: "#fff", color: "#111" }} value={email} onChange={(e) => setEmail(e.target.value)} />
          <button
            type="button"
            className="drv-cta drv-cta--navy"
            onClick={() => onSave({ ...profile, name, phone, email })}
          >
            Guardar perfil
          </button>
        </div>
        <div className="drv-card">
          <strong>Preferencias</strong>
          <p className="drv-muted">Tema Outdoor / Night (activo). Tamaño de texto mediano.</p>
        </div>
        <div className="drv-card">
          <strong>Offline y sincronización</strong>
          <p>
            {online ? "En línea" : "Offline"}
            {pendingCount ? ` · ${pendingCount} pendiente(s)` : ""}
          </p>
        </div>
        <button type="button" className="drv-cta drv-cta--ghost drv-danger" onClick={onLogout}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
