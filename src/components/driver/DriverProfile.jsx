import { useState } from "react";

export default function DriverProfile({
  profile,
  pendingCount,
  online,
  guest,
  onSave,
  onLogout,
  onLogin,
}) {
  const [name, setName] = useState(profile.name || "");
  const [phone, setPhone] = useState(profile.phone || "");
  const [email, setEmail] = useState(profile.email || "");
  const initials = (name || "JP")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "JP";

  return (
    <div className="drv-scroll">
      <p className="drv-kicker">BMC DRIVER</p>
      <h1 className="drv-h1">Mi perfil</h1>
      <div className="drv-row" style={{ marginBottom: 16 }}>
        <div className="drv-avatar">{initials}</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>{name || (guest ? "Invitado" : "Chofer BMC")}</div>
          <div className="drv-muted">{guest ? "Sin sesión" : "Chofer · BMC Uruguay"}</div>
        </div>
      </div>
      <div className="drv-card">
        <strong>Datos del conductor</strong>
        <label className="drv-label">Nombre completo</label>
        <input className="drv-input" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="drv-label">Teléfono</label>
        <input className="drv-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <label className="drv-label">Email</label>
        <input
          className="drv-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@bmc.uy"
        />
        <button
          type="button"
          className="drv-cta drv-cta--navy"
          onClick={() => onSave({ ...profile, name, phone, email })}
        >
          Guardar perfil
        </button>
      </div>
      <div className="drv-card drv-row" style={{ justifyContent: "space-between" }}>
        <div>
          <strong>Outdoor / Night</strong>
          <div className="drv-muted">Texto mediano</div>
        </div>
        <span className="drv-chip-ok">Activo</span>
      </div>
      <div className={`drv-banner${online && !pendingCount ? " drv-banner--ok" : ""}`}>
        {online ? "En línea" : "Offline"}
        {pendingCount ? ` · ${pendingCount} pendiente(s)` : " · Sin pendientes"}
      </div>
      {guest ? (
        <button type="button" className="drv-cta drv-cta--navy" onClick={onLogin}>
          Ingresar con email o enlace
        </button>
      ) : (
        <button type="button" className="drv-cta drv-cta--ghost drv-danger" onClick={onLogout}>
          Cerrar sesión
        </button>
      )}
    </div>
  );
}
