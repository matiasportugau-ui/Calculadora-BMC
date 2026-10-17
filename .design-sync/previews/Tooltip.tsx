import { Tooltip, HELP_ANCHORS } from "calculadora-bmc-primitives";

// Opens on hover/focus — static capture shows the closed state (real child
// content, no visible tooltip bubble). See NOTES.md "Known render warns".
// Must be wrapped in .adminCot; real anchor ids only; children must be a
// single valid React element (Tooltip clones it to inject aria-describedby).

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="adminCot" style={{ padding: 16 }}>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 2 }} tabIndex={0}>
      <strong style={{ fontSize: 20 }}>{value}</strong>
      <span style={{ fontSize: 12, color: "var(--ac-text-2)" }}>{label}</span>
    </span>
  );
}

export function OverStat() {
  return (
    <Wrap>
      <Tooltip id={HELP_ANCHORS.KPI_STALE}>
        <Stat label="≥14 días sin enviar" value="5" />
      </Tooltip>
    </Wrap>
  );
}

export function PlacementRight() {
  return (
    <Wrap>
      <Tooltip id={HELP_ANCHORS.TOPBAR_LIVE} placement="right">
        <Stat label="Conexión en vivo" value="●" />
      </Tooltip>
    </Wrap>
  );
}
