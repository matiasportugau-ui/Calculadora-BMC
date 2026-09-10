import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ExternalLink, Pencil } from "lucide-react";
import { C, FONT, ROOF_2D_QUOTE_VISOR_STEP_IDS, SHC, TR } from "../data/constants.js";
import { DEFAULT_AGUA_REFERENCE_IMAGES, getQuoteVisorContext, QUOTE_VISOR_SHOP_URLS } from "../data/quoteVisorMedia.js";
import { getBorderAccentSlides, readShopifyImageOverrides, writeShopifyImageOverride } from "../data/quoteVisorShopifyResolve.js";
import ProductExplorerTabs from "./ProductExplorerTabs.jsx";
import ProductTooltip from "./ProductTooltip.jsx";
import "../styles/productExplorer.css";

const CAROUSEL_MS = 5500;

/** Asset en `public/video/panelin-lista-loop.mp4` (Vite sirve bajo BASE_URL). */
const PANELIN_LISTA_VIDEO_SRC = `${import.meta.env.BASE_URL}video/panelin-lista-loop.mp4`;

/**
 * Visor visual derecho: **Visualización 3D** (host del portal `RoofBorderCanvas`, planta + bordes, vía `createPortal`)
 * + carrusel Shopify según escenario / paso / bordes activos.
 * Selector DOM de la Visualización 3D: `[data-bmc-view="visualizacion-3d"]` · alias: `[data-bmc-roof-3d-host]`.
 * Etiqueta **Frente** (tipografía chica) centrada abajo del marco del visor; el canvas 3D omite el rótulo duplicado `FRENTE` cuando hay portal (`suppressFrenteCompass`).
 *
 * @param {object} props
 * @param {string} props.scenarioId
 * @param {string | null} [props.hoverScenarioId]
 * @param {string | null} [props.stepId]
 * @param {string} [props.tipoAguas]
 * @param {string} [props.techoFamilia]
 * @param {string} [props.hoverTechoFamilia]
 * @param {string} [props.techoColor]
 * @param {boolean} [props.aguasHighlight]
 * @param {boolean} [props.showRoof3DStage]
 * @param {import("react").MutableRefObject<HTMLElement | null>} [props.roofCanvasHostRef]
 * @param {(el: HTMLElement | null) => void} [props.onRoofCanvasHostReady]
 * @param {Record<string, string>} [props.techoBorders]
 * @param {Record<string, string>[]} [props.techoZonasBorders]
 * @param {string | null} [props.dimensionSummary] — resumen L×W (paso dimensiones)
 * @param {(key: "una_agua"|"dos_aguas") => void} [props.onSelectAgua] — selecciona tipo de aguas desde el visor
 * @param {() => void} [props.onNext] — avanza al siguiente paso desde el visor
 * @param {import("react").ReactNode} [props.roof2DPreview] — pasos en `ROOF_2D_QUOTE_VISOR_STEP_IDS`: vista 2D en el panel derecho; la 3D en subacordeón «Próximamente»
 */
