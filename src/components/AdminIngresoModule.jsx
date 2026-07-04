import { useState } from "react";
import { Link } from "react-router-dom";
import { useAdminIngreso } from "../hooks/useAdminIngreso.js";
import { formatMissingL } from "../utils/adminIngresoApi.js";
import CockpitTokenPanel from "./CockpitTokenPanel.jsx";
import "./admin-ingreso/styles.css";

function StatusDot({ status }) {
  const color =
    status === "up" ? "#188038" : status === "down" ? "#d93025" : "#f9ab00";
  return <span className="adminIngreso__dot" style={{ background: color }} aria-hidden />;
}

function InterpretationTags({ interpretation, ready }) {
  if (!interpretation) return null;
  const tags = [];
  if (interpretation.quotable === false) tags.push({ label: "No cotizable", kind: "warn" });
  else tags.push({ label: "Cotizable", kind: "muted" });
  if (ready) tags.push({ label: "Listo para cotizar", kind: "ready" });
  else tags.push({ label: "Faltan datos", kind: "warn" });
  if (interpretation.escenario) {
    tags.push({ label: interpretation.escenario, kind: "muted" });
  }
  return (
    <div className="adminIngreso__tags">
      {tags.map((t) => (
        <span key={t.label} className={`adminIngreso__tag adminIngreso__tag--${t.kind}`}>
          {t.label}
        </span>
      ))}
    </div>
  );
}

