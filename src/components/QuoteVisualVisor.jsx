import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ExternalLink, Pencil } from "lucide-react";
import { C, FONT, SHC, TR } from "../data/constants.js";
import { DEFAULT_AGUA_REFERENCE_IMAGES, getQuoteVisorContext, QUOTE_VISOR_SHOP_URLS } from "../data/quoteVisorMedia.js";
import { getBorderAccentSlides, readShopifyImageOverrides, writeShopifyImageOverride } from "../data/quoteVisorShopifyResolve.js";

const CAROUSEL_MS = 5500;

/** Asset en `public/video/panelin-lista-loop.mp4` (Vite sirve bajo BASE_URL). */
const PANELIN_LISTA_VIDEO_SRC = `${import.meta.env.BASE_URL}video/panelin-lista-loop.mp4`;

/**
 * Visor visual derecho: etapa 3D (host) + carrusel Shopify según escenario / paso / bordes activos.
 *
 * @param {object} props
 * @param {string} props.scenarioId
 * @param {string | null} [props.hoverScenarioId]
 * @param {string | null} [props.stepId]
 * @param {string} [props.tipoAguas]
 * @param {string} [props.techoFamilia]
 * @param {boolean} [props.aguasHighlight]
 * @param {boolean} [props.showRoof3DStage]
 * @param {import("react").MutableRefObject<HTMLElement | null>} [props.roofCanvasHostRef]
 * @param {(el: HTMLElement | null) => void} [props.onRoofCanvasHostReady]
 * @param {Record<string, string>} [props.techoBorders]
 * @param {Record<string, string>[]} [props.techoZonasBorders]
 * @param {string | null} [props.dimensionSummary] — resumen L×W (paso dimensiones)
 * @param {(key: "una_agua"|"dos_aguas") => void} [props.onSelectAgua] — selecciona tipo de aguas desde el visor
 * @param {() => void} [props.onNext] — avanza al siguiente paso desde el visor
 */
export default function QuoteVisualVisor({
  scenarioId,
  hoverScenarioId = null,
  stepId = null,
  tipoAguas = "una_agua",
  techoFamilia = "",
  aguasHighlight = false,
  showRoof3DStage = false,
  roofCanvasHostRef,
  onRoofCanvasHostReady,
  techoBorders = {},
  techoZonasBorders = [],
  dimensionSummary = null,
  onSelectAgua = null,
  onNext = null,
}) {
  const [open, setOpen] = useState(true);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [overrideDraft, setOverrideDraft] = useState("");
  const [showOverride, setShowOverride] = useState(false);
  const [shopifyOverrideGen, setShopifyOverrideGen] = useState(0);
  const timerRef = useRef(null);
  const panelinVideoRef = useRef(null);

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
        techoFamilia,
      }),
    [effectiveScenario, stepId, techoFamilia],
  );

  const mergedSlides = useMemo(() => {
    const seen = new Set();
    const out = [];
    const push = (s) => {
      const k = s.src || s.title;
      if (!k || seen.has(k)) return;
      seen.add(k);
      out.push(s);
    };
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
    baseSlides.forEach((s) => push({ ...s, kind: "base" }));
    return out;
  }, [baseSlides, borderSlides]);

  const slides = mergedSlides;

  const showAguaStep =
    (stepId === "tipoAguas" && (scenarioId === "solo_techo" || scenarioId === "techo_fachada")) ||
    (aguasHighlight && (scenarioId === "solo_techo" || scenarioId === "techo_fachada"));

  const showListaStep = stepId === "lista";
  const showRoof3DInVisor = showRoof3DStage && !showListaStep;

  useEffect(() => {
    setIdx(0);
  }, [effectiveScenario, stepId, techoFamilia, showAguaStep, showListaStep, aguasHighlight, slides.length]);

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
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          border: "none",
          background: C.surfaceAlt,
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 700,
          color: C.tp,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        <span>Visor visual · {showListaStep ? "Panelin" : heading}</span>
        {open ? <ChevronUp size={18} color={C.ts} /> : <ChevronDown size={18} color={C.ts} />}
      </button>

      {/* Host del portal 3D: fuera de `{open && …}` para que no se desmonte al colapsar el acordeón (evita React #200: portal a nodo desconectado). */}
      {showRoof3DInVisor && (
        <div
          style={{
            paddingLeft: 16,
            paddingRight: 16,
            marginBottom: open ? 16 : 0,
          }}
        >
          <div
            ref={setHostRef}
            data-bmc-roof-3d-host
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
                objectFit: "contain",
                display: "block",
                pointerEvents: "none",
              }}
            />
            {/* Fade overlays — top, bottom, left, right */}
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "linear-gradient(to right, #eaf0f8 0%, transparent 14%)" }} />
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "linear-gradient(to left, #e8eef6 0%, transparent 18%)" }} />
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
                        style={{ maxWidth: "100%", maxHeight: "min(36vh, 240px)", objectFit: "contain", display: "block" }}
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
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
