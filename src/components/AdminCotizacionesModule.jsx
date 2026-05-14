import { useCallback, useEffect, useState } from "react";
import { useAdminCotizaciones } from "../hooks/useAdminCotizaciones.js";
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

function ModuleInner() {
  const { skin } = useSkin();
  const cot = useAdminCotizaciones();

  const [tokenPanelOpen, setTokenPanelOpen] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [detail, setDetail] = useState(null);

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
        onOpenLegacy={() => { window.location.assign("/hub/admin"); }}
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
              exportCsvHref={cot.exportCsvUrl()}
              batchOpts={cot.batchOpts}
              onResetBatchOpts={cot.resetBatchOpts}
              onMarkSelectedEnviados={onMarkSelectedEnviados}
            />

            {cot.error && (
              <div className="adminCot__card" style={{ borderColor: "var(--ac-error)", color: "var(--ac-error)" }}>
                {cot.error}
              </div>
            )}

            <QuotesTable
              rows={cot.filtered}
              selected={cot.selected}
              onToggleSelect={cot.toggleSelect}
              onToggleSelectAll={cot.toggleSelectAll}
              onEdit={(row) => setDetail(row)}
              onMarkEnviado={onMarkEnviadoSingle}
              onApprove={(row) => cot.approve(row.rowNum)}
              onOpenPdf={(row) => row.link && window.open(row.link, "_blank", "noopener,noreferrer")}
              onOpenReplay={(row) => row.replaySnapshotUrl && window.open(row.replaySnapshotUrl, "_blank", "noopener,noreferrer")}
              onOpenSheet={(row) => row.sheetUrl && window.open(row.sheetUrl, "_blank", "noopener,noreferrer")}
              loading={cot.loading}
              emptyMessage={emptyMsg}
            />

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
          busyOp={cot.busyOp}
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
        onOpenLegacy={() => { window.location.assign("/hub/admin"); }}
      />

      {cot.toast && <div className="adminCot__toast" role="status">{cot.toast}</div>}
    </div>
  );
}

export default function AdminCotizacionesModule() {
  return (
    <SkinProvider>
      <ModuleInner />
    </SkinProvider>
  );
}
