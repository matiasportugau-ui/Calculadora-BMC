import { useState } from "react";
import { useBmcAuth } from "../hooks/useBmcAuth.js";

export default function CustomerTrackIssuePage() {
  const { accessToken } = useBmcAuth();
  const [form, setForm] = useState({
    quote_ref: "",
    customer_display_name: "",
    product_summary: "",
    production_date: "",
    pickup_label: "Kingspan (Bromyros)",
    pickup_scheduled_at: "",
    destination_label: "",
    trip_id: "",
  });
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const issue = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    setResult(null);
    try {
      const headers = { "Content-Type": "application/json" };
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
      const body = {
        ...form,
        order_at: new Date().toISOString(),
        trip_id: form.trip_id || undefined,
        pickup_scheduled_at: form.pickup_scheduled_at
          ? new Date(form.pickup_scheduled_at).toISOString()
          : undefined,
      };
      const res = await fetch("/api/track/issue", {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setErr(json.error || `Error ${res.status}`);
        return;
      }
      setResult(json);
    } catch (ex) {
      setErr(ex.message || String(ex));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 560, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 20 }}>Link de seguimiento para el cliente</h1>
      <p style={{ color: "#5b6b7c", fontSize: 14 }}>
        Generá un enlace que el cliente abre en el celular. Ve pedido, producción, transporte y GPS
        del camión cuando ya salió. No ve teléfono del chofer ni otros destinos.
      </p>
      <form onSubmit={issue} style={{ display: "grid", gap: 8 }}>
        <label>
          N° pedido / coti
          <input required style={inp} value={form.quote_ref} onChange={set("quote_ref")} placeholder="BMC-2026-1048" />
        </label>
        <label>
          Nombre a mostrar
          <input style={inp} value={form.customer_display_name} onChange={set("customer_display_name")} placeholder="Silva" />
        </label>
        <label>
          Producto (resumen)
          <input style={inp} value={form.product_summary} onChange={set("product_summary")} placeholder="ISOFRIG 80 · 240 m²" />
        </label>
        <label>
          Fecha de producción
          <input type="date" style={inp} value={form.production_date} onChange={set("production_date")} />
        </label>
        <label>
          Carga / planta
          <input style={inp} value={form.pickup_label} onChange={set("pickup_label")} />
        </label>
        <label>
          Salida programada
          <input type="datetime-local" style={inp} value={form.pickup_scheduled_at} onChange={set("pickup_scheduled_at")} />
        </label>
        <label>
          Destino (ciudad / obra)
          <input style={inp} value={form.destination_label} onChange={set("destination_label")} />
        </label>
        <label>
          Trip UUID (opcional, para GPS en vivo)
          <input style={inp} value={form.trip_id} onChange={set("trip_id")} placeholder="uuid del viaje conductor" />
        </label>
        <button type="submit" disabled={busy} style={btn}>
          {busy ? "Generando…" : "Generar enlace"}
        </button>
      </form>
      {err && <p style={{ color: "#b42318" }}>{err}</p>}
      {result?.url && (
        <div style={{ marginTop: 16, padding: 12, background: "#e8f1fa", borderRadius: 8 }}>
          <div style={{ fontSize: 13, marginBottom: 6 }}>Mandale esto al cliente (WA / mail):</div>
          <code style={{ wordBreak: "break-all", fontSize: 13 }}>{result.url}</code>
          <div>
            <button
              type="button"
              style={{ ...btn, marginTop: 8 }}
              onClick={() => navigator.clipboard.writeText(result.url)}
            >
              Copiar
            </button>
          </div>
          <div style={{ fontSize: 12, color: "#5b6b7c", marginTop: 6 }}>Vence {result.expires_at}</div>
        </div>
      )}
    </div>
  );
}

const inp = { display: "block", width: "100%", padding: 8, marginTop: 4, boxSizing: "border-box" };
const btn = {
  background: "#003366",
  color: "#fff",
  border: 0,
  borderRadius: 8,
  padding: "10px 14px",
  fontWeight: 600,
};
