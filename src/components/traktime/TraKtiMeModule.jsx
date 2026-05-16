import { useCallback, useEffect, useState } from "react";
import Timer from "./Timer/Timer.jsx";
import EntryList from "./Timer/EntryList.jsx";
import { tkApi } from "./shared/api.js";
import { colors, fonts, page, tabBar, tabButton } from "./shared/styles.js";

const TABS = [
  { id: "timer", label: "Temporizador" },
  { id: "reports", label: "Reportes" },
  { id: "projects", label: "Proyectos" },
  { id: "clients", label: "Clientes" },
  { id: "invoices", label: "Facturas" },
];

export default function TraKtiMeModule() {
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
    reload();
  }, [reload]);

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

        {tab !== "timer" && (
          <div
            style={{
              padding: 48,
              textAlign: "center",
              color: colors.textMuted,
              border: `1px dashed ${colors.border}`,
              borderRadius: 12,
            }}
          >
            <strong style={{ color: colors.text, display: "block", marginBottom: 8 }}>
              Próximamente
            </strong>
            Esta pestaña se completa en los sprints 2 y 3 del plan TraKtiMe.
          </div>
        )}
      </div>
    </div>
  );
}
