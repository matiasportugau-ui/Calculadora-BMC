import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { operatorRequest } from "../utils/operatorApiClient.js";

const LIVE_HANDOFF = "Un agente de ventas de BMC se suma a la conversación.";

export default function PanelinWebLiveBoard() {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("s") || "";
  const [items, setItems] = useState([]);
  const [session, setSession] = useState(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const loadList = useCallback(async () => {
    try {
      const { data } = await operatorRequest("/api/storefront-live");
      setItems(data.items || []);
    } catch (e) {
      setError(e.message || "No se pudo listar chats en vivo");
    }
  }, []);

  const loadOne = useCallback(async (id) => {
    if (!id) {
      setSession(null);
      return;
    }
    try {
      const { data } = await operatorRequest(`/api/storefront-live/${encodeURIComponent(id)}`);
      setSession(data.item || null);
    } catch (e) {
      setError(e.message || "Sesión no encontrada");
    }
  }, []);

  useEffect(() => {
    loadList();
    const t = setInterval(loadList, 4000);
    return () => clearInterval(t);
  }, [loadList]);

  useEffect(() => {
    loadOne(selectedId);
    if (!selectedId) return undefined;
    const t = setInterval(() => loadOne(selectedId), 2000);
    return () => clearInterval(t);
  }, [selectedId, loadOne]);

  function openSession(id) {
    const next = new URLSearchParams(params);
    next.set("s", id);
    setParams(next);
  }

  async function entrar() {
    if (!selectedId) return;
    setBusy(true);
    setError("");
    try {
      await operatorRequest(`/api/storefront-live/${encodeURIComponent(selectedId)}/takeover`, { method: "POST" });
      await loadOne(selectedId);
    } catch (e) {
      setError(e.message || "No se pudo entrar");
    } finally {
      setBusy(false);
    }
  }

  async function send(e) {
    e.preventDefault();
    const t = text.trim();
    if (!t || !selectedId) return;
    setBusy(true);
    setError("");
    try {
      await operatorRequest(`/api/storefront-live/${encodeURIComponent(selectedId)}/inject`, {
        method: "POST",
        body: { text: t },
      });
      setText("");
      await loadOne(selectedId);
    } catch (err) {
      setError(err.message || "No se pudo enviar");
    } finally {
      setBusy(false);
    }
  }

  const takeover = session?.status === "takeover";

  return (
    <div style={{ padding: 20, maxWidth: 1100, margin: "0 auto", fontFamily: "system-ui, sans-serif" }}>
      <p style={{ margin: "0 0 12px" }}>
        <Link to="/hub">Hub</Link>
        {" · "}
        Panelin web en vivo
      </p>
      <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>Chats en vivo · tienda</h1>
      <p style={{ color: "#555", margin: "0 0 16px", maxWidth: 40 * 16 }}>
        Default: solo mirar. Si entrás, Panelin se pausa y avisa al shopper: “{LIVE_HANDOFF}”
        El mic del operador (hablar en vivo) no está en esta versión: escribís y el shopper lo ve en el chat.
      </p>
      {error ? <p style={{ color: "#b00020" }}>{error}</p> : null}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(220px,280px) 1fr", gap: 16 }}>
        <aside>
          <h2 style={{ fontSize: 14 }}>Activos</h2>
          {!items.length ? <p style={{ color: "#666" }}>Nadie en vivo ahora.</p> : null}
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {items.map((it) => (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() => openSession(it.id)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 12px",
                    marginBottom: 8,
                    borderRadius: 8,
                    border: it.id === selectedId ? "2px solid #0071e3" : "1px solid #ddd",
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  <strong>{it.cliente || "Shopper"}</strong>
                  <div style={{ fontSize: 12, color: "#666" }}>{it.status} · {it.pageUrl || "—"}</div>
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <section>
          {!session ? (
            <p style={{ color: "#666" }}>Elegí un chat a la izquierda.</p>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
                <h2 style={{ fontSize: 16, margin: 0 }}>{session.cliente || "Shopper"}</h2>
                <span style={{ fontSize: 12, color: "#666" }}>{session.status}</span>
                {!takeover ? (
                  <button type="button" onClick={entrar} disabled={busy} style={{ marginLeft: "auto" }}>
                    Entrar
                  </button>
                ) : (
                  <span style={{ marginLeft: "auto", fontSize: 12 }}>Estás en el chat. Panelin en pausa.</span>
                )}
              </div>
              <p style={{ fontSize: 12, color: "#666" }}>{session.pageUrl}</p>
              <div
                style={{
                  border: "1px solid #e5e5ea",
                  borderRadius: 12,
                  padding: 12,
                  minHeight: 240,
                  maxHeight: 420,
                  overflow: "auto",
                  background: "#fafafa",
                }}
              >
                {(session.turns || []).map((t, i) => (
                  <p key={`${t.ts}-${i}`} style={{ margin: "0 0 8px", color: t.role === "user" ? "#666" : "#111" }}>
                    <strong>
                      {t.role === "user" ? "Shopper" : t.role === "agent" ? "Vos" : t.role === "system" ? "Sistema" : "Panelin"}
                      :
                    </strong>{" "}
                    {t.text}
                  </p>
                ))}
              </div>
              {takeover ? (
                <form onSubmit={send} style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Escribile al shopper…"
                    style={{ flex: 1, minHeight: 44, padding: "8px 12px" }}
                  />
                  <button type="submit" disabled={busy || !text.trim()}>
                    Enviar
                  </button>
                </form>
              ) : (
                <p style={{ fontSize: 13, color: "#666" }}>Mirando. Tocá Entrar para pausar Panelin y escribir.</p>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
