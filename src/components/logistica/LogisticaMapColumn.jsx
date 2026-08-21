/**
 * Visual column: map + 3D + packing, each collapsible (react-resizable-panels).
 * Independent of wizard step: if tripRoute is in state/draft, the map stays marked.
 */
import { lazy, Suspense, useCallback, useMemo, useRef, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { ENV_T as T } from "../../utils/enviosTheme.js";
import { googleMapsDirectionsUrl, legsWithGeo } from "../../utils/logistica/routeExport.js";
import { safeHttpUrl } from "../../utils/logistica/safeExternalUrl.js";
import { panelinPanelGroupStorage } from "../../utils/panelinChatLayoutStorage.js";
import { bedViewExtents } from "../../utils/bmcLogisticaBedView.js";
import { FactoryLoadSketch } from "./FactoryPickupBlock.jsx";
import RouteLeafletMap from "./wizard/RouteLeafletMap.jsx";

const LogisticaCargoScene3d = lazy(() => import("./LogisticaCargoScene3d.jsx"));

const TYPE_ES = { base: "Salida", pickup: "Levante", delivery: "Entrega" };
const TYPE_COLOR = { base: "#1a3a5c", pickup: "#ff9f0a", delivery: "#0071e3" };

function togglePanelHandle(handle) {
  if (!handle) return;
  if (typeof handle.isCollapsed === "function" && handle.isCollapsed()) handle.expand();
  else handle.collapse();
}

function PaneTitle({ label, collapsed, onToggle, meta }) {
  return (
    <button
      type="button"
      className={`envios-visual-pane__title${collapsed ? " is-collapsed" : ""}`}
      onClick={onToggle}
      aria-expanded={!collapsed}
    >
      <span>{label}</span>
      {meta ? <span className="envios-visual-pane__meta">{meta}</span> : null}
      <span className="envios-visual-pane__chevron" aria-hidden>
        {collapsed ? "▸" : "▾"}
      </span>
    </button>
  );
}

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
  children = null,
}) {
  const legs = useMemo(() => route?.orderedLegs || [], [route?.orderedLegs]);
  const geoCount = useMemo(() => legsWithGeo(legs).length, [legs]);
  const mapsUrl = useMemo(() => safeHttpUrl(googleMapsDirectionsUrl(legs)) || "", [legs]);
  const [flash, setFlash] = useState("");
  const [selectedRefId, setSelectedRefId] = useState("");
  const mapPanelRef = useRef(null);
  const scenePanelRef = useRef(null);
  const packPanelRef = useRef(null);
  const [mapCollapsed, setMapCollapsed] = useState(false);
  const [sceneCollapsed, setSceneCollapsed] = useState(false);
  const [packCollapsed, setPackCollapsed] = useState(false);

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

  return (
    <div className="envios-mapcol" data-testid="logistica-map-column">
      <PanelGroup
        direction="vertical"
        autoSaveId="logistica-visual-split-v1"
        storage={panelinPanelGroupStorage}
        className="envios-visual-split"
      >
        <Panel
          ref={mapPanelRef}
          className="envios-visual-pane envios-visual-pane--map"
          defaultSize={42}
          minSize={12}
          collapsible
          collapsedSize={8}
          onCollapse={() => setMapCollapsed(true)}
          onExpand={() => setMapCollapsed(false)}
        >
          <PaneTitle
            label="Ruta en mapa"
            collapsed={mapCollapsed}
            onToggle={() => togglePanelHandle(mapPanelRef.current)}
            meta={
              legs.length
                ? `${legs.length} paradas · ${geoCount} con pin${kmLabel}`
                : "Todavía no hay recorrido"
            }
          />
          <div className="envios-visual-pane__body envios-visual-pane__body--map">
            <div className="envios-mapcol__bar">
              {hideGenerateButton ? null : (
                <button type="button" className="envios-mapcol__btn" onClick={onRecalcular} disabled={recalculating}>
                  {recalculating ? "Calculando…" : legs.length ? "Recalcular" : "Generar ruta"}
                </button>
              )}
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
              />
            </div>
            <div className="envios-mapcol__actions">
              <button type="button" onClick={openMaps} disabled={!mapsUrl}>
                Abrir en Maps
              </button>
              {geoCount < legs.length && legs.length ? (
                <span className="envios-mapcol__hint">
                  {legs.length - geoCount} sin lat/lng (no se inventan coords)
                </span>
              ) : null}
              {flash ? <span className="envios-mapcol__hint">{flash}</span> : null}
            </div>
          </div>
        </Panel>

        <PanelResizeHandle className="bmc-sash bmc-sash--vertical" />

        <Panel
          ref={scenePanelRef}
          className="envios-visual-pane envios-visual-pane--3d"
          defaultSize={34}
          minSize={10}
          collapsible
          collapsedSize={8}
          onCollapse={() => setSceneCollapsed(true)}
          onExpand={() => setSceneCollapsed(false)}
        >
          <PaneTitle
            label="Diagrama 3D"
            collapsed={sceneCollapsed}
            onToggle={() => togglePanelHandle(scenePanelRef.current)}
            meta="orbitá · misma carga del viaje"
          />
          <div className="envios-visual-pane__body envios-visual-pane__body--3d">
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
        </Panel>

        <PanelResizeHandle className="bmc-sash bmc-sash--vertical" />

        <Panel
          ref={packPanelRef}
          className="envios-visual-pane envios-visual-pane--pack"
          defaultSize={24}
          minSize={10}
          collapsible
          collapsedSize={8}
          onCollapse={() => setPackCollapsed(true)}
          onExpand={() => setPackCollapsed(false)}
        >
          <PaneTitle
            label="Itinerario y croquis"
            collapsed={packCollapsed}
            onToggle={() => togglePanelHandle(packPanelRef.current)}
            meta={legs.length ? `${legs.length} tramos` : ""}
          />
          <div className="envios-visual-pane__body envios-visual-pane__body--pack">
            <div className="envios-mapcol__sketch">
              <FactoryLoadSketch cargo={cargo} truckL={truckL} />
            </div>
            {hideLegList ? null : legs.length ? (
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
            )}
            <p className="envios-mapcol__foot" style={{ color: T.muted }}>
              Clic en el título para plegar. El mapa no se pierde al cambiar Pedidos / Flota / Carga.
            </p>
            {children}
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}
