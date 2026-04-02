import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

const API_BASE = "";

function openOutboxDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("transportista-driver-outbox", 1);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains("pending")) {
        req.result.createObjectStore("pending", { keyPath: "localId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}

async function outboxAdd(body) {
  const localId =
    globalThis.crypto && globalThis.crypto.randomUUID
      ? globalThis.crypto.randomUUID()
      : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const row = { localId, body };
  const db = await openOutboxDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pending", "readwrite");
    tx.objectStore("pending").add(row);
    tx.oncomplete = () => resolve(localId);
    tx.onerror = () => reject(tx.error);
  });
}

async function outboxGetAll() {
  const db = await openOutboxDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pending", "readonly");
    const q = tx.objectStore("pending").getAll();
    q.onsuccess = () => resolve(q.result || []);
    q.onerror = () => reject(q.error);
  });
}

async function outboxDelete(localId) {
  const db = await openOutboxDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pending", "readwrite");
    tx.objectStore("pending").delete(localId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export default function DriverTransportistaApp() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get("t") || "";
  const [token, setToken] = useState(() => localStorage.getItem("transportista_driver_token") || "");
  const [status, setStatus] = useState("");
  const [trip, setTrip] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [stopId, setStopId] = useState("");
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (tokenFromUrl) {
      localStorage.setItem("transportista_driver_token", tokenFromUrl);
      setToken(tokenFromUrl);
      setSearchParams({}, { replace: true });
    }
  }, [tokenFromUrl, setSearchParams]);

  const authHeader = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token],
  );

  const loadTrip = useCallback(async () => {
    if (!token) return;
    setStatus("Cargando…");
    try {
      const res = await fetch(`${API_BASE}/api/driver/trips`, { headers: authHeader });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Error");
      const t0 = data.trips?.[0];
      if (!t0) {
        setTrip(null);
        setTimeline([]);
        setStatus("Sin viajes asignados.");
        return;
      }
      const r2 = await fetch(`${API_BASE}/api/driver/trips/${t0.trip_id}`, { headers: authHeader });
      const d2 = await r2.json();
      if (!d2.ok) throw new Error(d2.error || "Error");
      setTrip(d2.trip);
      setTimeline(d2.timeline || []);
      setStatus("");
    } catch (e) {
      setStatus(e.message || String(e));
    }
  }, [token, authHeader]);

  useEffect(() => {
    loadTrip();
  }, [loadTrip]);

  const refreshOutbox = useCallback(async () => {
    const all = await outboxGetAll();
    setPendingCount(all.length);
  }, []);

  useEffect(() => {
    refreshOutbox();
  }, [refreshOutbox]);

  const syncOutbox = useCallback(async () => {
    if (!token) return;
    const all = await outboxGetAll();
    for (const row of all) {
      try {
        const res = await fetch(`${API_BASE}/api/driver/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeader },
          body: JSON.stringify(row.body),
        });
        const data = await res.json();
        if (res.ok && data.ok) {
          await outboxDelete(row.localId);
        }
      } catch {
        break;
      }
    }
    await refreshOutbox();
    await loadTrip();
  }, [token, authHeader, loadTrip, refreshOutbox]);

  const sendEvent = async (type, extra = {}) => {
    if (!token || !trip) return;
    const idempotency_key = `drv:${trip.trip_id}:${type}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    const body = {
      idempotency_key,
      trip_id: trip.trip_id,
      stop_id: stopId || null,
      type,
      at_client_ms: Date.now(),
      payload: extra,
    };
    try {
      const res = await fetch(`${API_BASE}/api/driver/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Error");
      await loadTrip();
    } catch {
      await outboxAdd(body);
      await refreshOutbox();
      setStatus(`Sin conexión: evento en cola (${type}).`);
    }
  };

  const uploadB64 = async (kind, file) => {
    if (!token || !trip || !file) return;
    const reader = new FileReader();
    const data_base64 = await new Promise((resolve, reject) => {
      reader.onload = () => {
        const s = String(reader.result || "");
        const b64 = s.includes(",") ? s.split(",")[1] : s;
        resolve(b64);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    const idempotency_key = `evi:b64:${trip.trip_id}:${kind}:${Date.now()}`;
    const res = await fetch(`${API_BASE}/api/driver/evidence/upload-b64`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({
        idempotency_key,
        trip_id: trip.trip_id,
        stop_id: stopId || null,
        kind,
        mime: file.type || "image/jpeg",
        data_base64,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || "Upload failed");
    await loadTrip();
  };

  if (!token) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 520 }}>
        <h1 style={{ fontSize: 20 }}>Conductor BMC</h1>
        <p style={{ color: "#555" }}>Abrí el enlace con el parámetro <code>?t=…</code> o pegá el token:</p>
        <input
          style={{ width: "100%", padding: 8, marginBottom: 8 }}
          placeholder="Token"
          onChange={(e) => setToken(e.target.value)}
        />
        <button type="button" onClick={() => localStorage.setItem("transportista_driver_token", token)}>
          Guardar token
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, fontFamily: "system-ui", maxWidth: 560 }}>
      <h1 style={{ fontSize: 20, marginTop: 0 }}>Conductor</h1>
      {status && <p style={{ color: "#a00" }}>{status}</p>}
      {pendingCount > 0 && (
        <p style={{ background: "#fff3cd", padding: 8, borderRadius: 6 }}>
          Pendientes de sincronizar: {pendingCount}{" "}
          <button type="button" onClick={syncOutbox}>
            Sincronizar
          </button>
        </p>
      )}
      {trip && (
        <>
          <p>
            <strong>Viaje</strong> {trip.trip_id.slice(0, 8)}… — {trip.status}
          </p>
          <label style={{ display: "block", marginBottom: 8 }}>
            Stop ID (opcional, UUID)
            <input
              style={{ width: "100%", padding: 6, marginTop: 4 }}
              value={stopId}
              onChange={(e) => setStopId(e.target.value)}
              placeholder="UUID parada"
            />
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            <button type="button" onClick={() => sendEvent("factory_arrived")}>
              Llegué a fábrica
            </button>
            <button type="button" onClick={() => sendEvent("load_started")}>
              Inicié carga
            </button>
            <button type="button" onClick={() => sendEvent("load_completed")}>
              Carga lista
            </button>
            <button type="button" onClick={() => sendEvent("factory_departed")}>
              Salí de fábrica
            </button>
            <button type="button" onClick={() => sendEvent("stop_arrived")}>
              Llegué a parada
            </button>
            <button type="button" onClick={() => sendEvent("delivery_completed")}>
              Entregado
            </button>
            <button type="button" onClick={() => sendEvent("incident_reported", { note: "manual" })}>
              Incidencia
            </button>
          </div>
          <label style={{ display: "block", marginBottom: 12 }}>
            Foto evidencia (dev upload-b64)
            <input
              type="file"
              accept="image/*"
              style={{ display: "block", marginTop: 4 }}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  setStatus("Subiendo…");
                  await uploadB64("foto", f);
                  setStatus("");
                } catch (err) {
                  setStatus(err.message || String(err));
                }
              }}
            />
          </label>
          <h2 style={{ fontSize: 16 }}>Timeline</h2>
          <ul style={{ paddingLeft: 18, fontSize: 13, color: "#333" }}>
            {timeline.map((ev, i) => (
              <li key={i}>
                {ev.at_server} — {ev.event_type}
              </li>
            ))}
          </ul>
        </>
      )}
      <button type="button" style={{ marginTop: 16 }} onClick={() => loadTrip()}>
        Refrescar
      </button>
    </div>
  );
}
