import { Link } from "react-router-dom";
import BmcModuleNav from "./BmcModuleNav.jsx";

const wrap = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  background: "#f5f5f7",
};

const main = {
  flex: 1,
  padding: "18px 20px 36px",
  maxWidth: 1100,
  margin: "0 auto",
  width: "100%",
  boxSizing: "border-box",
};

const h1 = {
  margin: "0 0 4px",
  fontSize: 22,
  fontWeight: 700,
  color: "#1a3a5c",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Helvetica, Arial, sans-serif",
};

const sub = {
  margin: "0 0 16px",
  fontSize: 13,
  color: "#6e6e73",
  fontFamily: h1.fontFamily,
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
  gap: 12,
};

const card = {
  background: "#fff",
  borderRadius: 10,
  border: "1px solid #e5e5ea",
  boxShadow: "0 1px 3px rgba(0,0,0,.04), 0 2px 8px rgba(0,0,0,.05)",
  padding: "14px 16px",
  display: "flex",
  flexDirection: "column",
  gap: 7,
  fontFamily: h1.fontFamily,
};

const cardTitle = { margin: 0, fontSize: 14, fontWeight: 700, color: "#1d1d1f" };
const cardDesc = { margin: 0, fontSize: 12, color: "#6e6e73", lineHeight: 1.45 };

const cta = {
  marginTop: "auto",
  display: "inline-block",
  alignSelf: "flex-start",
  padding: "7px 13px",
  borderRadius: 8,
  background: "#0071e3",
  color: "#fff",
  fontWeight: 600,
  fontSize: 12,
  textDecoration: "none",
};

export default function BmcWolfboardHub() {
  return (
    <div style={wrap}>
      <BmcModuleNav />
      <div style={main}>
        <h1 style={h1}>Wolfboard</h1>
        <p style={sub}>Elegí un módulo. Más herramientas se irán sumando acá.</p>
        <div style={grid}>
          <div style={card}>
            <h2 style={cardTitle}>BMC Uruguay · Calculadora</h2>
            <p style={cardDesc}>Cotizaciones, BOM, PDF y presupuestos.</p>
            <Link to="/" style={cta}>
              Abrir calculadora
            </Link>
          </div>
          <div style={card}>
            <h2 style={cardTitle}>LogistikBMC</h2>
            <p style={cardDesc}>Carga, paradas, remitos y coordinación.</p>
            <Link to="/logistica" style={cta}>
              Abrir logística
            </Link>
          </div>
          <div style={card}>
            <h2 style={cardTitle}>Panelin · Asistente IA</h2>
            <p style={cardDesc}>
              Cotizá con ayuda de inteligencia artificial. Panelin te guía paso a paso según tu obra.
            </p>
            <Link to="/?chat=1" style={{ ...cta, background: "#1a3a5c" }}>
              Hablar con Panelin
            </Link>
          </div>
          <div style={card}>
            <h2 style={cardTitle}>Mercado Libre · Operativo</h2>
            <p style={cardDesc}>
              Cola CRM, respuesta sugerida (AF), aprobar y publicar en ML (mismo flujo cockpit).
            </p>
            <Link to="/hub/ml" style={{ ...cta, background: "#1a3a5c" }}>
              Abrir ML operativo
            </Link>
          </div>
          <div style={card}>
            <h2 style={cardTitle}>WhatsApp · Operativo</h2>
            <p style={cardDesc}>
              Cola CRM con origen WA, aprobar y enviar respuestas vía WhatsApp Cloud API.
            </p>
            <Link to="/hub/wa" style={{ ...cta, background: "#25d366" }}>
              Abrir WA operativo
            </Link>
          </div>
          <div style={card}>
            <h2 style={cardTitle}>Canales · Inbox unificado</h2>
            <p style={cardDesc}>
              Un botón para sincronizar ML a la planilla, tabla única ML + WA + IG/FB (por origen), copiar AF y
              guardar link de cotización (AH) en el mismo panel.
            </p>
            <Link to="/hub/canales" style={{ ...cta, background: "#5e5ce6" }}>
              Abrir inbox unificado
            </Link>
          </div>
          <div style={card}>
            <h2 style={cardTitle}>Admin · Consultas y Cotizaciones</h2>
            <p style={cardDesc}>
              Filas pendientes de Admin 2.0 ↔ CRM. Generá respuestas IA en lote, editá por fila y cerrá a Enviados.
            </p>
            <Link to="/hub/admin" style={{ ...cta, background: "#1a3a5c" }}>
              Abrir Admin operativo
            </Link>
          </div>
          <div style={card}>
            <h2 style={cardTitle}>Importar plano</h2>
            <p style={cardDesc}>
              Subí un plano (JPG, PNG, PDF o DXF) y la IA extrae las dimensiones automáticamente. Elegí el panel y abrí directo en la calculadora.
            </p>
            <Link to="/hub/plan-import" style={{ ...cta, background: "#0071e3" }}>
              Importar plano
            </Link>
          </div>
          <div style={card}>
            <h2 style={cardTitle}>Panelin · Admin IA</h2>
            <p style={cardDesc}>
              Gestioná la base de conocimiento, editá el system prompt, revisá logs de conversaciones, estadísticas y configuración de scoring.
            </p>
            <Link to="/hub/agent-admin" style={{ ...cta, background: "#1a3a5c" }}>
              Abrir Admin IA
            </Link>
          </div>
        </div>

        {/* ── Herramientas internas ───────────────────────────────────────── */}
        <div style={{ margin: "20px 0 10px", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, color: "#aeb3bb",
            textTransform: "uppercase", letterSpacing: 1.4,
          }}>
            Herramientas internas
          </span>
          <div style={{ flex: 1, height: 1, background: "#e5e5ea" }} />
        </div>
        <div style={grid}>
          <div style={{ ...card, borderColor: "#d1d9e6", background: "#f8fafc" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 26, height: 26, borderRadius: 6, background: "#1a3a5c", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                🔬
              </div>
              <h2 style={{ ...cardTitle, color: "#1a3a5c" }}>Inspector de Cálculos</h2>
            </div>
            <p style={cardDesc}>
              Explorá y verificá todas las lógicas de cálculo BMC en tiempo real: paneles, fijaciones, perfilería y selladores. Editá parámetros de fórmula con persistencia. Comparativa con Kingspan incluida.
            </p>
            <Link to="/inspector" style={{ ...cta, background: "#1a3a5c" }}>
              Abrir Inspector
            </Link>
          </div>
        </div>
      </div>
      {/* Floating Panelin bubble */}
      <Link
        to="/?chat=1"
        title="Hablar con Panelin"
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 100,
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "#1a3a5c",
          boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textDecoration: "none",
          fontSize: 26,
          overflow: "hidden",
        }}
        aria-label="Hablar con Panelin"
      >
        💬
      </Link>
    </div>
  );
}
