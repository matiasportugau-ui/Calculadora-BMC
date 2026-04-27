import { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Upload, X, ChevronDown, ChevronUp, Check, AlertTriangle, Loader } from "lucide-react";
import { C, FONT, SHI, TR, TN, PANELS_TECHO, PANELS_PARED } from "../data/constants.js";

const ALL_TECHO_FAMILIES = Object.entries(PANELS_TECHO).map(([key, p]) => ({
  value: key,
  label: p.label,
  espesores: Object.keys(p.esp).map(Number).sort((a, b) => a - b),
}));

const ALL_PARED_FAMILIES = Object.entries(PANELS_PARED).map(([key, p]) => ({
  value: key,
  label: p.label,
  espesores: Object.keys(p.esp).map(Number).sort((a, b) => a - b),
}));

function Select({ label, value, options, onChange, placeholder = "Seleccioná…" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = options.find(o => String(o.value) === String(value));

  const handleClickOutside = useCallback((e) => {
    if (ref.current && !ref.current.contains(e.target)) setOpen(false);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative", fontFamily: FONT }} onClick={(e) => e.stopPropagation()}>
      {label && (
        <div style={{ fontSize: 11, fontWeight: 600, color: C.ts, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {label}
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          if (!open) document.addEventListener("mousedown", handleClickOutside);
          else document.removeEventListener("mousedown", handleClickOutside);
          setOpen(o => !o);
        }}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", borderRadius: 10, border: `1.5px solid ${open ? C.primary : C.border}`, background: C.surface, cursor: "pointer", fontSize: 13, color: selected ? C.tp : C.tt, boxShadow: open ? `0 0 0 3px ${C.primarySoft}` : SHI, transition: TR, fontFamily: FONT }}
      >
        <span>{selected ? selected.label : placeholder}</span>
        {open ? <ChevronUp size={14} color={C.primary} /> : <ChevronDown size={14} color={C.ts} />}
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 200, background: C.surface, borderRadius: 10, boxShadow: "0 4px 24px rgba(0,0,0,0.18)", overflow: "hidden", maxHeight: 220, overflowY: "auto" }}>
          {options.map(opt => (
            <div
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); document.removeEventListener("mousedown", handleClickOutside); }}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", cursor: "pointer", fontSize: 13, background: String(opt.value) === String(value) ? C.primarySoft : "transparent", fontWeight: String(opt.value) === String(value) ? 600 : 400, color: C.tp, transition: TR }}
            >
              <span>{opt.label}</span>
              {String(opt.value) === String(value) && <Check size={13} color={C.primary} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const ALLOWED_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".pdf", ".dxf"]);

function getExt(name) {
  return (name || "").toLowerCase().match(/\.[^.]+$/)?.[0] || "";
}

export default function PlanUploadModal({ open, onClose, currentTecho, currentPared, onApply }) {
  const [phase, setPhase] = useState("drop"); // drop | loading | result | error
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  // Editable fields in result phase
  const [zonas, setZonas] = useState([]);
  const [tipoAguas, setTipoAguas] = useState("una_agua");
  const [pendiente, setPendiente] = useState(0);
  const [familia, setFamilia] = useState("");
  const [espesor, setEspesor] = useState("");
  const [scenario, setScenario] = useState("solo_techo");
  const [paredAlto, setParedAlto] = useState(3.5);
  const [paredPerimetro, setParedPerimetro] = useState(0);

  const fileInputRef = useRef(null);

  const familyData = ALL_TECHO_FAMILIES.find(f => f.value === familia);
  const espOptions = (familyData?.espesores || []).map(e => ({ value: String(e), label: `${e} mm` }));

  const canApply = zonas.length > 0 && familia && espesor;

  const reset = useCallback(() => {
    setPhase("drop");
    setResult(null);
    setErrorMsg("");
    setZonas([]);
    setFamilia(currentTecho?.familia || "");
    setEspesor(currentTecho?.espesor || "");
  }, [currentTecho]);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    const ext = getExt(file.name);

    if (ext === ".dwg") {
      setErrorMsg("Formato DWG no soportado directamente. Exportá a DXF desde AutoCAD: Archivo → Guardar como → AutoCAD DXF.");
      setPhase("error");
      return;
    }
    if (!ALLOWED_EXTS.has(ext) && !file.type.startsWith("image/") && file.type !== "application/pdf") {
      setErrorMsg("Tipo de archivo no soportado. Usá JPG, PNG, PDF o DXF.");
      setPhase("error");
      return;
    }

    setPhase("loading");
    const form = new FormData();
    form.append("file", file);

    try {
      const resp = await fetch("/api/plan/interpret", { method: "POST", body: form });
      const data = await resp.json();

      if (!resp.ok) {
        setErrorMsg(data.error || "Error al interpretar el plano.");
        setPhase("error");
        return;
      }

      setResult(data);

      const t = data.bmcPayload?.techo;
      const pw = data.bmcPayload?.pared;

      setZonas(t?.zonas || [{ largo: 0, ancho: 0 }]);
      setTipoAguas(t?.tipoAguas || "una_agua");
      setPendiente(t?.pendiente || 0);
      setScenario(data.bmcPayload?.scenario || "solo_techo");
      setParedAlto(pw?.alto || currentPared?.alto || 3.5);
      setParedPerimetro(pw?.perimetro || currentPared?.perimetro || 0);

      // Pre-fill familia/espesor from current state if not provided by AI
      setFamilia(t?.familia || currentTecho?.familia || "");
      setEspesor(t?.espesor || currentTecho?.espesor || "");

      setPhase("result");
    } catch (err) {
      setErrorMsg(err.message || "Error de red al interpretar el plano.");
      setPhase("error");
    }
  }, [currentTecho, currentPared]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleApply = useCallback(() => {
    const techo = scenario !== "solo_fachada" ? {
      zonas: zonas.filter(z => z.largo > 0 && z.ancho > 0),
      tipoAguas,
      pendiente: Number(pendiente),
      familia,
      espesor: String(espesor),
      color: currentTecho?.color || "Blanco",
      tipoEst: currentTecho?.tipoEst || "metal",
      borders: result?.bmcPayload?.techo?.borders || {
        frente: "gotero_frontal", fondo: "gotero_lateral",
        latIzq: "gotero_lateral", latDer: "gotero_lateral",
      },
      opciones: result?.bmcPayload?.techo?.opciones || { inclCanalon: false, inclGotSup: false, inclSell: true },
    } : null;

    const pared = (scenario === "solo_fachada" || scenario === "techo_fachada") ? {
      alto: Number(paredAlto),
      perimetro: Number(paredPerimetro),
      aberturas: result?.bmcPayload?.pared?.aberturas || [],
      numEsqExt: result?.bmcPayload?.pared?.numEsqExt || 4,
      numEsqInt: result?.bmcPayload?.pared?.numEsqInt || 0,
      familia,
      espesor: String(espesor),
      color: currentPared?.color || "Blanco",
    } : null;

    onApply({ scenario, techo, pared });
  }, [scenario, zonas, tipoAguas, pendiente, familia, espesor, paredAlto, paredPerimetro, result, currentTecho, currentPared, onApply]);

  if (!open) return null;

  const overlay = (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: C.surface, borderRadius: 16, padding: 28, width: "100%", maxWidth: 540, maxHeight: "90vh", overflowY: "auto", fontFamily: FONT, boxShadow: "0 8px 40px rgba(0,0,0,0.25)", position: "relative" }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Upload size={20} color={C.primary} />
            <span style={{ fontSize: 17, fontWeight: 700, color: C.tp }}>Importar plano</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ border: "none", background: "transparent", cursor: "pointer", color: C.ts, padding: 4, borderRadius: 8, display: "flex" }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Phase: Drop */}
        {phase === "drop" && (
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{ border: `2px dashed ${dragOver ? C.primary : C.border}`, borderRadius: 14, padding: "40px 24px", textAlign: "center", cursor: "pointer", background: dragOver ? C.primarySoft : "transparent", transition: TR }}
          >
            <Upload size={36} color={dragOver ? C.primary : C.ts} style={{ margin: "0 auto 12px" }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: C.tp, marginBottom: 6 }}>
              Arrastrá el plano aquí o hacé click
            </div>
            <div style={{ fontSize: 12, color: C.ts }}>
              JPG · PNG · PDF · DXF — máximo 10 MB
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf,.dxf"
              style={{ display: "none" }}
              onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); }}
            />
          </div>
        )}

        {/* Phase: Loading */}
        {phase === "loading" && (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <Loader size={36} color={C.primary} style={{ margin: "0 auto 16px", animation: "spin 1s linear infinite" }} />
            <div style={{ fontSize: 15, color: C.tp, fontWeight: 500 }}>Interpretando plano con IA…</div>
            <div style={{ fontSize: 12, color: C.ts, marginTop: 6 }}>Esto puede tardar unos segundos</div>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Phase: Error */}
        {phase === "error" && (
          <div style={{ padding: "24px 0" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "#FEF2F2", borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}>
              <AlertTriangle size={18} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 13, color: "#DC2626", lineHeight: 1.5 }}>{errorMsg}</div>
            </div>
            <button
              type="button"
              onClick={reset}
              style={{ width: "100%", padding: "11px 0", borderRadius: 10, border: `1.5px solid ${C.border}`, background: "transparent", color: C.tp, fontSize: 14, fontWeight: 600, cursor: "pointer", transition: TR }}
            >
              Intentar con otro archivo
            </button>
          </div>
        )}

        {/* Phase: Result */}
        {phase === "result" && (
          <div>
            {/* Warnings */}
            {result?.warnings?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                {result.warnings.map((w, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "#FFFBEB", borderRadius: 8, padding: "10px 12px", marginBottom: 6 }}>
                    <AlertTriangle size={14} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: 12, color: "#92400E", lineHeight: 1.4 }}>{w}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Scenario */}
            <div style={{ marginBottom: 14 }}>
              <Select
                label="Escenario"
                value={scenario}
                options={[
                  { value: "solo_techo", label: "Solo techo" },
                  { value: "solo_fachada", label: "Solo fachada" },
                  { value: "techo_fachada", label: "Techo + fachada" },
                ]}
                onChange={setScenario}
              />
            </div>

            {/* Zonas de techo */}
            {scenario !== "solo_fachada" && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.ts, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Zonas de techo detectadas
                </div>
                {zonas.map((z, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
                    <input
                      type="number"
                      value={z.largo}
                      onChange={e => setZonas(prev => prev.map((zz, ii) => ii === i ? { ...zz, largo: +e.target.value } : zz))}
                      placeholder="Largo (m)"
                      style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13, color: C.tp, background: C.surface, outline: "none", fontFamily: FONT, ...TN }}
                    />
                    <span style={{ color: C.ts, fontSize: 13 }}>×</span>
                    <input
                      type="number"
                      value={z.ancho}
                      onChange={e => setZonas(prev => prev.map((zz, ii) => ii === i ? { ...zz, ancho: +e.target.value } : zz))}
                      placeholder="Ancho (m)"
                      style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13, color: C.tp, background: C.surface, outline: "none", fontFamily: FONT, ...TN }}
                    />
                    <span style={{ color: C.ts, fontSize: 11, whiteSpace: "nowrap" }}>m</span>
                    {zonas.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setZonas(prev => prev.filter((_, ii) => ii !== i))}
                        style={{ border: "none", background: "transparent", cursor: "pointer", color: C.ts, padding: 4, display: "flex", borderRadius: 6 }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setZonas(prev => [...prev, { largo: 0, ancho: 0 }])}
                  style={{ fontSize: 12, color: C.primary, background: "transparent", border: "none", cursor: "pointer", padding: "4px 0", fontFamily: FONT }}
                >
                  + Agregar zona
                </button>
              </div>
            )}

            {/* Tipo de aguas + pendiente */}
            {scenario !== "solo_fachada" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                <Select
                  label="Tipo de aguas"
                  value={tipoAguas}
                  options={[
                    { value: "una_agua", label: "Una agua" },
                    { value: "dos_aguas", label: "Dos aguas" },
                  ]}
                  onChange={setTipoAguas}
                />
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.ts, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Pendiente</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="number"
                      value={pendiente}
                      min={0}
                      max={89}
                      onChange={e => setPendiente(+e.target.value)}
                      style={{ flex: 1, padding: "9px 10px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 13, color: C.tp, background: C.surface, outline: "none", fontFamily: FONT, ...TN }}
                    />
                    <span style={{ fontSize: 13, color: C.ts }}>°</span>
                  </div>
                </div>
              </div>
            )}

            {/* Paredes */}
            {(scenario === "solo_fachada" || scenario === "techo_fachada") && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.ts, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Alto pared (m)</div>
                  <input
                    type="number"
                    value={paredAlto}
                    min={0}
                    step={0.1}
                    onChange={e => setParedAlto(+e.target.value)}
                    style={{ width: "100%", padding: "9px 10px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 13, color: C.tp, background: C.surface, outline: "none", fontFamily: FONT, boxSizing: "border-box", ...TN }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.ts, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Perímetro (m)</div>
                  <input
                    type="number"
                    value={paredPerimetro}
                    min={0}
                    step={0.5}
                    onChange={e => setParedPerimetro(+e.target.value)}
                    style={{ width: "100%", padding: "9px 10px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 13, color: C.tp, background: C.surface, outline: "none", fontFamily: FONT, boxSizing: "border-box", ...TN }}
                  />
                </div>
              </div>
            )}

            {/* Panel: Familia + Espesor */}
            <div style={{ background: C.primarySoft, borderRadius: 12, padding: 14, marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.primary, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Panel — seleccioná familia y espesor
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Select
                  label="Familia"
                  value={familia}
                  options={scenario === "solo_fachada" ? ALL_PARED_FAMILIES : ALL_TECHO_FAMILIES}
                  onChange={(v) => { setFamilia(v); setEspesor(""); }}
                  placeholder="Elegí familia…"
                />
                <Select
                  label="Espesor"
                  value={espesor}
                  options={espOptions}
                  onChange={setEspesor}
                  placeholder="Elegí espesor…"
                />
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={reset}
                style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: `1.5px solid ${C.border}`, background: "transparent", color: C.tp, fontSize: 14, fontWeight: 600, cursor: "pointer", transition: TR, fontFamily: FONT }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!canApply}
                onClick={handleApply}
                style={{ flex: 2, padding: "11px 0", borderRadius: 10, border: "none", background: canApply ? C.primary : C.border, color: canApply ? "#fff" : C.ts, fontSize: 14, fontWeight: 700, cursor: canApply ? "pointer" : "not-allowed", transition: TR, fontFamily: FONT, ...TN }}
              >
                Aplicar a calculadora
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
