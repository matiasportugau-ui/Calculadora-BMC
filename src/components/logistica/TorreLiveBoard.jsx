import { useCallback, useEffect, useState } from "react";
import { ENV_T as T } from "../../utils/enviosTheme.js";
import { btnStyle } from "../../utils/logistica/btnStyle.js";
import { getCalcApiBase } from "../../utils/calcApiBase.js";
import TorreLiveMap from "./TorreLiveMap.jsx";

function authToken() {
  return typeof import.meta !== "undefined"
    ? String(import.meta.env?.VITE_BMC_API_AUTH_TOKEN || import.meta.env?.VITE_API_AUTH_TOKEN || "").trim()
    : "";
}

function when(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("es-UY", { dateStyle: "short", timeStyle: "short" });
}

const fieldStyle = {
  width: "100%",
  fontSize: 13,
  padding: "6px 8px",
  marginBottom: 6,
  borderRadius: 8,
  border: `1px solid ${T.border || "#e2e8f0"}`,
  boxSizing: "border-box",
};

function authHeaders(token) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

/** HITL alta + assign. Magic-link `?t=` stays for unregistered terceros. */
function ChoferHitlForm({ token, trips = [], onDone }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [choferId, setChoferId] = useState("");
  const [tripId, setTripId] = useState("");
  const [directive, setDirective] = useState("");
  const [msg, setMsg] = useState("");
  const [proposal, setProposal] = useState(null);
  const [busy, setBusy] = useState(false);

  const postJson = async (path, body) => {
    const res = await fetch(`${getCalcApiBase()}${path}`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j.ok === false) {
      throw new Error(j.error || res.statusText || "request_failed");
    }
    return j;
  };

  const alta = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const j = await postJson("/api/torre/chofer", { name, email, phone, password });
      setChoferId(j.chofer?.chofer_id || "");
      setPassword("");
      setMsg(`Alta HITL · ${j.chofer?.email || j.chofer?.phone_e164 || j.chofer?.chofer_id}`);
      onDone?.();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const assign = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      await postJson("/api/torre/assign", { trip_id: tripId, chofer_id: choferId });
      setMsg("Viaje asignado · aparece en el inbox del chofer");
      onDone?.();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const propose = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    setProposal(null);
    try {
      const j = await postJson("/api/torre/propose", {
        type: "draftDriverDirective",
        payload: { trip_id: tripId || undefined, text: directive },
      });
      setProposal(j.proposal || j);
      setMsg(j.applied ? "aplicado" : "Propuesta HITL — no se envió WhatsApp");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.border || "#e2e8f0"}` }}>
      <strong style={{ fontSize: 13, display: "block", marginBottom: 6 }}>HITL · chofer</strong>
      <form onSubmit={alta}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" style={fieldStyle} />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" style={fieldStyle} />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Celular" style={fieldStyle} />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña (mín. 6)"
          type="password"
          autoComplete="new-password"
          style={fieldStyle}
        />
        <button type="submit" style={btnStyle({ small: true })} disabled={busy || !token || (!email && !phone) || password.length < 6}>
          Dar de alta
        </button>
      </form>
      <form onSubmit={assign} style={{ marginTop: 10 }}>
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 4 }}>Asignar viaje → inbox</div>
        {trips.length ? (
          <select value={tripId} onChange={(e) => setTripId(e.target.value)} style={fieldStyle}>
            <option value="">Viaje…</option>
            {trips.map((t) => (
              <option key={t.trip_id} value={t.trip_id}>
                {t.reparto_no || t.trip_id}
              </option>
            ))}
          </select>
        ) : (
          <input
            value={tripId}
            onChange={(e) => setTripId(e.target.value)}
            placeholder="trip_id"
            style={fieldStyle}
          />
        )}
        <input
          value={choferId}
          onChange={(e) => setChoferId(e.target.value)}
          placeholder="chofer_id"
          style={fieldStyle}
        />
        <button type="submit" style={btnStyle({ small: true, outline: true })} disabled={busy || !token || !tripId || !choferId}>
          Asignar
        </button>
      </form>
      <form onSubmit={propose} style={{ marginTop: 10 }}>
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 4 }}>Torre propone · humano aplica</div>
        <input
          value={directive}
          onChange={(e) => setDirective(e.target.value)}
          placeholder="Directiva al chofer (no se envía WA)"
          style={fieldStyle}
        />
        <button type="submit" style={btnStyle({ small: true, outline: true })} disabled={busy || !token || !directive.trim()}>
          Proponer
        </button>
      </form>
      {msg ? (
        <div style={{ fontSize: 12, marginTop: 8, color: /error|required|failed|Unauthorized/i.test(msg) ? "#b42318" : T.muted }}>
          {msg}
        </div>
      ) : null}
      {proposal ? (
        <pre style={{ fontSize: 11, marginTop: 6, whiteSpace: "pre-wrap" }}>{JSON.stringify(proposal, null, 2)}</pre>
      ) : null}
    </div>
  );
}

export default function TorreLiveBoard() {
  const [trips, setTrips] = useState([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [generatedAt, setGeneratedAt] = useState("");

  const load = useCallback(async () => {
    const token = authToken();
    const base = getCalcApiBase();
    if (!token || !base) {
      setErr("Falta API token o base — la torre lee viajes en Postgres.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${base}/api/torre/live`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.ok === false) {
        setErr(j.error || res.statusText || "torre_unavailable");
        setTrips([]);
        return;
      }
      setErr("");
      setTrips(Array.isArray(j.trips) ? j.trips : []);
      setGeneratedAt(j.generated_at || "");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 20_000);
    return () => clearInterval(id);
  }, [load]);

  const selected = trips.find((t) => t.trip_id === selectedId) || null;
  const onlineN = trips.filter((t) => t.online).length;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(240px, 320px) 1fr", gap: 12, minHeight: 420 }}>
      <div style={{ background: T.surface || "#fff", border: `1px solid ${T.border || "#e2e8f0"}`, borderRadius: 12, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <strong style={{ fontSize: 14 }}>Torre · en curso</strong>
          <button type="button" style={btnStyle({ small: true, outline: true })} onClick={() => void load()} disabled={busy}>
            {busy ? "…" : "Actualizar"}
          </button>
        </div>
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 10 }}>
          {trips.length} viaje(s) · {onlineN} online
          {generatedAt ? ` · ${when(generatedAt)}` : ""}
        </div>
        {err ? (
          <div style={{ color: "#b42318", fontSize: 12, padding: 8, background: "#ffeceb", borderRadius: 8, marginBottom: 8 }}>
            {err}
          </div>
        ) : null}
        {trips.length === 0 && !err ? (
          <p style={{ fontSize: 13, color: T.muted }}>No hay viajes live. Confirmá un REP y abrí BMC Driver para ver el ping.</p>
        ) : null}
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {trips.map((t) => {
            const on = t.trip_id === selectedId;
            return (
              <li key={t.trip_id || t.reparto_no}>
                <button
                  type="button"
                  onClick={() => setSelectedId(t.trip_id)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    border: `1px solid ${on ? "#0f766e" : T.border || "#e2e8f0"}`,
                    background: on ? "#ecfdf5" : "#fff",
                    borderRadius: 10,
                    padding: "8px 10px",
                    marginBottom: 6,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{t.reparto_no || "sin REP"}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: t.online ? "#15803d" : "#64748b" }}>
                      {t.online ? "online" : "offline"}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: T.muted }}>
                    {t.transportista || "chofer"} {t.phone_tail ? `· …${t.phone_tail}` : ""}
                  </div>
                  <div style={{ fontSize: 11, color: T.muted }}>
                    {t.last_event?.type || t.status} · evidencias {t.evidence_count || 0}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
        {selected ? (
          <div style={{ marginTop: 10, fontSize: 12, color: T.text || "#0f172a" }}>
            <div><strong>Estado</strong> {selected.status}</div>
            <div><strong>Paradas</strong> {selected.stop_count}</div>
            <div><strong>Último GPS</strong> {selected.geo ? when(selected.geo.at) : "sin ping"}</div>
          </div>
        ) : null}
        <ChoferHitlForm token={authToken()} trips={trips} onDone={() => void load()} />
      </div>
      <div style={{ minHeight: 320, borderRadius: 12, overflow: "hidden", border: `1px solid ${T.border || "#e2e8f0"}` }}>
        <TorreLiveMap trips={trips} selectedId={selectedId} onSelect={(t) => setSelectedId(t.trip_id)} />
      </div>
    </div>
  );
}
