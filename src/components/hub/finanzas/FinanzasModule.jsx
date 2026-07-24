import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import BancoLedgerModule from "../banco/BancoLedgerModule.jsx";
import CashFlowPanel from "./CashFlowPanel.jsx";
import ProyeccionModule from "./proyeccion/ProyeccionModule.jsx";
import { colors, fonts, page, tabBar, tabButton } from "../../traktime/shared/styles.js";

const TABS = [
  { id: "banco", label: "Banco", to: "/hub/finanzas/banco", hint: "Libro y movimientos" },
  { id: "cash-flow", label: "Cash Flow", to: "/hub/finanzas/cash-flow", hint: "Clasificación y neto" },
  { id: "proyeccion", label: "Proyección", to: "/hub/finanzas/proyeccion", hint: "Runway y vencimientos" },
];

function tabActive(pathname, id) {
  if (id === "banco") return pathname.includes("/banco") || /\/finanzas\/?$/.test(pathname);
  if (id === "cash-flow") return pathname.includes("/cash-flow");
  return pathname.includes("/proyeccion");
}

export default function FinanzasModule() {
  const { pathname } = useLocation();
  const activeTab = TABS.find((t) => tabActive(pathname, t.id)) || TABS[0];

  return (
    <div style={page}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <header style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 22, margin: 0, fontFamily: fonts.body }}>Finanzas</h1>
          <div style={{ fontSize: 13, color: colors.textMuted, marginTop: 4 }}>
            {activeTab.hint} — vista gerencial, no declaración fiscal.
          </div>
        </header>

        <nav style={tabBar} role="tablist" aria-label="Finanzas">
          {TABS.map((t) => (
            <Link
              key={t.id}
              to={t.to}
              role="tab"
              aria-selected={tabActive(pathname, t.id)}
              style={{ ...tabButton(tabActive(pathname, t.id)), textDecoration: "none", display: "inline-block" }}
            >
              {t.label}
            </Link>
          ))}
        </nav>

        <Routes>
          <Route index element={<Navigate to="banco" replace />} />
          <Route path="banco" element={<BancoLedgerModule embedded />} />
          <Route path="cash-flow" element={<CashFlowPanel />} />
          <Route path="proyeccion" element={<ProyeccionModule />} />
          <Route path="*" element={<Navigate to="banco" replace />} />
        </Routes>
      </div>
    </div>
  );
}
