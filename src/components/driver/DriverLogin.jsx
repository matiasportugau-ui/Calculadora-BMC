import { useState } from "react";

export default function DriverLogin({ onLogin, onGuest, status, offlineHint }) {
  const [name, setName] = useState("");
  const [secret, setSecret] = useState("");

  return (
    <div className="drv-login">
      <div className="drv-mark">
        <div className="hex">BMC</div>
        <h1 className="drv-h1">BMC Driver</h1>
        <p className="drv-sub">Tu ruta. Cada paso, bajo control.</p>
      </div>
      <div className="drv-card">
        <label className="drv-label">Email o celular</label>
        <input
          className="drv-input"
          autoComplete="username"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tu email o celular"
        />
        <label className="drv-label">Contraseña</label>
        <input
          className="drv-input"
          type="password"
          autoComplete="current-password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="Contraseña o token del enlace"
        />
        <p className="drv-muted">
          Chofer de flota: email/celular + contraseña. Tercero: abrí el enlace o pegá el token.
        </p>
        <p className="drv-muted" style={{ marginTop: 10 }}>
          Para instalar BMC Driver: iPhone → Compartir → <strong>Agregar a inicio</strong>. Android → menú Chrome →{" "}
          <strong>Agregar a pantalla de inicio</strong>.
        </p>
        {status ? <p className="drv-danger">{status}</p> : null}
        <button type="button" className="drv-cta drv-cta--orange" onClick={() => onLogin(name, secret)}>
          Ingresar
        </button>
        <button
          type="button"
          className="drv-cta drv-cta--navy"
          onClick={() => {
            const saved = localStorage.getItem("transportista_driver_token");
            if (saved) {
              onLogin(name, secret || saved);
              return;
            }
            if (typeof onGuest === "function") onGuest();
            else onLogin(name, secret);
          }}
        >
          Entrar a la app
        </button>
        {offlineHint ? <p className="drv-muted">{offlineHint}</p> : null}
      </div>
      <p className="drv-muted" style={{ textAlign: "center", marginTop: 16 }}>
        BMC URUGUAY · CONDUCTOR
      </p>
    </div>
  );
}
