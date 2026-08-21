import { useState } from "react";
import { extractDriverTokenFromPaste } from "../../utils/conductorUrl.js";

export default function DriverLogin({ onLogin, status, offlineHint }) {
  const [link, setLink] = useState("");

  const submit = () => onLogin(extractDriverTokenFromPaste(link), "");

  return (
    <div className="drv-login">
      <div className="drv-mark">
        <div className="hex">BMC</div>
        <h1 className="drv-h1">BMC Driver</h1>
        <p className="drv-sub">No hay un viaje abierto en este teléfono</p>
      </div>
      <div className="drv-card">
        <p style={{ marginTop: 0, fontSize: 15, lineHeight: 1.45 }}>
          Logística tiene que <strong>confirmar la coordinación</strong> y mandarte el enlace.
          Abrilo (o pegalo acá). No es usuario/contraseña.
        </p>
        <label className="drv-label">Enlace de este viaje</label>
        <input
          className="drv-input"
          autoComplete="off"
          inputMode="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="https://calculadora-bmc.vercel.app/conductor?t=…"
        />
        {status ? <p className="drv-danger">{status}</p> : null}
        <button type="button" className="drv-cta drv-cta--orange" onClick={submit}>
          Abrir viaje
        </button>
        <button
          type="button"
          className="drv-cta drv-cta--navy"
          onClick={() =>
            onLogin(
              extractDriverTokenFromPaste(link) || localStorage.getItem("transportista_driver_token"),
              "",
            )
          }
        >
          Seguir el último viaje (sin conexión)
        </button>
        {offlineHint ? <p className="drv-muted">{offlineHint}</p> : null}
      </div>
      <p className="drv-muted" style={{ textAlign: "center", marginTop: 16 }}>
        BMC Uruguay
      </p>
    </div>
  );
}
