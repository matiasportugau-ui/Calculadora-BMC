import { ENV_T as T } from "../../utils/enviosTheme.js";
import { btnStyle } from "../../utils/logistica/btnStyle.js";
import { openDriverAssign } from "../../utils/logistica/driverAssign.js";
import { driverInstallUrl, spaOrigin } from "../../utils/logistica/driverQr.js";
import DriverQrCard from "./DriverQrCard.jsx";

function copy(text) {
  if (!text || typeof navigator === "undefined") return;
  void navigator.clipboard?.writeText(text).catch(() => {});
}

/**
 * Operator panel after confirm: chofer URL + customer links.
 */
export default function DriverLoopPanel({ result, onRetry, onAssign, busy, choferPhone, tripLabel }) {
  if (!result) return null;
  const failed = result.driver_loop === "failed" || result.local;
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 12,
        border: `1.5px solid ${failed ? "#fdba74" : "#6ee7b7"}`,
        background: failed ? "#fff7ed" : "#ecfdf5",
        marginBottom: 12,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 800, color: failed ? "#c2410c" : "#047857", marginBottom: 6 }}>
        {result.local ? "Chofer (solo este Mac)" : "BMC Driver"}
      </div>
      {result.local ? (
        <p style={{ margin: 0, fontSize: 13, color: "#9a3412" }}>
          Confirmación local — sin API no hay enlace para el chofer. Conectá la API y volvé a confirmar en un
          reparto nuevo, o usá Reintentar link cuando haya token.
        </p>
      ) : null}
      <DriverQrCard url={driverInstallUrl(spaOrigin())} caption="Instalar BMC Driver" size={220} />
      {result.driver_url ? (
        <div style={{ marginTop: 8 }}>
          <DriverQrCard url={result.driver_url} caption={tripLabel ? `Ruta ${tripLabel}` : "Asignar ruta"} size={240} />
          <div style={{ fontSize: 12, color: T.muted }}>Enlace chofer</div>
          <code style={{ fontSize: 12, wordBreak: "break-all" }}>{result.driver_url}</code>
          <div>
            <button
              type="button"
              style={btnStyle({ small: true, color: "#003366", style: { marginTop: 6 } })}
              onClick={() => copy(result.driver_url)}
            >
              Copiar enlace chofer
            </button>
            <button
              type="button"
              style={btnStyle({ small: true, color: "#0f766e", style: { marginTop: 6, marginLeft: 8 } })}
              onClick={() => {
                if (typeof onAssign === "function") onAssign();
                else {
                  openDriverAssign({
                    driverUrl: result.driver_url,
                    phone: choferPhone,
                    tripLabel,
                    open: (u, t, f) => window.open(u, t, f),
                    copy: (t) => copy(t),
                  });
                }
              }}
            >
              Mandar a Driver
            </button>
          </div>
        </div>
      ) : null}
      {!result.local && !result.driver_url ? (
        <p style={{ margin: "4px 0 8px", fontSize: 13 }}>
          No se pudo crear el viaje del chofer{result.error ? `: ${result.error}` : ""}.
        </p>
      ) : null}
      {Array.isArray(result.customer_links) && result.customer_links.length > 0 ? (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700 }}>Seguimiento cliente</div>
          {result.customer_links.map((l) => (
            <div key={l.stop_id || l.url} style={{ fontSize: 12, marginTop: 4 }}>
              {l.cliente || "Cliente"} ·{" "}
              <button type="button" style={btnStyle({ small: true, outline: true })} onClick={() => copy(l.url)}>
                Copiar
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {typeof onRetry === "function" && !result.local && !result.driver_url ? (
        <button
          type="button"
          disabled={busy}
          style={btnStyle({ small: true, color: "#c2410c", style: { marginTop: 8 } })}
          onClick={onRetry}
        >
          Reintentar link chofer
        </button>
      ) : null}
    </div>
  );
}
