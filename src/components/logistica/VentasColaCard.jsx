/** Ventas queue: search + pre-identified groups by fecha de reparo. */
import { useMemo, useState } from "react";
import { ENV_T as T } from "../../utils/enviosTheme.js";
import {
  groupVentasRowsByFechaReparto,
  countFechaGroupBuckets,
  fechaGroupJumpTargets,
} from "../../utils/logistica/ventasFechaGroups.js";
import { originLabelForStop } from "../../utils/logistica/wizardState.js";
import {
  MONITOR_FILTERS,
  MONITOR_FILTER_LABELS,
  filterRowsByMonitor,
  listCoordinationExceptions,
  countMonitorLanes,
  monitorRowFromStop,
} from "../../utils/logistica/coordinationMonitor.js";

/**
 * @param {{
 *   search?: string,
 *   onSearchChange?: (v: string) => void,
 *   onBuscar?: () => void,
 *   onCargarActuales?: () => void,
 *   loadSh?: boolean,
 *   shErr?: string,
 *   autoLoadMsg?: string,
 *   ventasRowCount?: number,
 *   results?: object[],
 *   stops?: object[],
 *   activeReparto?: object|null,
 *   onAddResult?: (row: object) => void,
 *   addingKeys?: string[],
 *   onRemoveStop?: (id: string) => void,
 *   wizard?: object,
 *   places?: object[],
 * }} props
 */
