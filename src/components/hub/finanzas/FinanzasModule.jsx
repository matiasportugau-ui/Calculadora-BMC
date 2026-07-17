import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import BancoLedgerModule from "../banco/BancoLedgerModule.jsx";
import CashFlowPanel from "./CashFlowPanel.jsx";
import { colors, fonts, page, tabBar, tabButton } from "../../traktime/shared/styles.js";

const TABS = [
  { id: "banco", label: "Banco", to: "/hub/finanzas/banco" },
  { id: "cash-flow", label: "Cash Flow", to: "/hub/finanzas/cash-flow" },
];

function tabLinkStyle(active) {
  const base = tabButton(active);
  return {
    ...base,
    textDecoration: "none",
    display: "inline-block",
  };
}

export default function FinanzasModule() {
  const { pathname } = useLocation();
  const cashFlowActive = pathname.includes("/cash-flow");

  return (
    <div style={page}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <header style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 22, margin: 0, fontFamily: fonts.body }}>Finanzas</h1>
          <div style={{ fontSize: 13, color: colors.textMuted, marginTop: 4 }}>
            Libro bancario y cash flow managerial — no es declaración fiscal.
          </div>
        </header>

        <nav style={tabBar} role="tablist" aria-label="Finanzas">
          {TABS.map((t) => {
            const active = t.id === "cash-flow" ? cashFlowActive : !cashFlowActive;
            return (
              <Link
                key={t.id}
                to={t.to}
                role="tab"
                aria-selected={active}
                style={tabLinkStyle(active)}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>

        <Routes>
          <Route index element={<Navigate to="banco" replace />} />
          <Route path="banco" element={<BancoLedgerModule embedded />} />
          <Route path="cash-flow" element={<CashFlowPanel />} />
          <Route path="*" element={<Navigate to="banco" replace />} />
        </Routes>
      </div>
    </div>
  );
}
