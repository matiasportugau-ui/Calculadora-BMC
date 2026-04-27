import { Link, useLocation } from "react-router-dom";

const bar = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
  padding: "10px 16px",
  background: "#ffffff",
  borderBottom: "1px solid #e5e5ea",
  boxShadow: "0 1px 3px rgba(0,0,0,.04)",
  position: "relative",
  zIndex: 2,
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Helvetica, Arial, sans-serif",
};

const btn = (active) => ({
  padding: "8px 14px",
  borderRadius: 10,
  textDecoration: "none",
  fontWeight: 600,
  fontSize: 13,
  color: active ? "#fff" : "#1d1d1f",
  background: active ? "#0071e3" : "transparent",
  border: active ? "none" : "1.5px solid #e5e5ea",
});

export default function BmcModuleNav() {
  const { pathname } = useLocation();
  const hubActive =
    pathname === "/hub" ||
    pathname.startsWith("/hub/ml") ||
    pathname.startsWith("/hub/wa") ||
    pathname.startsWith("/hub/canales") ||
    pathname.startsWith("/hub/admin") ||
    pathname.startsWith("/hub/agent-admin");
  const logiActive = pathname.endsWith("/logistica");
  const calcActive = pathname === "/" || pathname.endsWith("/calculadora");

  return (
    <nav style={bar} aria-label="Módulos BMC">
      <span style={{ fontWeight: 700, fontSize: 13, color: "#1a3a5c", marginRight: 8 }}>
        BMC
      </span>
      <Link to="/hub" style={btn(hubActive)}>
        Wolfboard
      </Link>
      <Link to="/" style={btn(calcActive)}>
        Calculadora
      </Link>
      <Link to="/logistica" style={btn(logiActive)}>
        Logística
      </Link>
    </nav>
  );
}
