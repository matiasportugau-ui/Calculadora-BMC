import { useState } from "react";
import {
  Layers, SlidersHorizontal, Square, PanelLeft, Wrench, Command as CommandIcon,
  Calculator, Plus, Download, Search, Settings, ChevronRight, Check, X,
  Sparkles, Eye, Copy, FileText, Box, Ruler,
} from "lucide-react";

/* ============================================================
   BMC · Glass — Sistema de diseño Liquid Glass (showcase vivo)
   React + Tailwind (core) + backdrop-filter + SVG displacement.
   La refracción plena (url(#…)) es solo Chromium; el resto cae
   a blur sólido. El vidrio vive en el chrome; los datos, sólidos.
   ============================================================ */

const ACCENT = "57,183,214";     // ice cyan — acción primaria / clima
const WARM = "230,168,92";       // ámbar acero — alternativa secundaria

const TINTS = [
  { id: "neutro", label: "Neutro", rgb: "255,255,255" },
  { id: "frio", label: "Frío", rgb: "201,226,255" },
  { id: "marca", label: "Marca", rgb: ACCENT },
  { id: "calido", label: "Cálido", rgb: WARM },
];

function glassRootVars(t, reduce) {
  const frost = reduce ? 0.96 : t.frost;
  const blur = reduce ? 0 : t.blur;
  return {
    "--g-blur": `${blur}px`,
    "--g-frost": frost,
    "--g-sat": `${t.saturate}%`,
    "--g-radius": `${t.radius}px`,
    "--g-spec": reduce ? 0 : t.specular,
    "--g-tint": t.tint,
    "--g-edge": reduce ? 0.06 : 0.2,
  };
}

function Slider({ label, value, min, max, step = 1, suffix = "", onChange }) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[12px] tracking-wide text-slate-300">{label}</span>
        <span className="font-data text-[12px] text-cyan-200/90 tabular-nums">
          {value}{suffix}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-white/12"
        style={{ accentColor: `rgb(${ACCENT})` }}
      />
    </label>
  );
}

function Toggle({ label, hint, checked, onChange, icon: Icon }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="w-full flex items-center gap-3 text-left rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
    >
      {Icon && <Icon size={16} className="shrink-0 text-slate-300" />}
      <span className="flex-1 min-w-0">
        <span className="block text-[13px] text-slate-100 leading-tight">{label}</span>
        {hint && <span className="block text-[11px] text-slate-400 leading-tight mt-0.5">{hint}</span>}
      </span>
      <span
        className="shrink-0 w-9 h-5 rounded-full p-0.5 transition-colors"
        style={{ background: checked ? `rgb(${ACCENT})` : "rgba(255,255,255,0.16)" }}
      >
        <span
          className="block w-4 h-4 rounded-full bg-white transition-transform"
          style={{ transform: checked ? "translateX(16px)" : "translateX(0)" }}
        />
      </span>
    </button>
  );
}

/* Glass surface — el primitivo. variant solo cambia geometría/uso. */
function Glass({ as: Tag = "div", className = "", style = {}, refract, interactive, children, ...rest }) {
  return (
    <Tag
      className={`glass ${refract ? "glass-refract" : ""} ${interactive ? "glass-interactive" : ""} ${className}`}
      style={style}
      {...rest}
    >
      {children}
    </Tag>
  );
}

function SectionLabel({ n, children }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="font-data text-[11px] text-cyan-300/70">{n}</span>
      <span className="h-px flex-1 bg-white/10" />
    </div>
  );
}

