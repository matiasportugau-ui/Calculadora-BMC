import { Glass, GlassFilterSvg } from "calculadora-bmc-primitives";

// GlassFilterSvg has no standalone visual output by design (it's a 0x0
// absolutely-positioned <svg><filter> def, consumed by .glass-refract via
// `backdrop-filter: ... url(#bmcGlass)`). Composed here inside the real
// parent it's meant to pair with — the only render of this component that's
// actually true to its purpose. See NOTES.md.
//
// data-appearance="night" exercises this repo's real dark-mode tokens (see
// Glass.tsx preview header) — day-mode's white-on-#f5f5f7 frost is too
// subtle to read the refraction/blur effect in a static screenshot.

export function InRefractContext() {
  return (
    <div
      data-appearance="night"
      style={{ background: "var(--g-bg-page)", color: "var(--g-text)", padding: 24, minHeight: 160 }}
    >
      <Glass refract interactive style={{ padding: 16, maxWidth: 280 }}>
        <strong style={{ display: "block", marginBottom: 8 }}>Refracción SVG activa</strong>
        <span style={{ fontSize: 13, color: "var(--g-text-2)" }}>
          El filtro <code>#bmcGlass</code> deforma el fondo detrás de este panel (Chromium).
        </span>
      </Glass>
      <GlassFilterSvg displace={24} />
    </div>
  );
}
