import { Link, useLocation } from "react-router-dom";
import { useBmcAuth } from "../hooks/useBmcAuth.js";

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
  const auth = useBmcAuth();
  const isAdmin = auth?.role === "admin" || auth?.role === "superadmin";
  const hubActive =
    pathname === "/hub" ||
    pathname.startsWith("/hub/ml") ||
    pathname.startsWith("/hub/wa") ||
    pathname.startsWith("/hub/canales") ||
    pathname.startsWith("/hub/admin") ||
    pathname.startsWith("/hub/agent-admin");
  const marketingActive = pathname.startsWith("/hub/marketing");
  const logiActive = pathname.endsWith("/logistica");
  const calcActive = pathname === "/" || pathname.endsWith("/calculadora");
  const traktimeActive = pathname.startsWith("/hub/traktime");
  const tareasActive = pathname.startsWith("/hub/tareas");
  const clientesActive = pathname.startsWith("/hub/clientes");

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
      <Link to="/hub/traktime" style={btn(traktimeActive)}>
        TraKtiMe
      </Link>
      <Link to="/hub/tareas" style={btn(tareasActive)}>
        Tareas
      </Link>
      <Link to="/hub/clientes" style={btn(clientesActive)}>
        Clientes
      </Link>
      <Link to="/hub/marketing" style={btn(marketingActive)}>
        Market Intel
      </Link>
      {isAdmin ? (
        <Link to="/hub/admin/users" style={btn(pathname.startsWith("/hub/admin/users"))}>
          Usuarios
        </Link>
      ) : null}
      {isAdmin ? (
        <Link to="/hub/admin/analytics" style={btn(pathname.startsWith("/hub/admin/analytics"))}>
          Analytics
        </Link>
      ) : null}
    </nav>
  );
}
