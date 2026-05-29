import { useCallback, useEffect, useState } from "react";
import { useAdminCotizaciones, ageDays } from "../hooks/useAdminCotizaciones.js";
import { getCalcApiBase } from "../utils/calcApiBase.js";
import { getStoredPanelinRole } from "../hooks/useAdminCotizaciones.js"; // if not exported, we'll move logic inside
import CockpitTokenPanel from "./CockpitTokenPanel.jsx";
import { SkinProvider, useSkin } from "./admin-cotizaciones/SkinProvider.jsx";
import Topbar from "./admin-cotizaciones/Topbar.jsx";
import StatStrip from "./admin-cotizaciones/StatStrip.jsx";
import Toolbar from "./admin-cotizaciones/Toolbar.jsx";
import QuotesTable from "./admin-cotizaciones/QuotesTable.jsx";
import QuoteCard from "./admin-cotizaciones/QuoteCard.jsx";
import DetailDrawer from "./admin-cotizaciones/DetailDrawer.jsx";
import CommandPalette from "./admin-cotizaciones/CommandPalette.jsx";
import "./admin-cotizaciones/styles.css";
import { HelpProvider } from "./help/HelpProvider.jsx";
import Callout from "./help/Callout.jsx";
import "./help/styles.css";
// Build-time import — Vite inlines this JSON at build, so consumers never
// hit FALLBACK_SOURCE in prod. The walkthrough script regenerates this file
// on each run (drafts/03-walkthrough-strategy-proposal.md § B Alt-3).
import walkthroughSource from "../../docs/walkthrough/admin-cot/source.json";

