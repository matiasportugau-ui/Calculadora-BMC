import { useEffect, useState } from "react";
import { tkApi } from "../shared/api.js";
import { button, card, colors, input } from "../shared/styles.js";

export default function ClientsPanel({ canEdit }) {
  const [clients, setClients] = useState([]);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState({ name: "", rut: "", email: "", address: "" });
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const r = await tkApi.listClients();
      setClients(r.clients || []);
      setError("");
    } catch (e) {
      setError(e.message || "load_failed");
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (!creating.name.trim()) return;
    setBusy(true);
    setError("");
    try {
      await tkApi.createClient(creating);
      setCreating({ name: "", rut: "", email: "", address: "" });
      await load();
    } catch (e) {
      setError(e.message || "create_failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {error ? <div style={{ color: colors.danger }}>{error}</div> : null}

      {canEdit ? (
        <div style={{ ...card, display: "grid", gridTemplateColumns: "2fr 1fr 1.5fr 2fr auto", gap: 8 }}>
          <input
            placeholder="Nombre"
            value={creating.name}
            onChange={(e) => setCreating({ ...creating, name: e.target.value })}
            style={input}
          />
          <input
            placeholder="RUT"
            value={creating.rut}
            onChange={(e) => setCreating({ ...creating, rut: e.target.value })}
            style={input}
          />
          <input
            placeholder="Email"
            value={creating.email}
            onChange={(e) => setCreating({ ...creating, email: e.target.value })}
            style={input}
          />
          <input
            placeholder="Dirección"
            value={creating.address}
            onChange={(e) => setCreating({ ...creating, address: e.target.value })}
            style={input}
          />
          <button disabled={busy} onClick={create} style={button("primary")}>
            + Cliente
          </button>
        </div>
      ) : null}

      <div style={card}>
        {clients.length === 0 ? (
          <div style={{ color: colors.textMuted, textAlign: "center", padding: 16 }}>
            Sin clientes aún.
          </div>
        ) : (
          clients.map((c) => (
            <div
              key={c.client_id}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1.5fr 2fr",
                padding: "10px 0",
                borderBottom: `1px solid ${colors.border}`,
                fontSize: 14,
                alignItems: "center",
              }}
            >
              <div style={{ fontWeight: 600 }}>{c.name}</div>
              <div style={{ color: colors.textMuted }}>{c.rut || "—"}</div>
              <div style={{ color: colors.textMuted }}>{c.email || "—"}</div>
              <div style={{ color: colors.textMuted }}>{c.address || "—"}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
