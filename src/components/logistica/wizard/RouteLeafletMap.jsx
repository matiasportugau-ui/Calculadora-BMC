/**
 * Leaflet OSM map for the Ruta dispatch desk. Client-only.
 */
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { decodePolyline } from "../../../utils/logistica/osrmPolyline.js";

const TYPE_COLOR = {
  base: "#1a3a5c",
  pickup: "#ff9f0a",
  delivery: "#0071e3",
  depot: "#0f766e",
};

/**
 * @param {{
 *   legs?: object[],
 *   geometry?: string | null,
 *   selectedRefId?: string,
 *   onSelect?: (leg: object, index: number) => void,
 * }} props
 */
export default function RouteLeafletMap({ legs = [], geometry = "", selectedRefId = "", onSelect }) {
  const hostRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let map;

    async function boot() {
      const leafletMod = await import("leaflet");
      const L = leafletMod.default || leafletMod;
      if (cancelled || !hostRef.current) return;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      map = L.map(hostRef.current, {
        zoomControl: true,
        attributionControl: true,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);
      map.setView([-34.82, -55.9], 8);
      mapRef.current = map;
      draw(L, map);
      requestAnimationFrame(() => map.invalidateSize());
    }

    function draw(L, mapInstance) {
      if (layerRef.current) {
        layerRef.current.remove();
        layerRef.current = null;
      }
      const group = L.layerGroup().addTo(mapInstance);
      layerRef.current = group;
      const withGeo = (legs || []).filter((l) => l?.geo && Number.isFinite(Number(l.geo.lat)));
      const latlngs = withGeo.map((l) => [Number(l.geo.lat), Number(l.geo.lng)]);
      const road = decodePolyline(geometry);
      if (road.length >= 2) {
        L.polyline(road, { color: "#1a3a5c", weight: 4, opacity: 0.9 }).addTo(group);
      }
      withGeo.forEach((leg) => {
        const i = (legs || []).indexOf(leg);
        const color = TYPE_COLOR[leg.type] || "#0071e3";
        const selected = selectedRefId && String(leg.refId) === String(selectedRefId);
        const icon = L.divIcon({
          className: "ruta-pin",
          html: `<div style="width:${selected ? 32 : 26}px;height:${selected ? 32 : 26}px;border-radius:99px;background:${color};color:#fff;font-weight:800;font-size:12px;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.25)">${i + 1}</div>`,
          iconSize: [selected ? 32 : 26, selected ? 32 : 26],
          iconAnchor: [selected ? 16 : 13, selected ? 16 : 13],
        });
        const m = L.marker([Number(leg.geo.lat), Number(leg.geo.lng)], { icon }).addTo(group);
        m.bindTooltip(`${i + 1}. ${leg.label || ""}`, { direction: "top" });
        m.on("click", () => onSelect?.(leg, i));
      });
      const boundsPts = road.length >= 2 ? road : latlngs;
      if (boundsPts.length === 1) {
        mapInstance.setView(boundsPts[0], 12);
      } else if (boundsPts.length > 1) {
        mapInstance.fitBounds(boundsPts, { padding: [28, 28], maxZoom: 12 });
      } else {
        mapInstance.setView([-34.82, -55.9], 8);
      }
    }

    void boot();

    const host = hostRef.current;
    const ro =
      host && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            const m = mapRef.current;
            if (m) m.invalidateSize();
          })
        : null;
    if (host && ro) ro.observe(host);

    return () => {
      cancelled = true;
      if (ro) ro.disconnect();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // legs identity: serialize geo+ids
  }, [JSON.stringify((legs || []).map((l) => [l?.refId, l?.type, l?.geo?.lat, l?.geo?.lng])), geometry, selectedRefId]);

  return <div ref={hostRef} className="ruta-desk-map" role="img" aria-label="Mapa del recorrido" />;
}
