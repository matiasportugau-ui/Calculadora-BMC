import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ExternalLink, ImagePlus, Pencil } from "lucide-react";
import { C, FONT, SHC, TR } from "../data/constants.js";
import {
  DEFAULT_AGUA_REFERENCE_IMAGES,
  DEFAULT_LISTA_REFERENCE_IMAGES,
  getQuoteVisorContext,
  QUOTE_VISOR_SHOP_URLS,
} from "../data/quoteVisorMedia.js";
import { getBorderAccentSlides, readShopifyImageOverrides, writeShopifyImageOverride } from "../data/quoteVisorShopifyResolve.js";

const AGUA_STORAGE_KEY = "bmc-panelin-visor-agua-images";
const LISTA_STORAGE_KEY = "bmc-panelin-visor-lista-images";
const CAROUSEL_MS = 5500;

function readAguaOverrides() {
  try {
    const raw = sessionStorage.getItem(AGUA_STORAGE_KEY);
    if (!raw) return { una_agua: "", dos_aguas: "" };
    const j = JSON.parse(raw);
    return {
      una_agua: typeof j.una_agua === "string" ? j.una_agua : "",
      dos_aguas: typeof j.dos_aguas === "string" ? j.dos_aguas : "",
    };
  } catch {
    return { una_agua: "", dos_aguas: "" };
  }
}

