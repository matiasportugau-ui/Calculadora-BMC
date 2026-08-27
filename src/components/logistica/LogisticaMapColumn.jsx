/**
 * Visual column: persistent map + bottom dock (Itinerario | 3D | Croquis).
 * Accordion dock — one tab at a time — so panes never overlap.
 */
import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import { ENV_T as T } from "../../utils/enviosTheme.js";
import { googleMapsDirectionsUrl, legsWithGeo } from "../../utils/logistica/routeExport.js";
import { safeHttpUrl } from "../../utils/logistica/safeExternalUrl.js";
import { bedViewExtents } from "../../utils/bmcLogisticaBedView.js";
import { FactoryLoadSketch } from "./FactoryPickupBlock.jsx";
import RouteLeafletMap from "./wizard/RouteLeafletMap.jsx";

const LogisticaCargoScene3d = lazy(() => import("./LogisticaCargoScene3d.jsx"));

const TYPE_ES = { base: "Salida", pickup: "Levante", delivery: "Entrega" };
const TYPE_COLOR = { base: "#1a3a5c", pickup: "#ff9f0a", delivery: "#0071e3" };

const DOCK_TABS = [
  { id: "itinerario", label: "Itinerario" },
  { id: "3d", label: "Diagrama 3D" },
  { id: "croquis", label: "Croquis" },
];

function DockedCargo3d({ cargo, truckL }) {
  const placed = Array.isArray(cargo?.placed) ? cargo.placed : [];
  const { minXV, maxXV, placedView } = bedViewExtents(placed, truckL);
  return (
    <LogisticaCargoScene3d
      placed={placedView}
      shiftX={-minXV}
      truckL={truckL}
      maxLen={maxXV}
      totalLen={Math.max(maxXV - minXV, truckL + 8)}
      fillParent
    />
  );
}

