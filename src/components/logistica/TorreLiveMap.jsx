import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

/**
 * OSM map of live driver pings. Client-only.
 * @param {{ trips: Array<{ trip_id?: string, geo?: { lat: number, lng: number }, online?: boolean, reparto_no?: string }>, selectedId?: string, onSelect?: (trip: object) => void }} props
 */
export default function TorreLiveMap({ trips = [], selectedId = "", onSelect }) {
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
      map = L.map(hostRef.current, { zoomControl: true, attributionControl: true });
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
      const withGeo = (trips || []).filter((t) => t?.geo && Number.isFinite(Number(t.geo.lat)));
      const latlngs = [];
      withGeo.forEach((t) => {
        const lat = Number(t.geo.lat);
        const lng = Number(t.geo.lng);
        latlngs.push([lat, lng]);
        const selected = selectedId && String(t.trip_id) === String(selectedId);
        const color = t.online ? "#16a34a" : "#94a3b8";
        const m = L.circleMarker([lat, lng], {
          radius: selected ? 11 : 8,
          color,
          weight: selected ? 3 : 2,
          fillColor: color,
          fillOpacity: 0.85,
        }).addTo(group);
        // Leaflet treats string tooltips as HTML (innerHTML). Use a text node.
        const tip = document.createElement("span");
        tip.textContent = String(t.reparto_no || t.trip_id || "viaje");
        m.bindTooltip(tip, { permanent: false });
        m.on("click", () => {
          if (typeof onSelect === "function") onSelect(t);
        });
      });
      if (latlngs.length === 1) mapInstance.setView(latlngs[0], 12);
      else if (latlngs.length > 1) mapInstance.fitBounds(latlngs, { padding: [28, 28], maxZoom: 12 });
    }

    boot();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [trips, selectedId, onSelect]);

  return <div ref={hostRef} style={{ width: "100%", height: "100%", minHeight: 280, borderRadius: 12 }} />;
}
