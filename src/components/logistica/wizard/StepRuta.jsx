/** Step 4 — suggested route legs + visualizer + export/share for transportista. */
import { useMemo, useState, useCallback } from "react";
import { ENV_T as T } from "../../../utils/enviosTheme.js";
import {
  googleMapsDirectionsUrl,
  routeToShareText,
  routeToGeoJson,
  routeToGpx,
  routeExportBasename,
  downloadTextFile,
  legsWithGeo,
} from "../../../utils/logistica/routeExport.js";
import { safeHttpUrl } from "../../../utils/logistica/safeExternalUrl.js";
import RouteMapVisualizer from "./RouteMapVisualizer.jsx";

export default function StepRuta({ route, onRecalcular, routeStale, info = {}, recalculating = false }) {
  const legs = route?.orderedLegs || [];
  const [feedback, setFeedback] = useState("");

  const mapsUrl = useMemo(() => safeHttpUrl(googleMapsDirectionsUrl(legs)) || "", [legs]);
  const geoCount = useMemo(() => legsWithGeo(legs).length, [legs]);
  const shareText = useMemo(
    () =>
      legs.length
        ? routeToShareText(route, {
            title: "🚚 Ruta BMC Envíos",
            info: {
              numero: info.numero,
              fecha: info.fecha,
              transportista: info.transportista,
              patente: info.patente,
            },
          })
        : "",
    [route, legs.length, info.numero, info.fecha, info.transportista, info.patente],
  );

  const flash = useCallback((msg) => {
    setFeedback(msg);
    window.setTimeout(() => setFeedback(""), 3200);
  }, []);

  const copyText = useCallback(async () => {
    if (!shareText) {
      flash("No hay ruta para copiar");
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
      } else {
        const ta = document.createElement("textarea");
        ta.value = shareText;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      flash("Itinerario copiado — pegalo al transportista");
    } catch {
      flash("No se pudo copiar");
    }
  }, [shareText, flash]);

  const shareNative = useCallback(async () => {
    if (!shareText) {
      flash("No hay ruta para compartir");
      return;
    }
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "Ruta BMC Envíos",
          text: shareText,
          ...(mapsUrl ? { url: mapsUrl } : {}),
        });
        flash("Compartido");
        return;
      } catch (e) {
        if (e?.name === "AbortError") return;
      }
    }
    await copyText();
  }, [shareText, mapsUrl, copyText, flash]);

  const openMaps = useCallback(() => {
    if (!mapsUrl) {
      flash("No hay paradas para abrir en Maps");
      return;
    }
    window.open(mapsUrl, "_blank", "noopener,noreferrer");
  }, [mapsUrl, flash]);

  const exportTxt = useCallback(() => {
    if (!shareText) {
      flash("No hay ruta");
      return;
    }
    const ok = downloadTextFile(routeExportBasename(route, "txt"), shareText, "text/plain;charset=utf-8");
    flash(ok ? "Itinerario .txt descargado" : "No se pudo descargar");
  }, [shareText, route, flash]);

  const exportGeoJson = useCallback(() => {
    if (!legs.length) {
      flash("No hay ruta");
      return;
    }
    const gj = routeToGeoJson(route);
    if (!gj.features.length) {
      flash("GeoJSON vacío — sin lat/lng. Usá TXT o Maps por nombre.");
      return;
    }
    const json = JSON.stringify(gj, null, 2);
    const ok = downloadTextFile(routeExportBasename(route, "geojson"), json, "application/geo+json");
    flash(ok ? "GeoJSON descargado" : "No se pudo descargar");
  }, [route, legs.length, flash]);

  const exportGpx = useCallback(() => {
    if (!geoCount) {
      flash("GPX necesita coordenadas. Usá Maps / TXT mientras tanto.");
      return;
    }
    const gpx = routeToGpx(route, { name: "Ruta BMC Envíos" });
    const ok = downloadTextFile(routeExportBasename(route, "gpx"), gpx, "application/gpx+xml");
    flash(ok ? "GPX descargado" : "No se pudo descargar");
  }, [route, geoCount, flash]);

  const openWhatsApp = useCallback(() => {
    if (!shareText) {
      flash("No hay ruta");
      return;
    }
    // WhatsApp URL has length limits; still try full itinerary
    const url = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }, [shareText, flash]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.4 }}>
        Ruta: base → levante(s) → entregas. Mirá el recorrido, abrilo en Maps y compartilo completo al transportista.
      </p>
      {routeStale ? (
        <div style={{ padding: 10, borderRadius: 8, background: "#fff7ed", border: "1px solid #fed7aa", fontSize: 12 }}>
          ⚠ La ruta está desactualizada respecto a pedidos/flota/levantes.
        </div>
      ) : null}
      <button type="button" onClick={onRecalcular} disabled={recalculating} style={btnPrimary}>
        {recalculating ? "Calculando…" : legs.length ? "Recalcular ruta" : "Generar ruta sugerida"}
      </button>

      {legs.length ? (
        <>
          <RouteMapVisualizer route={route} height={210} />

          <div
            style={{
              padding: 12,
              borderRadius: 12,
              border: `1px solid ${T.border}`,
              background: "#f8fafc",
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, color: T.brand }}>Compartir al transportista</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button type="button" onClick={openMaps} disabled={!mapsUrl} style={actionStyle(!mapsUrl, true)} title={mapsUrl || ""}>
                🗺 Google Maps (ruta completa)
              </button>
              <button type="button" onClick={openWhatsApp} style={actionStyle(false, true)}>
                💬 WhatsApp
              </button>
              <button type="button" onClick={copyText} style={actionStyle(false)}>
                📋 Copiar itinerario
              </button>
              <button type="button" onClick={shareNative} style={actionStyle(false)}>
                ↗ Compartir
              </button>
              <button type="button" onClick={exportTxt} style={actionStyle(false)}>
                ⬇ TXT
              </button>
              <button type="button" onClick={exportGeoJson} style={actionStyle(false)}>
                ⬇ GeoJSON
              </button>
              <button type="button" onClick={exportGpx} disabled={!geoCount} style={actionStyle(!geoCount)}>
                ⬇ GPX
              </button>
            </div>
            {mapsUrl ? (
              <div style={{ fontSize: 11, color: T.muted, wordBreak: "break-all" }}>
                Link Maps:{" "}
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                  abrir
                </a>
                {geoCount < legs.length
                  ? ` · ${geoCount}/${legs.length} con lat/lng (el resto va por nombre/dirección)`
                  : null}
              </div>
            ) : null}
          </div>

          {feedback ? (
            <div style={{ fontSize: 12, color: T.primary, fontWeight: 600 }} role="status">
              {feedback}
            </div>
          ) : null}
        </>
      ) : (
        <div style={{ fontSize: 12, color: T.muted }}>Todavía no hay tramos. Generá la sugerencia.</div>
      )}

      {route?.totalKm != null ? (
        <div style={{ fontSize: 12, fontWeight: 700 }}>Total ~{route.totalKm.toFixed(0)} km (aire)</div>
      ) : null}
      {(route?.warnings || []).map((w) => (
        <div key={w} style={{ fontSize: 11, color: "#9a3412" }}>
          {w}
        </div>
      ))}
    </div>
  );
}

const btnPrimary = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "none",
  background: "#2563eb",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
  minHeight: 44,
  justifySelf: "start",
};

function actionStyle(disabled, primary = false) {
  return {
    padding: "8px 12px",
    borderRadius: 8,
    border: primary ? "none" : `1.5px solid ${T.border}`,
    background: primary ? "#2563eb" : T.surface,
    color: primary ? "#fff" : T.text,
    fontWeight: 600,
    fontSize: 12,
    cursor: disabled ? "not-allowed" : "pointer",
    minHeight: 40,
    opacity: disabled ? 0.45 : 1,
  };
}
