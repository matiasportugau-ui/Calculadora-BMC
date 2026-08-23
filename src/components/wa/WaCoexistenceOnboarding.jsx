/**
 * WA Coexistence onboarding card — "Conectar WhatsApp" desde /hub/wa (Meta oficial).
 *
 * Lanza el Embedded Signup (Facebook Login for Business); Meta renderiza el QR de
 * coexistencia en su popup, el operador lo escanea con la app WhatsApp Business, y al
 * terminar POSTeamos el authorization code + phone_number_id + waba_id al backend, que
 * intercambia el token, suscribe la app a la WABA y persiste la conexión cifrada.
 *
 * Config no-secreta (appId/configId) viene de GET /api/wa/onboarding/config con fallback
 * a VITE_*; el token de sesión reusa el patrón token/apiBase del resto del panel.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Smartphone, RefreshCw, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import { loadFbSdk } from "../../utils/facebookSdk.js";

const VITE_APP_ID = import.meta.env?.VITE_META_APP_ID || "";
const VITE_CONFIG_ID = import.meta.env?.VITE_META_ES_CONFIG_ID || "";
const VITE_GRAPH = import.meta.env?.VITE_META_GRAPH_VERSION || "v21.0";

const S = {
  wrap: { maxWidth: 640 },
  title: { fontSize: 20, fontWeight: 700, color: "#1d1d1f", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 },
  subtitle: { fontSize: 13, color: "#86868b", marginBottom: 20, lineHeight: 1.5 },
  card: { border: "1px solid #e5e5ea", borderRadius: 12, padding: 20, background: "#fff", marginBottom: 16 },
  btn: (disabled) => ({
    display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 8,
    border: "none", background: disabled ? "#c7c7cc" : "#25D366", color: "#fff", fontSize: 14,
    fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer",
  }),
  note: { fontSize: 12, color: "#86868b", marginTop: 12, lineHeight: 1.5 },
  row: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #f2f2f7" },
  pill: (ok) => ({ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 12, background: ok ? "#e6f7ec" : "#f2f2f7", color: ok ? "#2a7a2a" : "#6e6e73" }),
  err: { display: "flex", alignItems: "center", gap: 8, color: "#c0392b", fontSize: 13, marginTop: 12 },
  linkBtn: { background: "none", border: "none", color: "#c0392b", cursor: "pointer", padding: 4, display: "inline-flex" },
};

export default function WaCoexistenceOnboarding({ token, apiBase }) {
  const [cfg, setCfg] = useState(null); // { enabled, appId, configId, graphVersion }
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [connections, setConnections] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const esResultRef = useRef(null); // { phoneNumberId, wabaId, event } del postMessage

  const authHeaders = useCallback(
    (extra = {}) => ({ Authorization: `Bearer ${token}`, ...extra }),
    [token],
  );

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`${apiBase}/api/wa/onboarding/config`, { headers: authHeaders() });
      if (r.status === 404) {
        setCfg({ enabled: false });
        return;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setCfg({
        enabled: j.enabled,
        appId: j.appId || VITE_APP_ID,
        configId: j.configId || VITE_CONFIG_ID,
        graphVersion: j.graphVersion || VITE_GRAPH,
      });
    } catch (e) {
      // Sin backend/flag: caemos a VITE_ si están, si no marcamos deshabilitado.
      if (VITE_APP_ID && VITE_CONFIG_ID) {
        setCfg({ enabled: true, appId: VITE_APP_ID, configId: VITE_CONFIG_ID, graphVersion: VITE_GRAPH });
      } else {
        setError(e.message);
        setCfg({ enabled: false });
      }
    } finally {
      setLoading(false);
    }
  }, [apiBase, authHeaders]);

  const loadConnections = useCallback(async () => {
    try {
      const r = await fetch(`${apiBase}/api/wa/onboarding/connections`, { headers: authHeaders() });
      if (!r.ok) return;
      const j = await r.json();
      setConnections(Array.isArray(j.connections) ? j.connections : []);
    } catch { /* non-critical */ }
  }, [apiBase, authHeaders]);

  useEffect(() => { loadConfig(); }, [loadConfig]);
  useEffect(() => { if (cfg?.enabled) loadConnections(); }, [cfg?.enabled, loadConnections]);

  // Captura el resultado de Embedded Signup (phone_number_id, waba_id).
  useEffect(() => {
    function onMessage(event) {
      if (typeof event.origin !== "string" || !/facebook\.com$/.test(new URL(event.origin).hostname || "")) return;
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data?.type === "WA_EMBEDDED_SIGNUP") {
          esResultRef.current = {
            phoneNumberId: data?.data?.phone_number_id || null,
            wabaId: data?.data?.waba_id || null,
            event: data?.event || null,
          };
        }
      } catch { /* no-op: no todos los mensajes son JSON de ES */ }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const exchange = useCallback(
    async (code) => {
      const es = esResultRef.current || {};
      if (!es.phoneNumberId) {
        setError("No se recibió el phone_number_id de Meta. Reintentá el flujo.");
        return;
      }
      try {
        const r = await fetch(`${apiBase}/api/wa/onboarding/exchange`, {
          method: "POST",
          headers: authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ code, phoneNumberId: es.phoneNumberId, wabaId: es.wabaId }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.ok) throw new Error(j.error || `HTTP ${r.status}`);
        setNotice(`Número conectado: ${j.connection?.displayNumber || es.phoneNumberId}`);
        esResultRef.current = null;
        await loadConnections();
      } catch (e) {
        setError(`Error conectando el número: ${e.message}`);
      }
    },
    [apiBase, authHeaders, loadConnections],
  );

  const handleConnect = useCallback(async () => {
    setError("");
    setNotice("");
    if (!cfg?.appId || !cfg?.configId) {
      setError("Falta META_APP_ID / config_id. Ver runbook wa-coexistence-onboarding.");
      return;
    }
    setConnecting(true);
    try {
      const FB = await loadFbSdk({ appId: cfg.appId, graphVersion: cfg.graphVersion });
      esResultRef.current = null;
      FB.login(
        (response) => {
          setConnecting(false);
          const code = response?.authResponse?.code;
          if (code) {
            exchange(code);
          } else if (esResultRef.current?.event === "CANCEL") {
            setNotice("Conexión cancelada.");
          } else {
            setError("No se completó la conexión (sin authorization code).");
          }
        },
        {
          config_id: cfg.configId,
          response_type: "code",
          override_default_response_type: true,
          extras: { setup: {}, featureType: "whatsapp_business_app_onboarding" },
        },
      );
    } catch (e) {
      setConnecting(false);
      setError(`No se pudo abrir el flujo de Meta: ${e.message}`);
    }
  }, [cfg, exchange]);

  const handleDisconnect = useCallback(
    async (phoneNumberId) => {
      if (!window.confirm(`¿Desconectar el número ${phoneNumberId}?`)) return;
      try {
        const r = await fetch(`${apiBase}/api/wa/onboarding/connections/${encodeURIComponent(phoneNumberId)}`, {
          method: "DELETE",
          headers: authHeaders(),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        await loadConnections();
      } catch (e) {
        setError(`Error desconectando: ${e.message}`);
      }
    },
    [apiBase, authHeaders, loadConnections],
  );

  if (loading) return <div style={S.subtitle}>Cargando…</div>;

  if (!cfg?.enabled) {
    return (
      <div style={S.wrap}>
        <div style={S.title}><Smartphone size={20} /> Conexión / Números</div>
        <div style={S.subtitle}>
          El onboarding de coexistencia está deshabilitado. Activá <code>WA_COEXISTENCE_ENABLED=1</code> y configurá
          <code> META_APP_ID</code> / <code>META_ES_CONFIG_ID</code> (ver <code>docs/team/runbooks/wa-coexistence-onboarding.md</code>).
        </div>
        {error && <div style={S.err}><AlertCircle size={16} /> {error}</div>}
      </div>
    );
  }

  return (
    <div style={S.wrap}>
      <div style={S.title}><Smartphone size={20} /> Conexión / Números</div>
      <div style={S.subtitle}>
        Conectá un número de WhatsApp por la vía oficial de Meta (coexistencia). Meta muestra un QR en su ventana:
        escaneálo con la app <b>WhatsApp Business</b> del teléfono. El número sigue funcionando en el teléfono y a la vez
        entra al cockpit.
      </div>

      <div style={S.card}>
        <button style={S.btn(connecting)} onClick={handleConnect} disabled={connecting}>
          <Smartphone size={16} /> {connecting ? "Abriendo Meta…" : "Conectar WhatsApp"}
        </button>
        <div style={S.note}>
          Se abrirá la ventana de Embedded Signup de Meta. Necesitás la app WhatsApp Business con el número a vincular.
        </div>
        {notice && <div style={{ ...S.err, color: "#2a7a2a" }}><CheckCircle2 size={16} /> {notice}</div>}
        {error && <div style={S.err}><AlertCircle size={16} /> {error}</div>}
      </div>

      <div style={S.card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <b style={{ fontSize: 14 }}>Números conectados</b>
          <button style={{ ...S.linkBtn, color: "#0071e3" }} onClick={loadConnections} title="Refrescar">
            <RefreshCw size={15} />
          </button>
        </div>
        {connections.length === 0 && <div style={S.subtitle}>Todavía no hay números conectados.</div>}
        {connections.map((c) => (
          <div key={c.phoneNumberId} style={S.row}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{c.displayNumber || c.phoneNumberId}</div>
              <div style={{ fontSize: 12, color: "#86868b" }}>
                {c.verifiedName || "—"} · id {c.phoneNumberId}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={S.pill(c.status === "active")}>{c.status === "active" ? "activo" : "inactivo"}</span>
              <span style={S.pill(c.subscribed)}>{c.subscribed ? "suscripto" : "sin suscribir"}</span>
              {c.status === "active" && (
                <button style={S.linkBtn} onClick={() => handleDisconnect(c.phoneNumberId)} title="Desconectar">
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
