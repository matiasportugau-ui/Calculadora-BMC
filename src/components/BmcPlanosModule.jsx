import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, Loader, AlertTriangle, Check, Download, FileDown, Calculator } from "lucide-react";
import BmcModuleNav from "./BmcModuleNav.jsx";

const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Helvetica, Arial, sans-serif";
const wrap = { minHeight: "100vh", display: "flex", flexDirection: "column", background: "#f5f5f7" };
const main = { flex: 1, padding: "24px 20px 48px", maxWidth: 820, margin: "0 auto", width: "100%", boxSizing: "border-box" };
const h1 = { margin: "0 0 4px", fontSize: 22, fontWeight: 700, color: "#1a3a5c", fontFamily: FONT };
const sub = { margin: "0 0 20px", fontSize: 13, color: "#6e6e73", fontFamily: FONT };
const card = { background: "#fff", borderRadius: 12, border: "1px solid #e5e5ea", padding: "18px 20px", marginBottom: 14, fontFamily: FONT };
const stepTag = { fontSize: 12, fontWeight: 700, color: "#0071e3", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" };
const label = { display: "block", fontSize: 11, fontWeight: 700, color: "#6e6e73", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 };
const inp = { width: "100%", padding: "9px 10px", borderRadius: 10, border: "1.5px solid #e5e5ea", fontSize: 13, fontFamily: FONT, outline: "none", boxSizing: "border-box" };
const btnPrimary = { padding: "10px 18px", borderRadius: 10, border: "none", background: "#0071e3", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", gap: 6 };
const btnGhost = { ...btnPrimary, background: "#fff", color: "#1d1d1f", border: "1.5px solid #e5e5ea" };
const tab = (active) => ({ flex: 1, padding: "9px 0", textAlign: "center", borderRadius: 9, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: FONT, background: active ? "#0071e3" : "#fff", color: active ? "#fff" : "#1d1d1f", border: `1.5px solid ${active ? "#0071e3" : "#e5e5ea"}` });

const ALLOWED_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".pdf", ".dxf"]);
const getExt = (n) => (n || "").toLowerCase().match(/\.[^.]+$/)?.[0] || "";

/** Footprints (m, Y-up) a partir de presets simples. */
function presetFootprint(preset, d) {
  const n = (v, f = 0) => (Number.isFinite(+v) && +v > 0 ? +v : f);
  if (preset === "rect") {
    const L = n(d.L, 10), A = n(d.A, 6);
    return [[0, 0], [L, 0], [L, A], [0, A]];
  }
  if (preset === "T") {
    const cL = n(d.cuerpoL, 14), cA = n(d.cuerpoA, 6), bA = n(d.brazoA, 3), bL = n(d.brazoL, 9);
    const bx0 = (cL - bA) / 2, bx1 = bx0 + bA, by = bL, top = bL + cA;
    return [[bx0, 0], [bx1, 0], [bx1, by], [cL, by], [cL, top], [0, top], [0, by], [bx0, by]];
  }
  // L: rectángulo cL×cA con recorte (rX×rY) en esquina superior derecha
  const cL = n(d.cuerpoL, 12), cA = n(d.cuerpoA, 8), rX = n(d.brazoA, 5), rY = n(d.brazoL, 4);
  return [[0, 0], [cL, 0], [cL, cA - rY], [cL - rX, cA - rY], [cL - rX, cA], [0, cA]];
}

/** Descomposición rectangular para cotizar (zonas largo×ancho, área exacta). */
function presetZonas(preset, d) {
  const n = (v, f = 0) => (Number.isFinite(+v) && +v > 0 ? +v : f);
  if (preset === "rect") return [{ largo: n(d.L, 10), ancho: n(d.A, 6) }];
  if (preset === "T") return [
    { largo: n(d.cuerpoL, 14), ancho: n(d.cuerpoA, 6) },
    { largo: n(d.brazoL, 9), ancho: n(d.brazoA, 3) },
  ];
  // L = rectángulo completo menos el recorte → dos rectángulos
  const cL = n(d.cuerpoL, 12), cA = n(d.cuerpoA, 8), rX = n(d.brazoA, 5), rY = n(d.brazoL, 4);
  return [{ largo: cL, ancho: cA - rY }, { largo: cL - rX, ancho: rY }];
}

function downloadText(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  a.remove(); URL.revokeObjectURL(url);
}

