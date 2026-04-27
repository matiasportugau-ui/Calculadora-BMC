import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, X, Loader, AlertTriangle, ChevronDown, ChevronUp, Check } from "lucide-react";
import { PANELS_TECHO } from "../data/constants.js";
import BmcModuleNav from "./BmcModuleNav.jsx";

const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Helvetica, Arial, sans-serif";

const wrap = { minHeight: "100vh", display: "flex", flexDirection: "column", background: "#f5f5f7" };
const main = { flex: 1, padding: "24px 20px 48px", maxWidth: 700, margin: "0 auto", width: "100%", boxSizing: "border-box" };
const h1 = { margin: "0 0 4px", fontSize: 22, fontWeight: 700, color: "#1a3a5c", fontFamily: FONT };
const sub = { margin: "0 0 20px", fontSize: 13, color: "#6e6e73", fontFamily: FONT };
const card = { background: "#fff", borderRadius: 12, border: "1px solid #e5e5ea", padding: "18px 20px", marginBottom: 14, fontFamily: FONT };
const label = { display: "block", fontSize: 11, fontWeight: 700, color: "#6e6e73", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 };
const btnPrimary = { padding: "10px 18px", borderRadius: 10, border: "none", background: "#0071e3", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", gap: 6 };
const btnGhost = { ...btnPrimary, background: "#fff", color: "#1d1d1f", border: "1.5px solid #e5e5ea" };

const ALL_FAMILIES = Object.entries(PANELS_TECHO).map(([key, p]) => ({
  value: key,
  label: p.label,
  espesores: Object.keys(p.esp).map(Number).sort((a, b) => a - b),
  esp: p.esp,
}));

const ALLOWED_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".pdf", ".dxf"]);
function getExt(name) { return (name || "").toLowerCase().match(/\.[^.]+$/)?.[0] || ""; }

