import { useCallback, useEffect, useState } from "react";

const font = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Helvetica, Arial, sans-serif";

const bubbleStyle = (dir) => ({
  maxWidth: "80%",
  padding: "8px 12px",
  borderRadius: dir === "in" ? "12px 12px 12px 4px" : "12px 12px 4px 12px",
  background: dir === "in" ? "#f0f0f2" : "#d1e7ff",
  color: "#1d1d1f",
  fontSize: 12,
  lineHeight: 1.45,
  fontFamily: font,
  alignSelf: dir === "in" ? "flex-start" : "flex-end",
  wordBreak: "break-word",
});

const tsStyle = { fontSize: 10, color: "#86868b", marginTop: 2 };

function fmtTime(iso) {
  try {
    const d = new Date(iso);
    const day = d.toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit" });
    const time = d.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" });
    return `${day} ${time}`;
  } catch { return ""; }
}

export default function WaMessagePreview({ phone, token, apiBase }) {
  const [chatId, setChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [nextBefore, setNextBefore] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadMessages = useCallback(async (cid, before) => {
    const auth = { Authorization: `Bearer ${token}` };
    setLoading(true);
    try {
      let url = `${apiBase}/api/wa/messages?chat_id=${encodeURIComponent(cid)}&limit=20`;
      if (before) url += `&before=${encodeURIComponent(before)}`;
      const r = await fetch(url, { headers: auth });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || "Error al cargar mensajes."); setLoading(false); return; }
      setMessages((prev) => before ? [...d.items, ...prev] : d.items);
      setNextBefore(d.next_before || null);
    } catch {
      setError("Error de red al cargar mensajes.");
    }
    setLoading(false);
  }, [apiBase, token]);

  useEffect(() => {
    if (!phone || !token) return;
    let cancelled = false;
    const auth = { Authorization: `Bearer ${token}` };

    (async () => {
      setLoading(true);
      setError("");
      setChatId(null);
      setMessages([]);
      setNextBefore(null);
      try {
        const r = await fetch(`${apiBase}/api/wa/conversations?q=${encodeURIComponent(phone)}&limit=1`, { headers: auth });
        const d = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (!r.ok || !d.items?.length) {
          setError("Sin historial WA para este teléfono.");
          setLoading(false);
          return;
        }
        const cid = d.items[0].chat_id;
        setChatId(cid);
        await loadMessages(cid, null);
      } catch {
        if (!cancelled) {
          setError("Error de red al buscar conversación.");
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [phone, token, apiBase, loadMessages]);

  if (!phone) return null;

  return (
    <div style={{ fontFamily: font }}>
      <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 600, color: "#6e6e73", textTransform: "uppercase" }}>
        Historial WhatsApp
      </p>

      {error && <p style={{ fontSize: 12, color: "#86868b", margin: "0 0 8px" }}>{error}</p>}

      {loading && !messages.length && <p style={{ fontSize: 12, color: "#86868b" }}>Cargando…</p>}

      {chatId && nextBefore && (
        <button
          type="button"
          onClick={() => loadMessages(chatId, nextBefore)}
          disabled={loading}
          style={{
            display: "block", margin: "0 auto 8px", padding: "4px 12px", borderRadius: 8,
            border: "1px solid #e5e5ea", background: "#fff", fontSize: 11, color: "#0071e3",
            cursor: "pointer", fontFamily: font,
          }}
        >
          {loading ? "Cargando…" : "↑ Cargar más"}
        </button>
      )}

      {messages.length > 0 && (
        <div style={{
          display: "flex", flexDirection: "column", gap: 6,
          maxHeight: 280, overflowY: "auto", padding: "8px 4px",
          background: "#fafafa", borderRadius: 8, border: "1px solid #e5e5ea",
        }}>
          {messages.map((m) => (
            <div key={m.msg_id} style={{ display: "flex", flexDirection: "column", alignItems: m.direction === "in" ? "flex-start" : "flex-end" }}>
              <div style={bubbleStyle(m.direction)}>
                {m.text || <span style={{ color: "#aaa", fontStyle: "italic" }}>[{m.type}]</span>}
              </div>
              <span style={{ ...tsStyle, textAlign: m.direction === "in" ? "left" : "right" }}>{fmtTime(m.ts)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