export default function LogisticaMapColumn({
  route,
  routeStale = false,
  recalculating = false,
  onRecalcular,
  hideGenerateButton = false,
  hideLegList = false,
  cargo = null,
  truckL = 12,
  onPinMoved,
  children = null,
}) {
  const legs = useMemo(() => route?.orderedLegs || [], [route?.orderedLegs]);
  const geoCount = useMemo(() => legsWithGeo(legs).length, [legs]);
  const mapsUrl = useMemo(() => safeHttpUrl(googleMapsDirectionsUrl(legs)) || "", [legs]);
  const [flash, setFlash] = useState("");
  const [selectedRefId, setSelectedRefId] = useState("");
  const [dockTab, setDockTab] = useState(() => (hideLegList ? "croquis" : "itinerario"));

  const kmLabel =
    route?.totalKm != null
      ? route?.suggestionSource === "osrm"
        ? ` · ~${Number(route.totalKm).toFixed(0)} km ruta`
        : ` · ~${Number(route.totalKm).toFixed(0)} km aire`
      : "";

  const ping = useCallback((msg) => {
    setFlash(msg);
    window.setTimeout(() => setFlash(""), 2800);
  }, []);

  const openMaps = useCallback(() => {
    if (!mapsUrl) {
      ping("Generá la ruta para abrir Maps");
      return;
    }
    window.open(mapsUrl, "_blank", "noopener,noreferrer");
  }, [mapsUrl, ping]);

  const tabs = hideLegList
    ? DOCK_TABS.filter((t) => t.id !== "itinerario")
    : DOCK_TABS;
  const activeTab = tabs.some((t) => t.id === dockTab) ? dockTab : tabs[0]?.id || "croquis";

  return (
    <div className="envios-mapcol" data-testid="logistica-map-column">
      <div className="envios-mapcol__map-block">
        <div className="envios-mapcol__map-head">
          <div className="envios-mapcol__map-title">
            <strong>Ruta en mapa</strong>
            <span className="envios-mapcol__meta">
              {legs.length
                ? `${legs.length} paradas · ${geoCount} con pin${kmLabel}`
                : "Todavía no hay recorrido"}
            </span>
          </div>
          <div className="envios-mapcol__bar">
            {hideGenerateButton ? null : (
              <button type="button" className="envios-mapcol__btn" onClick={onRecalcular} disabled={recalculating}>
                {recalculating ? "Calculando…" : legs.length ? "Recalcular" : "Generar ruta"}
              </button>
            )}
            <button type="button" className="envios-mapcol__btn envios-mapcol__btn--ghost" onClick={openMaps} disabled={!mapsUrl}>
              Abrir en Maps
            </button>
          </div>
        </div>
        {routeStale ? (
          <div className="envios-mapcol__stale">
            ⚠ Pedidos/flota/levantes cambiaron — recalculá para actualizar el trazo.
          </div>
        ) : null}
        <div className="envios-mapcol__canvas">
          <RouteLeafletMap
            legs={legs}
            geometry={route?.geometry || ""}
            selectedRefId={selectedRefId}
            onSelect={(leg) => setSelectedRefId(String(leg?.refId || ""))}
            onPinMoved={onPinMoved}
          />
        </div>
        <div className="envios-mapcol__actions">
          {geoCount < legs.length && legs.length ? (
            <span className="envios-mapcol__hint">
              {legs.length - geoCount} sin lat/lng (no se inventan coords)
            </span>
          ) : null}
          {flash ? <span className="envios-mapcol__hint">{flash}</span> : null}
        </div>
      </div>

      <div className="envios-mapcol__dock">
        <div className="envios-mapcol__dock-tabs" role="tablist" aria-label="Panel visual">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activeTab === t.id}
              className={`envios-mapcol__dock-tab${activeTab === t.id ? " is-active" : ""}`}
              onClick={() => setDockTab(t.id)}
            >
              {t.label}
              {t.id === "itinerario" && legs.length ? (
                <span className="envios-mapcol__dock-badge">{legs.length}</span>
              ) : null}
            </button>
          ))}
        </div>

        <div className="envios-mapcol__dock-body" role="tabpanel">
          {activeTab === "itinerario" ? (
            legs.length ? (
              <ol className="envios-mapcol__legs">
                {legs.map((leg, i) => {
                  const color = TYPE_COLOR[leg.type] || "#0071e3";
                  const selected = selectedRefId && String(leg.refId) === String(selectedRefId);
                  return (
                    <li key={`${leg.type}-${leg.refId}-${i}`}>
                      <button
                        type="button"
                        className={`envios-mapcol__leg${selected ? " is-selected" : ""}`}
                        onClick={() => setSelectedRefId(String(leg.refId || ""))}
                      >
                        <span className="envios-mapcol__leg-num" style={{ background: color }}>
                          {i + 1}
                        </span>
                        <span className="envios-mapcol__leg-body">
                          <span className="envios-mapcol__leg-type" style={{ color }}>
                            {TYPE_ES[leg.type] || leg.type}
                          </span>
                          <span className="envios-mapcol__leg-label">{leg.label || "—"}</span>
                          <span className="envios-mapcol__leg-addr">
                            {leg.addressText || "sin dirección"}
                            {leg.geo ? "" : " · falta ubi"}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="envios-mapcol__foot" style={{ color: T.muted }}>
                Generá la ruta para ver el itinerario.
              </p>
            )
          ) : null}

          {activeTab === "3d" ? (
            <div className="envios-mapcol__dock-3d">
              <Suspense
                fallback={
                  <div className="envios-visual-pane__fallback" style={{ color: T.muted }}>
                    Cargando 3D…
                  </div>
                }
              >
                <DockedCargo3d cargo={cargo} truckL={truckL} />
              </Suspense>
            </div>
          ) : null}

          {activeTab === "croquis" ? (
            <div className="envios-mapcol__sketch">
              <FactoryLoadSketch cargo={cargo} truckL={truckL} />
            </div>
          ) : null}

          {children}
        </div>
      </div>
    </div>
  );
}
