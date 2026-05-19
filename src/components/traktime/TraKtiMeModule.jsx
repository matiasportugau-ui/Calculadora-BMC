import { useCallback, useEffect, useState } from "react";
import Timer from "./Timer/Timer.jsx";
import EntryList from "./Timer/EntryList.jsx";
import ReportsView from "./Reports/ReportsView.jsx";
import ClientsPanel from "./Clients/ClientsPanel.jsx";
import ProjectsPanel from "./Projects/ProjectsPanel.jsx";
import InvoicesPanel from "./Invoices/InvoicesPanel.jsx";
import { tkApi, setApiToken } from "./shared/api.js";
import { useBmcAuth } from "../../hooks/useBmcAuth.js";
import { colors, fonts, page, tabBar, tabButton } from "./shared/styles.js";

const TABS = [
  { id: "timer", label: "Temporizador" },
  { id: "reports", label: "Reportes" },
  { id: "projects", label: "Proyectos" },
  { id: "clients", label: "Clientes" },
  { id: "invoices", label: "Facturas" },
];

export default function TraKtiMeModule() {
  const auth = useBmcAuth();
  const [tab, setTab] = useState("timer");
  const [me, setMe] = useState(null);
  const [projects, setProjects] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      const r = await tkApi.me();
      setMe(r);
      setProjects(r.projects || []);
      setError("");
    } catch (e) {
      setError(e.message || "load_failed");
    }
  }, []);

  useEffect(() => {
    if (auth.accessToken) {
      setApiToken(auth.accessToken);
      reload();
    }
  }, [auth.accessToken, reload]);

  const bumpEntries = () => setRefreshKey((k) => k + 1);

  return (
    <div style={page}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <header style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 22, margin: 0, fontFamily: fonts.body }}>TraKtiMe</h1>
          <div style={{ fontSize: 13, color: colors.textMuted }}>
            {me
              ? `${me.user?.email || ""} · ${me.role}`
              : "Cargando…"}
          </div>
        </header>

        <nav style={tabBar} role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              style={tabButton(tab === t.id)}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {error ? (
          <div style={{ color: colors.danger, marginBottom: 12 }}>{error}</div>
        ) : null}

        {tab === "timer" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <Timer projects={projects} onChange={bumpEntries} />
            <EntryList refreshKey={refreshKey} />
          </div>
        )}

        {tab === "reports" && <ReportsView />}
        {tab === "projects" && (
          <ProjectsPanel canEdit={me?.role === "admin"} onChange={reload} />
        )}
        {tab === "clients" && <ClientsPanel canEdit={me?.role === "admin"} />}

        {tab === "invoices" && me?.role === "admin" && <InvoicesPanel />}
        {tab === "invoices" && me?.role !== "admin" && (
          <div
            style={{
              padding: 48,
              textAlign: "center",
              color: colors.textMuted,
              border: `1px dashed ${colors.border}`,
              borderRadius: 12,
            }}
          >
            Solo los administradores pueden gestionar facturas.
          </div>
        )}
      </div>
    </div>
  );
}
