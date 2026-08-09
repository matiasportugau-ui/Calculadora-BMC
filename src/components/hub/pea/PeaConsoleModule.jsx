/**
 * PEA Gym console — /hub/pea
 * Lists gaps/packets; Approve (M2c ratchet) / Reject / Escalate.
 */
import { Link } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import BmcModuleNav from "../../BmcModuleNav.jsx";
import { useBmcAuth } from "../../../hooks/useBmcAuth.js";

const ApiBase = (() => {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE.replace(/\/+$/, "");
  }
  return "";
})();

async function jget(token, path) {
  const r = await fetch(`${ApiBase}${path}`, {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!r.ok) throw new Error(`http_${r.status}`);
  return r.json();
}

async function jpost(token, path, body = {}) {
  const r = await fetch(`${ApiBase}${path}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    let detail = `http_${r.status}`;
    try {
      const j = await r.json();
      detail = j?.error || detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return r.json();
}

const wrap = { minHeight: "100vh", background: "#f5f5f7", fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" };
const main = { maxWidth: 960, margin: "0 auto", padding: "20px 16px 40px" };
const card = {
  background: "#fff",
  border: "1px solid #e5e5ea",
  borderRadius: 10,
  padding: 14,
  marginBottom: 12,
};
const btn = (bg) => ({
  border: "none",
  borderRadius: 8,
  padding: "8px 12px",
  fontWeight: 600,
  fontSize: 12,
  cursor: "pointer",
  color: "#fff",
  background: bg,
  marginRight: 8,
});

export default function PeaConsoleModule() {
  const auth = useBmcAuth();
  const token = auth?.token || "";
  const [health, setHealth] = useState(null);
  const [gaps, setGaps] = useState([]);
  const [packets, setPackets] = useState([]);
  const [selectedPacket, setSelectedPacket] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [ratchetLinks, setRatchetLinks] = useState([
    { type: "golden", path: "", description: "" },
  ]);

  const refresh = useCallback(async () => {
    setError("");
    try {
      const h = await jget(token, "/api/pea/health");
      setHealth(h);
      if (!h.pea_enabled) {
        setGaps([]);
        setPackets([]);
        return;
      }
      const g = await jget(token, "/api/pea/gaps?limit=30");
      setGaps(g.gaps || []);
      const p = await jget(token, "/api/pea/packets");
      setPackets(p.packets || []);
    } catch (e) {
      setError(e.message || "load_failed");
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function loadPacket(id) {
    try {
      const p = await jget(token, `/api/pea/packets/${id}`);
      setSelectedPacket(p);
      const arts = p.ratchet_plan?.artifacts || [];
      if (arts.length > 0) {
        setRatchetLinks(
          arts.map((a) => ({
            type: a.type || "golden",
            path: a.path || "",
            description: a.description || "",
          })),
        );
      }
    } catch (e) {
      setError(e.message);
    }
  }

  async function act(action) {
    if (!selectedPacket?.id) return;
    setBusy(true);
    setMsg("");
    try {
      const path = `/api/pea/packets/${selectedPacket.id}/${action}`;
      const body =
        action === "accept"
          ? { ratchet_links: ratchetLinks.filter((l) => l.type && (l.path || l.description)) }
          : {};
      const result = await jpost(token, path, body);
      setMsg(`${action}: ${JSON.stringify(result)}`);
      await refresh();
      await loadPacket(selectedPacket.id);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={wrap}>
      <BmcModuleNav />
      <div style={main}>
        <Link to="/hub" style={{ fontSize: 13, color: "#0071e3", textDecoration: "none" }}>
          ← Wolfboard
        </Link>
        <h1 style={{ margin: "12px 0 4px", color: "#1a3a5c", fontSize: 22 }}>PEA · Evolution Architect</h1>
        <p style={{ margin: "0 0 16px", color: "#6e6e73", fontSize: 13 }}>
          Gaps deduplicados, packets L2 y grants L3 (implementer deshabilitado hasta M4).
        </p>

        {health && (
          <div style={{ ...card, fontSize: 13 }}>
            <strong>Health:</strong> enabled={String(health.pea_enabled)} · schema=
            {String(health.schema_ready)} · worker={String(health.worker_enabled)}
          </div>
        )}

        {error && <div style={{ ...card, color: "#cf222e" }}>{error}</div>}
        {msg && <div style={{ ...card, color: "#1a7f37" }}>{msg}</div>}

        {!health?.pea_enabled && (
          <div style={card}>
            PEA desactivado. Local:{" "}
            <code>PEA_ENABLED=1 PEA_WORKER_ENABLED=1 npm run start:api</code>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={card}>
            <h2 style={{ margin: "0 0 8px", fontSize: 15 }}>Gaps</h2>
            {(gaps || []).map((g) => (
              <div
                key={g.id}
                style={{
                  borderTop: "1px solid #eee",
                  padding: "8px 0",
                  fontSize: 12,
                  cursor: "pointer",
                }}
                onClick={() => g.latest_packet_id && loadPacket(g.latest_packet_id)}
                onKeyDown={(e) => e.key === "Enter" && g.latest_packet_id && loadPacket(g.latest_packet_id)}
                role="button"
                tabIndex={0}
              >
                <strong>{g.title || g.signal_type}</strong>
                <div style={{ color: "#666" }}>
                  {g.status} · ×{g.occurrence_count} · {g.severity}
                </div>
              </div>
            ))}
            {gaps.length === 0 && health?.pea_enabled && <p style={{ fontSize: 12, color: "#888" }}>Sin gaps.</p>}
          </div>

          <div style={card}>
            <h2 style={{ margin: "0 0 8px", fontSize: 15 }}>Packet</h2>
            {!selectedPacket && (
              <p style={{ fontSize: 12, color: "#888" }}>Elegí un gap con packet o fila abajo.</p>
            )}
            {(packets || []).slice(0, 8).map((p) => (
              <button
                key={p.id}
                type="button"
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  background: "none",
                  border: "none",
                  borderTop: "1px solid #eee",
                  padding: "8px 0",
                  fontSize: 12,
                  cursor: "pointer",
                }}
                onClick={() => loadPacket(p.id)}
              >
                {p.primary_lane} · {p.status} · {p.id.slice(0, 8)}…
              </button>
            ))}
            {selectedPacket && (
              <div style={{ marginTop: 12, fontSize: 12 }}>
                <div>
                  <strong>Status:</strong> {selectedPacket.status}
                </div>
                <div style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>
                  {selectedPacket.diagnosis?.slice(0, 600)}
                </div>
                {selectedPacket.status === "ready_for_review" && (
                  <div style={{ marginTop: 12, padding: 10, background: "#f9f9fb", borderRadius: 8 }}>
                    <strong>Ratchet (obligatorio para Aprobar)</strong>
                    {ratchetLinks.map((link, idx) => (
                      <div key={idx} style={{ marginTop: 8, display: "grid", gap: 6 }}>
                        <select
                          value={link.type}
                          onChange={(e) => {
                            const next = [...ratchetLinks];
                            next[idx] = { ...next[idx], type: e.target.value };
                            setRatchetLinks(next);
                          }}
                          style={{ fontSize: 12, padding: 4 }}
                        >
                          <option value="golden">golden</option>
                          <option value="fitness_sensor">fitness_sensor</option>
                          <option value="rule_provenance">rule_provenance</option>
                        </select>
                        <input
                          placeholder="path (ej. tests/peaGapFingerprint.test.js)"
                          value={link.path}
                          onChange={(e) => {
                            const next = [...ratchetLinks];
                            next[idx] = { ...next[idx], path: e.target.value };
                            setRatchetLinks(next);
                          }}
                          style={{ fontSize: 12, padding: 6 }}
                        />
                        <input
                          placeholder="descripción"
                          value={link.description}
                          onChange={(e) => {
                            const next = [...ratchetLinks];
                            next[idx] = { ...next[idx], description: e.target.value };
                            setRatchetLinks(next);
                          }}
                          style={{ fontSize: 12, padding: 6 }}
                        />
                      </div>
                    ))}
                    <button
                      type="button"
                      style={{ ...btn("#0071e3"), marginTop: 8 }}
                      onClick={() =>
                        setRatchetLinks([...ratchetLinks, { type: "golden", path: "", description: "" }])
                      }
                    >
                      + link
                    </button>
                  </div>
                )}
                <div style={{ marginTop: 12 }}>
                  <button type="button" style={btn("#188038")} disabled={busy} onClick={() => act("accept")}>
                    Aprobar
                  </button>
                  <button type="button" style={btn("#57606a")} disabled={busy} onClick={() => act("reject")}>
                    Rechazar
                  </button>
                  <button type="button" style={btn("#9a6700")} disabled={busy} onClick={() => act("escalate")}>
                    Escalar L3
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
