import { Callout, HELP_ANCHORS } from "calculadora-bmc-primitives";

// help/styles.css selectors are all `.adminCot .acHelp-*` — every composition
// MUST be wrapped in <div className="adminCot"> or none of the CSS matches.
// Ids must be one of the 6 real HelpProvider FALLBACK_SOURCE entries (any
// other id renders null by design) — see NOTES.md.

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="adminCot" style={{ padding: 16, maxWidth: 420 }}>
      {children}
    </div>
  );
}

export function Info() {
  return (
    <Wrap>
      <Callout id={HELP_ANCHORS.DRAWER_REGENERATE_HINT} variant="info" />
    </Wrap>
  );
}

export function Warn() {
  return (
    <Wrap>
      <Callout id={HELP_ANCHORS.KPI_ERROR} variant="warn" />
    </Wrap>
  );
}

export function Dismissible() {
  return (
    <Wrap>
      <Callout id={HELP_ANCHORS.KPI_STALE} variant="success" dismissible />
    </Wrap>
  );
}