function SimpleSelect({ id, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = options.find(o => String(o.value) === String(value));

  const closeOnOutside = useCallback(e => {
    if (ref.current && !ref.current.contains(e.target)) {
      setOpen(false);
      document.removeEventListener("mousedown", closeOnOutside);
    }
  }, []);

  return (
    <div ref={ref} style={{ position: "relative", fontFamily: FONT }} id={id}>
      <button
        type="button"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) document.addEventListener("mousedown", closeOnOutside);
          else document.removeEventListener("mousedown", closeOnOutside);
        }}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", borderRadius: 10, border: `1.5px solid ${open ? "#0071e3" : "#e5e5ea"}`, background: "#fff", cursor: "pointer", fontSize: 13, color: selected ? "#1d1d1f" : "#aab", fontFamily: FONT }}
      >
        <span>{selected ? selected.label : "Elegí…"}</span>
        {open ? <ChevronUp size={14} color="#0071e3" /> : <ChevronDown size={14} color="#aab" />}
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 200, background: "#fff", borderRadius: 10, boxShadow: "0 4px 24px rgba(0,0,0,0.15)", overflow: "hidden", maxHeight: 220, overflowY: "auto" }}>
          {options.map(opt => (
            <div
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); document.removeEventListener("mousedown", closeOnOutside); }}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", cursor: "pointer", fontSize: 13, background: String(opt.value) === String(value) ? "#EFF6FF" : "transparent", fontWeight: String(opt.value) === String(value) ? 600 : 400, color: "#1d1d1f" }}
            >
              <span>{opt.label}</span>
              {String(opt.value) === String(value) && <Check size={13} color="#0071e3" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BmcPlanImportModule() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [phase, setPhase] = useState("idle"); // idle | loading | result | error
  const [dragOver, setDragOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState(null); // raw API result
  const [zonas, setZonas] = useState([]);
  const [tipoAguas, setTipoAguas] = useState("una_agua");
  const [pendiente, setPendiente] = useState(0);
  const [familia, setFamilia] = useState("");
  const [espesor, setEspesor] = useState("");

  const familyData = ALL_FAMILIES.find(f => f.value === familia);
  const espOptions = (familyData?.espesores || []).map(e => ({ value: String(e), label: `${e} mm` }));
  const precioWeb = familia && espesor && familyData?.esp?.[Number(espesor)]?.web;

  const areaTotal = zonas.reduce((s, z) => s + (z.largo || 0) * (z.ancho || 0), 0);
  const areaReal = pendiente > 0 ? areaTotal / Math.cos(pendiente * Math.PI / 180) : areaTotal;
  const precioAprox = precioWeb && areaReal > 0 ? areaReal * precioWeb : null;

  const reset = useCallback(() => {
    setPhase("idle");
    setResult(null);
    setErrorMsg("");
    setZonas([]);
    setFamilia("");
    setEspesor("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    const ext = getExt(file.name);

    if (ext === ".dwg") {
      setErrorMsg("Formato DWG no soportado. Exportá a DXF desde AutoCAD: Archivo → Guardar como → AutoCAD DXF.");
      setPhase("error");
      return;
    }
    if (!ALLOWED_EXTS.has(ext) && !file.type.startsWith("image/") && file.type !== "application/pdf") {
      setErrorMsg("Formato no soportado. Usá JPG, PNG, PDF o DXF.");
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
      setZonas(t?.zonas || []);
      setTipoAguas(t?.tipoAguas || "una_agua");
      setPendiente(t?.pendiente || 0);
      setPhase("result");
    } catch {
      setErrorMsg("Error de red al interpretar el plano.");
      setPhase("error");
    }
  }, []);

  const handleOpenInCalc = useCallback(() => {
    if (!familia || !espesor) return;
    const payload = {
      scenario: result?.bmcPayload?.scenario || "solo_techo",
      techo: {
        zonas: zonas.filter(z => z.largo > 0 && z.ancho > 0),
        tipoAguas,
        pendiente: Number(pendiente),
        familia,
        espesor: String(espesor),
        color: "Blanco",
        tipoEst: "metal",
        borders: result?.bmcPayload?.techo?.borders || { frente: "gotero_frontal", fondo: "gotero_lateral", latIzq: "gotero_lateral", latDer: "gotero_lateral" },
        opciones: result?.bmcPayload?.techo?.opciones || { inclCanalon: false, inclGotSup: false, inclSell: true },
      },
      pared: result?.bmcPayload?.pared || null,
    };
    localStorage.setItem("bmc_pending_plan_import", JSON.stringify(payload));
    navigate("/");
  }, [familia, espesor, zonas, tipoAguas, pendiente, result, navigate]);

  return (
    <div style={wrap}>
      <BmcModuleNav />
      <div style={main}>
        <h1 style={h1}>Importar plano de cliente</h1>
        <p style={sub}>Subí un plano (JPG, PNG, PDF o DXF) y la IA extrae las dimensiones. Elegí el panel y abrí directo en la calculadora.</p>

        {/* Step 1: Upload */}
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#0071e3", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>1 · Subir plano</div>

          {phase === "idle" && (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
              onClick={() => fileInputRef.current?.click()}
              style={{ border: `2px dashed ${dragOver ? "#0071e3" : "#d1d9e6"}`, borderRadius: 12, padding: "36px 20px", textAlign: "center", cursor: "pointer", background: dragOver ? "#EFF6FF" : "#fafafa", transition: "all .15s" }}
            >
              <Upload size={32} color={dragOver ? "#0071e3" : "#aab"} style={{ margin: "0 auto 10px" }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: "#1d1d1f", marginBottom: 4 }}>Arrastrá el plano aquí o hacé click</div>
              <div style={{ fontSize: 12, color: "#6e6e73" }}>JPG · PNG · PDF · DXF — máximo 10 MB</div>
              <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,.dxf" style={{ display: "none" }} onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); }} />
            </div>
          )}

          {phase === "loading" && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "20px 0", justifyContent: "center" }}>
              <Loader size={20} color="#0071e3" style={{ animation: "spin 1s linear infinite" }} />
              <span style={{ fontSize: 14, color: "#1d1d1f", fontFamily: FONT }}>Interpretando plano con IA…</span>
              <style>{`@keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }`}</style>
            </div>
          )}

          {phase === "error" && (
            <div>
              <div style={{ display: "flex", gap: 8, padding: "12px 14px", borderRadius: 10, background: "#FEF2F2", border: "1px solid #FCA5A5", marginBottom: 12 }}>
                <AlertTriangle size={16} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 13, color: "#DC2626", fontFamily: FONT }}>{errorMsg}</span>
              </div>
              <button type="button" onClick={reset} style={btnGhost}>Intentar con otro archivo</button>
            </div>
          )}

          {phase === "result" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: "#F0FDF4", border: "1px solid #86EFAC" }}>
              <Check size={14} color="#16A34A" />
              <span style={{ fontSize: 13, color: "#15803D", flex: 1, fontFamily: FONT }}>Plano interpretado correctamente</span>
              <button type="button" onClick={reset} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#6B7280", padding: 2, display: "flex" }}>
                <X size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Step 2: Result */}
        {phase === "result" && (
          <div style={card}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#0071e3", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>2 · Dimensiones detectadas</div>

            {result?.warnings?.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                {result.warnings.map((w, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, padding: "8px 10px", borderRadius: 8, background: "#FFFBEB", border: "1px solid #FDE68A", marginBottom: 4 }}>
                    <AlertTriangle size={13} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: 12, color: "#92400E", fontFamily: FONT }}>{w}</span>
                  </div>
                ))}
              </div>
            )}

            {zonas.length > 0 ? (
              <div style={{ marginBottom: 12 }}>
                <span style={label}>Zonas de techo</span>
                {zonas.map((z, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
                    <input
                      type="number"
                      value={z.largo}
                      onChange={e => setZonas(prev => prev.map((zz, ii) => ii === i ? { ...zz, largo: +e.target.value } : zz))}
                      placeholder="Largo (m)"
                      style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1.5px solid #e5e5ea", fontSize: 13, fontFamily: FONT, outline: "none" }}
                    />
                    <span style={{ color: "#aab", fontSize: 13 }}>×</span>
                    <input
                      type="number"
                      value={z.ancho}
                      onChange={e => setZonas(prev => prev.map((zz, ii) => ii === i ? { ...zz, ancho: +e.target.value } : zz))}
                      placeholder="Ancho (m)"
                      style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1.5px solid #e5e5ea", fontSize: 13, fontFamily: FONT, outline: "none" }}
                    />
                    <span style={{ color: "#aab", fontSize: 11 }}>m</span>
                    {zonas.length > 1 && (
                      <button type="button" onClick={() => setZonas(p => p.filter((_, ii) => ii !== i))} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#aab", padding: 4, display: "flex" }}>
                        <X size={13} />
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => setZonas(p => [...p, { largo: 0, ancho: 0 }])} style={{ fontSize: 12, color: "#0071e3", background: "transparent", border: "none", cursor: "pointer", padding: "4px 0", fontFamily: FONT }}>
                  + Agregar zona
                </button>
              </div>
            ) : (
              <div style={{ marginBottom: 12, fontSize: 13, color: "#6e6e73" }}>No se detectaron zonas — ingresalas manualmente.</div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <span style={label}>Tipo de aguas</span>
                <SimpleSelect
                  value={tipoAguas}
                  options={[{ value: "una_agua", label: "Una agua" }, { value: "dos_aguas", label: "Dos aguas" }]}
                  onChange={setTipoAguas}
                />
              </div>
              <div>
                <span style={label}>Pendiente</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="number"
                    value={pendiente}
                    min={0}
                    max={89}
                    onChange={e => setPendiente(+e.target.value)}
                    style={{ flex: 1, padding: "9px 10px", borderRadius: 10, border: "1.5px solid #e5e5ea", fontSize: 13, fontFamily: FONT, outline: "none" }}
                  />
                  <span style={{ fontSize: 13, color: "#6e6e73" }}>°</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Panel selection */}
        {phase === "result" && (
          <div style={card}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#0071e3", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>3 · Seleccionar panel</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div>
                <span style={label}>Familia</span>
                <SimpleSelect
                  value={familia}
                  options={ALL_FAMILIES.map(f => ({ value: f.value, label: f.label }))}
                  onChange={v => { setFamilia(v); setEspesor(""); }}
                />
              </div>
              <div>
                <span style={label}>Espesor</span>
                <SimpleSelect
                  value={espesor}
                  options={espOptions}
                  onChange={setEspesor}
                />
              </div>
            </div>

            {/* Quick estimate */}
            {areaReal > 0 && (
              <div style={{ padding: "12px 14px", borderRadius: 10, background: "#F8FAFF", border: "1px solid #dce8ff", marginTop: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#6e6e73", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Estimado rápido</div>
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                  <div>
                    <span style={{ fontSize: 12, color: "#6e6e73" }}>Área planta: </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#1d1d1f" }}>{areaTotal.toFixed(1)} m²</span>
                  </div>
                  {pendiente > 0 && (
                    <div>
                      <span style={{ fontSize: 12, color: "#6e6e73" }}>Área real ({pendiente}°): </span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#1d1d1f" }}>{areaReal.toFixed(1)} m²</span>
                    </div>
                  )}
                  {precioAprox !== null && (
                    <div>
                      <span style={{ fontSize: 12, color: "#6e6e73" }}>Solo paneles aprox.: </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#0071e3" }}>USD {precioAprox.toLocaleString("es-UY", { maximumFractionDigits: 0 })} s/IVA</span>
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 11, color: "#aab", marginTop: 4 }}>* Precio web solo de paneles, sin fijaciones ni perfilería. Abrí en calculadora para el presupuesto completo.</div>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        {phase === "result" && (
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={reset} style={btnGhost}>Limpiar</button>
            <button
              type="button"
              disabled={!familia || !espesor}
              onClick={handleOpenInCalc}
              style={{ ...btnPrimary, opacity: (!familia || !espesor) ? 0.5 : 1, cursor: (!familia || !espesor) ? "not-allowed" : "pointer" }}
            >
              Abrir en calculadora →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