export default function App() {
  const [t, setT] = useState({
    blur: 14, frost: 0.42, saturate: 165, radius: 20, specular: 0.5, displace: 24, tint: "255,255,255",
  });
  const [refract, setRefract] = useState(true);
  const [reduce, setReduce] = useState(false);
  const [bad, setBad] = useState(false);
  const [copied, setCopied] = useState(false);

  const set = (k) => (v) => setT((p) => ({ ...p, [k]: v }));
  const rootVars = glassRootVars(t, reduce);
  const liveRefract = refract && !reduce;

  const cssSnippet =
`:root {
  --g-blur: ${reduce ? 0 : t.blur}px;
  --g-frost: ${reduce ? 0.96 : t.frost};
  --g-saturate: ${t.saturate}%;
  --g-radius: ${t.radius}px;
  --g-specular: ${reduce ? 0 : t.specular};
  --g-tint: ${t.tint};
  --g-displace: ${t.displace};
}`;

  const copy = async () => {
    try { await navigator.clipboard.writeText(cssSnippet); setCopied(true); setTimeout(() => setCopied(false), 1600); }
    catch { setCopied(false); }
  };

  return (
    <div className="min-h-screen text-slate-100 font-body relative overflow-x-hidden" style={rootVars}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap');
        .font-display{font-family:'Space Grotesk',sans-serif}
        .font-body{font-family:'Inter',system-ui,sans-serif}
        .font-data{font-family:'JetBrains Mono',ui-monospace,monospace}
        body{margin:0}
        .app-bg{
          position:fixed;inset:0;z-index:0;
          background:
            radial-gradient(60% 55% at 12% 18%, rgba(45,212,223,0.30), transparent 60%),
            radial-gradient(55% 50% at 88% 12%, rgba(124,124,240,0.28), transparent 60%),
            radial-gradient(60% 60% at 78% 88%, rgba(52,211,153,0.20), transparent 62%),
            radial-gradient(50% 50% at 30% 92%, rgba(230,168,92,0.16), transparent 60%),
            #0a0f1e;
        }
        .app-bg::after{
          content:"";position:absolute;inset:0;
          background:
            radial-gradient(40% 40% at 50% 35%, rgba(255,255,255,0.05), transparent 70%);
          mix-blend-mode:screen;
        }
        .blob{position:absolute;border-radius:9999px;filter:blur(8px);opacity:.55;animation:drift 22s ease-in-out infinite}
        .blob.b2{animation-duration:30s;animation-direction:alternate}
        .blob.b3{animation-duration:26s}
        @keyframes drift{
          0%{transform:translate(0,0) scale(1)}
          50%{transform:translate(40px,-30px) scale(1.12)}
          100%{transform:translate(-20px,24px) scale(0.96)}
        }
        /* ----- el primitivo de vidrio ----- */
        .glass{
          position:relative;
          background:rgba(var(--g-tint), var(--g-frost));
          -webkit-backdrop-filter:saturate(var(--g-sat)) blur(var(--g-blur));
          backdrop-filter:saturate(var(--g-sat)) blur(var(--g-blur));
          border:1px solid rgba(255,255,255, var(--g-edge));
          border-radius:var(--g-radius);
          box-shadow:
            inset 0 1px 0 0 rgba(255,255,255, calc(var(--g-spec) * 0.85)),
            inset 0 -1px 1px 0 rgba(0,0,0,0.18),
            0 14px 38px -12px rgba(0,0,0,0.55);
        }
        .glass::before{
          content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;
          background:linear-gradient(135deg, rgba(255,255,255, calc(var(--g-spec)*0.55)) 0%, rgba(255,255,255,0) 42%);
        }
        .glass-refract{
          -webkit-backdrop-filter:saturate(var(--g-sat)) blur(var(--g-blur)) url(#bmcGlass);
          backdrop-filter:saturate(var(--g-sat)) blur(var(--g-blur)) url(#bmcGlass);
        }
        .glass-interactive{transition:transform .18s ease, box-shadow .18s ease, filter .18s ease;cursor:pointer}
        .glass-interactive:hover{transform:translateY(-1px)}
        .glass-interactive:active{transform:translateY(0) scale(.985)}
        .glass-interactive:focus-visible{outline:2px solid #fff;outline-offset:3px}
        @supports not ((-webkit-backdrop-filter:blur(1px)) or (backdrop-filter:blur(1px))){
          .glass{background:rgba(20,26,46,0.92)}
        }
        @media (prefers-reduced-motion: reduce){ .blob{animation:none} }
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 0 0 4px rgba(57,183,214,.35);cursor:pointer}
        .tnum{font-variant-numeric:tabular-nums}
      `}</style>

      {/* SVG displacement — scale reactivo al token --displace */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <filter id="bmcGlass" x="-25%" y="-25%" width="150%" height="150%">
          <feTurbulence type="fractalNoise" baseFrequency="0.011 0.013" numOctaves="2" seed="42" result="n" />
          <feGaussianBlur in="n" stdDeviation="1.5" result="sn" />
          <feDisplacementMap in="SourceGraphic" in2="sn" scale={t.displace} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>

      {/* fondo */}
      <div className="app-bg">
        <span className="blob" style={{ width: 340, height: 340, left: "6%", top: "12%", background: `rgb(${ACCENT})` }} />
        <span className="blob b2" style={{ width: 300, height: 300, right: "8%", top: "6%", background: "rgb(124,124,240)" }} />
        <span className="blob b3" style={{ width: 360, height: 360, right: "16%", bottom: "8%", background: "rgb(52,211,153)" }} />
      </div>

      {/* ---------- NAV (variante: nav) ---------- */}
      <div className="sticky top-0 z-30 px-3 sm:px-6 pt-3">
        <Glass as="nav" refract={liveRefract} className="mx-auto max-w-6xl flex items-center gap-2 px-3 sm:px-4 py-2.5" style={{ "--g-radius": "18px" }}>
          <div className="flex items-center gap-2 pr-2">
            <span className="grid place-items-center w-7 h-7 rounded-lg" style={{ background: `rgb(${ACCENT})` }}>
              <Layers size={15} className="text-slate-900" />
            </span>
            <span className="font-display font-600 text-[15px] tracking-tight">BMC<span className="text-cyan-300"> · Glass</span></span>
          </div>
          <div className="hidden md:flex items-center gap-1 ml-2 text-[13px] text-slate-300">
            {["Sistema", "Tokens", "Componentes", "Calculadora", "Accesibilidad"].map((x, i) => (
              <span key={x} className={`px-3 py-1.5 rounded-lg ${i === 1 ? "text-white bg-white/10" : "hover:text-white hover:bg-white/[0.06]"} cursor-default transition-colors`}>{x}</span>
            ))}
          </div>
          <div className="flex-1" />
          <button className="grid place-items-center w-9 h-9 rounded-lg hover:bg-white/[0.06] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" aria-label="Ajustes">
            <Settings size={16} className="text-slate-300" />
          </button>
        </Glass>
      </div>

      {/* ---------- HERO ---------- */}
      <header className="relative z-10 px-4 sm:px-6 pt-14 pb-10 max-w-6xl mx-auto">
        <p className="font-data text-[12px] tracking-[0.25em] text-cyan-300/80 mb-4">SISTEMA DE DISEÑO · v0.1</p>
        <h1 className="font-display font-700 tracking-tight leading-[0.95] text-[clamp(2.6rem,7vw,5rem)]">
          El vidrio en el chrome.<br />
          <span className="text-cyan-200">Los datos, sólidos.</span>
        </h1>
        <p className="mt-5 max-w-xl text-[15px] sm:text-[17px] text-slate-300 leading-relaxed">
          Liquid Glass como base estética reutilizable para la Calculadora-BMC y las landings.
          Translúcido solo en navegación, modales y acciones; nunca sobre tablas, inputs ni números.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Glass as="button" refract={liveRefract} interactive className="px-5 py-3 text-[14px] font-600 flex items-center gap-2"
            style={{ "--g-tint": ACCENT, "--g-frost": 0.5, "--g-radius": "14px", "--g-edge": 0.45 }}>
            Explorar tokens <ChevronRight size={16} />
          </Glass>
          <Glass as="button" refract={liveRefract} interactive className="px-5 py-3 text-[14px] font-500 text-slate-100" style={{ "--g-radius": "14px" }}>
            Ver reglas de uso
          </Glass>
        </div>
      </header>

      {/* ---------- PLAYGROUND ---------- */}
      <section className="relative z-10 px-4 sm:px-6 py-8 max-w-6xl mx-auto">
        <SectionLabel n="01 — TOKENS EN VIVO" />
        <h2 className="font-display font-600 text-[clamp(1.6rem,4vw,2.4rem)] tracking-tight mb-2">Probá los tokens</h2>
        <p className="text-slate-400 text-[14px] mb-7 max-w-lg">Movés un control y todas las superficies de vidrio de la página reaccionan. Estos son los valores que viajan a <span className="font-data text-cyan-200/90">@bmc/glass</span>.</p>

        <div className="grid lg:grid-cols-[320px_1fr] gap-5 items-start">
          {/* control deck */}
          <Glass refract={liveRefract} className="p-5 lg:sticky lg:top-24" style={{ "--g-radius": "22px" }}>
            <div className="space-y-4">
              <Slider label="Blur" value={t.blur} min={0} max={40} suffix="px" onChange={set("blur")} />
              <Slider label="Frost (opacidad tinte)" value={t.frost} min={0} max={1} step={0.02} onChange={set("frost")} />
              <Slider label="Saturación" value={t.saturate} min={100} max={240} suffix="%" onChange={set("saturate")} />
              <Slider label="Radio" value={t.radius} min={4} max={36} suffix="px" onChange={set("radius")} />
              <Slider label="Specular (brillo)" value={t.specular} min={0} max={1} step={0.05} onChange={set("specular")} />
              <Slider label="Displacement (refracción)" value={t.displace} min={0} max={120} onChange={set("displace")} />
            </div>

            <div className="mt-5">
              <span className="text-[12px] tracking-wide text-slate-300">Tinte</span>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {TINTS.map((tint) => (
                  <button key={tint.id} onClick={() => setT((p) => ({ ...p, tint: tint.rgb }))}
                    className={`h-9 rounded-lg border text-[11px] transition-all ${t.tint === tint.rgb ? "border-white/70" : "border-white/10 hover:border-white/30"}`}
                    style={{ background: `rgba(${tint.rgb},0.5)` }} aria-label={tint.label}>
                    <span className="sr-only">{tint.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-white/10 space-y-1">
              <Toggle label="Refracción (enhancement)" hint="SVG displacement · solo Chromium" checked={refract} onChange={setRefract} icon={Sparkles} />
              <Toggle label="Reducir transparencia" hint="prefers-reduced-transparency → sólido" checked={reduce} onChange={setReduce} icon={Eye} />
            </div>
          </Glass>

          {/* previews vivas */}
          <div className="space-y-4">
            <Glass refract={liveRefract} className="p-6" style={{ "--g-radius": "22px" }}>
              <div className="flex items-start gap-4">
                <span className="grid place-items-center w-11 h-11 rounded-xl shrink-0" style={{ background: `rgba(${ACCENT},0.22)` }}>
                  <Box size={20} className="text-cyan-200" />
                </span>
                <div>
                  <h3 className="font-display font-600 text-[18px]">Tarjeta de vidrio</h3>
                  <p className="text-slate-300 text-[14px] mt-1 leading-relaxed max-w-md">
                    La superficie base. El texto encima mantiene su contraste con un backplate; el fondo se difumina sin congelarse.
                  </p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Glass as="button" refract={liveRefract} interactive className="px-4 py-2 text-[13px] font-600 flex items-center gap-1.5"
                  style={{ "--g-tint": ACCENT, "--g-frost": 0.5, "--g-radius": "11px", "--g-edge": 0.45 }}>
                  <Plus size={15} /> Acción primaria
                </Glass>
                <Glass as="button" refract={liveRefract} interactive className="px-4 py-2 text-[13px] font-500" style={{ "--g-radius": "11px" }}>
                  Secundaria
                </Glass>
                <button disabled className="px-4 py-2 text-[13px] rounded-[11px] bg-white/[0.04] text-slate-500 border border-white/5 cursor-not-allowed">
                  Deshabilitada
                </button>
              </div>
            </Glass>

            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { k: "m² cotizados", v: "1.284", Icon: Ruler },
                { k: "Paneles", v: "342", Icon: Box },
                { k: "Accesorios", v: "57", Icon: Wrench },
              ].map(({ k, v, Icon }) => (
                <Glass key={k} refract={liveRefract} className="p-4" style={{ "--g-radius": "16px" }}>
                  <Icon size={16} className="text-cyan-200/80" />
                  <div className="font-data font-600 text-[26px] mt-2 tnum">{v}</div>
                  <div className="text-[12px] text-slate-400 mt-0.5">{k}</div>
                </Glass>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------- COMPONENTES ---------- */}
      <section className="relative z-10 px-4 sm:px-6 py-8 max-w-6xl mx-auto">
        <SectionLabel n="02 — COMPONENTES" />
        <h2 className="font-display font-600 text-[clamp(1.6rem,4vw,2.4rem)] tracking-tight mb-7">El set de variantes</h2>

        <div className="grid md:grid-cols-2 gap-4">
          {/* toolbar flotante */}
          <Glass refract={liveRefract} className="p-5 flex flex-col" style={{ "--g-radius": "20px" }}>
            <div className="flex items-center gap-2 mb-4 text-slate-400"><Wrench size={14} /><span className="font-data text-[11px] tracking-wide">TOOLBAR FLOTANTE</span></div>
            <div className="mt-auto flex items-center gap-1.5 self-start rounded-2xl p-1.5" style={{ background: "rgba(255,255,255,0.05)" }}>
              {[Calculator, FileText, Download].map((Ic, i) => (
                <Glass key={i} as="button" refract={liveRefract} interactive className="grid place-items-center w-10 h-10" style={{ "--g-radius": "12px", "--g-frost": i === 0 ? 0.5 : t.frost, "--g-tint": i === 0 ? ACCENT : t.tint }}>
                  <Ic size={17} className={i === 0 ? "text-white" : "text-slate-200"} />
                </Glass>
              ))}
            </div>
          </Glass>

          {/* command palette */}
          <Glass refract={liveRefract} className="p-5" style={{ "--g-radius": "20px" }}>
            <div className="flex items-center gap-2 mb-4 text-slate-400"><CommandIcon size={14} /><span className="font-data text-[11px] tracking-wide">COMMAND PALETTE</span></div>
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: "rgba(255,255,255,0.06)" }}>
              <Search size={15} className="text-slate-400" />
              <span className="text-[14px] text-slate-300">Buscar producto o accesorio…</span>
            </div>
            <div className="mt-2 space-y-0.5">
              {["ISODEC EPS 100mm", "ISOROOF 5 grecas", "Tornillo autoperforante"].map((x, i) => (
                <div key={x} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] ${i === 0 ? "bg-white/10 text-white" : "text-slate-300"}`}>
                  <Box size={14} className="text-cyan-200/70" /> {x}
                  {i === 0 && <ChevronRight size={14} className="ml-auto text-slate-400" />}
                </div>
              ))}
            </div>
          </Glass>

          {/* sheet / modal */}
          <Glass refract={liveRefract} className="p-5" style={{ "--g-radius": "20px" }}>
            <div className="flex items-center gap-2 mb-4 text-slate-400"><Square size={14} /><span className="font-data text-[11px] tracking-wide">SHEET / MODAL</span></div>
            <h4 className="font-display font-600 text-[16px]">Agregar accesorio</h4>
            <p className="text-[13px] text-slate-400 mt-1">El chrome del modal es vidrio; los campos, sólidos.</p>
            <div className="mt-3 space-y-2">
              <div className="px-3 py-2 rounded-lg text-[13px] text-slate-200" style={{ background: "#0e1424", border: "1px solid rgba(255,255,255,0.08)" }}>Cantidad · <span className="font-data">24</span></div>
              <div className="flex gap-2">
                <Glass as="button" refract={liveRefract} interactive className="flex-1 py-2 text-[13px] font-600 text-center" style={{ "--g-tint": ACCENT, "--g-frost": 0.5, "--g-radius": "11px", "--g-edge": 0.45 }}>Confirmar</Glass>
                <button className="px-4 py-2 text-[13px] rounded-[11px] text-slate-300 hover:bg-white/[0.06]">Cancelar</button>
              </div>
            </div>
          </Glass>

          {/* estados de botón */}
          <Glass refract={liveRefract} className="p-5" style={{ "--g-radius": "20px" }}>
            <div className="flex items-center gap-2 mb-4 text-slate-400"><PanelLeft size={14} /><span className="font-data text-[11px] tracking-wide">ESTADOS · BOTÓN</span></div>
            <div className="grid grid-cols-2 gap-2.5 text-[13px]">
              <Glass refract={liveRefract} className="py-2.5 text-center font-500" style={{ "--g-radius": "11px" }}>default</Glass>
              <Glass refract={liveRefract} className="py-2.5 text-center font-500" style={{ "--g-radius": "11px", "--g-frost": Math.min(1, t.frost + 0.12), "--g-spec": Math.min(1, t.specular + 0.2) }}>hover</Glass>
              <Glass refract={liveRefract} className="py-2.5 text-center font-500" style={{ "--g-radius": "11px", transform: "scale(0.97)", "--g-frost": Math.min(1, t.frost + 0.18) }}>active</Glass>
              <div className="py-2.5 text-center rounded-[11px] text-slate-500 bg-white/[0.04] border border-white/5">disabled</div>
            </div>
            <p className="text-[11px] text-slate-500 mt-3">Foco visible siempre por encima del vidrio (probá con <span className="font-data">Tab</span>).</p>
          </Glass>
        </div>
      </section>

      {/* ---------- CASO CALCULADORA ---------- */}
      <section className="relative z-10 px-4 sm:px-6 py-8 max-w-6xl mx-auto">
        <SectionLabel n="03 — CASO CALCULADORA-BMC" />
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="font-display font-600 text-[clamp(1.6rem,4vw,2.4rem)] tracking-tight">Dónde va el vidrio</h2>
            <p className="text-slate-400 text-[14px] mt-2 max-w-md">Chrome translúcido, datos sólidos. Cambiá el modo y mirá qué pasa con la legibilidad de los números.</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl p-1" style={{ background: "rgba(255,255,255,0.06)" }}>
            <button onClick={() => setBad(false)} className={`px-3 py-1.5 rounded-lg text-[12px] font-600 flex items-center gap-1.5 transition-colors ${!bad ? "text-slate-900" : "text-slate-300"}`} style={{ background: !bad ? `rgb(${ACCENT})` : "transparent" }}>
              <Check size={14} /> Correcto
            </button>
            <button onClick={() => setBad(true)} className={`px-3 py-1.5 rounded-lg text-[12px] font-600 flex items-center gap-1.5 transition-colors ${bad ? "text-white" : "text-slate-300"}`} style={{ background: bad ? "rgb(225,72,72)" : "transparent" }}>
              <X size={14} /> Incorrecto
            </button>
          </div>
        </div>

        <Glass refract={liveRefract} className="overflow-hidden" style={{ "--g-radius": "22px", padding: 0 }}>
          {/* barra superior del cotizador — vidrio (chrome) */}
          <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 border-b border-white/10"
            style={{ background: "rgba(var(--g-tint), calc(var(--g-frost) * 0.7))", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}>
            <Calculator size={16} className="text-cyan-200" />
            <span className="font-display font-600 text-[14px]">Cotizador · Obra Maldonado</span>
            <span className="ml-auto font-data text-[12px] text-slate-300 tnum">USD 18.940</span>
          </div>

          {/* tabla de datos — SÓLIDA en correcto, vidrio fino en incorrecto */}
          <div className="max-h-[260px] overflow-auto" style={{ background: bad ? "transparent" : "#0c1322" }}>
            <table className="w-full text-left">
              <thead className="sticky top-0">
                <tr className="text-[11px] uppercase tracking-wide text-slate-400" style={{ background: bad ? "transparent" : "#0e1626" }}>
                  <th className="px-4 py-2.5 font-500">Producto</th>
                  <th className="px-4 py-2.5 font-500">Espesor</th>
                  <th className="px-4 py-2.5 font-500 text-right">m²</th>
                  <th className="px-4 py-2.5 font-500 text-right">Precio</th>
                </tr>
              </thead>
              <tbody className="font-data text-[13px]">
                {[
                  ["ISODEC EPS", "100 mm", "420,0", "6.300"],
                  ["ISOROOF", "5 grecas", "318,5", "5.412"],
                  ["ISOPANEL", "150 mm", "204,0", "4.488"],
                  ["ISOWALL", "80 mm", "188,0", "2.444"],
                  ["Accesorios", "varios", "—", "296"],
                ].map((row, i) => (
                  <tr key={i} className="border-t border-white/[0.06]"
                    style={{ background: bad ? "transparent" : (i % 2 ? "rgba(255,255,255,0.015)" : "transparent") }}>
                    <td className="px-4 py-2.5 text-slate-100 font-body">{row[0]}</td>
                    <td className="px-4 py-2.5 text-slate-300">{row[1]}</td>
                    <td className="px-4 py-2.5 text-right text-slate-200 tnum">{row[2]}</td>
                    <td className="px-4 py-2.5 text-right text-cyan-200 tnum">{row[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* toolbar inferior flotante — vidrio */}
          <div className="flex items-center gap-2 px-4 py-3 border-t border-white/10" style={{ background: "rgba(var(--g-tint), calc(var(--g-frost) * 0.6))", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}>
            <Glass as="button" refract={liveRefract} interactive className="px-4 py-2 text-[13px] font-600 flex items-center gap-1.5" style={{ "--g-tint": ACCENT, "--g-frost": 0.5, "--g-radius": "11px", "--g-edge": 0.45 }}>
              <Calculator size={15} /> Calcular
            </Glass>
            <Glass as="button" refract={liveRefract} interactive className="px-4 py-2 text-[13px] font-500 flex items-center gap-1.5" style={{ "--g-radius": "11px" }}>
              <Download size={15} /> Exportar PDF
            </Glass>
          </div>
        </Glass>

        <div className={`mt-4 flex items-start gap-2.5 text-[13px] rounded-xl px-4 py-3 ${bad ? "text-red-200" : "text-emerald-200"}`}
          style={{ background: bad ? "rgba(225,72,72,0.12)" : "rgba(52,211,153,0.10)", border: `1px solid ${bad ? "rgba(225,72,72,0.3)" : "rgba(52,211,153,0.25)"}` }}>
          {bad ? <X size={16} className="mt-0.5 shrink-0" /> : <Check size={16} className="mt-0.5 shrink-0" />}
          <span>
            {bad
              ? "Vidrio sobre los datos: los números pelean contra el fondo y el contraste cae por debajo de 4.5:1. Regla rota."
              : "Vidrio solo en barra superior, toolbar y acciones. La tabla queda sólida y los números, perfectamente legibles."}
          </span>
        </div>
      </section>

      {/* ---------- ACCESIBILIDAD + EXPORT ---------- */}
      <section className="relative z-10 px-4 sm:px-6 py-8 pb-16 max-w-6xl mx-auto grid lg:grid-cols-2 gap-5 items-start">
        <Glass refract={liveRefract} className="p-6" style={{ "--g-radius": "22px" }}>
          <SectionLabel n="04 — ACCESIBILIDAD" />
          <h3 className="font-display font-600 text-[20px] mb-2">Incorporada, no agregada</h3>
          <p className="text-slate-400 text-[14px] leading-relaxed mb-4">
            El sistema responde a <span className="font-data text-cyan-200/90">prefers-reduced-transparency</span>,
            <span className="font-data text-cyan-200/90"> -motion</span> y <span className="font-data text-cyan-200/90">-contrast</span>.
            Activá el modo sólido y mirá cómo el vidrio se vuelve opaco sin romper el layout.
          </p>
          <Toggle label="Reducir transparencia" hint="swap a fondo sólido + sin specular" checked={reduce} onChange={setReduce} icon={Eye} />
          <ul className="mt-4 space-y-2 text-[13px] text-slate-300">
            {["Texto siempre ≥ 4.5:1 con backplate", "Foco visible por encima del vidrio", "Sin movimiento si se pide reduce-motion", "Fallback sólido donde no hay backdrop-filter"].map((x) => (
              <li key={x} className="flex items-center gap-2"><Check size={15} className="text-emerald-300 shrink-0" /> {x}</li>
            ))}
          </ul>
        </Glass>

        <Glass refract={liveRefract} className="p-6" style={{ "--g-radius": "22px" }}>
          <SectionLabel n="05 — EXPORT" />
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-600 text-[20px]">Tus tokens</h3>
            <button onClick={copy} className="flex items-center gap-1.5 text-[12px] font-600 px-3 py-1.5 rounded-lg transition-colors"
              style={{ background: copied ? "rgba(52,211,153,0.2)" : "rgba(255,255,255,0.08)", color: copied ? "rgb(110,231,183)" : "#e2e8f0" }}>
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copiado" : "Copiar CSS"}
            </button>
          </div>
          <pre className="font-data text-[12px] leading-relaxed text-cyan-100/90 rounded-xl p-4 overflow-x-auto" style={{ background: "#0a0f1c", border: "1px solid rgba(255,255,255,0.08)" }}>
{cssSnippet}
          </pre>
          <p className="text-[11px] text-slate-500 mt-3">Estos custom properties son la fuente de verdad; Tailwind v4 los mapea con <span className="font-data">@theme</span>.</p>
        </Glass>
      </section>

      <footer className="relative z-10 px-6 pb-10 text-center text-[12px] text-slate-500">
        <p>BMC · Glass — hand-rolled · React + Tailwind · <span className="font-data">backdrop-filter</span> + SVG displacement.</p>
        <p className="mt-1">La refracción plena es solo Chromium; el resto cae a blur sólido, sin errores.</p>
      </footer>
    </div>
  );
}