function writeAguaOverrides(next) {
  try {
    sessionStorage.setItem(AGUA_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
}

function readListaOverrides() {
  try {
    const raw = sessionStorage.getItem(LISTA_STORAGE_KEY);
    if (!raw) return { venta: "", web: "", extra: "" };
    const j = JSON.parse(raw);
    return {
      venta: typeof j.venta === "string" ? j.venta : "",
      web: typeof j.web === "string" ? j.web : "",
      extra: typeof j.extra === "string" ? j.extra : "",
    };
  } catch {
    return { venta: "", web: "", extra: "" };
  }
}

function writeListaOverrides(next) {
  try {
    sessionStorage.setItem(LISTA_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
}

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
 * @param {string} [props.listaPrecios] — "venta" | "web" | ""
 * @param {string | null} [props.dimensionSummary] — resumen L×W (paso dimensiones)
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
  listaPrecios = "",
  dimensionSummary = null,
}) {
  const [open, setOpen] = useState(true);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [aguaCustom, setAguaCustom] = useState(() => readAguaOverrides());
  const [listaCustom, setListaCustom] = useState(() => readListaOverrides());
  const [listaExtraOpen, setListaExtraOpen] = useState(() => !!readListaOverrides().extra);
  const [overrideDraft, setOverrideDraft] = useState("");
  const [showOverride, setShowOverride] = useState(false);
  const [shopifyOverrideGen, setShopifyOverrideGen] = useState(0);
  const timerRef = useRef(null);

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

  useEffect(() => {
    setIdx(0);
  }, [effectiveScenario, stepId, techoFamilia, showAguaStep, showListaStep, aguasHighlight, slides.length]);

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

  const onUploadAgua = useCallback((key, file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      setAguaCustom((prev) => {
        const next = { ...prev, [key]: dataUrl };
        writeAguaOverrides(next);
        return next;
      });
    };
    reader.readAsDataURL(file);
  }, []);

  const clearAgua = useCallback((key) => {
    setAguaCustom((prev) => {
      const next = { ...prev, [key]: "" };
      writeAguaOverrides(next);
      return next;
    });
  }, []);

  const onUploadLista = useCallback((key, file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      setListaCustom((prev) => {
        const next = { ...prev, [key]: dataUrl };
        writeListaOverrides(next);
        return next;
      });
    };
    reader.readAsDataURL(file);
  }, []);

  const clearLista = useCallback((key) => {
    setListaCustom((prev) => {
      const next = { ...prev, [key]: "" };
      writeListaOverrides(next);
      return next;
    });
    if (key === "extra") setListaExtraOpen(false);
  }, []);

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
        <span>Visor visual · {heading}</span>
        {open ? <ChevronUp size={18} color={C.ts} /> : <ChevronDown size={18} color={C.ts} />}
      </button>

      {open && (
        <div
          style={{ padding: 16 }}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {showRoof3DStage && (
            <div
              ref={setHostRef}
              data-bmc-roof-3d-host
              style={{
                width: "100%",
                minHeight: "min(52vh, 560px)",
                marginBottom: 16,
                borderRadius: 12,
                border: `1px solid ${C.border}`,
                background: "#eef2f9",
                minWidth: 0,
                overflow: "hidden",
              }}
            />
          )}

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
              <div style={{ fontSize: 13, color: C.ts, lineHeight: 1.5 }}>
                Referencias de <strong style={{ color: C.tp }}>una agua</strong> y{" "}
                <strong style={{ color: C.tp }}>dos aguas</strong> con nuestros paneles de techo. Podés{" "}
                <strong style={{ color: C.tp }}>subir fotos reales</strong> de obra; se guardan en esta sesión del
                navegador.
              </div>
              {(["una_agua", "dos_aguas"]).map((key) => {
                const label = key === "una_agua" ? "Una agua" : "Dos aguas";
                const src = aguaCustom[key] || DEFAULT_AGUA_REFERENCE_IMAGES[key];
                const selected = tipoAguas === key;
                return (
                  <div
                    key={key}
                    style={{
                      borderRadius: 12,
                      border: `2px solid ${selected ? C.primary : C.border}`,
                      padding: 12,
                      background: selected ? C.primarySoft : "#fff",
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
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10, alignItems: "center" }}>
                      <label
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "6px 12px",
                          borderRadius: 8,
                          background: C.primary,
                          color: "#fff",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        <ImagePlus size={14} />
                        Subir imagen
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: "none" }}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) onUploadAgua(key, f);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      {aguaCustom[key] && (
                        <button
                          type="button"
                          onClick={() => clearAgua(key)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 8,
                            border: `1px solid ${C.border}`,
                            background: C.surface,
                            fontSize: 12,
                            cursor: "pointer",
                            color: C.danger,
                            fontWeight: 600,
                          }}
                        >
                          Quitar foto
                        </button>
                      )}
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
          ) : showListaStep ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ fontSize: 13, color: C.ts, lineHeight: 1.5 }}>
                Referencias para <strong style={{ color: C.tp }}>lista BMC (venta)</strong> y{" "}
                <strong style={{ color: C.tp }}>lista Web</strong>. Podés{" "}
                <strong style={{ color: C.tp }}>subir capturas o PDF exportado a imagen</strong>; se guardan en esta sesión.
                Usá la barra del visor arriba para colapsar o expandir, y el <strong style={{ color: C.tp }}>separador</strong>{" "}
                entre columnas para agrandar la vista.
              </div>
              {(
                [
                  { key: "venta", label: "Lista BMC (venta directo)", hint: "Precios operación BMC" },
                  { key: "web", label: "Lista precios Web", hint: "Referencia tienda / web" },
                ]
              ).map(({ key, label, hint }) => {
                const src = listaCustom[key] || DEFAULT_LISTA_REFERENCE_IMAGES[key];
                const selected = listaPrecios === key;
                return (
                  <div
                    key={key}
                    style={{
                      borderRadius: 12,
                      border: `2px solid ${selected ? C.primary : C.border}`,
                      padding: 12,
                      background: selected ? C.primarySoft : "#fff",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: C.tp }}>{label}</span>
                      {listaPrecios === key && (
                        <span style={{ fontSize: 10, fontWeight: 800, color: C.primary, textTransform: "uppercase" }}>Selección actual</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: C.ts, marginBottom: 8 }}>{hint}</div>
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
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                      <label
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "6px 12px",
                          borderRadius: 8,
                          border: `1px solid ${C.border}`,
                          background: C.surface,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          color: C.primary,
                        }}
                      >
                        <ImagePlus size={14} />
                        Subir o reemplazar
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: "none" }}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) onUploadLista(key, f);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      {listaCustom[key] ? (
                        <button
                          type="button"
                          onClick={() => clearLista(key)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 8,
                            border: `1px solid ${C.border}`,
                            background: C.surface,
                            fontSize: 12,
                            cursor: "pointer",
                            color: C.danger,
                            fontWeight: 600,
                          }}
                        >
                          Quitar foto
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              {listaExtraOpen ? (
                <div
                  style={{
                    borderRadius: 12,
                    border: `2px dashed ${C.border}`,
                    padding: 12,
                    background: C.surfaceAlt,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.tp }}>Otra referencia (opcional)</span>
                    <button
                      type="button"
                      onClick={() => setListaExtraOpen(false)}
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: C.ts,
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        textDecoration: "underline",
                      }}
                    >
                      Ocultar bloque
                    </button>
                  </div>
                  <div
                    style={{
                      borderRadius: 10,
                      overflow: "hidden",
                      background: "#fff",
                      minHeight: 120,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 10,
                    }}
                  >
                    <img
                      src={listaCustom.extra || DEFAULT_LISTA_REFERENCE_IMAGES.extra}
                      alt="Referencia adicional"
                      style={{ maxWidth: "100%", maxHeight: "min(32vh, 200px)", objectFit: "contain", display: "block" }}
                    />
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                    <label
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 12px",
                        borderRadius: 8,
                        border: `1px solid ${C.border}`,
                        background: C.surface,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        color: C.primary,
                      }}
                    >
                      <ImagePlus size={14} />
                      Subir imagen adicional
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) onUploadLista("extra", f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    {listaCustom.extra ? (
                      <button
                        type="button"
                        onClick={() => clearLista("extra")}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 8,
                          border: `1px solid ${C.border}`,
                          background: C.surface,
                          fontSize: 12,
                          cursor: "pointer",
                          color: C.danger,
                          fontWeight: 600,
                        }}
                      >
                        Quitar foto extra
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setListaExtraOpen(true)}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: `1.5px dashed ${C.primary}`,
                    background: C.primarySoft,
                    fontSize: 13,
                    fontWeight: 600,
                    color: C.primary,
                    cursor: "pointer",
                    alignSelf: "flex-start",
                  }}
                >
                  + Añadir otra imagen de referencia
                </button>
              )}
              <a
                href={QUOTE_VISOR_SHOP_URLS.catalogoCompleto}
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
                Ver catálogo en tienda <ExternalLink size={14} />
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
