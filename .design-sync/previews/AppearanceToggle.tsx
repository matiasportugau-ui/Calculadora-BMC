import { AppearanceToggle } from "calculadora-bmc-primitives";

// Renders via the outer BmcAppearanceProvider (cfg.provider) — no props
// required for the provider itself; `compact` is the component's own axis.

function Backdrop({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--g-bg-page)", padding: 24, display: "flex", gap: 16, alignItems: "center" }}>
      {children}
    </div>
  );
}

export function Default() {
  return (
    <Backdrop>
      <AppearanceToggle />
    </Backdrop>
  );
}

export function Compact() {
  return (
    <Backdrop>
      <AppearanceToggle compact />
    </Backdrop>
  );
}
