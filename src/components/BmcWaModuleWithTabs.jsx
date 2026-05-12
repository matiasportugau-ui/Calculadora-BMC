/**
 * BmcWaModuleWithTabs — wrapper para /hub/wa con dos vistas:
 *   - Cockpit (default): nuevo BmcWaCockpit (Postgres + extensión + AI)
 *   - Sheet legacy:      BmcWaOperativoModule (lectura CRM_Operativo por origen=WA)
 *
 * El cockpit es el flujo operativo nuevo (F1-F5 del plan WA Cockpit).
 * La pestaña legacy queda como fallback / referencia mientras la extensión
 * Chrome no esté cargando datos en producción.
 */
import { Suspense, lazy, useEffect, useState } from "react";

const BmcWaCockpit = lazy(() => import("./BmcWaCockpit.jsx"));
const BmcWaOperativoModule = lazy(() => import("./BmcWaOperativoModule.jsx"));

const STORAGE_KEY = "bmc_wa_module_tab";

const wrap = {
  display: "flex",
  flexDirection: "column",
  flex: 1,
  minHeight: 0,
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Helvetica, Arial, sans-serif",
};

const tabsBar = {
  display: "flex",
  gap: 6,
  alignItems: "center",
  padding: "8px 16px",
  borderBottom: "1px solid #e5e5ea",
  background: "#fff",
};

const tabBtn = (active) => ({
  padding: "6px 12px",
  borderRadius: 8,
  border: active ? "none" : "1px solid #e5e5ea",
  background: active ? "#0071e3" : "#fff",
  color: active ? "#fff" : "#1d1d1f",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 600,
});

const fallback = (
  <div style={{ padding: 24, fontSize: 13, color: "#6e6e73" }}>Cargando…</div>
);

const TABS = [
  { id: "cockpit", label: "Cockpit", subtitle: "Postgres · extensión · AI" },
  { id: "legacy", label: "Sheet legacy", subtitle: "CRM_Operativo · origen=WA" },
];

export default function BmcWaModuleWithTabs() {
  const [active, setActive] = useState("cockpit");

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved === "cockpit" || saved === "legacy") setActive(saved);
    } catch {
      /* ignore */
    }
  }, []);

  const setTab = (id) => {
    setActive(id);
    try {
      sessionStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
  };

  const activeMeta = TABS.find((t) => t.id === active) || TABS[0];

  return (
    <div style={wrap}>
      <div style={tabsBar}>
        <strong style={{ fontSize: 13, color: "#1a3a5c", marginRight: 8 }}>WhatsApp</strong>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            style={tabBtn(active === t.id)}
            onClick={() => setTab(t.id)}
            title={t.subtitle}
          >
            {t.label}
          </button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#8a8a8e" }}>
          {activeMeta.subtitle}
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <Suspense fallback={fallback}>
          {active === "cockpit" ? <BmcWaCockpit /> : <BmcWaOperativoModule />}
        </Suspense>
      </div>
    </div>
  );
}
