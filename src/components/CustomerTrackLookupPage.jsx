import { useState } from "react";

export default function CustomerTrackLookupPage() {
  const [orderId, setOrderId] = useState("");
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const lookup = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    setData(null);
    try {
      const res = await fetch(`/api/track/by-order/${encodeURIComponent(orderId.trim())}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) {
        setErr(json.error === "not_found" ? "No encontramos ese pedido." : json.error || `Error ${res.status}`);
        return;
      }
      setData(json);
    } catch (ex) {
      setErr(ex.message || String(ex));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 560, fontFamily: "system-ui", margin: "0 auto" }}>
      <h1 style={{ fontSize: 20 }}>Seguimiento de pedido</h1>
      <p style={{ color: "#5b6b7c", fontSize: 14 }}>Ingresá el número de pedido o cotización.</p>
      <form onSubmit={lookup}>
        <input
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          placeholder="BMC-2026-1048"
          style={{ width: "100%", minHeight: 44, fontSize: 16, padding: "8px 12px", marginBottom: 8 }}
        />
        <button type="submit" disabled={busy || !orderId.trim()} style={{ minHeight: 44, padding: "8px 16px" }}>
          {busy ? "Buscando…" : "Ver estado"}
        </button>
      </form>
      {err ? <p style={{ color: "#b42318" }}>{err}</p> : null}
      {data?.order ? (
        <div style={{ marginTop: 16 }}>
          <div>
            <strong>{data.order.ref}</strong> {data.order.customer ? `· ${data.order.customer}` : ""}
          </div>
          <div style={{ color: "#5b6b7c", fontSize: 14 }}>{data.destination}</div>
          <ul>
            {(data.stages || []).map((s) => (
              <li key={s.id}>
                {s.label}: {s.status}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
