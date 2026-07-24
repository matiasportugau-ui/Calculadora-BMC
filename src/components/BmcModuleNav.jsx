import { Link, useLocation } from "react-router-dom";
import { useBmcAuth } from "../hooks/useBmcAuth.js";
import { openBugReport } from "../lib/bugReportBus.js";
import { isDesignPreviewEnabled } from "../lib/designPreviewMode.js";

const barClassic = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
  padding: "10px 16px",
  background: "#ffffff",
  borderBottom: "1px solid #e5e5ea",
  boxShadow: "0 1px 3px rgba(0,0,0,.04)",
  position: "sticky",
  top: 0,
  zIndex: 20,
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Helvetica, Arial, sans-serif",
};

const barPreview = {
  ...barClassic,
  background: undefined,
  borderBottom: undefined,
  boxShadow: undefined,
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
  const previewNav = isDesignPreviewEnabled();
  const auth = useBmcAuth();
  const isAdmin = auth?.role === "admin" || auth?.role === "superadmin";
  const finanzasActive =
    pathname.startsWith("/hub/finanzas") || pathname.startsWith("/hub/banco");
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
  const bancoActive = pathname.startsWith("/hub/banco");
  const tareasActive = pathname.startsWith("/hub/tareas");
  const clientesActive = pathname.startsWith("/hub/clientes");

  return (
    <nav
      className={previewNav ? "bmc-module-nav chrome-glass glass" : undefined}
      style={previewNav ? barPreview : barClassic}
      aria-label="Módulos BMC"
    >
      <span
        className={previewNav ? "bmc-module-nav__brand" : undefined}
        style={previewNav ? undefined : { fontWeight: 700, fontSize: 13, color: "#1a3a5c", marginRight: 8 }}
      >
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
      <Link to="/hub/banco" style={btn(bancoActive)}>
        Banco
      </Link>
      <Link to="/hub/marketing" style={btn(marketingActive)}>
        Market Intel
      </Link>
      <Link to="/hub/finanzas" style={btn(finanzasActive)}>
        Finanzas
      </Link>
      <Link to="/hub/tareas" style={btn(tareasActive)}>
        Tareas
      </Link>
      <Link to="/hub/clientes" style={btn(clientesActive)}>
        Clientes
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

      <button
        type="button"
        onClick={() => openBugReport({ via: "nav" })}
        title="Reportar un bug o problema en la interfaz"
        style={{
          marginLeft: "auto",
          padding: "4px 10px",
          borderRadius: 999,
          border: "1px solid #e5e5ea",
          background: "transparent",
          fontSize: 13,
          cursor: "pointer",
          color: "#c0392b",
          fontWeight: 600,
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        🐛 <span style={{ fontSize: 12 }}>Reportar</span>
      </button>
    </nav>
  );
}
