import { Glass, GlassFilterSvg } from "calculadora-bmc-primitives";

// Composition ported from the repo's own canonical reference,
// src/components/glass/GlassDesignShowcase.jsx — the real usage patterns
// for this primitive (panel, nav bar, solid-content table), simplified to
// static content (the showcase's live range-slider controls aren't part of
// the primitive's own API).
//
// The day-mode tokens (--g-frost: 0.42 white-on-#f5f5f7) are intentionally
// subtle by design — real production values, not a rendering bug — but too
// low-contrast to read as "styled" in a static screenshot. [data-appearance]
// is a real, already-shipped feature (BmcAppearanceProvider / the
// AppearanceToggle this family also ships) and a plain descendant attribute
// selector in bmc-glass.css (not :root-locked), so wrapping a cell in
// data-appearance="night" exercises the actual dark-mode tokens rather than
// inventing a demo backdrop — white-on-#0a0f1e makes the frost/blur/edge
// legible. One cell is kept in day mode so the real default is represented
// too. See conventions.md.

function Backdrop({ night = false, children }: { night?: boolean; children: React.ReactNode }) {
  return (
    <div
      data-appearance={night ? "night" : "day"}
      style={{
        background: "var(--g-bg-page)",
        color: "var(--g-text)",
        padding: 24,
        minHeight: 160,
      }}
    >
      {children}
    </div>
  );
}

export function Panel() {
  return (
    <Backdrop night>
      <Glass refract style={{ padding: 16, maxWidth: 280 }}>
        <strong style={{ display: "block", marginBottom: 8 }}>BMC Uruguay</strong>
        <span style={{ fontSize: 13, color: "var(--g-text-2)" }}>
          Panel de vidrio — contenido flotante sobre el fondo de página.
        </span>
      </Glass>
      <GlassFilterSvg />
    </Backdrop>
  );
}

export function NavBar() {
  return (
    <Backdrop night>
      <Glass as="nav" refract style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px" }}>
        <strong style={{ color: "rgb(var(--g-brand))" }}>BMC Uruguay</strong>
        <span style={{ marginLeft: "auto", fontSize: 12 }}>USD 18.940</span>
      </Glass>
      <GlassFilterSvg />
    </Backdrop>
  );
}

export function ContentSolidDay() {
  return (
    <Backdrop>
      <Glass style={{ padding: 0, overflow: "hidden", maxWidth: 320 }}>
        <div className="glass glass-minimal" style={{ padding: "10px 14px", borderRadius: 0, border: "none" }}>
          Cotizador · ISODEC / ISOROOF
        </div>
        <div className="glass-content-solid">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <tbody>
              <tr>
                <td style={{ padding: 10 }}>ISODEC EPS</td>
                <td style={{ padding: 10, textAlign: "right" }}>6.300</td>
              </tr>
              <tr>
                <td style={{ padding: 10 }}>ISOROOF</td>
                <td style={{ padding: 10, textAlign: "right" }}>5.412</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Glass>
    </Backdrop>
  );
}
