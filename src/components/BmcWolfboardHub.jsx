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
  padding: "28px 20px 48px",
  maxWidth: 960,
  margin: "0 auto",
  width: "100%",
  boxSizing: "border-box",
};

const h1 = {
  margin: "0 0 8px",
  fontSize: 26,
  fontWeight: 700,
  color: "#1a3a5c",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Helvetica, Arial, sans-serif",
};

const sub = {
  margin: "0 0 28px",
  fontSize: 15,
  color: "#6e6e73",
  fontFamily: h1.fontFamily,
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
  gap: 16,
};

const card = {
  background: "#fff",
  borderRadius: 12,
  border: "1px solid #e5e5ea",
  boxShadow: "0 1px 3px rgba(0,0,0,.04), 0 4px 16px rgba(0,0,0,.06)",
  padding: 20,
  display: "flex",
  flexDirection: "column",
  gap: 10,
  fontFamily: h1.fontFamily,
};

const cardTitle = { margin: 0, fontSize: 17, fontWeight: 700, color: "#1d1d1f" };
const cardDesc = { margin: 0, fontSize: 13, color: "#6e6e73", lineHeight: 1.45 };

const cta = {
  marginTop: "auto",
  display: "inline-block",
  alignSelf: "flex-start",
  padding: "10px 16px",
  borderRadius: 10,
  background: "#0071e3",
  color: "#fff",
  fontWeight: 600,
  fontSize: 13,
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
