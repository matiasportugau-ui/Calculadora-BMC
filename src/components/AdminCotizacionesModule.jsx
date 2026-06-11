import { useCallback, useEffect, useState } from "react";
import { useAdminCotizaciones, ageDays } from "../hooks/useAdminCotizaciones.js";
import { getCalcApiBase } from "../utils/calcApiBase.js";
import { useTaskLists, useCreateTask } from "./hub/tasks/hooks/useTasks.js";
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

  // For direct task creation (A1 aggressive improvement)
  const taskListsQ = useTaskLists();
  const primaryListId = taskListsQ.data?.lists?.[0]?.id; // Use first list as default
  const createTaskMutation = useCreateTask(primaryListId);

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

  const onMoveStage = useCallback(async (row, newStage) => {
    await cot.moveLeadToStage(row, newStage);
  }, [cot]);

  const onRegenerateBorrador = useCallback(async (row) => {
    if (!confirm("¿Regenerar el borrador con IA usando el presupOrchestrator?")) return;
    await cot.regenerateBorrador(row);
  }, [cot]);

  // Quick "Crear Tarea de Seguimiento" - A1 aggressive: try direct creation first, excellent fallback
  const onCreateFollowupTask = useCallback(async (row) => {
    const title = `Seguimiento - ${row.cliente || row.telefono || "Lead"}`;

    const notes = [
      `**Consulta original:**`,
      row.consulta || "(sin consulta)",
      ``,
      `**Canal:** ${row.canal || row.origen || "N/D"}`,
      `**Zona:** ${row.zona || "N/D"}`,
      `**Responsable actual:** ${row.responsable || "Sin asignar"}`,
      ``,
      row.borradorPdf ? `**Borrador PDF:** ${row.borradorPdf}` : "",
      row.borradorExplicacion ? `**Explicación del Borrador:** ${row.borradorExplicacion}` : "",
      row.link ? `**Link presupuesto:** ${row.link}` : "",
      ``,
      `Fuente: Admin Cotizaciones`,
      `ID: ${row.id || row.rowNum || "?"}`,
    ].filter(Boolean).join("\n");

    const due = null; // We can add logic later for due date based on urgency

    // Try direct creation first (best UX when backend supports it)
    if (primaryListId && createTaskMutation) {
      try {
        await createTaskMutation.mutateAsync({ title, notes, due });
        showToast?.("Tarea de seguimiento creada correctamente");
        return;
      } catch (err) {
        // If it's the known 503 (sync not ready), fall back gracefully
        if (err?.code === "service_unavailable" || err?.status === 503) {
          // Fall through to excellent prefilled open
        } else {
          showToast?.("No se pudo crear la tarea directamente. Abriendo Tareas...");
        }
      }
    }

    // Excellent fallback: open Tareas with very rich prefill
    const params = new URLSearchParams({
      title,
      description: notes,
      source: "cotizacion",
      sourceId: String(row.id || row.rowNum || ""),
      priority: (ageDays(row.fecha) || 0) >= 5 ? "high" : "medium",
    }).toString();

    window.open(`/hub/tareas?${params}`, "_blank");
  }, [primaryListId, createTaskMutation]);

  // Keyboard shortcuts for aggressive power use (especially useful in Kanban + selection)
  useEffect(() => {
    const onKey = (e) => {
      if (!cot.selected.size) return;

      const key = e.key.toLowerCase();

      // Number keys 1-5 to bulk move selected to stages (when in any view)
      if (['1','2','3','4','5'].includes(key)) {
        const stageIndex = parseInt(key, 10) - 1;
        const targetStage = KANBAN_STAGES[stageIndex];
        if (targetStage) {
          e.preventDefault();
          const selectedRows = cot.filtered.filter(r => cot.selected.has(r.rowNum));
          selectedRows.forEach(r => cot.moveLeadToStage(r, targetStage));
          cot.clearSelection();
        }
      }

      // "t" to create task for all selected
      if (key === 't' && onCreateFollowupTask) {
        e.preventDefault();
        const selectedRows = cot.filtered.filter(r => cot.selected.has(r.rowNum));
        selectedRows.forEach(r => onCreateFollowupTask(r));
        cot.clearSelection();
      }

      // "r" to regenerate borrador for all selected (power move)
      if (key === 'r' && cot.regenerateBorrador) {
        e.preventDefault();
        const selectedRows = cot.filtered.filter(r => cot.selected.has(r.rowNum) && r.consulta);
        if (selectedRows.length > 0) {
          if (confirm(`¿Regenerar borrador para ${selectedRows.length} leads?`)) {
            selectedRows.forEach(r => cot.regenerateBorrador(r));
            cot.clearSelection();
          }
        }
      }
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [cot, onCreateFollowupTask]);

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
    <div className="adminCot" data-skin={skin} data-tutorial-id="admin-cot-module">
      <Topbar
        liveState={liveState}
        onOpenPalette={() => setPaletteOpen(true)}
        onChangeToken={() => setTokenPanelOpen(true)}
        onOpenLegacy={() => { window.location.assign("/hub/admin?legacy=1"); }}
      />

      {/* Quick access to interactive tutorial for this module (when Tutorial Mode is on) */}
      <div style={{ padding: '0 16px', marginTop: 8 }}>
        <button
          type="button"
          onClick={() => {
            // This will be picked up by the global tutorial system
            window.dispatchEvent(new CustomEvent('start-admin-cot-tutorial'));
          }}
          style={{
            fontSize: 12,
            padding: '4px 10px',
            borderRadius: 6,
            border: '1px solid #2563eb',
            background: '#eff6ff',
            color: '#1e40af',
            cursor: 'pointer',
          }}
        >
          🎓 Iniciar tutorial guiado de este módulo
        </button>
      </div>

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
              tokenInput={cot.tokenInput}
              setTokenInput={cot.setTokenInput}
              onSave={() => { cot.saveToken(); setTokenPanelOpen(false); }}
              onClear={cot.clearToken}
              isJwt={cot.isJwt}
              userEmail={cot.userEmail}
              onLogin={cot.login}
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
              onExportCsv={cot.downloadExportCsv}
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

            {/* Bulk Actions Bar - Aggressive Lead Management */}
            {cot.selected.size > 0 && (
              <div style={{ 
                background: "#f0f4ff", 
                border: "1px solid #0071e3", 
                borderRadius: 8, 
                padding: 10, 
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap"
              }}>
                <strong>{cot.selected.size} seleccionados</strong>

                <button 
                  onClick={() => {
                    const resp = prompt("Asignar a todos los seleccionados:");
                    if (resp) {
                      // Bulk assign (simplified for now - can be improved)
                      Array.from(cot.selected).forEach(rowNum => {
                        const r = cot.filtered.find(x => x.rowNum === rowNum);
                        if (r) cot.assignTo(r, resp.trim());
                      });
                      cot.clearSelection();
                    }
                  }}
                  className="adminCot__btn adminCot__btn--sm"
                >
                  Asignar a todos
                </button>

                <select 
                  onChange={async (e) => {
                    const stage = e.target.value;
                    if (!stage) return;
                    const rowsToMove = cot.filtered.filter(r => cot.selected.has(r.rowNum));
                    for (const r of rowsToMove) {
                      await cot.moveLeadToStage(r, stage);
                    }
                    cot.clearSelection();
                  }}
                  className="adminCot__input"
                  style={{ width: "auto", minWidth: 140 }}
                  defaultValue=""
                >
                  <option value="">Mover a etapa...</option>
                  {KANBAN_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>

                <button 
                  onClick={() => cot.clearSelection()} 
                  className="adminCot__btn adminCot__btn--sm adminCot__btn--ghost"
                >
                  Limpiar selección
                </button>

                {onCreateFollowupTask && (
                  <button 
                    onClick={async () => {
                      const selectedRows = cot.filtered.filter(r => cot.selected.has(r.rowNum));
                      for (const r of selectedRows) {
                        await onCreateFollowupTask(r); // now supports async direct creation
                      }
                      cot.clearSelection();
                    }} 
                    className="adminCot__btn adminCot__btn--sm"
                    style={{ background: "#e0f2fe", color: "#0369a1" }}
                    disabled={createTaskMutation?.isPending}
                  >
                    + Crear Tarea para los {cot.selected.size}
                  </button>
                )}

                {/* Bulk Regenerar Borrador - aggressive power move */}
                {cot.regenerateBorrador && (
                  <button 
                    onClick={() => {
                      if (!confirm(`¿Regenerar borrador con IA para los ${cot.selected.size} leads seleccionados? Esto puede tardar.`)) return;
                      const selectedRows = cot.filtered.filter(r => cot.selected.has(r.rowNum));
                      selectedRows.forEach(r => {
                        if (r.consulta) cot.regenerateBorrador(r);
                      });
                      cot.clearSelection();
                    }} 
                    className="adminCot__btn adminCot__btn--sm"
                    style={{ background: "#fee2e2", color: "#991b1b" }}
                  >
                    ↻ Regenerar Borrador ({cot.selected.size})
                  </button>
                )}
              </div>
            )}

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
                onCreateFollowupTask={onCreateFollowupTask}
                loading={cot.loading}
                emptyMessage={emptyMsg}
              />
            ) : (
              /* Proper Kanban board - Tanda 1 (stage columns with urgency + quick moves) */
              <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 20 }}>
                {KANBAN_STAGES.map((stage) => {
                  const stageRows = getKanbanRows(stage);
                  return (
                    <div key={stage} style={{ minWidth: 260, background: "#f8f8f8", borderRadius: 8, padding: 8, border: "1px solid #eee" }}>
                      <div style={{ fontWeight: 600, marginBottom: 8, paddingBottom: 4, borderBottom: "1px solid #ddd", display: "flex", justifyContent: "space-between" }}>
                        <span>{stage}</span>
                        <span style={{ fontSize: 12, color: "#666" }}>{stageRows.length}</span>
                      </div>
                      {stageRows.length === 0 && (
                        <div style={{ 
                          fontSize: 12, 
                          color: "#999", 
                          padding: 12, 
                          textAlign: "center",
                          background: "#fff",
                          borderRadius: 6,
                          border: "1px dashed #ddd"
                        }}>
                          Sin leads en esta etapa
                        </div>
                      )}
                      {stageRows.map(row => {
                        const age = ageDays(row.fecha);
                        const isUrgent = age != null && age >= 7;
                        return (
                          <div 
                            key={row.rowNum || row.id} 
                            style={{ 
                              background: "white", 
                              padding: 8, 
                              marginBottom: 6, 
                              borderRadius: 6, 
                              fontSize: 13, 
                              cursor: "pointer", 
                              border: isUrgent ? "2px solid #ef4444" : "1px solid #eee" 
                            }}
                            onClick={() => setDetail(row)}
                          >
                            <div style={{ fontWeight: 600, display: "flex", justifyContent: "space-between" }}>
                              <span>{row.cliente || "Sin nombre"}</span>
                              {isUrgent && <span style={{ color: "#ef4444", fontSize: 10 }}>⚠ {age}d</span>}
                            </div>
                            <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{(row.consulta || "").slice(0, 70)}...</div>
                            <div style={{ marginTop: 4, fontSize: 11, display: "flex", justifyContent: "space-between" }}>
                              <span style={{ color: "#0071e3" }}>{row.responsable || "Sin asignar"}</span>
                              {row.telefono && <span style={{ fontSize: 10 }}>{row.telefono}</span>}
                            </div>

                            {/* Quick stage moves */}
                            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
                              {KANBAN_STAGES.filter(s => s !== stage).slice(0, 3).map(targetStage => (
                                <button
                                  key={targetStage}
                                  onClick={(e) => { e.stopPropagation(); onMoveStage(row, targetStage); }}
                                  style={{
                                    fontSize: 10,
                                    padding: "2px 6px",
                                    border: "1px solid #ddd",
                                    borderRadius: 4,
                                    background: "#f8f8f8",
                                    cursor: "pointer"
                                  }}
                                  title={`Mover a ${targetStage}`}
                                >
                                  → {targetStage}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
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
          onOpenBorrador={onOpenBorrador}
          busyOp={cot.busyOp}
          waToken={cot.token}
          waApiBase={getCalcApiBase()}
          onAssign={onAssign}
          onOpenBorrador={onOpenBorrador}
          onRegenerateBorrador={onRegenerateBorrador}
          onCreateFollowupTask={onCreateFollowupTask}
        />
      )}

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onRefresh={cot.load}
        onRunBatch={() => cot.runBatch()}
        onRunSync={cot.runSync}
        onExport={() => cot.downloadExportCsv()}
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
