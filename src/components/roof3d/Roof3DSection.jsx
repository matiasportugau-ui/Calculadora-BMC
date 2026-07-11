// Visor 3D · Paneles para cubierta — sección colapsable.
// Gate: isVisor3dEnabled() — dedicated flag (VITE_FEATURE_VISOR_3D / ?visor3d=1),
// additive to design-preview. Lectura pura del estado del techo (one-way): reusa
// RoofPanelRealisticScene vía React.lazy, mismo chunk lazy que el flujo legacy
// (ENABLE_ROOF_3D_VISOR), por lo que con el gate apagado no se descarga ni un byte 3D nuevo.
import { lazy, Suspense, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { C, FONT, SHC } from "../../data/constants.js";
import { isVisor3dEnabled } from "../../lib/visor3dMode.js";

const RoofPanelRealisticScene = lazy(() => import("../RoofPanelRealisticScene.jsx"));

// Inject beta-badge pulse keyframe once (respects prefers-reduced-motion, same
// inject-once pattern as PanelinChatPanel.jsx).
if (typeof document !== "undefined" && !document.getElementById("roof3d-beta-kf")) {
  const s = document.createElement("style");
  s.id = "roof3d-beta-kf";
  s.textContent = `
    @keyframes roof3d-beta-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(255,159,10,0.45)} 50%{box-shadow:0 0 0 5px rgba(255,159,10,0)} }
    .roof3d-beta-badge { animation: roof3d-beta-pulse 2.2s ease-in-out infinite; }
    @media (prefers-reduced-motion: reduce) {
      .roof3d-beta-badge { animation: none; }
    }
  `;
  document.head.appendChild(s);
}

// La escena no maneja fallo de contexto WebGL; el único boundary por encima es
// el de ruta (RouteErrorBoundary, App.jsx), que ante un throw reemplazaría TODA
// la calculadora por la pantalla de error (y no se recupera hasta navegar, por
// resetKey=pathname). Por eso probamos WebGL y degradamos in-situ.
let webglSupport = null;
function isWebglSupported() {
  if (webglSupport !== null) return webglSupport;
  try {
    if (typeof document === "undefined") return false;
    const canvas = document.createElement("canvas");
    webglSupport = !!(
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl")
    );
  } catch {
    webglSupport = false;
  }
  return webglSupport;
}

const noticeBoxStyle = {
  padding: 40,
  textAlign: "center",
  color: C.ts,
  fontSize: 13,
  background: C.surfaceAlt,
  borderRadius: 10,
  border: `1px solid ${C.border}`,
};

export default function Roof3DSection({
  zonas,
  tipoAguas,
  pendiente,
  familiaKey,
  espesorMm,
  panelAu = 1.12,
  techoColor = "",
}) {
  const [open, setOpen] = useState(false);
  const validZonas = useMemo(
    () => (zonas || []).filter((z) => z?.largo > 0 && z?.ancho > 0),
    [zonas],
  );
  // pendiente 0 (techo plano / default vendedor) → el `|| 15` de la escena
  // (RoofPanelRealisticScene: `Number(pendiente) || 15`) lo inflaría a 15°;
  // pasamos un sentinel chico que cae en el piso ~2.86° de la escena
  // (Math.max(0.05, …)) — lo más plano que puede representar. Ver #667.
  const scenePendiente = Number(pendiente) > 0 ? pendiente : 0.5;
  // Defensa para reuso standalone: el gate primario vive en el mount del quoter
  // (`{isVisor3dEnabled() && <Roof3DSection/>}`), así que en el flujo actual
  // esto nunca retorna null — se mantiene por si el componente se monta suelto.
  if (!isVisor3dEnabled()) return null;

  return (
    <div
      data-bmc-component="Roof3DSection"
      data-bmc-view="roof-3d-visor"
      style={{
        fontFamily: FONT,
        background: C.surface,
        borderRadius: 16,
        border: `1px solid ${C.border}`,
        boxShadow: SHC,
        marginBottom: 16,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 16px",
          border: "none",
          background: C.surfaceAlt,
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 600,
          color: C.ts,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span>Visor 3D · Paneles para cubierta</span>
          <span
            className="roof3d-beta-badge"
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: C.warning,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              padding: "3px 8px",
              borderRadius: 6,
              background: C.warningSoft,
              border: `1px solid ${C.warning}`,
            }}
          >
            Versión Beta
          </span>
        </span>
        {open ? <ChevronUp size={18} color={C.ts} /> : <ChevronDown size={18} color={C.ts} />}
      </button>
      {open && (
        <div style={{ padding: "12px 16px 16px" }}>
          {isWebglSupported() ? (
            <Suspense fallback={<div style={noticeBoxStyle}>Cargando vista 3D…</div>}>
              <RoofPanelRealisticScene
                validZonas={validZonas}
                tipoAguas={tipoAguas}
                pendiente={scenePendiente}
                familiaKey={familiaKey}
                espesorMm={espesorMm}
                panelAu={panelAu}
                techoColor={techoColor}
              />
            </Suspense>
          ) : (
            <div data-bmc-state="no-webgl" style={noticeBoxStyle}>
              Este navegador no soporta WebGL — la vista 3D no está disponible.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
