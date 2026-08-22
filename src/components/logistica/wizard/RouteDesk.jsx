/**
 * P0 dispatch desk for wizard step 4 — itinerary + Leaflet + faltas.
 * Pointer-events reorder (touch / trackpad / mouse) — not HTML5 DnD only.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ENV_T as T } from "../../../utils/enviosTheme.js";
import { googleMapsDirectionsUrl, routeToShareText, legsWithGeo } from "../../../utils/logistica/routeExport.js";
import { billableRoute } from "../../../utils/logistica/quoteWindow.js";
import { safeHttpUrl } from "../../../utils/logistica/safeExternalUrl.js";
import { buildRutaFaltas } from "../../../utils/logistica/rutaFaltas.js";
import {
  isPlantPickupStop,
  isDepotPickupStop,
  isOffTruckDelivery,
  normalizeEntregaModo,
  BMC_DEPO,
} from "../../../utils/logistica/uyGazetteer.js";
import { pickupIdForStop } from "../../../utils/logistica/wizardState.js";
import {
  listCoordinationExceptions,
  monitorRowFromStop,
} from "../../../utils/logistica/coordinationMonitor.js";
import { reorderRouteLegs } from "../../../utils/logistica/routeSuggest.js";
import RouteLeafletMap from "./RouteLeafletMap.jsx";
import "../../../styles/ruta-desk.css";

const TYPE_ES = { base: "Salida", pickup: "Levante", delivery: "Entrega", depot: "BMC URUGUAY" };
const TYPE_COLOR = { base: "#1a3a5c", pickup: "#ff9f0a", delivery: "#0071e3", depot: "#0f766e" };

const ENTREGA_MODO_OPTIONS = [
  { id: "planta", label: "Retiran en planta" },
  { id: "depo", label: "A depósito" },
  { id: "obra", label: "Entrega destino" },
];

export default function RouteDesk({
  route,
  routeStale,
  info = {},
  stops = [],
  wizard = {},
  truckL,
  recalculating = false,
  onRecalcular,
  onReorderRoute,
  onEntregaModo,
  onGotoStep,
  hideMap = false,
  places = [],
}) {
  const legs = useMemo(() => route?.orderedLegs || [], [route?.orderedLegs]);
  const [selectedRefId, setSelectedRefId] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const listRef = useRef(null);
  const dragRef = useRef(null);
  const [dragActive, setDragActive] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  const findIndexAtPoint = useCallback((clientX, clientY) => {
    const el = document.elementFromPoint(clientX, clientY);
    if (!el || !listRef.current?.contains(el)) return null;
    const row = el.closest?.("[data-leg-index]");
    if (!row) return null;
    const n = Number(row.getAttribute("data-leg-index"));
    return Number.isFinite(n) ? n : null;
  }, []);

  const endPointerDrag = useCallback(
    (e) => {
      const d = dragRef.current;
      if (!d) return;
      try {
        d.handle?.releasePointerCapture?.(d.pointerId);
      } catch {
        /* ignore */
      }
      const from = d.fromIndex;
      const to = findIndexAtPoint(e?.clientX ?? 0, e?.clientY ?? 0);
      dragRef.current = null;
      setDragActive(null);
      setDragOver(null);
      if (from == null || to == null || from === to) return;
      onReorderRoute?.(reorderRouteLegs(legs, from, to));
    },
    [findIndexAtPoint, legs, onReorderRoute],
  );

  const onHandlePointerDown = useCallback((e, index) => {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget;
    try {
      handle.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    dragRef.current = { pointerId: e.pointerId, fromIndex: index, handle, startY: e.clientY };
    setDragActive(index);
    setDragOver(index);
  }, []);

  const onHandlePointerMove = useCallback(
    (e) => {
      const d = dragRef.current;
      if (!d || d.pointerId !== e.pointerId) return;
      e.preventDefault();
      const to = findIndexAtPoint(e.clientX, e.clientY);
      if (to != null) setDragOver(to);
    },
    [findIndexAtPoint],
  );

  const onHandlePointerUp = useCallback(
    (e) => {
      const d = dragRef.current;
      if (!d || d.pointerId !== e.pointerId) return;
      e.preventDefault();
      endPointerDrag(e);
    },
    [endPointerDrag],
  );

  useEffect(() => {
    const onUp = (e) => {
      if (dragRef.current) endPointerDrag(e);
    };
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [endPointerDrag]);

  const billed = useMemo(() => billableRoute(route, { info }), [route, info]);
  const mapsUrl = useMemo(
    () => safeHttpUrl(googleMapsDirectionsUrl(info.tercerizado ? billed.orderedLegs : legs)) || "",
    [info.tercerizado, billed.orderedLegs, legs],
  );
  const geoCount = useMemo(() => legsWithGeo(legs).length, [legs]);
  const shareText = useMemo(
    () =>
      legs.length
        ? routeToShareText(route, {
            title: "Ruta BMC Envíos",
            info: {
              numero: info.numero,
              fecha: info.fecha,
              transportista: info.transportista,
              patente: info.patente,
              tercerizado: info.tercerizado,
              quoteStart: info.quoteStart,
            },
          })
        : "",
    [route, legs.length, info.numero, info.fecha, info.transportista, info.patente, info.tercerizado, info.quoteStart],
  );
  const faltas = useMemo(
    () => buildRutaFaltas({ stops, info, route, wizard: { ...wizard, routeStale } }),
    [stops, info, route, wizard, routeStale],
  );
  const coordExceptions = useMemo(
    () => listCoordinationExceptions(stops.map(monitorRowFromStop)),
    [stops],
  );

  const openMaps = () => mapsUrl && window.open(mapsUrl, "_blank", "noopener,noreferrer");
  const openWa = () => {
    if (!shareText) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="ruta-desk" data-testid="ruta-desk">
      <div className="ruta-desk-bar">
        <div>
          <h2>Mesa de ruta</h2>
          <div className="ruta-desk-kpis">
            <span>
              <strong>{info.numero || "—"}</strong> · {info.fecha || "—"} · camión {truckL || "—"} m
            </span>
            <span>
              {legs.length} tramos · {geoCount} con pin
              {route?.totalKm != null
                ? ` · ~${Number(route.totalKm).toFixed(0)} km ${route?.suggestionSource === "osrm" ? "ruta" : "aire"}`
                : ""}
            </span>
            {info.tercerizado && billed.totalKm != null ? (
              <span>
                Cotizable {info.transportista || "tercerizado"} ~{Number(billed.totalKm).toFixed(0)} km desde fábrica
              </span>
            ) : null}
          </div>
        </div>
        <div className="ruta-desk-actions">
          <button type="button" onClick={onRecalcular} disabled={recalculating} style={btnPrimary}>
            {recalculating ? "Calculando…" : "Recalcular"}
          </button>
          <button type="button" onClick={openMaps} disabled={!mapsUrl} style={btnGhost}>
            Maps
          </button>
          <button type="button" onClick={openWa} disabled={!shareText} style={btnGhost}>
            WA chofer
          </button>
          <button type="button" onClick={() => setMoreOpen((v) => !v)} style={btnGhost}>
            Más
          </button>
        </div>
      </div>

      {coordExceptions.length ? (
        <div
          className="ruta-desk-coord-ex"
          data-testid="coord-monitor-exceptions"
          style={{
            fontSize: 12,
            lineHeight: 1.4,
            color: "#9a3412",
            background: "#fff7ed",
            border: "1px solid #fdba74",
            borderRadius: 8,
            padding: "8px 10px",
            margin: "0 0 8px",
          }}
        >
          Coordinación · {info.numero || "ENV"} · excepciones ({coordExceptions.length}):{" "}
          {coordExceptions
            .slice(0, 8)
            .map((h) => {
              const name = h.row.nombre || h.row.orderId || "parada";
              return `${name} · ${h.exceptions.map((e) => e.label).join(", ")}`;
            })
            .join(" · ")}
        </div>
      ) : (
        <div data-testid="coord-monitor-exceptions" hidden />
      )}

      {faltas.length ? (
        <div className="ruta-faltas" data-testid="ruta-faltantes" style={{ margin: "0 0 8px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", color: T.muted }}>
            {faltas.filter((f) => f.severity === "block").length
              ? `${faltas.filter((f) => f.severity === "block").length} faltantes — no está listo`
              : "Avisos"}
          </div>
          {faltas.map((f) => (
            <div key={`top-${f.id}`} className={`ruta-falta${f.severity === "block" ? " is-block" : ""}`}>
              <span>{f.label}</span>
            </div>
          ))}
        </div>
      ) : (
        <div data-testid="ruta-faltantes-ok" style={{ margin: "0 0 8px", fontSize: 12, color: "#166534" }}>
          Sin faltantes de tel/dir.
        </div>
      )}

      {moreOpen ? (
        <div style={{ fontSize: 12, color: T.muted }}>
          GeoJSON/GPX y copiar itinerario quedan en Detalle Completo. Acá: mapa + orden + faltas.
          {mapsUrl ? (
            <>
              {" "}
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                Link Maps
              </a>
            </>
          ) : null}
        </div>
      ) : null}

      <div className={`ruta-desk-body${hideMap ? " ruta-desk-body--itinerary" : ""}`}>
        <div className="ruta-desk-col" ref={listRef}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", color: T.muted, marginBottom: 8 }}>
            ITINERARIO
          </div>
          {stops.filter(isPlantPickupStop).map((stop) => (
            <div key={`planta-${stop.id}`} className="ruta-leg">
              <div className="ruta-leg-num" style={{ background: "#ff9f0a" }}>
                P
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#c2410c", textTransform: "uppercase" }}>
                  Retiro en planta (no viaja)
                </div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{stop.cliente}</div>
                <div style={{ fontSize: 11, color: T.muted }}>Se encuentran en el levante · no van en el camión</div>
                <EntregaModoToggle stop={stop} onEntregaModo={onEntregaModo} />
              </div>
            </div>
          ))}
          {stops.filter(isDepotPickupStop).map((stop) => (
            <div key={`depo-${stop.id}`} className="ruta-leg">
              <div className="ruta-leg-num" style={{ background: "#0f766e" }}>
                D
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#0f766e", textTransform: "uppercase" }}>
                  Viene a depo
                </div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{BMC_DEPO.label}</div>
                <div style={{ fontSize: 11, color: T.muted }}>{stop.cliente} · va al depósito</div>
                <DepoMapsLink />
                <EntregaModoToggle stop={stop} onEntregaModo={onEntregaModo} />
              </div>
            </div>
          ))}
          {legs.length ? (
            legs.map((leg, i) => {
              const stop = stops.find((s) => s.id === leg.stopId);
              const color = TYPE_COLOR[leg.type] || "#0071e3";
              return (
                <div
                  key={`${leg.type}-${leg.refId}-${i}`}
                  data-leg-index={i}
                  className={`ruta-leg${selectedRefId === String(leg.refId) ? " is-selected" : ""}${
                    dragActive === i ? " is-dragging" : ""
                  }${dragOver === i && dragActive != null && dragActive !== i ? " is-drag-over" : ""}`}
                  onClick={() => setSelectedRefId(String(leg.refId || ""))}
                >
                  <button
                    type="button"
                    className="ruta-leg-handle"
                    aria-label={`Reordenar parada ${i + 1}`}
                    data-testid="ruta-leg-handle"
                    onPointerDown={(e) => onHandlePointerDown(e, i)}
                    onPointerMove={onHandlePointerMove}
                    onPointerUp={onHandlePointerUp}
                    onClick={(e) => e.stopPropagation()}
                  >
                    ⠿
                  </button>
                  <div className="ruta-leg-num" style={{ background: color }}>
                    {i + 1}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color, textTransform: "uppercase" }}>
                      {TYPE_ES[leg.type] || leg.type}
                      {leg.geo?.source?.includes("city") || leg.geo?.precision === "city" ? " · pin ciudad" : ""}
                      {leg.geo?.precision === "approx" || String(leg.geo?.source || "").includes("approx")
                        ? " · pin aprox."
                        : ""}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>
                      {leg.label || places.find((p) => p.id === leg.refId)?.label || "—"}
                    </div>
                    <div style={{ fontSize: 11, color: T.muted }}>
                      {leg.type === "depot" ? (
                        <DepoMapsLink />
                      ) : (
                        leg.addressText || "sin dirección"
                      )}
                      {leg.legKmFromPrev != null ? ` · +${Number(leg.legKmFromPrev).toFixed(0)} km` : ""}
                    </div>
                    {leg.type === "pickup" ? (
                      <PickupClients
                        pickupId={String(leg.refId || "")}
                        stops={stops}
                        wizard={wizard}
                      />
                    ) : null}
                    {leg.type === "depot" ? <DepotClients stops={stops} /> : null}
                    {stop && leg.type === "delivery" ? (
                      <EntregaModoToggle stop={stop} onEntregaModo={onEntregaModo} />
                    ) : null}
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ fontSize: 13, color: T.muted }}>Generando itinerario…</div>
          )}

          {faltas.length ? (
            <div className="ruta-faltas">
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", color: T.muted }}>FALTAS</div>
              {faltas.map((f) => (
                <div key={f.id} className={`ruta-falta${f.severity === "block" ? " is-block" : ""}`}>
                  <span>{f.label}</span>
                  {f.action === "recalc" ? (
                    <button type="button" onClick={onRecalcular} style={btnTiny}>
                      Recalc
                    </button>
                  ) : null}
                  {f.action === "goto_flota" ? (
                    <button type="button" onClick={() => onGotoStep?.("flota")} style={btnTiny}>
                      Flota
                    </button>
                  ) : null}
                  {f.action === "goto_levantes" ? (
                    <button type="button" onClick={() => onGotoStep?.("levantes")} style={btnTiny}>
                      Levantes
                    </button>
                  ) : null}
                  {f.action === "toggle_mode" && f.stopId ? (
                    <button
                      type="button"
                      onClick={() => {
                        const hit = stops.find((s) => s.id === f.stopId);
                        if (hit) onEntregaModo?.(hit.id, isOffTruckDelivery(hit) ? "obra" : "planta");
                      }}
                      style={btnTiny}
                    >
                      Modo
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ marginTop: 12, fontSize: 12, color: "#166534" }}>Sin bloqueos de ruta.</div>
          )}
        </div>

        {hideMap ? null : (
          <div className="ruta-desk-map-wrap">
            <RouteLeafletMap
              legs={legs}
              selectedRefId={selectedRefId}
              onSelect={(leg) => setSelectedRefId(String(leg.refId || ""))}
            />
          </div>
        )}
      </div>

      <div className="ruta-desk-thumb" data-testid="ruta-desk-thumb">
        <button
          type="button"
          className="ruta-desk-thumb__primary"
          onClick={onRecalcular}
          disabled={recalculating}
        >
          {recalculating ? "Calculando…" : "Recalcular"}
        </button>
        <button type="button" className="ruta-desk-thumb__secondary" onClick={openMaps} disabled={!mapsUrl}>
          Maps
        </button>
        <button type="button" className="ruta-desk-thumb__secondary" onClick={openWa} disabled={!shareText}>
          WA chofer
        </button>
      </div>
    </div>
  );
}

const btnPrimary = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "none",
  background: "#2563eb",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
  minHeight: 44,
};
const btnGhost = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  background: "#fff",
  fontWeight: 600,
  cursor: "pointer",
  minHeight: 44,
};
function PickupClients({ pickupId, stops, wizard }) {
  const clients = (stops || []).filter(
    (s) => pickupIdForStop(s, wizard) === pickupId && !isPlantPickupStop(s),
  );
  if (!clients.length) return null;
  return (
    <ul className="ruta-leg-clients">
      {clients.map((s) => (
        <li key={s.id} className="ruta-leg-client">
          {s.cliente || "Parada"}
          {s.orderId ? <span> #{s.orderId}</span> : null}
        </li>
      ))}
    </ul>
  );
}

function DepoMapsLink() {
  const href = safeHttpUrl(BMC_DEPO.mapUrl);
  if (!href) return <span>{BMC_DEPO.addressText}</span>;
  return (
    <a
      className="ruta-depo-maps"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
    >
      Destino Maps
    </a>
  );
}

function DepotClients({ stops }) {
  const clients = (stops || []).filter(isDepotPickupStop);
  if (!clients.length) return null;
  return (
    <ul className="ruta-leg-clients">
      {clients.map((s) => (
        <li key={s.id} className="ruta-leg-client">
          {s.cliente || "Parada"}
          {s.orderId ? <span> #{s.orderId}</span> : null}
        </li>
      ))}
    </ul>
  );
}

function EntregaModoToggle({ stop, onEntregaModo }) {
  if (!stop) return null;
  const modo = normalizeEntregaModo(stop);
  const hint =
    modo === "planta"
      ? "No viaja — retiran en el levante"
      : modo === "depo"
        ? `Va al depósito ${BMC_DEPO.label}`
        : `Se entrega en ${stop.direccion || "destino"}`;
  return (
    <div>
      <div className="ruta-toggle" role="group" aria-label="Cómo se entrega">
        {ENTREGA_MODO_OPTIONS.map((opt) => {
          const on = modo === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              className={on ? "is-on" : "is-off"}
              aria-pressed={on}
              data-testid={`entrega-modo-${opt.id}`}
              onClick={(e) => {
                e.stopPropagation();
                if (!on) onEntregaModo?.(stop.id, opt.id);
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>{hint}</div>
    </div>
  );
}

const btnTiny = {
  fontSize: 11,
  padding: "4px 8px",
  borderRadius: 6,
  border: "1px solid currentColor",
  background: "transparent",
  cursor: "pointer",
  whiteSpace: "nowrap",
};
