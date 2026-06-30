import { useState } from "react";
import Glass from "./Glass.jsx";
import GlassFilterSvg from "./GlassFilterSvg.jsx";

const DEFAULT = {
  blur: 14, frost: 0.42, saturate: 165, radius: 20, specular: 0.5, displace: 24, tint: "255,255,255",
};

export default function GlassDesignShowcase() {
  const [t, setT] = useState(DEFAULT);
  const [refract, setRefract] = useState(true);
  const [bad, setBad] = useState(false);

  const rootStyle = {
    "--g-blur": `${t.blur}px`,
    "--g-frost": t.frost,
    "--g-sat": `${t.saturate}%`,
    "--g-radius": `${t.radius}px`,
    "--g-spec": t.specular,
    "--g-tint": t.tint,
    minHeight: "100vh",
    padding: 24,
    background: "var(--g-bg-page)",
    color: "var(--g-text)",
  };

  return (
    <div style={rootStyle}>
      <GlassFilterSvg displace={t.displace} />
      <h1 style={{ margin: "0 0 8px", fontSize: 28 }}>BMC · Glass — Sistema de diseño</h1>
      <p style={{ color: "var(--g-text-2)", maxWidth: 560 }}>
        Vidrio en el chrome; datos sólidos. Tokens en vivo — producción usa <code>src/styles/bmc-glass.css</code>.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 320px) 1fr", gap: 20, marginTop: 24 }}>
        <Glass refract={refract} style={{ padding: 16 }}>
          <label style={{ display: "block", fontSize: 12, marginBottom: 12 }}>
            Blur {t.blur}px
            <input type="range" min={0} max={40} value={t.blur} onChange={(e) => setT((p) => ({ ...p, blur: +e.target.value }))} style={{ width: "100%" }} />
          </label>
          <label style={{ display: "block", fontSize: 12, marginBottom: 12 }}>
            Frost {t.frost}
            <input type="range" min={0} max={1} step={0.02} value={t.frost} onChange={(e) => setT((p) => ({ ...p, frost: +e.target.value }))} style={{ width: "100%" }} />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={refract} onChange={(e) => setRefract(e.target.checked)} />
            Refracción SVG (Chromium)
          </label>
        </Glass>

        <div>
          <Glass as="nav" refract={refract} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", marginBottom: 16 }}>
            <strong style={{ color: "rgb(var(--g-brand))" }}>BMC Uruguay</strong>
            <span style={{ marginLeft: "auto", fontSize: 12 }}>USD 18.940</span>
          </Glass>

          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button type="button" onClick={() => setBad(false)} style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: bad ? "#eee" : "rgb(var(--g-accent))", color: bad ? "#333" : "#fff" }}>Correcto</button>
            <button type="button" onClick={() => setBad(true)} style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: bad ? "#dc2626" : "#eee", color: bad ? "#fff" : "#333" }}>Incorrecto</button>
          </div>

          <Glass style={{ padding: 0, overflow: "hidden" }}>
            <div className="glass glass-minimal" style={{ padding: "10px 14px", borderRadius: 0, border: "none" }}>Cotizador · demo</div>
            <div className={bad ? "" : "glass-content-solid"} style={bad ? { backdropFilter: "blur(6px)" } : { background: "var(--g-solid-table)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <tbody>
                  <tr><td style={{ padding: 10 }}>ISODEC EPS</td><td style={{ padding: 10, textAlign: "right" }}>6.300</td></tr>
                  <tr><td style={{ padding: 10 }}>ISOROOF</td><td style={{ padding: 10, textAlign: "right" }}>5.412</td></tr>
                </tbody>
              </table>
            </div>
          </Glass>
        </div>
      </div>
    </div>
  );
}
