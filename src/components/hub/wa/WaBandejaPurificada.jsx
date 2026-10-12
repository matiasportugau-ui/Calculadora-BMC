/**
 * Bandeja WA gemela de Administración de Cotizaciones.
 * Misma fila, mismos criterios. Canal filtrado a WhatsApp.
 * Antigüedad = días desde Fecha (B). Alerta = reloj de abandono. Prioridad = Urgencia (S) o derivada.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { isWaCanal, useAdminCotizaciones } from "../../../hooks/useAdminCotizaciones.js";
import { getCalcApiBase } from "../../../utils/calcApiBase.js";
import CockpitTokenPanel from "../../CockpitTokenPanel.jsx";
import { SkinProvider, useSkin } from "../../admin-cotizaciones/SkinProvider.jsx";
import QuotesTable from "../../admin-cotizaciones/QuotesTable.jsx";
import DetailDrawer from "../../admin-cotizaciones/DetailDrawer.jsx";
import "../../admin-cotizaciones/styles.css";

function Inner() {
  const { skin } = useSkin();
  const cot = useAdminCotizaciones();
  const [tokenPanelOpen, setTokenPanelOpen] = useState(false);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    if (!cot.token && !cot.tokenAutoLoaded) setTokenPanelOpen(true);
  }, [cot.token, cot.tokenAutoLoaded]);

  const waRows = useMemo(
    () => (cot.filtered || []).filter((r) => isWaCanal(r.origen || r.canal)),
    [cot.filtered],
  );

  const toggleSelectAllWa = useCallback(() => {
    const nums = waRows.map((r) => r.rowNum).filter((n) => n != null);
    cot.setSelected?.((prev) => {
      const all = nums.length > 0 && nums.every((n) => prev.has(n));
      return all ? new Set() : new Set(nums);
    });
  }, [cot, waRows]);

  const onMarkEnviadoSingle = useCallback((row) => {
    if (!window.confirm(`¿Mover fila ${row.rowNum} a Enviados? Se borra del Admin.`)) return;
    cot.markEnviado(row.rowNum);
    if (detail?.rowNum === row.rowNum) setDetail(null);
  }, [cot, detail]);

  const onQuickAssign = useCallback((row) => {
    const next = prompt("Asignar a (nombre o código):", row.responsable || "");
    if (next !== null) cot.assignTo(row, next.trim());
  }, [cot]);

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

  return (
    <div className="adminCot" data-skin={skin} style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <header className="adminCot__card" style={{ margin: 16, marginBottom: 0 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 650 }}>Bandeja WhatsApp</h1>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--ac-text-2)", lineHeight: 1.45 }}>
          Gemela de Administración de Cotizaciones. Una fila por consulta, no el chat.
          Alerta = abandono (7d / 14d). Prioridad = urgencia de la planilla. Antigüedad = días desde la fecha.
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" className="adminCot__btn adminCot__btn--sm" onClick={() => cot.load()} disabled={cot.loading}>
            Actualizar
          </button>
          <Link to="/hub/cotizaciones" className="adminCot__btn adminCot__btn--sm adminCot__btn--ghost">
            Abrir planilla Admin
          </Link>
          <span style={{ fontSize: 12, color: "var(--ac-text-2)" }}>
            {waRows.length} consulta{waRows.length === 1 ? "" : "s"} WA
          </span>
        </div>
      </header>

      {tokenPanelOpen && (
        <div className="adminCot__card" style={{ margin: 16 }}>
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
          />
        </div>
      )}

      {cot.error ? (
        <div className="adminCot__card" style={{ margin: 16, borderColor: "var(--ac-error)" }}>
          {cot.error}
        </div>
      ) : null}

      <div style={{ flex: 1, minHeight: 0, margin: 16, marginTop: 12 }}>
        <QuotesTable
          rows={waRows}
          selected={cot.selected}
          onToggleSelect={cot.toggleSelect}
          onToggleSelectAll={toggleSelectAllWa}
          onEdit={(row) => setDetail(row)}
          onMarkEnviado={onMarkEnviadoSingle}
          onApprove={(row) => cot.approve(row.rowNum)}
          onOpenPdf={(row) => row.link && window.open(row.link, "_blank", "noopener,noreferrer")}
          onOpenReplay={(row) => row.replaySnapshotUrl && window.open(row.replaySnapshotUrl, "_blank", "noopener,noreferrer")}
          onOpenSheet={(row) => row.sheetUrl && window.open(row.sheetUrl, "_blank", "noopener,noreferrer")}
          onOpenBorrador={(row) => cot.openBorrador(row)}
          onQuickAssign={onQuickAssign}
          loading={cot.loading}
          emptyMessage="No hay consultas WhatsApp en la planilla. El chat crudo no entra acá."
        />
      </div>

      {detail ? (
        <DetailDrawer
          row={detail}
          onClose={() => setDetail(null)}
          onSave={onSaveDetail}
          onApprove={onApproveDetail}
          onMarkEnviado={onMarkEnviadoDetail}
          onRequestSuggestion={cot.requestSuggestion}
          onOpenBorrador={(row) => cot.openBorrador(row)}
          busyOp={cot.busyOp}
          waToken={cot.token}
          waApiBase={getCalcApiBase()}
        />
      ) : null}
    </div>
  );
}

export default function WaBandejaPurificada() {
  return (
    <SkinProvider>
      <Inner />
    </SkinProvider>
  );
}
