// Hub rediseñado (mock) — todas las superficies reales agrupadas por sección.
// Los links son reales: navegan a los módulos oficiales existentes.
import { Link } from "react-router-dom";
import { HUB_SECTIONS } from "./mockData.js";
import { ui, SectionDivider, Badge } from "./ui.jsx";

function HubCard({ item }) {
  return (
    <div style={{ ...ui.card, display: "flex", flexDirection: "column", gap: 7, position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 10, height: 10, borderRadius: 3, background: item.color, flexShrink: 0 }} />
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#1d1d1f" }}>{item.title}</h3>
        {item.badge ? <Badge tone="purple">{item.badge}</Badge> : null}
        {item.admin ? <Badge tone="gray">ADMIN</Badge> : null}
        {item.internal ? <Badge tone="gray">INTERNO</Badge> : null}
      </div>
      <p style={{ margin: 0, fontSize: 12, color: "#6e6e73", lineHeight: 1.45, flex: 1 }}>{item.desc}</p>
      <Link
        to={item.to}
        style={{
          marginTop: 4, alignSelf: "flex-start", padding: "6px 12px", borderRadius: 8,
          background: item.color, color: "#fff", fontWeight: 600, fontSize: 12, textDecoration: "none",
        }}
      >
        Abrir
      </Link>
    </div>
  );
}

export default function HubNextMock() {
  return (
    <div>
      <p style={{ ...ui.sub, marginBottom: 6 }}>
        Así quedaría el hub: <strong>todas</strong> las superficies visibles (hoy 14 rutas no tienen card),
        agrupadas por sección. Cada card linkea al módulo oficial — nada se re-implementa ni se borra.
      </p>
      {HUB_SECTIONS.map((section) => (
        <div key={section.title}>
          <SectionDivider label={section.title} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 12 }}>
            {section.items.map((item) => (
              <HubCard key={item.title + item.to} item={item} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