export default function QuoteVisualVisor({
  scenarioId,
  hoverScenarioId = null,
  stepId = null,
  tipoAguas = "una_agua",
  techoFamilia = "",
  hoverTechoFamilia = "",
  techoColor = "",
  hoverTechoColor = "",
  aguasHighlight = false,
  showRoof3DStage = false,
  roofCanvasHostRef,
  onRoofCanvasHostReady,
  techoBorders = {},
  techoZonasBorders = [],
  dimensionSummary = null,
  onSelectAgua = null,
  onNext = null,
  roof2DPreview = null,
  enhancedProductViz = false, // NEW toggleable: shows real product refs (mapped images from research) + DWG profile notes. Default false, no impact on existing UI.
}) {
  const roof2dQuoteVisorLayout = Boolean(roof2DPreview) && Boolean(stepId && ROOF_2D_QUOTE_VISOR_STEP_IDS.has(stepId));
  const [open, setOpen] = useState(() => !roof2dQuoteVisorLayout);
  const [roof3dOpen, setRoof3dOpen] = useState(() => !roof2dQuoteVisorLayout);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [overrideDraft, setOverrideDraft] = useState("");
  const [showOverride, setShowOverride] = useState(false);
  const [shopifyOverrideGen, setShopifyOverrideGen] = useState(0);
  const [shiftPressed, setShiftPressed] = useState(false);
  const [hoveredTab, setHoveredTab] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const timerRef = useRef(null);
  const touchUnpauseRef = useRef(null);
  const panelinVideoRef = useRef(null);
  const prevStepIdRef = useRef(stepId);

  const effectiveScenario = hoverScenarioId || scenarioId;

  const borderSlides = useMemo(() => {
    void shopifyOverrideGen;
    return getBorderAccentSlides({
      borders: techoBorders,
      zonasBorders: techoZonasBorders,
      tipoAguas,
    });
  }, [techoBorders, techoZonasBorders, tipoAguas, shopifyOverrideGen]);

  const { slides: baseSlides, shopHref, heading } = useMemo(
    () =>
      getQuoteVisorContext({
        scenarioId: effectiveScenario,
        stepId,
        techoFamilia: hoverTechoFamilia || techoFamilia,
        techoColor: hoverTechoColor || techoColor,
      }),
    [effectiveScenario, stepId, techoFamilia, hoverTechoFamilia, techoColor, hoverTechoColor],
  );

  const mergedSlides = useMemo(() => {
    const seen = new Set();
    const out = [];
    const allowAccessorySlides = !["familia", "espesor", "color"].includes(stepId || "");
    const push = (s) => {
      const k = s.src || s.title;
      if (!k || seen.has(k)) return;
      seen.add(k);
      out.push(s);
    };
    if (allowAccessorySlides) {
      borderSlides.forEach((b) =>
        push({
          src: b.src,
          title: b.title,
          subtitle: b.subtitle,
          href: b.href,
          kind: "border",
          borderId: b.id,
        }),
      );
    }
    baseSlides.forEach((s) => push({ ...s, kind: "base" }));
    return out;
  }, [baseSlides, borderSlides, stepId]);

  const slides = mergedSlides;

  const showAguaStep =
    (stepId === "tipoAguas" && (scenarioId === "solo_techo" || scenarioId === "techo_fachada")) ||
    (aguasHighlight && (scenarioId === "solo_techo" || scenarioId === "techo_fachada"));

  const showListaStep = stepId === "lista";
  const showRoof3DInVisor = showRoof3DStage && !showListaStep;

  useEffect(() => {
    const prev = prevStepIdRef.current;
    if (prev === stepId) return;
    prevStepIdRef.current = stepId;
    const slotOn = Boolean(roof2DPreview) && Boolean(stepId && ROOF_2D_QUOTE_VISOR_STEP_IDS.has(stepId));
    if (slotOn) {
      setOpen(false);
      setRoof3dOpen(false);
    } else {
      setOpen(true);
      setRoof3dOpen(true);
    }
  }, [stepId, roof2DPreview]);

  useEffect(() => {
    setIdx(0);
  }, [effectiveScenario, stepId, techoFamilia, hoverTechoFamilia, techoColor, hoverTechoColor, showAguaStep, showListaStep, aguasHighlight, slides.length]);

  useEffect(() => {
    const v = panelinVideoRef.current;
    if (!v) return;
    if (open && showListaStep) {
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } else {
      v.pause();
    }
  }, [open, showListaStep]);

  useEffect(() => {
    if (!open || showAguaStep || showListaStep || slides.length <= 1 || paused) return;
    timerRef.current = window.setInterval(() => {
      setIdx((i) => (i + 1) % slides.length);
    }, CAROUSEL_MS);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [open, showAguaStep, showListaStep, slides.length, paused]);

  useEffect(() => {
    return () => clearTimeout(touchUnpauseRef.current);
  }, []);

  // Keyboard listener for Shift key (ProductExplorerTabs Shift+hover)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.shiftKey) setShiftPressed(true);
    };
    const handleKeyUp = (e) => {
      if (!e.shiftKey) setShiftPressed(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const go = useCallback(
    (delta) => {
      if (!slides.length) return;
      setIdx((i) => (i + delta + slides.length) % slides.length);
    },
    [slides.length],
  );

  const setHostRef = useCallback(
    (el) => {
      if (roofCanvasHostRef) roofCanvasHostRef.current = el;
      onRoofCanvasHostReady?.(el);
    },
    [roofCanvasHostRef, onRoofCanvasHostReady],
  );

  const slide = slides[idx] || slides[0];
  const slideShopHref = slide?.href || shopHref;

  const applyOverrideForCurrentBorder = useCallback(() => {
    const bid = slide?.borderId;
    if (!bid) return;
    writeShopifyImageOverride(bid, overrideDraft);
    setShopifyOverrideGen((g) => g + 1);
    setShowOverride(false);
    setOverrideDraft("");
  }, [slide?.borderId, overrideDraft]);

  useEffect(() => {
    if (!showOverride) return;
    const bid = slide?.borderId;
    const ov = readShopifyImageOverrides();
    setOverrideDraft(bid ? ov[bid] || "" : "");
  }, [showOverride, slide?.borderId, idx]);

  return (
    <div
      data-bmc-view="quote-visual-visor"
      data-bmc-component="QuoteVisualVisor"
      style={{
        fontFamily: FONT,
        background: C.surface,
        borderRadius: 16,
        border: `1px solid ${C.border}`,
        boxShadow: SHC,
        marginBottom: 16,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        ...(stepId === "estructura" && roof2DPreview
          ? { minHeight: "min(90dvh, 1180px)" }
          : {}),
      }}
    >
      <button
        type="button"
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
        <span>Visor visual · {showListaStep ? "Panelin" : heading}</span>
        {open ? <ChevronUp size={18} color={C.ts} /> : <ChevronDown size={18} color={C.ts} />}
      </button>

      {roof2DPreview ? (
        <div
          style={{
            paddingLeft: 16,
            paddingRight: 16,
            marginBottom: 16,
            display: "flex",
            flexDirection: "column",
            flex: stepId === "estructura" ? 1 : undefined,
            minHeight: stepId === "estructura" ? 0 : undefined,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: C.ts,
              marginBottom: 8,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              flexShrink: 0,
            }}
          >
            Vista previa del techo (2D)
          </div>
          <div
            style={{
              borderRadius: 12,
              border: `1px solid ${C.border}`,
              background: "#fff",
              minWidth: 0,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              flex: stepId === "estructura" ? 1 : undefined,
              minHeight: stepId === "estructura" ? 0 : undefined,
              ...(stepId === "estructura"
                ? {
                    minHeight: "clamp(420px, calc(100dvh - 200px), min(1200px, 96dvh))",
                    maxHeight: "min(96dvh, 1200px)",
                  }
                : {
                    minHeight: "clamp(300px, min(52dvh, 560px), 640px)",
                  }),
            }}
          >
            <div
              style={{
                flex: 1,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
              }}
            >
              {roof2DPreview}

              {/* NEW (toggleable via enhancedProductViz, default OFF, no effect on current state): Real product reference from the researched image mapping + DWG notes.
                  Uses public URLs from kingspan.com.uy / bmcuruguay (exact matches to calculator products per the PRODUCT-IMAGE-MAPPING-VERIFICATION.pdf).
                  Includes cross-ref to internal TECHMET/BMC DWGs for plegados/grecas/forros/babetas profiles (to be used in future 3D/2D enhancements behind same flag).
                  Placed here for visibility during familia/espesor steps and in results without replacing any existing carousels or 3D. */}
              {enhancedProductViz && techoFamilia && (
                <div style={{ marginTop: 12, padding: "8px 12px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#166534", marginBottom: 4 }}>
                    Producto real (ref. mapeo investigación UY + DWGs) — {techoFamilia}
                  </div>
                  {(() => {
                    const refMap = {
                      ISOROOF_3G: "https://kingspan.com.uy/wp-content/uploads/2024/06/isoroof_3G.png",
                      ISOROOF_PLUS: "https://kingspan.com.uy/wp-content/uploads/2024/06/isoroof_plus.png",
                      ISOROOF_FOIL: "https://kingspan.com.uy/wp-content/uploads/2024/10/isoroof_foil-tabla.png",
                      ISOROOF_COLONIAL: "https://kingspan.com.uy/wp-content/uploads/2024/06/Isoroof-colonial.jpg.webp",
                      ISODEC_PIR: "https://kingspan.com.uy/wp-content/uploads/2024/06/isodec-pir.png",
                      ISODEC_EPS: "https://kingspan.com.uy/wp-content/uploads/2024/06/isodec-pir.png",
                    };
                    const url = refMap[techoFamilia] || refMap.ISOROOF_3G;
                    const bmUrl = techoFamilia.startsWith("ISOROOF") ? "https://bmcuruguay.com.uy/cdn/shop/files/Isoroof.jpg" : null;

                    // NEW: 2D CAD-style cross section (inspired by FreeCAD TechDraw videos + TECHMET/BMC DWGs).
                    // Represents real plegado/grecas profile for the family (3 grecas trapezoidal for ISOROOF, engrafado for ISODEC).
                    // Safe, behind flag, additive. Future: drive from panelConstructionSpecs + exact DWG dims.
                    const render2DProfile = (fam) => {
                      const isIsoroof = fam.startsWith("ISOROOF");
                      const isIsodec = fam.startsWith("ISODEC");
                      // Simple SVG profile (top view of the corrugation). Units conceptual (scale to ~1m ancho útil).
                      // For ISOROOF: 3 grecas (ribs) + valleys. For ISODEC: flatter engrafado style.
                      const svg = isIsoroof ? (
                        <svg width="160" height="48" viewBox="0 0 160 48" style={{ border: "1px solid #86efac", borderRadius: 3, background: "#fff" }}>
                          <defs>
                            <pattern id="hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
                              <line x1="0" y1="0" x2="0" y2="6" stroke="#166534" strokeWidth="1" />
                            </pattern>
                          </defs>
                          {/* Base sheet */}
                          <rect x="8" y="32" width="144" height="4" fill="#e5e7eb" />
                          {/* 3 grecas (trapezoidal ribs) - approx real plegado */}
                          <polygon points="20,32 28,18 40,18 48,32" fill="#86efac" stroke="#166534" strokeWidth="1" />
                          <polygon points="60,32 68,18 80,18 88,32" fill="#86efac" stroke="#166534" strokeWidth="1" />
                          <polygon points="100,32 108,18 120,18 128,32" fill="#86efac" stroke="#166534" strokeWidth="1" />
                          {/* Valleys / liner hint */}
                          <rect x="8" y="36" width="144" height="8" fill="url(#hatch)" opacity="0.4" />
                          {/* Labels (CAD style) */}
                          <text x="80" y="12" fontSize="7" fill="#166534" textAnchor="middle" fontFamily="monospace">3 grecas | AU ~1000mm</text>
                          <text x="80" y="46" fontSize="6" fill="#166534" textAnchor="middle" fontFamily="monospace">Perfil plegado (TECHMET F*-MET + BMC Desarrollos)</text>
                        </svg>
                      ) : isIsodec ? (
                        <svg width="160" height="48" viewBox="0 0 160 48" style={{ border: "1px solid #86efac", borderRadius: 3, background: "#fff" }}>
                          <defs>
                            <pattern id="hatch2" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
                              <line x1="0" y1="0" x2="0" y2="6" stroke="#166534" strokeWidth="1" />
                            </pattern>
                          </defs>
                          <rect x="8" y="32" width="144" height="4" fill="#e5e7eb" />
                          {/* Engrafado / flatter profile for ISODEC (more linear, engrafado edges) */}
                          <polyline points="20,32 30,22 50,22 60,32 80,32 90,22 110,22 120,32 140,32" fill="none" stroke="#166534" strokeWidth="2" />
                          <rect x="8" y="36" width="144" height="8" fill="url(#hatch2)" opacity="0.35" />
                          <text x="80" y="12" fontSize="7" fill="#166534" textAnchor="middle" fontFamily="monospace">Engrafado | AU ~1120mm</text>
                          <text x="80" y="46" fontSize="6" fill="#166534" textAnchor="middle" fontFamily="monospace">Perfil constructivo (ref DWG + forros F1-MET)</text>
                        </svg>
                      ) : null;

                      return (
                        <div style={{ marginTop: 6 }}>
                          <div style={{ fontSize: 8, fontWeight: 600, color: "#166534", marginBottom: 2 }}>Sección 2D constructiva (inspirada TechDraw / DWG)</div>
                          {svg}
                        </div>
                      );
                    };

                    return (
                      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <img src={url} alt="Real ref" style={{ width: 120, height: 80, objectFit: "cover", borderRadius: 6, border: "1px solid #86efac" }} onError={e=>e.currentTarget.style.opacity=0.3} />
                        {bmUrl && <img src={bmUrl} alt="Comercial BMC" style={{ width: 120, height: 80, objectFit: "cover", borderRadius: 6, border: "1px solid #86efac" }} onError={e=>e.currentTarget.style.display='none'} />}
                        <div style={{ fontSize: 9, color: "#166534", lineHeight: 1.3 }}>
                          Fuente: kingspan.com.uy + bmcuruguay (mapeo exacto a calculadora). Ver PDF completo: docs/team/visual/PRODUCT-IMAGE-MAPPING-VERIFICATION.pdf<br/>
                          DWG: perfiles de plegados/grecas/forros (F*-MET) y babetas en TECHMET + BMC/Desarrollos/BabetaLateral (usar para extrusión 3D precisa cuando se active la fase volumétrica).
                          {render2DProfile(techoFamilia)}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Visualización 3D: host del portal RoofBorderCanvas; fuera de `{open && …}` para no desmontar al colapsar (evita React #200). */}
      {showRoof3DInVisor && (
        <div
          style={{
            paddingLeft: 16,
            paddingRight: 16,
            marginBottom: roof2dQuoteVisorLayout ? (roof3dOpen ? 16 : 8) : open ? 16 : 0,
          }}
        >
          {roof2dQuoteVisorLayout ? (
            <>
              <button
                type="button"
                onClick={() => setRoof3dOpen((v) => !v)}
                aria-expanded={roof3dOpen}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: `1px solid ${C.border}`,
                  background: C.surfaceAlt,
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: 700,
                  color: C.tp,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span>Visualización 3D</span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: C.primary,
                      textTransform: "none",
                      letterSpacing: "0.04em",
                      padding: "3px 8px",
                      borderRadius: 6,
                      background: C.primarySoft,
                      border: `1px solid ${C.primary}`,
                    }}
                  >
                    Próximamente
                  </span>
                </span>
                {roof3dOpen ? <ChevronUp size={18} color={C.ts} /> : <ChevronDown size={18} color={C.ts} />}
              </button>
              <div style={{ position: "relative", width: "100%", marginTop: 8 }}>
                <div
                  ref={setHostRef}
                  data-bmc-roof-3d-host
                  data-bmc-view="visualizacion-3d"
                  data-bmc-view-legacy="roof-border-canvas-host"
                  data-bmc-component="RoofBorderCanvas-portal-host"
                  role="region"
                  aria-label="Visualización 3D: planta y bordes del techo"
                  title="Visualización 3D — planta y bordes (RoofBorderCanvas vía portal)"
                  style={{
                    width: "100%",
                    height: "clamp(360px, min(72vh, 820px), 900px)",
                    minHeight: "clamp(360px, min(72vh, 820px), 900px)",
                    borderRadius: 12,
                    border: `1px solid ${C.border}`,
                    background: "#eef2f9",
                    minWidth: 0,
                    overflow: "hidden",
                    boxSizing: "border-box",
                    display: roof3dOpen ? "block" : "none",
                  }}
                />
                {roof3dOpen && (
                  <>
                    <div
                      aria-hidden
                      style={{
                        position: "absolute",
                        inset: 0,
                        pointerEvents: "none",
                        display: "flex",
                        alignItems: "flex-end",
                        justifyContent: "center",
                        paddingBottom: 10,
                        zIndex: 2,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 8,
                          fontWeight: 600,
                          color: C.ts,
                          letterSpacing: "0.04em",
                          fontFamily: FONT,
                          lineHeight: 1.2,
                          padding: "2px 7px",
                          borderRadius: 5,
                          background: "rgba(255,255,255,0.78)",
                          border: `1px solid ${C.border}`,
                          boxShadow: "0 1px 2px rgba(15,23,42,0.06)",
                        }}
                      >
                        Frente
                      </span>
                    </div>
                    <div
                      aria-hidden
                      style={{
                        position: "absolute",
                        inset: 0,
                        pointerEvents: "none",
                        zIndex: 3,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "rgba(255,255,255,0.72)",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 18,
                          fontWeight: 800,
                          color: C.tp,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          padding: "12px 20px",
                          borderRadius: 12,
                          border: `2px dashed ${C.border}`,
                          background: "rgba(255,255,255,0.95)",
                          boxShadow: SHC,
                        }}
                      >
                        Próximamente
                      </span>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              {open && (
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: C.ts,
                    marginBottom: 8,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}
                >
                  Visualización 3D
                </div>
              )}
              <div style={{ position: "relative", width: "100%" }}>
                <div
                  ref={setHostRef}
                  data-bmc-roof-3d-host
                  data-bmc-view="visualizacion-3d"
                  data-bmc-view-legacy="roof-border-canvas-host"
                  data-bmc-component="RoofBorderCanvas-portal-host"
                  role="region"
                  aria-label="Visualización 3D: planta y bordes del techo"
                  title="Visualización 3D — planta y bordes (RoofBorderCanvas vía portal)"
                  style={{
                    width: "100%",
                    /* Altura explícita: solo min-height no estira hijos height:100% → canvas 3D quedaba bajo/recortado */
                    height: "clamp(360px, min(72vh, 820px), 900px)",
                    minHeight: "clamp(360px, min(72vh, 820px), 900px)",
                    borderRadius: 12,
                    border: `1px solid ${C.border}`,
                    background: "#eef2f9",
                    minWidth: 0,
                    overflow: "hidden",
                    boxSizing: "border-box",
                    /* Colapsado: el nodo sigue en el DOM (portal válido); oculto visualmente */
                    display: open ? "block" : "none",
                  }}
                />
                {open && (
                  <div
                    aria-hidden
                    style={{
                      position: "absolute",
                      inset: 0,
                      pointerEvents: "none",
                      display: "flex",
                      alignItems: "flex-end",
                      justifyContent: "center",
                      paddingBottom: 10,
                      zIndex: 2,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 8,
                        fontWeight: 600,
                        color: C.ts,
                        letterSpacing: "0.04em",
                        fontFamily: FONT,
                        lineHeight: 1.2,
                        padding: "2px 7px",
                        borderRadius: 5,
                        background: "rgba(255,255,255,0.78)",
                        border: `1px solid ${C.border}`,
                        boxShadow: "0 1px 2px rgba(15,23,42,0.06)",
                      }}
                    >
                      Frente
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {showListaStep && (
        <div
          style={{
            paddingLeft: 16,
            paddingRight: 16,
            marginBottom: open ? 16 : 0,
          }}
        >
          <div
            style={{
              width: "100%",
              height: "clamp(420px, min(85vh, 980px), 1050px)",
              minHeight: "clamp(420px, min(85vh, 980px), 1050px)",
              borderRadius: 12,
              border: `1px solid ${C.border}`,
              background: "linear-gradient(180deg, #eef2f9 0%, #e2e8f4 100%)",
              minWidth: 0,
              overflow: "hidden",
              boxSizing: "border-box",
              display: open ? "block" : "none",
              position: "relative",
            }}
          >
            <video
              ref={panelinVideoRef}
              src={PANELIN_LISTA_VIDEO_SRC}
              loop
              muted
              playsInline
              preload="metadata"
              title="Panelin"
              aria-label="Panelin, asistente BMC"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "center",
                display: "block",
                pointerEvents: "none",
              }}
            />
            {/* Fade overlays — only top/bottom to avoid side column artifact */}
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "linear-gradient(to bottom, #eef2f9 0%, transparent 10%)" }} />
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "linear-gradient(to top, #e2e8f4 0%, transparent 12%)" }} />
          </div>
        </div>
      )}

      {open && !showListaStep && (
        <div
          style={{ padding: 16 }}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onTouchStart={() => { clearTimeout(touchUnpauseRef.current); setPaused(true); }}
          onTouchEnd={() => { clearTimeout(touchUnpauseRef.current); touchUnpauseRef.current = setTimeout(() => setPaused(false), 8000); }}
        >
          {dimensionSummary ? (
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: C.tp,
                marginBottom: 12,
                padding: "8px 12px",
                borderRadius: 10,
                background: C.surfaceAlt,
                border: `1px solid ${C.border}`,
              }}
            >
              Dimensiones cargadas · {dimensionSummary}
            </div>
          ) : null}

          {hoverScenarioId && hoverScenarioId !== scenarioId && (
            <div
              style={{
                fontSize: 11,
                color: C.primary,
                fontWeight: 600,
                marginBottom: 10,
                padding: "6px 10px",
                background: C.primarySoft,
                borderRadius: 8,
              }}
            >
              Vista previa al pasar el cursor · escenario: {hoverScenarioId.replace(/_/g, " ")}
            </div>
          )}

          {stepId === "familia" && hoverTechoFamilia && (
            <div
              style={{
                fontSize: 11,
                color: C.primary,
                fontWeight: 600,
                marginBottom: 10,
                padding: "6px 10px",
                background: C.primarySoft,
                borderRadius: 8,
              }}
            >
              Vista previa al pasar el cursor · familia: {hoverTechoFamilia.replace(/_/g, " ")}
            </div>
          )}

          {showAguaStep ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {(["una_agua", "dos_aguas"]).map((key) => {
                const label = key === "una_agua" ? "Una agua" : "Dos aguas";
                const src = DEFAULT_AGUA_REFERENCE_IMAGES[key];
                const selected = tipoAguas === key;
                const clickable = !!onSelectAgua;
                return (
                  <div
                    key={key}
                    role={clickable ? "button" : undefined}
                    tabIndex={clickable ? 0 : undefined}
                    onClick={clickable ? () => { onSelectAgua(key); if (onNext) onNext(); } : undefined}
                    onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") { onSelectAgua(key); if (onNext) onNext(); } } : undefined}
                    style={{
                      borderRadius: 12,
                      border: `2px solid ${selected ? C.primary : C.border}`,
                      padding: 12,
                      background: selected ? C.primarySoft : "#fff",
                      cursor: clickable ? "pointer" : "default",
                      transition: "border-color 0.15s, box-shadow 0.15s",
                      boxShadow: selected ? `0 0 0 3px ${C.primarySoft}` : "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: C.tp }}>{label}</span>
                      {selected && (
                        <span style={{ fontSize: 10, fontWeight: 800, color: C.primary, textTransform: "uppercase" }}>Selección actual</span>
                      )}
                    </div>
                    <div
                      style={{
                        position: "relative",
                        borderRadius: 10,
                        overflow: "hidden",
                        background: "#fff",
                        minHeight: 140,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <img
                        src={src}
                        alt={label}
                        style={{
                          maxWidth: "100%",
                          /* Mantener diagramas completos visibles con cabecera BMC: cap más bajo que 36vh. */
                          maxHeight: "min(200px, calc((100dvh - 200px) / 2.2))",
                          width: "auto",
                          height: "auto",
                          objectFit: "contain",
                          display: "block",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
              <a
                href={QUOTE_VISOR_SHOP_URLS.panelesAislantes}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  color: C.primary,
                  textDecoration: "none",
                }}
              >
                Ver paneles de techo en tienda <ExternalLink size={14} />
              </a>
            </div>
          ) : slide ? (
            <>
              <div
                style={{
                  position: "relative",
                  borderRadius: 12,
                  background: "#fff",
                  minHeight: 200,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  border: `1px solid ${C.border}`,
                }}
              >
                <img
                  key={slide.src + idx}
                  src={slide.src}
                  alt={slide.title}
                  width={800}
                  height={600}
                  decoding="async"
                  // DOM: `fetchpriority` (HTML); React warns on `fetchPriority` passthrough to DOM.
                  // eslint-disable-next-line react/no-unknown-property -- intentional HTML attribute casing
                  fetchpriority={idx === 0 ? "high" : "auto"}
                  style={{
                    width: "100%",
                    maxHeight: "min(42vh, 420px)",
                    objectFit: "contain",
                    display: "block",
                    transition: TR,
                  }}
                />
                {slide.borderId && (
                  <button
                    type="button"
                    title="Editar URL de imagen (local)"
                    onClick={() => setShowOverride((v) => !v)}
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      border: `1px solid ${C.border}`,
                      background: "rgba(255,255,255,0.94)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: SHC,
                    }}
                  >
                    <Pencil size={16} color={C.tp} />
                  </button>
                )}
                {slides.length > 1 && (
                  <>
                    <button
                      type="button"
                      aria-label="Anterior"
                      onClick={() => go(-1)}
                      style={{
                        position: "absolute",
                        left: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        border: `1px solid ${C.border}`,
                        background: "rgba(255,255,255,0.92)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: SHC,
                      }}
                    >
                      <ChevronLeft size={20} color={C.tp} />
                    </button>
                    <button
                      type="button"
                      aria-label="Siguiente"
                      onClick={() => go(1)}
                      style={{
                        position: "absolute",
                        right: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        border: `1px solid ${C.border}`,
                        background: "rgba(255,255,255,0.92)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: SHC,
                      }}
                    >
                      <ChevronRight size={20} color={C.tp} />
                    </button>
                  </>
                )}
              </div>
              {showOverride && slide.borderId && (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                  <input
                    value={overrideDraft}
                    onChange={(e) => setOverrideDraft(e.target.value)}
                    placeholder="URL de imagen (https://…)"
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: `1px solid ${C.border}`,
                      fontSize: 13,
                    }}
                  />
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={applyOverrideForCurrentBorder}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 8,
                        border: "none",
                        background: C.primary,
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Guardar override
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        writeShopifyImageOverride(slide.borderId, "");
                        setShopifyOverrideGen((g) => g + 1);
                        setShowOverride(false);
                      }}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 8,
                        border: `1px solid ${C.border}`,
                        background: C.surface,
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      Restaurar default
                    </button>
                  </div>
                </div>
              )}
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.tp }}>{slide.title}</div>
                {slide.subtitle && <div style={{ fontSize: 12, color: C.ts, marginTop: 4 }}>{slide.subtitle}</div>}
                {slide.description && (
                  <div
                    style={{
                      fontSize: 12,
                      color: C.tp,
                      marginTop: 6,
                      lineHeight: 1.5,
                    }}
                  >
                    {slide.description}
                  </div>
                )}
              </div>
              {slides.length > 1 && (
                <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 12 }}>
                  {slides.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Ir a imagen ${i + 1}`}
                      onClick={() => setIdx(i)}
                      style={{
                        width: i === idx ? 22 : 8,
                        height: 8,
                        borderRadius: 4,
                        border: "none",
                        background: i === idx ? C.primary : C.border,
                        cursor: "pointer",
                        padding: 0,
                        transition: TR,
                      }}
                    />
                  ))}
                </div>
              )}
              <a
                href={slideShopHref}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  marginTop: 14,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  color: C.primary,
                  textDecoration: "none",
                }}
              >
                Ver en tienda BMC <ExternalLink size={14} />
              </a>

              {/* ProductExplorerTabs: 3-tab interface for product details */}
              {slide && (
                <ProductExplorerTabs
                  product={slide}
                  onMouseEnter={() => setHoveredTab(true)}
                  onMouseLeave={() => setHoveredTab(false)}
                  onMouseMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
                />
              )}
            </>
          ) : null}
        </div>
      )}

      {/* ProductTooltip: Shift+hover description tooltip */}
      {slide && shiftPressed && hoveredTab && (
        <ProductTooltip
          product={slide}
          visible={true}
          position={tooltipPos}
        />
      )}
    </div>
  );
}
