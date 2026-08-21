import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { osmEmbedUrl } from "../utils/logistica/customerTrackView.js";

const STAGE_HINT = {
  order: "Recibimos tu pedido.",
  production: "Fabricación / corte programado.",
  transport: "Fecha de carga y salida.",
  delivery: "Camión en ruta hasta tu obra.",
};

function fmtWhen(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("es-UY", { dateStyle: "medium", timeStyle: "short" });
}

export default function CustomerTrackPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/track/${encodeURIComponent(token || "")}`);
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || json.ok === false) {
          setErr("No encontramos este seguimiento o el enlace venció.");
          setData(null);
          return;
        }
        setErr("");
        setData(json);
      } catch {
        if (!cancelled) setErr("Sin conexión. Reintentamos en unos segundos.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, tick]);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 20_000);
    return () => clearInterval(id);
  }, []);

  const truck = data?.truck;
  const mapSrc = truck ? osmEmbedUrl(truck.lat, truck.lng) : null;

  return (
    <div style={wrap}>
      <header style={hdr}>
        <div style={{ fontSize: 12, letterSpacing: "0.08em", opacity: 0.75 }}>BMC URUGUAY</div>
        <h1 style={{ margin: "4px 0 0", fontSize: 22 }}>Tu pedido</h1>
      </header>

      {err && <p style={banner}>{err}</p>}

      {data && (
        <>
          <section style={card}>
            <div style={{ color: "#5b6b7c", fontSize: 13 }}>
              {data.order?.ref || "Pedido"}
              {data.order?.customer ? ` · ${data.order.customer}` : ""}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>
              {data.order?.product || "Materiales BMC"}
            </div>
            {data.destination && (
              <div style={{ marginTop: 6, fontSize: 14 }}>Entrega: {data.destination}</div>
            )}
          </section>

          <ol style={{ listStyle: "none", padding: 0, margin: "16px 0" }}>
            {(data.stages || []).map((s) => (
              <li key={s.id} style={stageRow(s.status)}>
                <div style={dot(s.status)} />
                <div>
                  <strong>{s.label}</strong>
                  <div style={{ fontSize: 13, color: "#5b6b7c" }}>{STAGE_HINT[s.id]}</div>
                  {s.date && <div style={{ fontSize: 14, marginTop: 2 }}>Fecha: {s.date}</div>}
                  {s.scheduledAt && (
                    <div style={{ fontSize: 14, marginTop: 2 }}>Salida: {fmtWhen(s.scheduledAt)}</div>
                  )}
                  {s.pickupLabel && (
                    <div style={{ fontSize: 14 }}>Carga: {s.pickupLabel}</div>
                  )}
                  {s.at && s.id === "order" && (
                    <div style={{ fontSize: 13, color: "#5b6b7c" }}>{fmtWhen(s.at)}</div>
                  )}
                </div>
              </li>
            ))}
          </ol>

          {data.inTransit && (
            <section style={card}>
              <strong>Camión en camino</strong>
              {truck ? (
                <>
                  <p style={{ margin: "6px 0 10px", fontSize: 13, color: "#5b6b7c" }}>
                    Posición actualizada {fmtWhen(truck.at)}
                  </p>
                  {mapSrc && (
                    <iframe
                      title="Posición del camión"
                      src={mapSrc}
                      style={{ width: "100%", height: 220, border: 0, borderRadius: 8 }}
                    />
                  )}
                </>
              ) : (
                <p style={{ margin: "8px 0 0", fontSize: 14 }}>
                  El chofer ya salió. La posición GPS aparece cuando el camión reporta (últimos 30 min).
                </p>
              )}
            </section>
          )}
        </>
      )}

      <p style={{ fontSize: 12, color: "#8a96a3", marginTop: 28 }}>
        Este enlace es personal. No incluye datos de otros clientes ni del chofer.
      </p>
    </div>
  );
}

const wrap = {
  minHeight: "100vh",
  margin: 0,
  padding: "20px 18px 40px",
  fontFamily: "system-ui, sans-serif",
  background: "#f4f6f8",
  color: "#1a2330",
  maxWidth: 520,
  marginInline: "auto",
};

const hdr = {
  background: "#003366",
  color: "#fff",
  margin: "-20px -18px 18px",
  padding: "20px 18px 18px",
};

const card = {
  background: "#fff",
  border: "1px solid #d7dee6",
  borderRadius: 12,
  padding: 14,
};

const banner = {
  background: "#fff4e5",
  padding: 12,
  borderRadius: 8,
};

function stageRow(status) {
  return {
    display: "flex",
    gap: 12,
    padding: "10px 0",
    opacity: status === "pending" ? 0.55 : 1,
  };
}

function dot(status) {
  const bg = status === "done" ? "#1a7f4b" : status === "current" ? "#003366" : "#c5ced6";
  return {
    width: 12,
    height: 12,
    borderRadius: "50%",
    background: bg,
    marginTop: 5,
    flex: "0 0 12px",
  };
}