export default function BmcPlanosModule() {
  const fileInputRef = useRef(null);
  const [mode, setMode] = useState("croquis");        // croquis | plano | manual
  const [preset, setPreset] = useState("T");
  const [dims, setDims] = useState({ L: 10, A: 6, cuerpoL: 14, cuerpoA: 6, brazoA: 3, brazoL: 9 });
  const [titulo, setTitulo] = useState("VIVIENDA UNIFAMILIAR");
  const [cliente, setCliente] = useState("");
  const [lamina, setLamina] = useState("Lám. 01");
  const [iaRooms, setIaRooms] = useState([]);
  const [iaOpenings, setIaOpenings] = useState([]);
  const [calibPlano, setCalibPlano] = useState("");
  const [calibReal, setCalibReal] = useState("");

  const [uploadPhase, setUploadPhase] = useState("idle"); // idle | loading | done | error
  const [uploadMsg, setUploadMsg] = useState("");
  const [iaFootprint, setIaFootprint] = useState(null);
  const [iaWarnings, setIaWarnings] = useState([]);

  // Selector de IA: proveedores disponibles + recomendado para visión
  const [aiOptions, setAiOptions] = useState(null);
  const [aiProvider, setAiProvider] = useState("auto");
  const [aiModel, setAiModel] = useState("");
  useEffect(() => {
    fetch("/api/plan/ai-options").then((r) => r.json()).then(setAiOptions).catch(() => {});
  }, []);
  const recommended = aiOptions?.recommended || null;
  const providers = aiOptions?.providers || [];
  const provObj = providers.find((p) => p.id === aiProvider);

  const [genPhase, setGenPhase] = useState("idle");      // idle | loading | done | error
  const [genMsg, setGenMsg] = useState("");
  const [result, setResult] = useState(null);            // { svg, dxf, areaM2 }
  const [iaPayload, setIaPayload] = useState(null);      // bmcPayload completo (para cotizar)
  const navigate = useNavigate();

  const setDim = (k, v) => setDims((p) => ({ ...p, [k]: v }));

  const isUpload = mode !== "manual";   // croquis y plano del cliente comparten subir + interpretar

  const footprint = useMemo(() => {
    if (isUpload && Array.isArray(iaFootprint) && iaFootprint.length >= 3) return iaFootprint;
    return presetFootprint(preset, dims);
  }, [isUpload, iaFootprint, preset, dims]);

  // Generar plano CAD necesita perímetro; cotizar sólo necesita zonas.
  const canPlan = isUpload ? (Array.isArray(iaFootprint) && iaFootprint.length >= 3) : true;
  const canQuote = isUpload ? !!iaPayload?.techo?.zonas?.length : true;

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    const ext = getExt(file.name);
    if (!ALLOWED_EXTS.has(ext) && !file.type.startsWith("image/") && file.type !== "application/pdf") {
      setUploadMsg("Formato no soportado. Usá JPG, PNG, PDF o DXF."); setUploadPhase("error"); return;
    }
    setUploadPhase("loading"); setUploadMsg(""); setIaFootprint(null); setIaWarnings([]);
    try {
      const form = new FormData();
      form.append("file", file);
      if (aiProvider !== "auto") {
        form.append("provider", aiProvider);
        if (aiModel) form.append("model", aiModel);
      }
      const resp = await fetch("/api/plan/interpret", { method: "POST", body: form });
      const data = await resp.json();
      if (!resp.ok) { setUploadMsg(data.error || "Error al interpretar el croquis."); setUploadPhase("error"); return; }
      const fp = data.bmcPayload?.footprint;
      const usedAi = data.ai?.providerLabel ? ` · ${data.ai.providerLabel}${data.ai.model ? ` (${data.ai.model})` : ""}` : "";
      setIaWarnings(data.warnings || []);
      setIaPayload(data.bmcPayload || null);
      if (Array.isArray(fp) && fp.length >= 3) {
        setIaFootprint(fp);
        setIaRooms(data.bmcPayload?.rooms || []);
        setIaOpenings(data.bmcPayload?.openings || []);
        setUploadMsg(`Interpretado — perímetro detectado por IA${usedAi}.`); setUploadPhase("done");
      } else if (data.bmcPayload?.techo?.zonas?.length) {
        // Sin perímetro para el plano CAD, pero hay dimensiones → se puede COTIZAR.
        setIaFootprint(null); setIaRooms([]); setIaOpenings([]);
        setUploadMsg(`Dimensiones extraídas${usedAi} — no se detectó el perímetro para el plano CAD, pero podés cotizarlo. Para generar el plano, ingresá las medidas.`);
        setUploadPhase("done");
      } else {
        setUploadMsg("La IA no pudo extraer dimensiones. Definí las medidas a mano abajo.");
        setUploadPhase("error"); setMode("manual");
      }
    } catch {
      setUploadMsg("Error de red al interpretar el croquis."); setUploadPhase("error");
    }
  }, [aiProvider, aiModel]);

  const scale = useMemo(() => {
    const p = +calibPlano, r = +calibReal;
    return p > 0 && r > 0 ? r / p : 1;
  }, [calibPlano, calibReal]);

  const generar = useCallback(async () => {
    setGenPhase("loading"); setGenMsg(""); setResult(null);
    try {
      const rooms = isUpload ? iaRooms : [];
      const openings = isUpload ? iaOpenings : [];
      const resp = await fetch("/api/plan/cad", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ footprint, rooms, openings, scale, title: { titulo, proyecto: titulo, cliente, lamina, escala: "1:100" } }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) { setGenMsg(data.error || "Error generando el plano."); setGenPhase("error"); return; }
      setResult({ svg: data.svg, dxf: data.dxf, areaM2: data.areaM2 });
      setGenPhase("done");
    } catch {
      setGenMsg("Error de red al generar el plano."); setGenPhase("error");
    }
  }, [footprint, titulo, cliente, lamina, scale, isUpload, iaRooms, iaOpenings]);

  // Vínculo con la calculadora: cotizar el plano creado (mismo puente que «Subir plano»).
  const cotizar = useCallback(() => {
    let zonas;
    if (isUpload && iaPayload?.techo?.zonas?.length) {
      zonas = iaPayload.techo.zonas.map((z) => ({ largo: z.largo * scale, ancho: z.ancho * scale }));
    } else {
      zonas = presetZonas(preset, dims).map((z) => ({ largo: z.largo * scale, ancho: z.ancho * scale }));
    }
    zonas = zonas.filter((z) => z.largo > 0 && z.ancho > 0);
    const payload = {
      scenario: iaPayload?.scenario || "solo_techo",
      techo: {
        zonas,
        tipoAguas: iaPayload?.techo?.tipoAguas || "una_agua",
        pendiente: iaPayload?.techo?.pendiente || 0,
        familia: "", espesor: "", color: "Blanco", tipoEst: "metal",
        borders: iaPayload?.techo?.borders || { frente: "gotero_frontal", fondo: "gotero_lateral", latIzq: "gotero_lateral", latDer: "gotero_lateral" },
        opciones: iaPayload?.techo?.opciones || { inclCanalon: false, inclGotSup: false, inclSell: true },
      },
      pared: iaPayload?.pared || null,
      proyecto: { titulo, cliente },
    };
    localStorage.setItem("bmc_pending_plan_import", JSON.stringify(payload));
    navigate("/");
  }, [isUpload, iaPayload, preset, dims, scale, titulo, cliente, navigate]);

  const fileBase = (titulo || "plano").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "plano";

  return (
    <div style={wrap}>
      <BmcModuleNav />
      <div style={main}>
        <h1 style={h1}>Planos</h1>
        <p style={sub}>Un croquis a mano, un plano del cliente o unas medidas → plano profesional (DXF/SVG) <b>y</b> presupuesto. Mismo motor: lo que cargás se puede <b>exportar</b> y <b>cotizar</b>.</p>

        {/* Paso 1: origen */}
        <div style={card}>
          <div style={stepTag}>1 · Origen de la planta</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <div style={tab(mode === "croquis")} onClick={() => setMode("croquis")}>Croquis a mano (IA)</div>
            <div style={tab(mode === "plano")} onClick={() => setMode("plano")}>Plano del cliente (IA)</div>
            <div style={tab(mode === "manual")} onClick={() => setMode("manual")}>Medidas</div>
          </div>

          {isUpload && (
            <>
              {aiOptions && providers.length === 0 && (
                <div style={{ display: "flex", gap: 8, padding: "10px 14px", borderRadius: 10, background: "#FFFBEB", border: "1px solid #FDE68A", marginBottom: 12 }}>
                  <AlertTriangle size={14} color="#D97706" />
                  <span style={{ fontSize: 13, color: "#92400E" }}>No hay servicio de IA conectado. Configurá una API key o usá «Ingresar medidas».</span>
                </div>
              )}
              {providers.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <span style={label}>Modelo de IA {recommended && <span style={{ color: "#16A34A", fontWeight: 600 }}>· recomendado: {recommended.providerLabel} {recommended.model}</span>}</span>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <select value={aiProvider} onChange={(e) => { setAiProvider(e.target.value); setAiModel(""); }} style={inp}>
                      <option value="auto">Automático (recomendado{recommended ? `: ${recommended.providerLabel}` : ""})</option>
                      {providers.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                    {aiProvider !== "auto" && provObj && (
                      <select value={aiModel} onChange={(e) => setAiModel(e.target.value)} style={inp}>
                        <option value="">Predeterminado ({provObj.defaultModel})</option>
                        {provObj.models.map((m) => (
                          <option key={m.id} value={m.id}>{m.id}{recommended && recommended.provider === aiProvider && recommended.model === m.id ? " ★" : ""}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              )}
              {uploadPhase !== "loading" && (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
                  style={{ border: "2px dashed #d1d9e6", borderRadius: 12, padding: "28px 20px", textAlign: "center", cursor: "pointer", background: "#fafafa" }}
                >
                  <Upload size={28} color="#aab" style={{ margin: "0 auto 8px" }} />
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#1d1d1f" }}>{mode === "plano" ? "Arrastrá el plano del cliente o hacé click" : "Arrastrá el croquis o hacé click"}</div>
                  <div style={{ fontSize: 12, color: "#6e6e73" }}>JPG · PNG · PDF · DXF — máx 10 MB · {mode === "plano" ? "se interpreta para cotizar" : "se interpreta para crear el plano"}</div>
                  <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,.dxf" style={{ display: "none" }} onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])} />
                </div>
              )}
              {uploadPhase === "loading" && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 0", justifyContent: "center" }}>
                  <Loader size={18} color="#0071e3" style={{ animation: "spin 1s linear infinite" }} />
                  <span style={{ fontSize: 14 }}>Interpretando croquis con IA…</span>
                  <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
                </div>
              )}
              {uploadPhase === "done" && (
                <div style={{ display: "flex", gap: 8, padding: "10px 14px", borderRadius: 10, background: "#F0FDF4", border: "1px solid #86EFAC", marginTop: 10 }}>
                  <Check size={14} color="#16A34A" /><span style={{ fontSize: 13, color: "#15803D" }}>{uploadMsg}</span>
                </div>
              )}
              {uploadPhase === "error" && (
                <div style={{ display: "flex", gap: 8, padding: "10px 14px", borderRadius: 10, background: "#FFFBEB", border: "1px solid #FDE68A", marginTop: 10 }}>
                  <AlertTriangle size={14} color="#D97706" /><span style={{ fontSize: 13, color: "#92400E" }}>{uploadMsg}</span>
                </div>
              )}
              {iaWarnings.map((w, i) => (
                <div key={i} style={{ fontSize: 12, color: "#92400E", marginTop: 6 }}>• {w}</div>
              ))}
            </>
          )}

          {mode === "manual" && (
            <>
              <span style={label}>Forma base</span>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {[["rect", "Rectángulo"], ["L", "L"], ["T", "T"]].map(([k, lbl]) => (
                  <div key={k} style={tab(preset === k)} onClick={() => setPreset(k)}>{lbl}</div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {preset === "rect" && (<>
                  <Field label="Largo (m)" value={dims.L} onChange={(v) => setDim("L", v)} />
                  <Field label="Ancho (m)" value={dims.A} onChange={(v) => setDim("A", v)} />
                </>)}
                {preset === "T" && (<>
                  <Field label="Cuerpo · largo (m)" value={dims.cuerpoL} onChange={(v) => setDim("cuerpoL", v)} />
                  <Field label="Cuerpo · ancho (m)" value={dims.cuerpoA} onChange={(v) => setDim("cuerpoA", v)} />
                  <Field label="Brazo · ancho (m)" value={dims.brazoA} onChange={(v) => setDim("brazoA", v)} />
                  <Field label="Brazo · largo (m)" value={dims.brazoL} onChange={(v) => setDim("brazoL", v)} />
                </>)}
                {preset === "L" && (<>
                  <Field label="Largo (m)" value={dims.cuerpoL} onChange={(v) => setDim("cuerpoL", v)} />
                  <Field label="Ancho (m)" value={dims.cuerpoA} onChange={(v) => setDim("cuerpoA", v)} />
                  <Field label="Recorte · X (m)" value={dims.brazoA} onChange={(v) => setDim("brazoA", v)} />
                  <Field label="Recorte · Y (m)" value={dims.brazoL} onChange={(v) => setDim("brazoL", v)} />
                </>)}
              </div>
            </>
          )}
        </div>

        {/* Paso 2: rótulo + generar */}
        <div style={card}>
          <div style={stepTag}>2 · Generar plano</div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
            <Field label="Título / Proyecto" value={titulo} onChange={setTitulo} type="text" />
            <Field label="Cliente" value={cliente} onChange={setCliente} type="text" />
            <Field label="Lámina" value={lamina} onChange={setLamina} type="text" />
          </div>
          <div style={{ marginBottom: 14 }}>
            <span style={label}>Calibración de escala (opcional · si el croquis no trae medidas)</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="number" value={calibPlano} placeholder="medida en el dibujo (m)" onChange={(e) => setCalibPlano(e.target.value)} style={inp} />
              <span style={{ color: "#aab" }}>→</span>
              <input type="number" value={calibReal} placeholder="medida real (m)" onChange={(e) => setCalibReal(e.target.value)} style={inp} />
              <span style={{ fontSize: 12, color: scale !== 1 ? "#0071e3" : "#aab", whiteSpace: "nowrap", fontWeight: 600 }}>×{scale.toFixed(3)}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={generar} disabled={genPhase === "loading" || !canPlan}
              style={{ ...btnPrimary, opacity: (genPhase === "loading" || !canPlan) ? 0.5 : 1, cursor: !canPlan ? "not-allowed" : "pointer" }}
              title={!canPlan ? "Falta el perímetro: ingresá medidas o subí un croquis con contorno claro" : undefined}>
              {genPhase === "loading" ? <Loader size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={16} />}
              Generar plano profesional
            </button>
            <button type="button" onClick={cotizar} disabled={!canQuote}
              style={{ ...btnPrimary, background: "#1a3a5c", opacity: !canQuote ? 0.5 : 1, cursor: !canQuote ? "not-allowed" : "pointer" }}
              title={!canQuote ? "Subí un croquis/plano o ingresá medidas para cotizar" : undefined}>
              <Calculator size={16} /> Cotizar este plano →
            </button>
          </div>
          {isUpload && canQuote && !canPlan && (
            <div style={{ fontSize: 12, color: "#92400E", marginTop: 8 }}>Se extrajeron dimensiones pero no el perímetro: podés <b>Cotizar</b> ahora, o ingresar medidas para generar el plano CAD.</div>
          )}
          {genPhase === "error" && (
            <div style={{ display: "flex", gap: 8, padding: "10px 14px", borderRadius: 10, background: "#FEF2F2", border: "1px solid #FCA5A5", marginTop: 12 }}>
              <AlertTriangle size={14} color="#DC2626" /><span style={{ fontSize: 13, color: "#DC2626" }}>{genMsg}</span>
            </div>
          )}
        </div>

        {/* Paso 3: resultado */}
        {genPhase === "done" && result && (
          <div style={card}>
            <div style={stepTag}>3 · Resultado · {result.areaM2} m²</div>
            <div style={{ border: "1px solid #e5e5ea", borderRadius: 10, overflow: "auto", background: "#fff", marginBottom: 14 }}
                 dangerouslySetInnerHTML={{ __html: result.svg }} />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" style={btnPrimary} onClick={() => downloadText(`${fileBase}.dxf`, result.dxf, "application/dxf")}>
                <Download size={16} /> Descargar DXF
              </button>
              <button type="button" style={btnGhost} onClick={() => downloadText(`${fileBase}.svg`, result.svg, "image/svg+xml")}>
                <FileDown size={16} /> Descargar SVG
              </button>
              <button type="button" style={{ ...btnPrimary, background: "#1a3a5c" }} onClick={cotizar}>
                <Calculator size={16} /> Cotizar este plano →
              </button>
            </div>
            <div style={{ fontSize: 11, color: "#aab", marginTop: 10 }}>DXF editable en AutoCAD/QCAD/FreeCAD/LibreCAD (capas AIA, cotas, metros). «Cotizar» abre el plano en la calculadora para presupuestarlo.</div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label: lbl, value, onChange, type = "number" }) {
  return (
    <div>
      <span style={label}>{lbl}</span>
      <input type={type} value={value} min={type === "number" ? 0 : undefined}
        onChange={(e) => onChange(e.target.value)} style={inp} />
    </div>
  );
}