export default function VentasColaCard({
  search = "",
  onSearchChange,
  onBuscar,
  onCargarActuales,
  loadSh = false,
  shErr = "",
  autoLoadMsg = "",
  ventasRowCount = 0,
  results = [],
  stops = [],
  activeReparto = null,
  onAddResult,
  addingKeys = [],
  onRemoveStop,
  wizard = {},
  places = [],
}) {
  const [monitorFilter, setMonitorFilter] = useState("all");
  const monitorSource = useMemo(() => {
    if (results.length) return results;
    return (stops || []).map(monitorRowFromStop);
  }, [results, stops]);
  const filteredResults = useMemo(
    () => filterRowsByMonitor(results, monitorFilter),
    [results, monitorFilter],
  );
  const laneCounts = useMemo(() => countMonitorLanes(monitorSource), [monitorSource]);
  const exceptionHits = useMemo(
    () => listCoordinationExceptions(monitorSource),
    [monitorSource],
  );
  const groups = useMemo(
    () => groupVentasRowsByFechaReparto(filteredResults),
    [filteredResults],
  );
  const buckets = useMemo(() => countFechaGroupBuckets(groups), [groups]);
  const jumps = useMemo(() => fechaGroupJumpTargets(groups), [groups]);

  const scrollTo = (key) => {
    if (!key) return;
    const el = document.getElementById(`envios-fecha-${key}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="envios-ventas-cola" data-testid="ventas-fecha-board">
      <div className="envios-ventas-cola__toolbar">
        <div className="envios-ventas-cola__title">Cola por fecha de entrega</div>
        <div className="envios-ventas-cola__search">
          <input
            id="log-ventas-search"
            name="log-ventas-search"
            aria-label="Buscar cliente"
            value={search}
            onChange={(e) => onSearchChange?.(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onBuscar?.()}
            placeholder="Nombre, pedido, tel, dirección..."
            className="envios-ventas-cola__q"
            style={inp}
          />
          <button type="button" onClick={onBuscar} disabled={loadSh} style={btnPrimary}>
            {loadSh ? "…" : "Buscar"}
          </button>
          <button
            type="button"
            className="envios-ventas-cola__cargar"
            onClick={onCargarActuales}
            disabled={loadSh}
            style={btnOutline}
          >
            Cargar actuales
          </button>
        </div>
        {ventasRowCount ? (
          <div className="envios-ventas-cola__meta">
            {results.length} operativos · {ventasRowCount} filas leídas
          </div>
        ) : null}
        {monitorSource.length ? (
          <div
            className="envios-ventas-cola__jumps"
            role="toolbar"
            aria-label="Filtro de coordinación"
            data-testid="coord-monitor-filters"
          >
            {MONITOR_FILTERS.map((id) => (
              <JumpChip
                key={id}
                label={MONITOR_FILTER_LABELS[id]}
                count={laneCounts[id] || 0}
                tone={monitorFilter === id ? "today" : "undated"}
                selected={monitorFilter === id}
                onClick={() => setMonitorFilter(id)}
              />
            ))}
          </div>
        ) : null}
        {exceptionHits.length ? (
          <div
            className="envios-ventas-cola__err"
            data-testid="coord-monitor-exceptions"
            style={{ marginTop: 6 }}
          >
            Excepciones ({exceptionHits.length}):{" "}
            {exceptionHits
              .slice(0, 8)
              .map((h) => {
                const name = h.row.nombre || h.row.orderId || "fila";
                const codes = h.exceptions.map((e) => e.label).join(", ");
                return `${name} · ${codes}`;
              })
              .join(" · ")}
            {exceptionHits.length > 8 ? ` · +${exceptionHits.length - 8}` : ""}
          </div>
        ) : null}
        {groups.length ? (
          <div className="envios-ventas-cola__jumps" role="navigation" aria-label="Saltar a fecha">
            <JumpChip
              label="Atrasados"
              count={buckets.overdue}
              tone="overdue"
              onClick={() => scrollTo(jumps.overdue)}
            />
            <JumpChip label="Hoy" count={buckets.today} tone="today" onClick={() => scrollTo(jumps.today)} />
            <JumpChip
              label="Próximos"
              count={buckets.upcoming}
              tone="upcoming"
              onClick={() => scrollTo(jumps.upcoming)}
            />
            <JumpChip
              label="Sin fecha"
              count={buckets.undated}
              tone="undated"
              onClick={() => scrollTo(jumps.undated)}
            />
          </div>
        ) : null}
        {shErr ? <div className="envios-ventas-cola__err">{shErr}</div> : null}
        {autoLoadMsg ? <div className="envios-ventas-cola__ok">{autoLoadMsg}</div> : null}
      </div>

      {!results.length ? (
        <div className="envios-ventas-cola__empty">
          {loadSh
            ? "Leyendo Ventas…"
            : "La cola se arma sola al abrir. Buscá o tocá Cargar actuales."}
        </div>
      ) : (
        <div className="envios-ventas-cola__groups">
          {groups.map((g) => (
            <section
              key={g.key}
              id={`envios-fecha-${g.key}`}
              className={`envios-fecha-group${g.overdue ? " is-overdue" : ""}${g.today ? " is-today" : ""}`}
            >
              <header className="envios-fecha-group__head">
                <span className="envios-fecha-group__label">{g.label}</span>
                <span className="envios-fecha-group__count">{g.count}</span>
              </header>
              <div className="envios-fecha-group__rows">
                {g.rows.map((r, i) => (
                  <VentasRowButton
                    key={`${r.orderId || r.nombre || "r"}-${r.ventasSheetRow1Based || i}`}
                    row={r}
                    stops={stops}
                    activeReparto={activeReparto}
                    onAddResult={onAddResult}
                    adding={addingKeys.includes(String(r.orderId || r.nombre || "").trim())}
                    onRemoveStop={onRemoveStop}
                    wizard={wizard}
                    places={places}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function JumpChip({ label, count, tone, onClick, selected = false }) {
  return (
    <button
      type="button"
      className={`envios-ventas-jump envios-ventas-jump--${tone}${count ? "" : " is-off"}${selected ? " is-on" : ""}`}
      onClick={onClick}
      aria-pressed={selected ? "true" : "false"}
      disabled={!count && !selected}
    >
      {label} <b>{count}</b>
    </button>
  );
}

function VentasRowButton({ row: r, stops, activeReparto, onAddResult, adding = false, onRemoveStop, wizard = {}, places = [] }) {
  const inReparto = stops.some(
    (s) =>
      (r.orderId && String(s.orderId) === String(r.orderId)) ||
      (r.nombre && String(s.cliente || "").toLowerCase() === String(r.nombre || "").toLowerCase()),
  );
  const hitStop = inReparto
    ? stops.find(
        (s) =>
          (r.orderId && String(s.orderId) === String(r.orderId)) ||
          (r.nombre && String(s.cliente || "").toLowerCase() === String(r.nombre || "").toLowerCase()),
      )
    : null;
  const originLabel = hitStop ? originLabelForStop(hitStop, wizard, places) : "";
  const chipColor = inReparto
    ? "#c2410c"
    : r.coordination?.status === "enviado"
      ? "#16a34a"
      : r.coordination?.status === "coordinado"
        ? r.coordinationColor || "#2563eb"
        : "#94a3b8";
  const chipBg = inReparto
    ? "#fff7ed"
    : r.coordination?.status === "enviado"
      ? "#dcfce7"
      : r.coordination?.status === "coordinado"
        ? "#eff6ff"
        : "#f1f5f9";
  const fecha = String(r.fechaEntrega || r.coordination?.coordDateIso || "").trim();
  const fechaShort = /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha.slice(8, 10) + "/" + fecha.slice(5, 7) : "";

  return (
    <button
      type="button"
      className={`envios-ventas-row${inReparto ? " is-in" : ""}${adding ? " is-adding" : ""}`}
      disabled={adding}
      onClick={() => {
        if (adding) return;
        if (inReparto) {
          const hit = stops.find(
            (s) =>
              (r.orderId && String(s.orderId) === String(r.orderId)) ||
              (r.nombre && String(s.cliente || "").toLowerCase() === String(r.nombre || "").toLowerCase()),
          );
          if (hit) onRemoveStop?.(hit.id);
          return;
        }
        onAddResult?.(r);
      }}
    >
      <div className="envios-ventas-row__main">
        <div className="envios-ventas-row__name">
          <span>{r.nombre || "—"}</span>
          {r.orderId || r.cotizacionId ? (
            <span className="envios-ventas-row__id">#{r.orderId || r.cotizacionId}</span>
          ) : null}
          {fechaShort ? <span className="envios-ventas-row__date">{fechaShort}</span> : null}
          <span
            className="envios-ventas-row__chip"
            style={{ color: chipColor, background: chipBg, borderColor: chipColor }}
          >
            {inReparto
              ? "En este reparto"
              : activeReparto?.status === "en_coordinacion" && stops.length
                ? "Por coordinar"
                : r.coordinationCaption || r.coordination?.label || "Por coordinar"}
          </span>
          {inReparto ? (
            <span className={`envios-origen-chip${originLabel ? "" : " is-missing"}`}>
              {originLabel || "Sin origen"}
            </span>
          ) : null}
        </div>
        <div className="envios-ventas-row__meta">
          {r.dir || "—"} · {r.tel || "—"}
        </div>
      </div>
      <span className={`envios-ventas-row__cta${inReparto ? " is-on" : ""}${adding ? " is-adding" : ""}`}>
        {adding ? "Sumando…" : inReparto ? "En el envío" : "+ Parada"}
      </span>
    </button>
  );
}

const inp = {
  flex: 1,
  minWidth: 140,
  padding: "10px 12px",
  borderRadius: 8,
  border: "1.5px solid #bfdbfe",
  fontSize: 16,
  fontFamily: "inherit",
  minHeight: 48,
  background: "#fff",
};

const btnPrimary = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "none",
  background: T.brand || "#2563eb",
  color: "#fff",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
  minHeight: 48,
  touchAction: "manipulation",
};

const btnOutline = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "1.5px solid #93c5fd",
  background: "#fff",
  color: "#1e40af",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
  minHeight: 48,
  touchAction: "manipulation",
};