function ModuleInner() {
  const { skin } = useSkin();
  const cot = useAdminCotizaciones();

  const [tokenPanelOpen, setTokenPanelOpen] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [detail, setDetail] = useState(null);

  // Tanda 1 - Saved Views (best practice for lead management)
  const currentRole = (typeof window !== "undefined" ? localStorage.getItem("bmc_panelin_role") : "") || "";

  const SAVED_VIEWS = {
    todas: { label: "Todas", filter: () => true },
    misLeads: { 
      label: "Mis Leads", 
      filter: (r) => {
        const resp = (r.responsable || "").toLowerCase();
        return resp === currentRole.toLowerCase() || resp.includes(currentRole.toLowerCase()) || resp.includes("yo");
      } 
    },
    urgentes: { 
      label: "Urgentes (7d+)", 
      filter: (r) => {
        const age = ageDays(r.fecha);
        return age != null && age >= 7 && !String(r.estado || "").toLowerCase().includes("enviado");
      }
    },
    sinMovimiento: { 
      label: "Sin movimiento 5d+", 
      filter: (r) => {
        const age = ageDays(r.fecha);
        return age != null && age >= 5 && !String(r.estado || "").toLowerCase().includes("enviado");
      }
    },
    borrador: { label: "En Borrador", filter: (r) => String(r.estado || "").toLowerCase().includes("borrador") },
    revision: { label: "En Revisión", filter: (r) => String(r.estado || "").toLowerCase().includes("revis") },
  };

  const [activeSavedView, setActiveSavedView] = useState("todas");
  const [viewMode, setViewMode] = useState("table"); // "table" | "kanban"

  const displayedRows = (() => {
    const base = cot.filtered;
    const view = SAVED_VIEWS[activeSavedView] || SAVED_VIEWS.todas;
    return base.filter(view.filter);
  })();

  // Basic Kanban stages for best practices (aligned with hybrid model)
  const KANBAN_STAGES = ["Pendiente", "Borrador", "En Revisión", "Aprobado", "Enviado"];

  const getKanbanRows = (stage) => {
    return displayedRows.filter(r => {
      const e = String(r.estado || "Pendiente").toLowerCase();
      if (stage === "Pendiente") return !e.includes("borrador") && !e.includes("revis") && !e.includes("aprobado") && !e.includes("enviado");
      if (stage === "Borrador") return e.includes("borrador");
      if (stage === "En Revisión") return e.includes("revis");
      if (stage === "Aprobado") return e.includes("aprobado") && !e.includes("enviado");
      if (stage === "Enviado") return e.includes("enviado");
      return false;
    });
  };

  // If we still don't have a token after auto-load, show the panel by default.
  useEffect(() => {
    if (!cot.token && !cot.tokenAutoLoaded) setTokenPanelOpen(true);
  }, [cot.token, cot.tokenAutoLoaded]);

  // Keep input in sync with the loaded token (so "Cambiar token" pre-fills it).
  useEffect(() => { setTokenInput(cot.token); }, [cot.token]);

  // ⌘K to open palette, R for refresh (when no input focused).
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || "").toLowerCase();
      const editable = tag === "input" || tag === "textarea" || e.target?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (!editable && (e.key === "r" || e.key === "R")) {
        e.preventDefault();
        cot.load();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [cot]);

  const onMarkSelectedEnviados = useCallback(async () => {
    if (cot.selected.size === 0) return;
    const ids = Array.from(cot.selected).sort((a, b) => b - a); // desc → row indices stable
    if (!window.confirm(`¿Marcar ${ids.length} fila(s) como enviadas? Se borran del Admin. No se puede deshacer.`)) return;
    await cot.markEnviadoSeries(ids);
  }, [cot]);

  const onMarkEnviadoSingle = useCallback((row) => {
    if (!window.confirm(`¿Mover fila ${row.rowNum} a Enviados? Se borra del Admin.`)) return;
    cot.markEnviado(row.rowNum);
    if (detail?.rowNum === row.rowNum) setDetail(null);
  }, [cot, detail]);

  const onSaveDetail = useCallback(async (adminRow, patch) => {
    const { ok } = await cot.saveRow(adminRow, patch);
    if (ok) setDetail(null);
  }, [cot]);

  const onApproveDetail = useCallback(async (adminRow) => {
    const { ok } = await cot.approve(adminRow);
    if (ok) setDetail(null);
  }, [cot]);

  // Tanda 1 - Aggressive additions for best practices
  const onAssign = useCallback(async (row, responsable) => {
    await cot.assignTo(row, responsable);
  }, [cot]);

  const onOpenBorrador = useCallback((row) => {
    cot.openBorrador(row);
  }, [cot]);

  const onQuickAssign = useCallback((row) => {
    const newResp = prompt("Asignar a (nombre o código):", row.responsable || "");
    if (newResp !== null) {
      cot.assignTo(row, newResp.trim());
    }
  }, [cot]);

  const onMarkEnviadoDetail = useCallback(async (adminRow) => {
    if (!window.confirm(`¿Mover fila ${adminRow} a Enviados? Se borra del Admin.`)) return;
    const { ok } = await cot.markEnviado(adminRow);
    if (ok) setDetail(null);
  }, [cot]);

  const liveState = cot.error
    ? "error"
    : (cot.loading || cot.busyOp ? "busy" : "ok");

  const emptyMsg = cot.scope === "admin"
    ? "Sin filas con datos en el rango leído (A2:M)."
    : "Sin consultas pendientes (col I). Probá «Toda la planilla».";

  return (
    <div className="adminCot" data-skin={skin}>
      <Topbar
        liveState={liveState}
        onOpenPalette={() => setPaletteOpen(true)}
        onChangeToken={() => setTokenPanelOpen(true)}
        onOpenLegacy={() => { window.location.assign("/hub/admin?legacy=1"); }}
      />

      <main className="adminCot__shell">
        {!cot.token && cot.tokenLoadError && (
          <div className="adminCot__card" style={{ borderColor: "var(--ac-warn)", marginTop: 16 }}>
            <strong>{cot.tokenLoadError}</strong>
          </div>
        )}

        {tokenPanelOpen && (
          <div className="adminCot__card" style={{ marginTop: 16 }}>
            <CockpitTokenPanel
              tokenAutoLoaded={cot.tokenAutoLoaded}
              tokenLoadError={cot.tokenLoadError}
              tokenInput={tokenInput}
              setTokenInput={setTokenInput}
              onSave={() => { cot.saveToken(tokenInput); setTokenPanelOpen(false); }}
              onClear={() => { cot.clearToken(); setTokenInput(""); }}
              inputStyle={{
                width: "100%",
                maxWidth: 380,
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid var(--ac-border)",
                fontFamily: "var(--ac-font-mono)",
                fontSize: 13,
                boxSizing: "border-box",
              }}
              btnPrimaryStyle={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid var(--ac-accent)",
                background: "var(--ac-accent)",
                color: "var(--ac-accent-fg)",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
              }}
              btnGhostStyle={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid var(--ac-border)",
                background: "var(--ac-surface)",
                color: "var(--ac-text)",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
              }}
            />
            <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="adminCot__btn adminCot__btn--ghost adminCot__btn--sm"
                onClick={() => setTokenPanelOpen(false)}
              >
                Cerrar panel
              </button>
            </div>
          </div>
        )}

        {cot.token && (
          <>
            <Callout id="drawer-regenerate-hint" variant="info" dismissible />
            <StatStrip stats={cot.stats} />

            <Toolbar
              scope={cot.scope}
              setScope={cot.setScope}
              statusFilter={cot.statusFilter}
              setStatusFilter={cot.setStatusFilter}
              search={cot.search}
              setSearch={cot.setSearch}
              selectedCount={cot.selected.size}
              loading={cot.loading}
              busyOp={cot.busyOp}
              rowCount={cot.filtered.length}
              sheetRowCount={cot.sheetRowCount}
              onRefresh={cot.load}
              onRunSync={cot.runSync}
              onRunBatch={(opts) => cot.runBatch(opts)}
              onCreateRow={cot.createRow}
              exportCsvHref={cot.exportCsvUrl()}
              batchOpts={cot.batchOpts}
              updateBatchOpts={cot.updateBatchOpts}
              onResetBatchOpts={cot.resetBatchOpts}
              onMarkSelectedEnviados={onMarkSelectedEnviados}
            />

            {cot.error && (
              <div className="adminCot__card" style={{ borderColor: "var(--ac-error)", color: "var(--ac-error)" }}>
                {cot.error}
              </div>
            )}

            {/* Saved Views + View Mode - Tanda 1 Aggressive */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
              <div style={{ display: "flex", gap: 4 }}>
                {Object.keys(SAVED_VIEWS).map((key) => (
                  <button
                    key={key}
                    onClick={() => setActiveSavedView(key)}
                    className="adminCot__btn adminCot__btn--sm"
                    style={{
                      background: activeSavedView === key ? "#0071e3" : "#fff",
                      color: activeSavedView === key ? "#fff" : "#1d1d1f",
                      border: activeSavedView === key ? "none" : "1.5px solid #e5e5ea",
                    }}
                  >
                    {SAVED_VIEWS[key].label}
                  </button>
                ))}
              </div>

              <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                <button 
                  onClick={() => setViewMode("table")} 
                  className="adminCot__btn adminCot__btn--sm"
                  style={{ background: viewMode === "table" ? "#111" : "#fff", color: viewMode === "table" ? "#fff" : "#000" }}
                >
                  Tabla
                </button>
                <button 
                  onClick={() => setViewMode("kanban")} 
                  className="adminCot__btn adminCot__btn--sm"
                  style={{ background: viewMode === "kanban" ? "#111" : "#fff", color: viewMode === "kanban" ? "#fff" : "#000" }}
                >
                  Kanban
                </button>
              </div>
            </div>

            {viewMode === "table" ? (
              <QuotesTable
                rows={displayedRows}
                selected={cot.selected}
                onToggleSelect={cot.toggleSelect}
                onToggleSelectAll={cot.toggleSelectAll}
                onEdit={(row) => setDetail(row)}
                onMarkEnviado={onMarkEnviadoSingle}
                onApprove={(row) => cot.approve(row.rowNum)}
                onOpenPdf={(row) => row.link && window.open(row.link, "_blank", "noopener,noreferrer")}
                onOpenReplay={(row) => row.replaySnapshotUrl && window.open(row.replaySnapshotUrl, "_blank", "noopener,noreferrer")}
                onOpenSheet={(row) => row.sheetUrl && window.open(row.sheetUrl, "_blank", "noopener,noreferrer")}
                onAssign={onAssign}
                onOpenBorrador={onOpenBorrador}
                onQuickAssign={onQuickAssign}
                loading={cot.loading}
                emptyMessage={emptyMsg}
              />
            ) : (
              /* Basic Kanban - Tanda 1 Aggressive */
              <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 20 }}>
                {KANBAN_STAGES.map((stage) => {
                  const stageRows = getKanbanRows(stage);
                  return (
                    <div key={stage} style={{ minWidth: 260, background: "#f8f8f8", borderRadius: 8, padding: 8, border: "1px solid #eee" }}>
                      <div style={{ fontWeight: 600, marginBottom: 8, paddingBottom: 4, borderBottom: "1px solid #ddd", display: "flex", justifyContent: "space-between" }}>
                        <span>{stage}</span>
                        <span style={{ fontSize: 12, color: "#666" }}>{stageRows.length}</span>
                      </div>
                      {stageRows.length === 0 && <div style={{ fontSize: 12, color: "#999", padding: 8 }}>Sin leads</div>}
                      {stageRows.map(row => (
                        <div 
                          key={row.rowNum || row.id} 
                          style={{ background: "white", padding: 8, marginBottom: 6, borderRadius: 6, fontSize: 13, cursor: "pointer", border: "1px solid #eee" }}
                          onClick={() => setDetail(row)}
                        >
                          <div style={{ fontWeight: 600 }}>{row.cliente || "Sin nombre"}</div>
                          <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{(row.consulta || "").slice(0, 70)}...</div>
                          <div style={{ marginTop: 6, fontSize: 11 }}>
                            <span style={{ color: "#0071e3" }}>{row.responsable || "Sin asignar"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="adminCot__cards" style={{ marginTop: 12 }}>
              {cot.filtered.length === 0 && !cot.loading && (
                <div className="adminCot__qcard" style={{ textAlign: "center", color: "var(--ac-text-2)" }}>
                  {emptyMsg}
                </div>
              )}
              {cot.filtered.map((row) => (
                <QuoteCard
                  key={row.rowNum}
                  row={row}
                  selected={cot.selected.has(row.rowNum)}
                  onToggleSelect={cot.toggleSelect}
                  onEdit={(r) => setDetail(r)}
                  onMarkEnviado={onMarkEnviadoSingle}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {detail && (
        <DetailDrawer
          row={detail}
          onClose={() => setDetail(null)}
          onSave={onSaveDetail}
          onApprove={onApproveDetail}
          onMarkEnviado={onMarkEnviadoDetail}
          onRequestSuggestion={cot.requestSuggestion}
          busyOp={cot.busyOp}
          waToken={cot.token}
          waApiBase={getCalcApiBase()}
        />
      )}

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onRefresh={cot.load}
        onRunBatch={() => cot.runBatch()}
        onRunSync={cot.runSync}
        onExport={() => window.open(cot.exportCsvUrl(), "_blank", "noopener,noreferrer")}
        onChangeToken={() => setTokenPanelOpen(true)}
        onOpenLegacy={() => { window.location.assign("/hub/admin?legacy=1"); }}
      />

      {cot.toast && <div className="adminCot__toast" role="status">{cot.toast}</div>}
    </div>
  );
}

export default function AdminCotizacionesModule() {
  return (
    <SkinProvider>
      <HelpProvider source={walkthroughSource}>
        <ModuleInner />
      </HelpProvider>
    </SkinProvider>
  );
}