function ChatTurns({ conversation }) {
  if (!conversation?.turns?.length) return null;
  return (
    <div className="adminIngreso__chat">
      {conversation.turns.map((turn, i) => {
        if (turn.role === "user") {
          return (
            <div key={i} className="adminIngreso__bubble adminIngreso__bubble--user">
              <div className="adminIngreso__bubble-label">Tu respuesta</div>
              {turn.text}
            </div>
          );
        }
        if (turn.role === "ai" && turn.interpretation) {
          const j = turn.interpretation.interpretation_J || "";
          return (
            <div key={i} className="adminIngreso__bubble adminIngreso__bubble--ai">
              <div className="adminIngreso__bubble-label">IA</div>
              {j}
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

export default function AdminIngresoModule() {
  const ing = useAdminIngreso();
  const [draft, setDraft] = useState("");
  const activeInquiry = ing.inquiries.find((i) => i.row === ing.selectedRow);
  const missing = formatMissingL(ing.interpretation?.missing_L);
  const inputDisabled = !ing.selectedRow || ing.busy || ing.ready;

  const handleSend = () => {
    const text = draft;
    setDraft("");
    ing.sendMessage(text);
  };

  if (!ing.token) {
    return (
      <div className="adminIngreso">
        <div className="adminIngreso__topbar">
          <span className="adminIngreso__title">Ingreso y actualización Admin</span>
        </div>
        <div className="adminIngreso__empty">
          <CockpitTokenPanel
            tokenAutoLoaded={ing.tokenAutoLoaded}
            tokenLoadError={ing.tokenLoadError}
            tokenInput={ing.tokenInput}
            setTokenInput={ing.setTokenInput}
            onSave={ing.saveToken}
            onClear={ing.clearToken}
            isJwt={ing.isJwt}
            userEmail={ing.userEmail}
            onLogin={ing.login}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="adminIngreso">
      <header className="adminIngreso__topbar">
        <Link to="/hub" style={{ fontSize: 13, color: "var(--ai-accent)", textDecoration: "none" }}>
          ← Hub
        </Link>
        <span className="adminIngreso__title">Ingreso y actualización Admin</span>
        <span className="adminIngreso__badge">Cola {ing.inquiries.length}</span>
        <StatusDot status={ing.sheetsStatus} />
        <span style={{ fontSize: 12, color: "var(--ai-text-2)" }}>Sheets</span>
      </header>

      <div className="adminIngreso__split">
        <aside className="adminIngreso__sidebar">
          <div className="adminIngreso__sidebar-head">Consultas pendientes</div>
          <div className="adminIngreso__list">
            {ing.inquiries.length === 0 && (
              <div className="adminIngreso__empty" style={{ padding: 20, fontSize: 12 }}>
                No hay consultas pendientes sin presupuesto (col M vacía).
              </div>
            )}
            {ing.inquiries.map((item) => (
              <button
                key={item.row}
                type="button"
                className={`adminIngreso__item${ing.selectedRow === item.row ? " adminIngreso__item--active" : ""}`}
                onClick={() => ing.selectRow(item.row)}
              >
                <span className="adminIngreso__row-num">{item.row}</span>
                <span className="adminIngreso__item-text">{item.consulta}</span>
              </button>
            ))}
          </div>
        </aside>

        <main className="adminIngreso__main">
          {!ing.selectedRow ? (
            <div className="adminIngreso__empty">Seleccioná una consulta de la lista.</div>
          ) : (
            <>
              <div className="adminIngreso__workspace">
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  Fila {ing.selectedRow}
                  {activeInquiry ? ` · ${activeInquiry.consulta.slice(0, 48)}…` : ""}
                </div>

                <div>
                  <div className="adminIngreso__section-label">Consulta del cliente (I)</div>
                  <div className="adminIngreso__consulta">
                    {activeInquiry?.consulta || ing.conversation?.consulta || "(sin texto)"}
                  </div>
                </div>

                {ing.interpretation && (
                  <>
                    <InterpretationTags interpretation={ing.interpretation} ready={ing.ready} />
                    <div>
                      <div className="adminIngreso__section-label">Interpretación (J)</div>
                      <div className="adminIngreso__interp">
                        {ing.interpretation.interpretation_J || "—"}
                      </div>
                    </div>
                    {ing.interpretation.question_K && (
                      <p className="adminIngreso__question">
                        ❓ {ing.interpretation.question_K}
                      </p>
                    )}
                    {missing && (
                      <p className="adminIngreso__missing">Faltan: {missing}</p>
                    )}
                  </>
                )}

                <ChatTurns conversation={ing.conversation} />

                {ing.error && (
                  <p style={{ color: "var(--ai-error)", fontSize: 13 }}>{ing.error}</p>
                )}
                {ing.busy === "load" && (
                  <p style={{ color: "var(--ai-text-2)", fontSize: 13 }}>Cargando…</p>
                )}
                {ing.busy === "interpret" && (
                  <p style={{ color: "var(--ai-text-2)", fontSize: 13 }}>Interpretando…</p>
                )}
              </div>

              <div className="adminIngreso__input-row">
                <textarea
                  className="adminIngreso__input"
                  rows={1}
                  placeholder={
                    ing.ready
                      ? "Listo para guardar o cotizar"
                      : "Escribí la respuesta del cliente…"
                  }
                  value={draft}
                  disabled={inputDisabled}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <button
                  type="button"
                  className="adminIngreso__btn adminIngreso__btn--secondary"
                  disabled={inputDisabled || !draft.trim()}
                  onClick={handleSend}
                >
                  Enviar
                </button>
              </div>

              <div className="adminIngreso__actions">
                <button
                  type="button"
                  className="adminIngreso__btn adminIngreso__btn--primary"
                  disabled={!ing.interpretation || ing.busy}
                  onClick={ing.writeToSheet}
                >
                  {ing.busy === "write" ? "Guardando…" : "Guardar en Admin"}
                </button>
                <button
                  type="button"
                  className="adminIngreso__btn adminIngreso__btn--ghost"
                  disabled={ing.inquiries.length < 2 || ing.busy}
                  onClick={ing.selectNext}
                >
                  Siguiente →
                </button>
                <Link
                  to={`/hub/cotizaciones${ing.selectedRow ? `?row=${ing.selectedRow}` : ""}`}
                  className="adminIngreso__btn adminIngreso__btn--ghost"
                  style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}
                >
                  Abrir en Cotizaciones ↗
                </Link>
              </div>
            </>
          )}
        </main>
      </div>

      {ing.toast && (
        <div className={`adminIngreso__toast adminIngreso__toast--${ing.toast.type}`}>
          {ing.toast.message}
        </div>
      )}
    </div>
  );
}