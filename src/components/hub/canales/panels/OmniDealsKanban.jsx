import React from "react";

const STAGES = [
  { id: "lead", label: "Lead" },
  { id: "qualified", label: "Calificado" },
  { id: "proposal", label: "Propuesta" },
  { id: "negotiation", label: "Negociación" },
  { id: "closed_won", label: "Ganado" },
  { id: "closed_lost", label: "Perdido" },
];

export default function OmniDealsKanban({ deals, loading, onMoveDeal }) {
  const byStage = STAGES.reduce((acc, s) => {
    acc[s.id] = deals.filter((d) => d.stage === s.id);
    return acc;
  }, {});

  if (loading) {
    return <p style={{ color: "#6b7280" }}>Cargando pipeline…</p>;
  }

  return (
    <div style={{ display: "flex", gap: "0.75rem", overflowX: "auto", paddingBottom: "1rem" }}>
      {STAGES.map((stage) => (
        <div
          key={stage.id}
          style={{
            minWidth: 200,
            flex: "0 0 200px",
            background: "#f9fafb",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            padding: "0.75rem",
          }}
        >
          <h4 style={{ margin: "0 0 0.75rem", fontSize: "0.875rem", fontWeight: 600 }}>
            {stage.label}
            <span style={{ marginLeft: 6, color: "#6b7280" }}>({byStage[stage.id].length})</span>
          </h4>
          {byStage[stage.id].length === 0 ? (
            <p style={{ fontSize: "0.75rem", color: "#9ca3af", margin: 0 }}>Sin deals</p>
          ) : (
            byStage[stage.id].map((deal) => (
              <div
                key={deal.id}
                style={{
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 6,
                  padding: "0.5rem",
                  marginBottom: "0.5rem",
                  fontSize: "0.8125rem",
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{deal.title}</div>
                <div style={{ color: "#6b7280", marginBottom: 6 }}>
                  {deal.contact_name || deal.contact_email || "—"}
                </div>
                {deal.value_usd != null && (
                  <div style={{ fontWeight: 500 }}>USD {Number(deal.value_usd).toLocaleString()}</div>
                )}
                {onMoveDeal && stage.id !== "closed_won" && stage.id !== "closed_lost" && (
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) onMoveDeal(deal.id, e.target.value);
                      e.target.value = "";
                    }}
                    style={{ marginTop: 6, width: "100%", fontSize: "0.75rem" }}
                  >
                    <option value="">Mover a…</option>
                    {STAGES.filter((s) => s.id !== stage.id).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ))
          )}
        </div>
      ))}
    </div>
  );
}
