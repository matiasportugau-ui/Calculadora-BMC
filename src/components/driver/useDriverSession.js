import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const TOKEN_KEY = "transportista_driver_token";
const PROFILE_KEY = "bmc-driver-profile-v1";

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
    globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const db = await openOutboxDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pending", "readwrite");
    tx.objectStore("pending").add({ localId, body });
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

export function readProfile() {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

export function writeProfile(next) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
}

export function eventTypes(timeline) {
  return new Set((timeline || []).map((e) => e.event_type));
}

export function factoryPhase(timeline) {
  const t = eventTypes(timeline);
  if (t.has("factory_departed")) return 4;
  if (t.has("load_completed")) return 3;
  if (t.has("load_started")) return 2;
  if (t.has("factory_arrived")) return 1;
  return 0;
}

const FACTORY_EVENTS = ["factory_arrived", "load_started", "load_completed", "factory_departed"];

export default function useDriverSession() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const tokenFromUrl = searchParams.get("t") || "";
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [status, setStatus] = useState("");
  const [trip, setTrip] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [profile, setProfile] = useState(() => readProfile());
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    if (!tokenFromUrl) return;
    localStorage.setItem(TOKEN_KEY, tokenFromUrl);
    setToken(tokenFromUrl);
    setSearchParams({}, { replace: true });
  }, [tokenFromUrl, setSearchParams]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const authHeader = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  const loadTrip = useCallback(async () => {
    if (!token) return;
    setStatus("Cargando…");
    try {
      const res = await fetch("/api/driver/trips", { headers: authHeader });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Error");
      const t0 = data.trips?.[0];
      if (!t0) {
        setTrip(null);
        setTimeline([]);
        setStatus("Sin viajes asignados.");
        return;
      }
      const r2 = await fetch(`/api/driver/trips/${t0.trip_id}`, { headers: authHeader });
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
    try {
      const all = await outboxGetAll();
      setPendingCount(all.length);
    } catch {
      setPendingCount(0);
    }
  }, []);

  useEffect(() => {
    refreshOutbox();
  }, [refreshOutbox]);

  const syncOutbox = useCallback(async () => {
    if (!token) return;
    const all = await outboxGetAll();
    for (const row of all) {
      try {
        const res = await fetch("/api/driver/events", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeader },
          body: JSON.stringify(row.body),
        });
        const data = await res.json();
        if (res.ok && data.ok) await outboxDelete(row.localId);
      } catch {
        break;
      }
    }
    await refreshOutbox();
    await loadTrip();
  }, [token, authHeader, loadTrip, refreshOutbox]);

  const sendEvent = useCallback(
    async (type, extra = {}, geo = null, stopId = null) => {
      if (!token || !trip) return;
      const idempotency_key = `drv:${trip.trip_id}:${type}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
      const body = {
        idempotency_key,
        trip_id: trip.trip_id,
        stop_id: stopId || null,
        type,
        at_client_ms: Date.now(),
        payload: extra,
        ...(geo && Number.isFinite(geo.lat) && Number.isFinite(geo.lng) ? { geo } : {}),
      };
      try {
        const res = await fetch("/api/driver/events", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeader },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || "Error");
        if (type !== "location_ping") await loadTrip();
      } catch {
        // Ephemeral GPS: never poison the durable outbox (rejected/stale pings).
        if (type === "location_ping") return;
        await outboxAdd(body);
        await refreshOutbox();
        setStatus(`Sin conexión: evento en cola (${type}).`);
      }
    },
    [token, trip, authHeader, loadTrip, refreshOutbox],
  );

  useEffect(() => {
    if (!token || !trip || typeof navigator === "undefined" || !navigator.geolocation) return undefined;
    let lastSent = 0;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastSent < 40_000) return;
        lastSent = now;
        sendEvent("location_ping", { source: "watchPosition" }, {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [token, trip, sendEvent]);

  const loginWithToken = (plain, name) => {
    const t = String(plain || "").trim();
    if (!t) {
      setStatus("Pegá el token del enlace o la contraseña del operador.");
      return;
    }
    localStorage.setItem(TOKEN_KEY, t);
    setToken(t);
    if (name) {
      const next = { ...readProfile(), name: String(name).trim() };
      writeProfile(next);
      setProfile(next);
    }
    setStatus("");
    navigate("/conductor", { replace: true });
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setTrip(null);
    setTimeline([]);
    navigate("/conductor", { replace: true });
  };

  const saveProfile = (next) => {
    writeProfile(next);
    setProfile(next);
  };

  const uploadB64 = async (kind, file, stopId = null) => {
    if (!token || !trip || !file) return;
    const data_base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const s = String(reader.result || "");
        resolve(s.includes(",") ? s.split(",")[1] : s);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    const res = await fetch("/api/driver/evidence/upload-b64", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({
        idempotency_key: `evi:b64:${trip.trip_id}:${kind}:${Date.now()}`,
        trip_id: trip.trip_id,
        stop_id: stopId,
        kind,
        mime: file.type || "image/jpeg",
        data_base64,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || "Upload failed");
    await loadTrip();
  };

  const plan = trip?.plan_snapshot && typeof trip.plan_snapshot === "object" ? trip.plan_snapshot : {};
  const stops = Array.isArray(plan.stops) ? plan.stops : [];
  const phase = factoryPhase(timeline);
  const types = eventTypes(timeline);
  const done =
    types.has("delivery_completed") ||
    trip?.status === "closed" ||
    (stops.length > 0 &&
      stops.every(() => types.has("delivery_completed")) &&
      phase >= 4);

  return {
    token,
    status,
    setStatus,
    trip,
    timeline,
    pendingCount,
    profile,
    online,
    plan,
    stops,
    phase,
    types,
    done,
    FACTORY_EVENTS,
    loadTrip,
    syncOutbox,
    sendEvent,
    loginWithToken,
    logout,
    saveProfile,
    uploadB64,
  };
}
